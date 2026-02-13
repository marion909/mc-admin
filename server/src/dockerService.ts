import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock';

export interface ServerOptions {
    name: string;
    port: number;
    type: string;
    version: string;
    ram: string;
    motd?: string;
    difficulty?: string;
    gamemode?: string;
    maxPlayers?: number;
    levelType?: string;
    seed?: string;
    onlineMode?: boolean;
    useAikarFlags?: boolean;
    viewDistance?: number;
    icon?: string;
}

export interface ProxyServer {
    name: string;
    address: string;
}

export interface ProxyOptions {
    name: string;
    port: number;
    motd?: string;
    showMaxPlayers?: number;
    onlineMode?: boolean;
    forwardingMode?: 'NONE' | 'LEGACY' | 'BUNGEEGUARD' | 'MODERN';
    servers: ProxyServer[];
    tryServers: string[];
    ram?: string;
}

export interface DatabaseOptions {
    name: string;
    type: 'postgres' | 'mysql';
    version?: string;
    user: string;
    password: string;
    database: string;
    rootPassword?: string; // For MySQL
    port?: number;
}

export class DockerService {
  private docker: Docker;
  private dataDir: string;

  constructor() {
    this.docker = new Docker({ socketPath });
    // Ensure data directory exists
    this.dataDir = path.resolve(process.cwd(), 'data', 'servers');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async listMinecraftContainers() {
    const containers = await this.docker.listContainers({ all: true });
    // Filter by label 'mc-admin-managed'
    return containers.filter(c => c.Labels && c.Labels['created_by'] === 'mc-admin');
  }

  async createServer(options: ServerOptions) {
    const { 
        name, port, type, version, ram,
        motd, difficulty, gamemode, maxPlayers,
        levelType, seed, onlineMode, useAikarFlags,
        viewDistance, icon
    } = options;

    const containerName = `mc-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const serverDir = path.resolve(this.dataDir, containerName);
    
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    // Determine Host Path for Binding
    let bindPath = serverDir; // Default to local path (works on Linux host)
    if (process.env.HOST_DATA_PATH) {
        // We are in a container, map our dataDir structure to host structure
        // serverDir is like /app/data/servers/mc-foo
        // dataDir is /app/data/servers
        // HOST_DATA_PATH is C:\Projekte\MC-Admin\server\data\servers
        const relative = path.relative(this.dataDir, serverDir);
        bindPath = path.join(process.env.HOST_DATA_PATH, relative);
        
        // Fix for Linux container running on Windows Host: path.join might use forward slashes
        // but if process.env.HOST_DATA_PATH has backslashes, node might mix them.
        // Docker on Windows usually handles mixed slashes or forward slashes well.
        // But let's respect the separator of the HOST_DATA_PATH if possible.
        if (process.env.HOST_DATA_PATH.includes('\\')) {
             bindPath = bindPath.replace(/\//g, '\\');
        }
        console.log(`[Docker] Mapped bind path: ${serverDir} -> ${bindPath}`);
    }

    // Construct Environment Variables
    const env = [
      'EULA=TRUE',
      `TYPE=${type}`,
      `VERSION=${version}`,
      `MEMORY=${ram}`
    ];

    if (motd) env.push(`MOTD=${motd}`);
    if (difficulty) env.push(`DIFFICULTY=${difficulty}`);
    if (gamemode) env.push(`MODE=${gamemode}`); // 'MODE' sets gamemode in itzg image
    if (maxPlayers) env.push(`MAX_PLAYERS=${maxPlayers}`);
    if (levelType) env.push(`LEVEL_TYPE=${levelType}`);
    if (seed) env.push(`SEED=${seed}`);
    if (onlineMode !== undefined) env.push(`ONLINE_MODE=${onlineMode.toString().toUpperCase()}`);
    if (viewDistance) env.push(`VIEW_DISTANCE=${viewDistance}`);
    if (icon) env.push(`ICON=${icon}`);
    
    if (useAikarFlags) {
        env.push('USE_AIKAR_FLAGS=true');
    }

    const imageName = 'itzg/minecraft-server:latest';

    try {
        // Ensure image exists
        try {
            await this.docker.getImage(imageName).inspect();
        } catch {
            console.log(`Image ${imageName} not found, pulling...`);
            await new Promise((resolve, reject) => {
                this.docker.pull(imageName, (err: any, stream: any) => {
                    if (err) return reject(err);
                    this.docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
                });
            });
        }

        const container = await this.docker.createContainer({
            Image: imageName,
            name: containerName,
            Tty: true,
            OpenStdin: true,
            Env: env,
            HostConfig: {
                PortBindings: {
                    '25565/tcp': [{ HostPort: port.toString() }]
                },
                Binds: [
                    `${bindPath}:/data`
                ]
            },
            Labels: {
                'created_by': 'mc-admin',
                'server_name': name,
                'server_type': type
            }
        });
        return container;
    } catch (error) {
        throw error;
    }
  }

  async startContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.start();
  }

  async stopContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.stop();
  }

  async deleteContainer(id: string) {
    const container = this.docker.getContainer(id);
    // Force remove (stop then remove)
    await container.remove({ force: true });
  }

  async getContainerInfo(id: string) {
      const container = this.docker.getContainer(id);
      return await container.inspect();
  }

  async createProxy(options: ProxyOptions) {
    const { 
        name, port, motd, showMaxPlayers, onlineMode, 
        forwardingMode, servers, tryServers, ram
    } = options;

    const containerName = `proxy-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const proxyDir = path.resolve(this.dataDir, containerName);
    
    if (!fs.existsSync(proxyDir)) {
      fs.mkdirSync(proxyDir, { recursive: true });
    }

    // Generate velocity.toml
    const velocityToml = this.generateVelocityConfig(options);
    fs.writeFileSync(path.join(proxyDir, 'velocity.toml'), velocityToml);

    // Generate forwarding secret for MODERN mode
    if (forwardingMode === 'MODERN' || forwardingMode === 'BUNGEEGUARD') {
      const crypto = await import('crypto');
      const secret = crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(path.join(proxyDir, 'forwarding.secret'), secret);
      console.log(`[Proxy] Generated forwarding secret: ${secret}`);
    }

    // Determine Host path for Proxy Bind
    let bindPath = proxyDir;
    if (process.env.HOST_DATA_PATH) {
        const relative = path.relative(this.dataDir, proxyDir);
        bindPath = path.join(process.env.HOST_DATA_PATH, relative);
        if (process.env.HOST_DATA_PATH.includes('\\')) {
             bindPath = bindPath.replace(/\//g, '\\');
        }
        console.log(`[Docker] Mapped proxy bind path: ${proxyDir} -> ${bindPath}`);
    }

    const imageName = 'itzg/bungeecord';

    try {
        // Ensure image exists
        try {
            await this.docker.getImage(imageName).inspect();
        } catch {
            console.log(`Image ${imageName} not found, pulling...`);
            await new Promise((resolve, reject) => {
                this.docker.pull(imageName, (err: any, stream: any) => {
                    if (err) return reject(err);
                    this.docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
                });
            });
        }

        const env = [
            'TYPE=VELOCITY',
            `MEMORY=${ram || '512M'}`
        ];

        const container = await this.docker.createContainer({
            Image: imageName,
            name: containerName,
            Tty: true,
            OpenStdin: true,
            Env: env,
            HostConfig: {
                PortBindings: {
                    '25577/tcp': [{ HostPort: port.toString() }]
                },
                Binds: [
                    `${bindPath}:/server`
                ],
                ExtraHosts: [
                    'host.docker.internal:host-gateway'
                ]
            },
            Labels: {
                'created_by': 'mc-admin',
                'server_name': name,
                'server_type': 'velocity-proxy'
            }
        });
        return container;
    } catch (error) {
        throw error;
    }
  }

  private generateVelocityConfig(options: ProxyOptions): string {
    const {
        motd = '&3A Velocity Server',
        showMaxPlayers = 500,
        onlineMode = true,
        forwardingMode = 'LEGACY',
        servers,
        tryServers
    } = options;

    const serverEntries = servers.map(s => `${s.name} = "${s.address}"`).join('\n  ');
    const tryList = tryServers.map(s => `"${s}"`).join(',\n    ');

    return `# Config version. Do not change.
config-version = "2.7"

# Bind address
bind = "0.0.0.0:25577"

# Message of the day
motd = "${motd}"

# Maximum players shown
show-max-players = ${showMaxPlayers}

# Online mode
online-mode = ${onlineMode}

# Player info forwarding mode
player-info-forwarding-mode = "${forwardingMode}"

# Force key authentication
force-key-authentication = true

# Prevent client proxy connections
prevent-client-proxy-connections = false

# Forwarding secret
forwarding-secret-file = "forwarding.secret"

# Announce Forge
announce-forge = false

# Kick existing players on reconnect
kick-existing-players = false

# Ping passthrough mode
ping-passthrough = "DISABLED"

# Enable player address logging
enable-player-address-logging = true

[servers]
  # Configure your servers here
  ${serverEntries}
  
  # Try list - servers to connect to on login
  try = [
    ${tryList}
  ]

[forced-hosts]
  # Example: "lobby.example.com" = ["lobby"]

[advanced]
  compression-threshold = 256
  compression-level = -1
  login-ratelimit = 3000
  connection-timeout = 5000
  read-timeout = 30000
  haproxy-protocol = false
  tcp-fast-open = false
  bungee-plugin-message-channel = true
  show-ping-requests = false
  announce-proxy-commands = true
  failover-on-unexpected-server-disconnect = true
  log-command-executions = false
  log-player-connections = true
  accepts-transfers = false

[query]
  enabled = false
  port = 25577
  map = "Velocity"
  show-plugins = false
`;
  }

  async createDatabase(options: DatabaseOptions) {
    const { name, type, version, user, password, database, rootPassword, port } = options;
    const containerName = `db-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    // Database storage directory - Use _databases subfolder inside data/servers
    // This allows us to reuse the existing volume mount if user mounted /server/data -> /app/data/servers
    const dbDataDir = path.resolve(this.dataDir, '_databases', containerName);
    if (!fs.existsSync(dbDataDir)) {
      fs.mkdirSync(dbDataDir, { recursive: true });
    }

    // Determine Host Path for Binding
    // Default to internal path for safety
    let finalBindPath = dbDataDir;
    
    if (process.env.HOST_DATA_PATH) {
        // Map internal path to host path based on environment variables
        // dbDataDir is /app/data/servers/_databases/db-name
        // dataDir is /app/data/servers
        // HOST_DATA_PATH is C:\Projekte\MC-Admin\server\data
        
        const relative = path.relative(this.dataDir, dbDataDir); // _databases/db-name
        finalBindPath = path.join(process.env.HOST_DATA_PATH, relative);
        
        // Handle Windows paths if host is Windows but container is Linux
        if (process.env.HOST_DATA_PATH.includes('\\')) {
             finalBindPath = finalBindPath.replace(/\//g, '\\');
        }
        console.log(`[Docker] Mapped DB bind path: ${dbDataDir} -> ${finalBindPath}`);
    }

    let imageName = '';
    const env: string[] = [];
    const binds: string[] = [];
    let internalPort = 0;

    if (type === 'postgres') {
        imageName = `postgres:${version || '15-alpine'}`;
        internalPort = 5432;
        env.push(
            `POSTGRES_USER=${user || 'postgres'}`,
            `POSTGRES_PASSWORD=${password}`,
            `POSTGRES_DB=${database || 'minecraft'}`
        );
        binds.push(`${finalBindPath}:/var/lib/postgresql/data`);
    } else if (type === 'mysql') {
        imageName = `mysql:${version || '8.0'}`;
        internalPort = 3306;
        env.push(
            `MYSQL_USER=${user || 'minecraft'}`,
            `MYSQL_PASSWORD=${password}`,
            `MYSQL_DATABASE=${database || 'minecraft'}`,
            `MYSQL_ROOT_PASSWORD=${rootPassword || password}`
        );
        binds.push(`${finalBindPath}:/var/lib/mysql`);
    }

    try {
        try {
            await this.docker.getImage(imageName).inspect();
        } catch {
            console.log(`Image ${imageName} not found, pulling...`);
            await new Promise((resolve, reject) => {
                this.docker.pull(imageName, (err: any, stream: any) => {
                    if (err) return reject(err);
                    this.docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
                });
            });
        }

        const container = await this.docker.createContainer({
            Image: imageName,
            name: containerName,
            Env: env,
            HostConfig: {
                PortBindings: {
                    [`${internalPort}/tcp`]: [{ 
                        HostPort: port ? port.toString() : '0', // 0 = Random available port
                         // Bind to 0.0.0.0 is DEFAULT for bridge, but user asked for "No, internal network only"
                         // HOWEVER, if we bind to 127.0.0.1, external plugins on other hosts can't reach it.
                         // But plugins on SAME host can use host.docker.internal.
                         // Let's bind to 0.0.0.0 but rely on firewall? 
                         // NO, user said "internal network only" usually implies 127.0.0.1 or internal docker network.
                         // Since we are using "Default Bridge", the only way to be "internal" to the HOST is bind 127.0.0.1.
                        HostIp: '127.0.0.1' 
                    }]
                },
                Binds: binds
            },
            Labels: {
                'created_by': 'mc-admin',
                'server_name': name,
                'server_type': 'database',
                'db_type': type
            }
        });
        
        await container.start();
        return container;
    } catch (e) {
        throw e;
    }
  }

  async recreateServerForProxy(containerId: string) {
    // Get current container info
    const oldContainer = this.docker.getContainer(containerId);
    const info = await oldContainer.inspect();

    console.log(`[Docker] Recreating container ${containerId} for proxy use...`);

    // Extract current configuration
    const env = info.Config.Env || [];
    const binds = info.HostConfig.Binds || [];
    const portBindings = info.HostConfig.PortBindings || {};
    const labels = info.Config.Labels || {};
    const name = info.Name.replace(/^\//, ''); // Remove leading slash

    // Update environment variables
    const newEnv = env.filter(e => !e.startsWith('ONLINE_MODE='));
    newEnv.push('ONLINE_MODE=FALSE');

    console.log('[Docker] Updated env with ONLINE_MODE=FALSE');

    // Stop and remove old container
    try {
      if (info.State.Running) {
        console.log('[Docker] Stopping container...');
        await oldContainer.stop();
      }
      console.log('[Docker] Removing old container...');
      await oldContainer.remove();
    } catch (e: any) {
      console.error('[Docker] Error removing container:', e.message);
      throw new Error(`Failed to remove old container: ${e.message}`);
    }

    // Create new container with updated settings
    try {
      console.log('[Docker] Creating new container with proxy settings...');
      const newContainer = await this.docker.createContainer({
        Image: info.Config.Image,
        name: name,
        Tty: info.Config.Tty,
        OpenStdin: info.Config.OpenStdin,
        Env: newEnv,
        HostConfig: {
          PortBindings: portBindings,
          Binds: binds
        },
        Labels: labels
      });

      console.log('[Docker] Container recreated successfully');
      return newContainer;
    } catch (e: any) {
      console.error('[Docker] Error creating new container:', e.message);
      throw new Error(`Failed to create new container: ${e.message}`);
    }
  }
}

export const dockerService = new DockerService();
