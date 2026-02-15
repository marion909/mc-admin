import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Docker from 'dockerode';
import { DockerService } from './dockerService.js';
import { FileService } from './fileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BackupInfo {
    filename: string;
    type: 'server' | 'proxy' | 'database' | 'full';
    name: string;
    timestamp: string;
    size: number;
    date: Date;
}

export class BackupService {
    private backupDir: string;
    private docker: Docker;
    private dockerService: DockerService;
    private fileService: FileService;

    constructor() {
        // Use /app/data/backups inside container, fallback to local for development
        this.backupDir = process.env.NODE_ENV === 'production' 
            ? '/app/data/backups' 
            : path.join(__dirname, '..', 'data', 'backups');
        
        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        // Initialize Docker client
        const isWindows = process.platform === 'win32';
        const socketPath = isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock';
        this.docker = new Docker({ socketPath });
        
        this.dockerService = new DockerService();
        this.fileService = new FileService();
    }

    /**
     * Create backup of a single container (server, proxy, or database)
     */
    async createBackup(containerId: string): Promise<{ filename: string; path: string; size: number }> {
        try {
            // Get container info
            const containerInfo = await this.dockerService.getContainerInfo(containerId);
            const containerName = containerInfo.Name.replace('/', '');
            
            // Determine type
            let type: 'server' | 'proxy' | 'database' = 'server';
            if (containerName.startsWith('proxy-')) {
                type = 'proxy';
            } else if (containerName.startsWith('db-')) {
                type = 'database';
            }

            // Get source directory on host
            const sourceDir = this.fileService.getServerDataDir(containerInfo);
            if (!sourceDir) {
                throw new Error(`Could not determine data directory for ${containerName}`);
            }

            // Create backup filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + 
                             new Date().toTimeString().split(' ')[0].replace(/:/g, '');
            const filename = `${type}-${containerName}-${timestamp}.tar.gz`;
            const backupPath = path.join(this.backupDir, filename);

            console.log(`[Backup] Creating backup of ${containerName} from ${sourceDir} to ${backupPath}`);

            // Create archive
            await this.createArchive(sourceDir, backupPath, type);

            // Get file size
            const stats = fs.statSync(backupPath);
            
            console.log(`[Backup] Backup created successfully: ${filename} (${this.formatBytes(stats.size)})`);

            return {
                filename,
                path: backupPath,
                size: stats.size
            };
        } catch (error: any) {
            console.error('[Backup] Error creating backup:', error);
            throw error;
        }
    }

    /**
     * Create full backup of all containers
     */
    async createFullBackup(): Promise<{ filename: string; path: string; size: number; count: number }> {
        try {
            console.log('[Backup] Starting full backup of all containers...');

            // Get all containers
            const allContainers = await this.docker.listContainers({ all: true });
            const managedContainers = allContainers.filter((c: any) => 
                c.Names.some((n: string) => n.startsWith('/mc-') || n.startsWith('/proxy-') || n.startsWith('/db-'))
            );

            if (managedContainers.length === 0) {
                throw new Error('No containers found to backup');
            }

            // Create temp directory for full backup
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + 
                             new Date().toTimeString().split(' ')[0].replace(/:/g, '');
            const filename = `full-backup-${timestamp}.tar.gz`;
            const backupPath = path.join(this.backupDir, filename);

            console.log(`[Backup] Creating full backup with ${managedContainers.length} containers`);

            // Create archive with all container data
            const output = fs.createWriteStream(backupPath);
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: { level: 6 }
            });

