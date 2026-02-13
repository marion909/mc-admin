import fs from 'fs/promises';
import path from 'path';
import { dockerService } from './dockerService.js';

export class FileService {
    
    // Securely get the absolute path to a file inside the server's data directory
    private async resolvePath(containerId: string, relativePath: string = '.') {
        const info = await dockerService.getContainerInfo(containerId);
        
        console.log(`[FileService] Inspecting container ${containerId}`);
        // console.log(`[FileService] Info keys:`, Object.keys(info));

        let rootDir: string | undefined;

        // Strategy 1: Look in Mounts (standard)
        if (info.Mounts && Array.isArray(info.Mounts)) {
            const mount = info.Mounts.find((m: any) => m.Destination === '/data' || m.Destination === '/server');
            if (mount) {
                console.log(`[FileService] Found mount via info.Mounts at ${mount.Destination}`);
                rootDir = this.mapHostToContainerPath(mount.Source);
            }
        }

        // Strategy 2: Look in HostConfig.Binds (fallback)
        if (!rootDir && info.HostConfig && Array.isArray(info.HostConfig.Binds)) {
             console.log('[FileService] Looking in HostConfig.Binds');
             const bind = info.HostConfig.Binds.find((b: string) => b.includes(':/data') || b.includes(':/server'));
             if (bind) {
                 // Format: "C:\Path\To\Data:/data" or "/host/path:/data"
                 
                 const parts = bind.split(':');
                 
                 // If the last part is options (ro, rw), ignore it.
                 // We look for the part that IS '/data' or '/server'.
                 let dataIndex = parts.indexOf('/data');
                 if (dataIndex === -1) dataIndex = parts.indexOf('/server');

                 if (dataIndex > 0) {
                     // Reassemble host part
                     const hostPath = parts.slice(0, dataIndex).join(':');
                     rootDir = this.mapHostToContainerPath(hostPath);
                 }
                 
                 console.log('[FileService] Found rootDir via Binds:', rootDir);
             }
        }

        if (!rootDir) {
             console.error('[FileService] Failed to find /data or /server mount. Mounts:', JSON.stringify(info.Mounts), 'Binds:', JSON.stringify(info.HostConfig?.Binds));
             throw new Error('Container has no /data or /server volume mount');
        }

        // Normalize path and fix Windows drive letter capitalization for comparison
        rootDir = path.resolve(rootDir); 
        const targetPath = path.resolve(rootDir, relativePath);

        console.log(`[FileService] Path Check: Root=${rootDir}, Target=${targetPath}`);

        // Security Check: Prevent directory traversal (Case-insensitive for Windows)
        // Check if platform is win32, or just be safe and do both checks
        const isChild = targetPath.startsWith(rootDir) || 
                       (process.platform === 'win32' && targetPath.toLowerCase().startsWith(rootDir.toLowerCase()));

        if (!isChild) {
            throw new Error(`Access denied: Path is outside server directory. Root: ${rootDir}, Target: ${targetPath}`);
        }

        try {
            await fs.access(targetPath);
        } catch {
            // If path doesn't exist, it might be a valid new file creation request, 
            // but for listFiles it will fail later.
            // Let it pass here, the caller will handle ENOENT
        }

        return targetPath;
    }

    async listFiles(containerId: string, dirPath: string = '.') {
        const absPath = await this.resolvePath(containerId, dirPath);
        const stats = await fs.stat(absPath);
        
        if (!stats.isDirectory()) {
            throw new Error('Path is not a directory');
        }

        const entries = await fs.readdir(absPath, { withFileTypes: true });
        
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: entry.isDirectory() ? 0 : 0, // Getting size requires stat per file, skipping for perf
            path: path.join(dirPath, entry.name).replace(/\\/g, '/')
        })).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });
    }

    async readFile(containerId: string, filePath: string) {
        const absPath = await this.resolvePath(containerId, filePath);
        return await fs.readFile(absPath, 'utf-8');
    }

    async writeFile(containerId: string, filePath: string, content: string) {
        const absPath = await this.resolvePath(containerId, filePath);
        await fs.writeFile(absPath, content, 'utf-8');
    }

    async deleteEntry(containerId: string, entryPath: string) {
        const absPath = await this.resolvePath(containerId, entryPath);
        const stats = await fs.stat(absPath);
        
        if (stats.isDirectory()) {
            // Delete directory recursively
            await fs.rm(absPath, { recursive: true, force: true });
        } else {
            // Delete file
            await fs.unlink(absPath);
        }
    }

    getServerDataDir(containerInfo: any): string {
        // Extract data directory from container info
        if (containerInfo.Mounts && Array.isArray(containerInfo.Mounts)) {
            const mount = containerInfo.Mounts.find((m: any) => m.Destination === '/data' || m.Destination === '/server');
            if (mount) {
                return this.mapHostToContainerPath(mount.Source);
            }
        }

        if (containerInfo.HostConfig && Array.isArray(containerInfo.HostConfig.Binds)) {
            const bind = containerInfo.HostConfig.Binds.find((b: string) => b.includes(':/data') || b.includes(':/server'));
            if (bind) {
                const parts = bind.split(':');
                const destIndex = parts.findIndex((p: string) => p === '/data' || p === '/server');
                if (destIndex > 0) {
                    const hostSource = parts.slice(0, destIndex).join(':');
                    return this.mapHostToContainerPath(hostSource);
                }
            }
        }

        throw new Error('Could not find data directory for container');
    }

    private mapHostToContainerPath(hostPath: string): string {
        // Check if we're running inside a Docker container
        // If CONTAINER_DATA_PATH is set, we're definitely in a container
        const containerDataPath = process.env.CONTAINER_DATA_PATH || '/app/data/servers';
        
        // Simple check: if the path starts with a Windows drive letter or looks like a Windows path,
        // and we have an environment variable indicating we're in a container, use the container path
        const isWindowsPath = /^[A-Za-z]:|\\/.test(hostPath);
        
        if (isWindowsPath) {
            // We're seeing a Windows host path, but we're in a Linux container
            // Extract just the server name from the end of the path
            const parts = hostPath.replace(/\\/g, '/').split('/');
            const serverName = parts[parts.length - 1];
            
            // Return the container path
            const result = path.join(containerDataPath, serverName);
            console.log(`[FileService] Mapped Windows host path '${hostPath}' to container path '${result}'`);
            return result;
        }

        // Legacy mapping logic for non-Windows paths
        const hostRoot = process.env.HOST_DATA_PATH;

        if (hostRoot) {
            // Normalize paths for comparison (handle Windows backslashes)
            const normHostPath = hostPath.replace(/\\/g, '/');
            const normHostRoot = hostRoot.replace(/\\/g, '/');

            // Check if this path is within our known host data root
            if (normHostPath.toLowerCase().startsWith(normHostRoot.toLowerCase())) {
                const relative = normHostPath.slice(normHostRoot.length).replace(/^\/+/, '');
                const result = path.join(containerDataPath, relative);
                console.log(`[FileService] Mapped host path '${hostPath}' to container path '${result}'`);
                return result;
            }
        }
        
        // If no mapping or no match, return as is
        return hostPath;
    }
}


export const fileService = new FileService();
