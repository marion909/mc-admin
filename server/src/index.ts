import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Docker from 'dockerode';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupSocket } from './socketHandler.js';
import { dockerService } from './dockerService.js';
import { fileService } from './fileService.js';
import { authService } from './authService.js';
import { playerService } from './playerService.js';
import { BackupService } from './backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock';
const docker = new Docker({ socketPath });
const backupService = new BackupService();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

setupSocket(io);

app.use(cors());
app.use(express.json());

app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    if (!password) {
        res.status(400).json({ error: 'Password required' });
        return;
    }
    const token = await authService.login(password);
    if (token) {
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Protect all subsequent /api routes
app.use('/api', authService.authenticateToken);

app.post('/api/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
         res.status(400).json({ error: 'Missing fields' });
         return;
    }
    const success = await authService.changePassword(currentPassword, newPassword);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid current password' });
    }
});

// Server Management API
app.get('/api/servers', async (req, res) => {
    try {
        const containers = await dockerService.listMinecraftContainers();
        // Filter out proxies AND databases - only return actual Minecraft servers
        const servers = containers.filter((c: any) => 
            (!c.Labels || (c.Labels['server_type'] !== 'velocity-proxy' && c.Labels['server_type'] !== 'database'))
        );
        res.json(servers);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/servers', async (req, res) => {
    try {
        const options = req.body;
        // Basic validation
        if (!options.name || !options.port) {
            res.status(400).json({ error: 'Name and Port are required' });
            return;
        }

        // Ensure port is a number
        options.port = parseInt(options.port);
        
        // TODO: Check if port is free
        
        const container = await dockerService.createServer(options);
        res.json({ id: container.id, status: 'created' });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});
// MC-Admin Plugins - List available official plugins
app.get('/api/mc-admin-plugins', async (req, res) => {
    try {
        const plugins = [
            {
                id: 'mcadmin-dataapi',
                name: 'MCAdmin-DataAPI',
                version: '1.0.0',
                description: 'Player Data & Statistics REST API',
                fileName: 'MCAdmin-DataAPI-1.0.0.jar',
                downloadUrl: '/api/mc-admin-plugins/MCAdmin-DataAPI-1.0.0.jar',
                requirements: {
                    minecraft: '1.20+',
                    serverType: ['Spigot', 'Paper'],
                    dependencies: []
                },
                config: {
                    port: 8080,
                    requiresApiKey: true,
                    configFile: 'plugins/MCAdmin-DataAPI/config.yml'
                }
            }
        ];
        res.json({ plugins });
    } catch (e: any) {
        console.error('[API] MC-Admin plugins list error:', e);
        res.status(500).json({ error: e.message });
    }
});

// MC-Admin Plugins - Download plugin JAR
app.get('/api/mc-admin-plugins/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Validate filename to prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        
        if (!filename.endsWith('.jar')) {
            return res.status(400).json({ error: 'Only .jar files are allowed' });
        }
        
        const pluginPath = path.join(__dirname, '..', 'mc-admin-plugins', filename);
        
        // Check if file exists
        if (!fs.existsSync(pluginPath)) {
            return res.status(404).json({ error: 'Plugin not found' });
        }
        
        console.log(`[API] Serving MC-Admin plugin: ${filename}`);
        res.setHeader('Content-Type', 'application/java-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(pluginPath);
    } catch (e: any) {
        console.error('[API] MC-Admin plugin download error:', e);
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/servers/:id/start', async (req, res) => {
    try {
        await dockerService.startContainer(req.params.id);
        res.json({ status: 'started' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/servers/:id/stop', async (req, res) => {
    try {
        await dockerService.stopContainer(req.params.id);
        res.json({ status: 'stopped' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/servers/:id', async (req, res) => {
    try {
        await dockerService.deleteContainer(req.params.id);
        res.json({ status: 'deleted' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// File Management API
app.get('/api/servers/:id/files', async (req, res) => {
    try {
        const path = req.query.path as string || '.';
        console.log(`[API] List files for ${req.params.id} at path: ${path}`);
        const files = await fileService.listFiles(req.params.id, path);
        res.json(files);
    } catch (e: any) {
        console.error('[API] File list error:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.get('/api/servers/:id/files/content', async (req, res) => {
    try {
        const path = req.query.path as string;
        if (!path) throw new Error('Path required');
        const content = await fileService.readFile(req.params.id, path);
        res.send(content);
    } catch (e: any) {
        console.error('[API] File read error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/servers/:id/files/content', async (req, res) => {
    try {
        const { path, content } = req.body;
        if (!path) throw new Error('Path required');
        await fileService.writeFile(req.params.id, path, content);
        res.json({ status: 'saved' });
    } catch (e: any) {
        console.error('[API] File write error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/servers/:id/files', async (req, res) => {
    try {
        const path = req.query.path as string;
        if (!path) throw new Error('Path required');
        console.log(`[API] Delete file/folder for ${req.params.id} at path: ${path}`);
        await fileService.deleteEntry(req.params.id, path);
        res.json({ status: 'deleted' });
    } catch (e: any) {
        console.error('[API] File delete error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Plugin Installation
app.post('/api/servers/:id/plugins', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) throw new Error('Plugin URL required');
        
        // More flexible validation - check if URL looks like it could be a .jar
        // Allow URLs with query parameters or from known sources
        const urlWithoutQuery = url.split('?')[0];
        const isDirectJar = urlWithoutQuery.endsWith('.jar');
        const isKnownSource = url.includes('spigotmc.org') || 
                            url.includes('hangar.papermc.io') || 
                            url.includes('modrinth.com') ||
                            url.includes('github.com') ||
                            url.includes('jenkins');
        
        if (!isDirectJar && !isKnownSource) {
            throw new Error('URL must be a direct .jar download link or from a known plugin source (SpigotMC, Hangar, Modrinth, GitHub)');
        }

        console.log(`[API] Installing plugin from ${url} for ${req.params.id}`);
        
        // Get container info to find plugins directory
        const info = await dockerService.getContainerInfo(req.params.id);
        
        let rootDir: string | undefined;
        if (info.Mounts && Array.isArray(info.Mounts)) {
            const mount = info.Mounts.find((m: any) => m.Destination === '/data');
            if (mount) rootDir = mount.Source;
        }
        
        if (!rootDir && info.HostConfig && Array.isArray(info.HostConfig.Binds)) {
            const bind = info.HostConfig.Binds.find((b: string) => b.includes(':/data'));
            if (bind) {
                const parts = bind.split(':');
                const dataIndex = parts.indexOf('/data');
                if (dataIndex > 0) {
                    rootDir = parts.slice(0, dataIndex).join(':');
                }
            }
        }

        if (!rootDir) {
            throw new Error('Could not locate server data directory');
        }

        const pluginsDir = path.resolve(rootDir, 'plugins');
        
        // Create plugins directory if it doesn't exist
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
        }

        // Extract filename from URL
        const urlParts = new URL(url);
        const filename = path.basename(urlParts.pathname) || `plugin-${Date.now()}.jar`;
        const destinationPath = path.join(pluginsDir, filename);

        // Download file with redirect handling
        const downloadFile = (downloadUrl: string, maxRedirects = 5): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (maxRedirects === 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const protocol = downloadUrl.startsWith('https') ? https : http;
                const file = fs.createWriteStream(destinationPath);
                
                protocol.get(downloadUrl, (response) => {
                    const statusCode = response.statusCode || 0;
                    
                    if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
                        // Handle redirect
                        file.close();
                        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
                        
                        const redirectUrl = response.headers.location.startsWith('http') 
                            ? response.headers.location 
                            : new URL(response.headers.location, downloadUrl).toString();
                        
                        console.log(`[API] Following redirect to ${redirectUrl}`);
                        downloadFile(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
                    } else if (statusCode !== 200) {
                        file.close();
                        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
                        reject(new Error(`Download failed with status ${statusCode}. URL: ${downloadUrl}`));
                    } else {
                        response.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve();
                        });
                        file.on('error', (err) => {
                            if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
                            reject(err);
                        });
                    }
                }).on('error', (err) => {
                    file.close();
                    if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
                    reject(err);
                });
            });
        };

        await downloadFile(url);

        console.log(`[API] Plugin installed to ${destinationPath}`);
        res.json({ status: 'installed', filename, path: destinationPath });
    } catch (e: any) {
        console.error('[API] Plugin install error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Plugin Upload (File Upload)
app.post('/api/servers/:id/plugins/upload', async (req, res) => {
    try {
        const multer = (await import('multer')).default;
        const upload = multer({
            storage: multer.memoryStorage(),
            fileFilter: (req, file, cb) => {
                if (file.originalname.endsWith('.jar')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only .jar files are allowed'));
                }
            },
            limits: {
                fileSize: 100 * 1024 * 1024 // 100MB limit
            }
        });

        // Use multer middleware
        upload.single('plugin')(req, res, async (err: any) => {
            if (err) {
                console.error('[API] Upload error:', err);
                return res.status(400).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                console.log(`[API] Uploading plugin ${req.file.originalname} for ${req.params.id}`);
                
                // Get container info to find plugins directory
                const info = await dockerService.getContainerInfo(req.params.id);
                
                // Use the centralized reliable method that handles /data, /server and path mapping
                const rootDir = fileService.getServerDataDir(info);

                if (!rootDir) {
                    return res.status(500).json({ error: 'Could not locate server data directory' });
                }

                const pluginsDir = path.join(rootDir, 'plugins');
                if (!fs.existsSync(pluginsDir)) {
                    fs.mkdirSync(pluginsDir, { recursive: true });
                }

                const filename = req.file.originalname;
                const destinationPath = path.join(pluginsDir, filename);
                
                // Write uploaded file to plugins directory
                fs.writeFileSync(destinationPath, req.file.buffer);

                console.log(`[API] Plugin uploaded to ${destinationPath}`);
                res.json({ status: 'uploaded', filename, path: destinationPath });
            } catch (uploadError: any) {
                console.error('[API] Plugin upload processing error:', uploadError);
                res.status(500).json({ error: uploadError.message });
            }
        });
    } catch (e: any) {
        console.error('[API] Plugin upload error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Proxy Server Management API
app.get('/api/proxies', async (req, res) => {
    try {
        const containers = await dockerService.listMinecraftContainers();
        // Filter proxies (those with server_type label = 'velocity-proxy')
        const proxies = containers.filter((c: any) => 
            c.Labels && c.Labels['server_type'] === 'velocity-proxy'
        );
        res.json(proxies);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/proxies', async (req, res) => {
    try {
        const options = req.body;
        // Basic validation
        if (!options.name || !options.port) {
            res.status(400).json({ error: 'Name and Port are required' });
            return;
        }

        if (!options.servers || options.servers.length === 0) {
            res.status(400).json({ error: 'At least one server must be configured' });
            return;
        }

        // Ensure port is a number
        options.port = parseInt(options.port);
        
        const container = await dockerService.createProxy(options);
        res.json({ id: container.id, status: 'created' });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/proxies/:id/start', async (req, res) => {
    try {
        await dockerService.startContainer(req.params.id);
        res.json({ status: 'started' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/proxies/:id/stop', async (req, res) => {
    try {
        await dockerService.stopContainer(req.params.id);
        res.json({ status: 'stopped' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/proxies/:id', async (req, res) => {
    try {
        await dockerService.deleteContainer(req.params.id);
        res.json({ status: 'deleted' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Server Config Management
app.get('/api/servers/:id/config', async (req, res) => {
    try {
        const container = await dockerService.getContainerInfo(req.params.id);
        const dataDir = fileService.getServerDataDir(container);
        const propertiesPath = path.join(dataDir, 'server.properties');
        
        if (!fs.existsSync(propertiesPath)) {
            res.status(404).json({ error: 'server.properties not found. Server may not be initialized.' });
            return;
        }

        const content = fs.readFileSync(propertiesPath, 'utf-8');
        const config: any = {};
        
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const [key, ...valueParts] = trimmed.split('=');
            if (key) {
                const value = valueParts.join('=');
                config[key.trim()] = value.trim();
            }
        });

        res.json(config);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/servers/:id/config', async (req, res) => {
    try {
        const container = await dockerService.getContainerInfo(req.params.id);
        
        // Check if server is running
        if (container.State.Running) {
            res.status(400).json({ 
                error: 'Server must be stopped before editing config. Stop the server first.',
                needsStop: true
            });
            return;
        }
        
        const dataDir = fileService.getServerDataDir(container);
        const propertiesPath = path.join(dataDir, 'server.properties');
        
        if (!fs.existsSync(propertiesPath)) {
            res.status(404).json({ error: 'server.properties not found' });
            return;
        }

        const updates = req.body;
        let content = fs.readFileSync(propertiesPath, 'utf-8');
        
        // Update each property
        Object.keys(updates).forEach(key => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            const newLine = `${key}=${updates[key]}`;
            if (regex.test(content)) {
                content = content.replace(regex, newLine);
            } else {
                content += `\n${newLine}`;
            }
        });

        fs.writeFileSync(propertiesPath, content, 'utf-8');
        res.json({ status: 'updated', message: 'Configuration saved. Restart server to apply.' });
    } catch (e: any) {
        console.error('[API] Config update error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Proxy Config Management
app.get('/api/proxies/:id/config', async (req, res) => {
    try {
        const container = await dockerService.getContainerInfo(req.params.id);
        const dataDir = fileService.getServerDataDir(container);
        const tomlPath = path.join(dataDir, 'velocity.toml');
        
        if (!fs.existsSync(tomlPath)) {
            res.status(404).json({ error: 'velocity.toml not found' });
            return;
        }

        const content = fs.readFileSync(tomlPath, 'utf-8');
        
        // Simple TOML parsing for basic values
        const config: any = { servers: [] };
        const lines = content.split('\n');
        
        let inServersSection = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Check if we entered [servers] section
            if (trimmed === '[servers]') {
                inServersSection = true;
                continue;
            }
            
            // Check if we left [servers] section (new section starts)
            if (trimmed.startsWith('[') && trimmed !== '[servers]') {
                inServersSection = false;
            }
            
            if (trimmed.startsWith('motd =')) {
                config.motd = trimmed.split('=')[1].trim().replace(/"/g, '');
            } else if (trimmed.startsWith('show-max-players =')) {
                config.showMaxPlayers = parseInt(trimmed.split('=')[1].trim());
            } else if (trimmed.startsWith('online-mode =')) {
                config.onlineMode = trimmed.split('=')[1].trim() === 'true';
            } else if (trimmed.startsWith('player-info-forwarding-mode =')) {
                config.forwardingMode = trimmed.split('=')[1].trim().replace(/"/g, '');
            } else if (inServersSection && trimmed.match(/^\w+ = ".+:\d+"$/)) {
                // Server line like: lobby = "127.0.0.1:25565" (only within [servers] section)
                const [name, address] = trimmed.split('=').map(s => s.trim());
                config.servers.push({ name, address: address.replace(/"/g, '') });
            }
        }

        res.json(config);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/proxies/:id/config', async (req, res) => {
    try {
        const container = await dockerService.getContainerInfo(req.params.id);
        
        // Check if proxy is running
        if (container.State.Running) {
            res.status(400).json({ 
                error: 'Proxy must be stopped before editing config. Stop the proxy first.',
                needsStop: true
            });
            return;
        }
        
        const dataDir = fileService.getServerDataDir(container);
        const tomlPath = path.join(dataDir, 'velocity.toml');
        
        if (!fs.existsSync(tomlPath)) {
            res.status(404).json({ error: 'velocity.toml not found' });
            return;
        }

        const updates = req.body;
        let content = fs.readFileSync(tomlPath, 'utf-8');
        
        // Update basic properties
        if (updates.motd !== undefined) {
            content = content.replace(/^motd = ".*"$/m, `motd = "${updates.motd}"`);
        }
        if (updates.showMaxPlayers !== undefined) {
            content = content.replace(/^show-max-players = \d+$/m, `show-max-players = ${updates.showMaxPlayers}`);
        }
        if (updates.onlineMode !== undefined) {
            content = content.replace(/^online-mode = (true|false)$/m, `online-mode = ${updates.onlineMode}`);
        }
        if (updates.forwardingMode !== undefined) {
            content = content.replace(/^player-info-forwarding-mode = ".*"$/m, `player-info-forwarding-mode = "${updates.forwardingMode}"`);
        }

        // Update servers section if provided
        if (updates.servers && Array.isArray(updates.servers)) {
            const serversStart = content.indexOf('[servers]');
            const tryStart = content.indexOf('try = [');
            
            if (serversStart !== -1 && tryStart !== -1) {
                const serverLines = updates.servers.map((s: any) => `  ${s.name} = "${s.address}"`).join('\n  ');
                const beforeServers = content.substring(0, serversStart);
                const afterTry = content.substring(content.indexOf(']', tryStart) + 1);
                
                content = beforeServers + '[servers]\n  ' + serverLines + '\n  \n  try = [\n    ' + 
                          updates.servers.map((s: any) => `"${s.name}"`).join(',\n    ') + '\n  ]' + afterTry;
            }
        }

        fs.writeFileSync(tomlPath, content, 'utf-8');
        res.json({ status: 'updated', message: 'Configuration saved. Restart proxy to apply.' });
    } catch (e: any) {
        console.error('[API] Proxy config update error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Configure server for proxy use
app.post('/api/servers/:id/configure-proxy', async (req, res) => {
    try {
        const { proxySecret } = req.body || {}; // Optional: secret from proxy
        const container = await dockerService.getContainerInfo(req.params.id);
        
        // Check if server is running
        if (container.State.Running) {
            res.status(400).json({ 
                error: 'Server must be stopped before configuration. Stop the server, then click "Configure for Proxy" again.',
                needsStop: true
            });
            return;
        }
        
        const dataDir = fileService.getServerDataDir(container);
        const propertiesPath = path.join(dataDir, 'server.properties');
        
        console.log('[Proxy Config] Server:', req.params.id);
        console.log('[Proxy Config] Data dir:', dataDir);
        console.log('[Proxy Config] Properties path:', propertiesPath);
        
        if (!fs.existsSync(propertiesPath)) {
            res.status(404).json({ error: 'server.properties not found. Start server first to generate it, then stop it before configuring.' });
            return;
        }

        // Update server.properties
        let content = fs.readFileSync(propertiesPath, 'utf-8');
        
        console.log('[Proxy Config] Original content has online-mode:', content.match(/^online-mode=.*$/m)?.[0]);
        console.log('[Proxy Config] Original content has onlineMode:', content.match(/^onlineMode=.*$/m)?.[0]);
        
        // Set online-mode=false (kebab-case format)
        const onlineModeKebab = /^online-mode=.*$/m;
        if (onlineModeKebab.test(content)) {
            content = content.replace(onlineModeKebab, 'online-mode=false');
        } else {
            content += '\nonline-mode=false';
        }
        
        // Set onlineMode=false (camelCase format) - some servers use this
        const onlineModeCamel = /^onlineMode=.*$/m;
        if (onlineModeCamel.test(content)) {
            content = content.replace(onlineModeCamel, 'onlineMode=false');
        } else {
            content += '\nonlineMode=false';
        }

        console.log('[Proxy Config] New online-mode:', content.match(/^online-mode=.*$/m)?.[0]);
        console.log('[Proxy Config] New onlineMode:', content.match(/^onlineMode=.*$/m)?.[0]);
        
        fs.writeFileSync(propertiesPath, content, 'utf-8');
        console.log('[Proxy Config] File written successfully');
        
        // Verify the write
        const verifyContent = fs.readFileSync(propertiesPath, 'utf-8');
        const verifyMatch = verifyContent.match(/^online-mode=.*$/m)?.[0];
        console.log('[Proxy Config] VERIFICATION - Read back from file:', verifyMatch);
        
        if (verifyMatch !== 'online-mode=false') {
            console.error('[Proxy Config] ERROR: File verification failed! Expected "online-mode=false" but got:', verifyMatch);
            res.status(500).json({ 
                error: 'Configuration write verification failed. File may be read-only or mounted incorrectly.',
                expected: 'online-mode=false',
                actual: verifyMatch
            });
            return;
        }

        // For Paper servers, configure velocity forwarding
        let paperConfigured = false;
        const configDir = path.join(dataDir, 'config');
        
        // Modern Paper (paper-global.yml)
        if (fs.existsSync(configDir)) {
            const paperGlobalPath = path.join(configDir, 'paper-global.yml');
            if (fs.existsSync(paperGlobalPath)) {
                let paperConfig = fs.readFileSync(paperGlobalPath, 'utf-8');
                
                // Check if proxies section exists
                if (!paperConfig.includes('proxies:')) {
                    const secretValue = proxySecret || '';
                    paperConfig += `
proxies:
  velocity:
    enabled: true
    online-mode: true
    secret: '${secretValue}'
`;
                } else {
                    // Update existing section
                    paperConfig = paperConfig.replace(/velocity:\s*\n\s*enabled:\s*false/, 'velocity:\n    enabled: true');
                    paperConfig = paperConfig.replace(/online-mode:\s*false/, 'online-mode: true');
                    if (proxySecret) {
                        paperConfig = paperConfig.replace(/secret:\s*'.*'/, `secret: '${proxySecret}'`);
                    }
                }
                
                fs.writeFileSync(paperGlobalPath, paperConfig, 'utf-8');
                paperConfigured = true;
            } else {
                // Older Paper (velocity-support.yml or spigot.yml)
                const velocitySupportPath = path.join(configDir, 'velocity-support.yml');
                const secretValue = proxySecret || '';
                fs.mkdirSync(configDir, { recursive: true });
                fs.writeFileSync(velocitySupportPath, `enabled: true\nonline-mode: true\nsecret: '${secretValue}'`, 'utf-8');
                paperConfigured = true;
            }
        }

        const message = paperConfigured 
            ? (proxySecret 
                ? 'Server configured with forwarding secret! Restart server to apply.'
                : 'Server configured! Set online-mode=false and enabled Velocity forwarding. Use LEGACY mode or provide proxy secret for MODERN.')
            : 'Server configured! Set online-mode=false. For MODERN forwarding, use Paper server and provide proxy secret.';

        res.json({ 
            status: 'configured', 
            message,
            paperConfigured,
            secretSet: !!proxySecret
        });
    } catch (e: any) {
        console.error('[API] Proxy config error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get proxy forwarding secret
app.get('/api/proxies/:id/secret', async (req, res) => {
    try {
        const container = await dockerService.getContainerInfo(req.params.id);
        const dataDir = fileService.getServerDataDir(container);
        const secretPath = path.join(dataDir, 'forwarding.secret');
        
        if (!fs.existsSync(secretPath)) {
            res.status(404).json({ error: 'No forwarding secret found. Proxy may use LEGACY mode.' });
            return;
        }

        const secret = fs.readFileSync(secretPath, 'utf-8').trim();
        res.json({ secret });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Copy secret from proxy to server
app.post('/api/servers/:serverId/copy-secret/:proxyId', async (req, res) => {
    try {
        // Get secret from proxy
        const proxyContainer = await dockerService.getContainerInfo(req.params.proxyId);
        const proxyDir = fileService.getServerDataDir(proxyContainer);
        const secretPath = path.join(proxyDir, 'forwarding.secret');
        
        if (!fs.existsSync(secretPath)) {
            res.status(404).json({ error: 'Proxy has no forwarding secret. Use LEGACY mode or create new proxy with MODERN mode.' });
            return;
        }

        const secret = fs.readFileSync(secretPath, 'utf-8').trim();

        // Configure server with this secret
        const serverContainer = await dockerService.getContainerInfo(req.params.serverId);
        
        // Check if server is running
        if (serverContainer.State.Running) {
            res.status(400).json({ 
                error: 'Server must be stopped before copying secret. Stop the server first.',
                needsStop: true
            });
            return;
        }
        
        const serverDir = fileService.getServerDataDir(serverContainer);
        const configDir = path.join(serverDir, 'config');
        
        if (!fs.existsSync(configDir)) {
            res.status(400).json({ error: 'Server not initialized or not Paper/Spigot. Start server first.' });
            return;
        }

        // Update Paper config
        const paperGlobalPath = path.join(configDir, 'paper-global.yml');
        if (fs.existsSync(paperGlobalPath)) {
            let paperConfig = fs.readFileSync(paperGlobalPath, 'utf-8');
            
            if (paperConfig.includes('secret:')) {
                paperConfig = paperConfig.replace(/secret:\s*'.*'/, `secret: '${secret}'`);
            } else if (paperConfig.includes('velocity:')) {
                paperConfig = paperConfig.replace(/velocity:/, `velocity:\n    enabled: true\n    online-mode: true\n    secret: '${secret}'`);
            } else {
                paperConfig += `
proxies:
  velocity:
    enabled: true
    online-mode: true
    secret: '${secret}'
`;
            }
            
            fs.writeFileSync(paperGlobalPath, paperConfig, 'utf-8');
        } else {
            // Create velocity-support.yml
            const velocitySupportPath = path.join(configDir, 'velocity-support.yml');
            fs.writeFileSync(velocitySupportPath, `enabled: true\nonline-mode: true\nsecret: '${secret}'`, 'utf-8');
        }

        res.json({ status: 'success', message: 'Secret copied! Restart server to apply.', secret });
    } catch (e: any) {
        console.error('[API] Secret copy error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Recreate server container with ONLINE_MODE=FALSE for proxy use
app.post('/api/servers/:id/recreate-for-proxy', async (req, res) => {
    try {
        console.log(`[API] Recreating server ${req.params.id} for proxy...`);
        
        const newContainer = await dockerService.recreateServerForProxy(req.params.id);
        
        res.json({ 
            status: 'success', 
            message: 'Server container recreated with ONLINE_MODE=FALSE! Start the server now.',
            containerId: newContainer.id
        });
    } catch (e: any) {
        console.error('[API] Recreate for proxy error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Database Management API
app.get('/api/databases', async (req, res) => {
    try {
         const containers = await dockerService.listMinecraftContainers();
         // Filter databases
         const dbs = containers.filter((c: any) => 
             c.Labels && c.Labels['server_type'] === 'database'
         );
         res.json(dbs);
    } catch (e: any) {
         res.status(500).json({ error: e.message });
    }
});

app.post('/api/databases', async (req, res) => {
    try {
        const options = req.body;
        // Basic validation
        if (!options.name || !options.type || !options.password) {
             res.status(400).json({ error: 'Name, Type and Password are required' });
             return;
        }

        const container = await dockerService.createDatabase(options);
        res.json({ 
             status: 'success', 
             message: 'Database created successfully!',
             id: container.id 
        });
    } catch (e: any) {
        console.error('[API] Create DB error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Player Management API
app.get('/api/players', async (req, res) => {
    try {
        const result = await playerService.getAllPlayers();
        res.json(result);
    } catch (e: any) {
        console.error('[API] Get all players error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/servers/:id/players', async (req, res) => {
    try {
        const players = await playerService.getServerPlayersById(req.params.id);
        res.json({ 
            players,
            count: players.length,
            serverId: req.params.id,
            timestamp: Date.now()
        });
    } catch (e: any) {
        console.error(`[API] Get players for server ${req.params.id} error:`, e);
        res.status(500).json({ error: e.message });
    }
});

// Backup Management API
// Create backup(s)
app.post('/api/backups/create', async (req, res) => {
    try {
        const { targets, fullBackup } = req.body;

        if (fullBackup) {
            // Create full backup of all containers
            console.log('[API] Creating full backup...');
            const result = await backupService.createFullBackup();
            res.json({ 
                success: true, 
                backup: result,
                message: `Full backup created with ${result.count} containers`
            });
        } else if (targets && Array.isArray(targets)) {
            // Create backups for specific containers
            console.log(`[API] Creating backups for ${targets.length} containers...`);
            const results = [];
            const errors = [];

            for (const containerId of targets) {
                try {
                    const result = await backupService.createBackup(containerId);
                    results.push(result);
                } catch (error: any) {
                    errors.push({ containerId, error: error.message });
                }
            }

            res.json({ 
                success: errors.length === 0,
                backups: results,
                errors: errors.length > 0 ? errors : undefined,
                message: `Created ${results.length} backup(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`
            });
        } else {
            res.status(400).json({ error: 'Either targets array or fullBackup flag required' });
        }
    } catch (e: any) {
        console.error('[API] Backup creation error:', e);
        res.status(500).json({ error: e.message });
    }
});

// List all backups
app.get('/api/backups', async (req, res) => {
    try {
        const backups = await backupService.listBackups();
        res.json({ backups, count: backups.length });
    } catch (e: any) {
        console.error('[API] List backups error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Download backup
app.get('/api/backups/:filename/download', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Validate filename (security)
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const backupPath = backupService.getBackupPath(filename);
        
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        console.log(`[API] Downloading backup: ${filename}`);
        res.download(backupPath, filename);
    } catch (e: any) {
        console.error('[API] Backup download error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Restore backup
app.post('/api/backups/:filename/restore/:containerId', async (req, res) => {
    try {
        const { filename, containerId } = req.params;
        
        console.log(`[API] Restoring backup ${filename} to container ${containerId}...`);
        await backupService.restoreBackup(containerId, filename);
        
        res.json({ 
            success: true, 
            message: `Backup ${filename} restored successfully to ${containerId}`
        });
    } catch (e: any) {
        console.error('[API] Backup restore error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Delete backup
app.delete('/api/backups/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        await backupService.deleteBackup(filename);
        
        res.json({ 
            success: true, 
            message: `Backup ${filename} deleted successfully`
        });
    } catch (e: any) {
        console.error('[API] Backup delete error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Test Docker connection
app.get('/api/docker/info', async (req, res) => {
  try {
    const info = await docker.info();
    res.json(info);
  } catch (error) {
    console.error('Docker Info Error:', error);
    res.status(500).json({ error: 'Failed to connect to Docker' });
  }
});

// Serve static files (Frontend)
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  console.log(`Serving static files from ${publicPath}`);
  app.use(express.static(publicPath));
  
  // Handle client-side routing, return index.html for all non-API routes
  app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

const PORT = 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