            return new Promise((resolve, reject) => {
                output.on('close', () => {
                    const stats = fs.statSync(backupPath);
                    console.log(`[Backup] Full backup created: ${filename} (${this.formatBytes(stats.size)})`);
                    resolve({
                        filename,
                        path: backupPath,
                        size: stats.size,
                        count: managedContainers.length
                    });
                });

                archive.on('error', (err) => {
                    console.error('[Backup] Archive error:', err);
                    reject(err);
                });

                archive.pipe(output);

                // Add each container's data to archive
                const addContainersToArchive = async () => {
                    let addedCount = 0;
                    for (const container of managedContainers) {
                        try {
                            const containerInfo = await this.docker.getContainer(container.Id).inspect();
                        const sourceDir = this.fileService.getServerDataDir(containerInfo);
                        
                        if (sourceDir && fs.existsSync(sourceDir)) {
                            const containerName = container.Names[0].replace('/', '');
                            console.log(`[Backup] Adding ${containerName} to full backup`);
                            
                            // Add with directory prefix
                            archive.directory(sourceDir, containerName);
                            addedCount++;
                        }
                    } catch (err) {
                        console.warn(`[Backup] Skipping container ${container.Names[0]}:`, err);
                    }
                }
                return addedCount;
            };

            addContainersToArchive().then(addedCount => {
                if (addedCount === 0) {
                    reject(new Error('No container data could be added to backup'));
                    return;
                }
                archive.finalize();
            }).catch(reject);
            });
        } catch (error: any) {
            console.error('[Backup] Error creating full backup:', error);
            throw error;
        }
    }

    /**
     * List all available backups
     */
    async listBackups(): Promise<BackupInfo[]> {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return [];
            }

            const files = fs.readdirSync(this.backupDir);
            const backups: BackupInfo[] = [];

            for (const file of files) {
                if (file.endsWith('.tar.gz')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filePath);
                    const info = this.parseBackupFilename(file);
                    
                    if (info) {
                        backups.push({
                            filename: file,
                            type: info.type,
                            name: info.name,
                            timestamp: info.timestamp,
                            size: stats.size,
                            date: stats.mtime
                        });
                    }
                }
            }

            // Sort by date (newest first)
            backups.sort((a, b) => b.date.getTime() - a.date.getTime());

            return backups;
        } catch (error: any) {
            console.error('[Backup] Error listing backups:', error);
            throw error;
        }
    }

    /**
     * Get backup file path
     */
    getBackupPath(filename: string): string {
        return path.join(this.backupDir, filename);
    }

    /**
     * Delete a backup file
     */
    async deleteBackup(filename: string): Promise<void> {
        try {
            const backupPath = path.join(this.backupDir, filename);
            
            if (!fs.existsSync(backupPath)) {
                throw new Error('Backup file not found');
            }

            // Validate filename (security)
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                throw new Error('Invalid backup filename');
            }

            fs.unlinkSync(backupPath);
            console.log(`[Backup] Deleted backup: ${filename}`);
        } catch (error: any) {
            console.error('[Backup] Error deleting backup:', error);
            throw error;
        }
    }

    /**
     * Restore backup to a container
     */
    async restoreBackup(containerId: string, backupFilename: string): Promise<void> {
        try {
            const backupPath = path.join(this.backupDir, backupFilename);
            
            if (!fs.existsSync(backupPath)) {
                throw new Error('Backup file not found');
            }

            // Get container info
            const containerInfo = await this.dockerService.getContainerInfo(containerId);
            const containerName = containerInfo.Name.replace('/', '');
            
            // Parse backup info
            const backupInfo = this.parseBackupFilename(backupFilename);
            if (!backupInfo) {
                throw new Error('Invalid backup filename format');
            }

            // Validate type matching
            const containerType = containerName.startsWith('proxy-') ? 'proxy' : 
                                 containerName.startsWith('db-') ? 'database' : 'server';
            
            if (backupInfo.type !== 'full' && backupInfo.type !== containerType) {
                throw new Error(`Backup type mismatch: backup is for ${backupInfo.type}, container is ${containerType}`);
            }

            console.log(`[Backup] Restoring ${backupFilename} to ${containerName}`);

            // Stop container
            console.log(`[Backup] Stopping container ${containerName}...`);
            await this.dockerService.stopContainer(containerId);
            
            // Wait a bit for clean shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get target directory
            const targetDir = this.fileService.getServerDataDir(containerInfo);
            if (!targetDir) {
                throw new Error(`Could not determine data directory for ${containerName}`);
            }

            // Clear existing data (backup first as safety)
            console.log(`[Backup] Clearing existing data in ${targetDir}...`);
            if (fs.existsSync(targetDir)) {
                const tempBackup = `${targetDir}.pre-restore`;
                if (fs.existsSync(tempBackup)) {
                    fs.rmSync(tempBackup, { recursive: true, force: true });
                }
                fs.renameSync(targetDir, tempBackup);
            }

            // Create fresh directory
            fs.mkdirSync(targetDir, { recursive: true });

            // Extract backup
            console.log(`[Backup] Extracting backup to ${targetDir}...`);
            await this.extractArchive(backupPath, targetDir, backupInfo.type === 'full' ? containerName : null);

            // Start container
            console.log(`[Backup] Starting container ${containerName}...`);
            await this.dockerService.startContainer(containerId);
            
            console.log(`[Backup] Restore completed successfully for ${containerName}`);
        } catch (error: any) {
            console.error('[Backup] Error restoring backup:', error);
            throw error;
        }
    }

    /**
     * Create tar.gz archive from directory
     */
    private async createArchive(sourceDir: string, outputPath: string, type: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: { level: 6 }
            });

            output.on('close', () => {
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Exclude patterns based on type
            const ignorePatterns: string[] = [];
            if (type === 'server') {
                ignorePatterns.push('**/logs/**', '**/cache/**', '**/libraries/**', '**/versions/**');
            }

            // Add directory to archive
            archive.glob('**/*', {
                cwd: sourceDir,
                ignore: ignorePatterns,
                dot: true
            });

            archive.finalize();
        });
    }

    /**
     * Extract tar.gz archive
     */
    private async extractArchive(archivePath: string, targetDir: string, subDir: string | null): Promise<void> {
        const tar = require('tar');
        
        const options: any = {
            file: archivePath,
            cwd: targetDir,
            strip: subDir ? 1 : 0  // Strip one level if extracting from full backup
        };

        if (subDir) {
            // Extract only specific subdirectory from full backup
            options.filter = (path: string) => path.startsWith(subDir + '/');
        }

        await tar.extract(options);
    }

    /**
     * Parse backup filename to extract metadata
     */
    private parseBackupFilename(filename: string): { type: 'server' | 'proxy' | 'database' | 'full'; name: string; timestamp: string } | null {
        // Format: {type}-{name}-{timestamp}.tar.gz
        // Example: server-mc-lobby-2026-02-13-143022.tar.gz
        const match = filename.match(/^(server|proxy|database|full)-([^-]+(?:-[^-]+)*)-(\d{4}-\d{2}-\d{2}-\d+)\.tar\.gz$/);
        
        if (!match) {
            // Try full backup format: full-backup-{timestamp}.tar.gz
            const fullMatch = filename.match(/^full-backup-(\d{4}-\d{2}-\d{2}-\d+)\.tar\.gz$/);
            if (fullMatch) {
                return {
                    type: 'full',
                    name: 'backup',
                    timestamp: fullMatch[1]
                };
            }
            return null;
        }

        return {
            type: match[1] as any,
            name: match[2],
            timestamp: match[3]
        };
    }

    /**
     * Format bytes to human readable string
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}
