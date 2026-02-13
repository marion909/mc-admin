import Docker from 'dockerode';
import axios from 'axios';

const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

export interface PlayerLocation {
  x: number;
  y: number;
  z: number;
  world: string;
  pitch: number;
  yaw: number;
}

export interface InventoryItem {
  slot: number;
  type: string;
  amount: number;
  durability: number;
  displayName?: string;
  enchantments?: string[];
}

export interface PlayerStatistics {
  playTime?: number;
  deaths?: number;
  mobKills?: number;
  playerKills?: number;
  jumps?: number;
  distanceWalked?: number;
  distanceFlown?: number;
}

export interface PlayerData {
  uuid: string;
  name: string;
  displayName: string;
  location: PlayerLocation;
  health: number;
  maxHealth: number;
  foodLevel: number;
  saturation: number;
  level: number;
  exp: number;
  totalExperience: number;
  gameMode: string;
  isFlying: boolean;
  allowFlight: boolean;
  walkSpeed: number;
  flySpeed: number;
  fireTicks: number;
  remainingAir: number;
  maximumAir: number;
  inventory: InventoryItem[];
  statistics: PlayerStatistics;
  advancementCount: number;
  achievements: string[];
  ping: number;
  address: string;
  server?: string;
  serverId?: string;
}

export interface ServerPlayerResponse {
  players: PlayerData[];
  count: number;
  timestamp: number;
  server: string;
}

export interface AggregatedPlayerResponse {
  players: PlayerData[];
  totalCount: number;
  serverCount: number;
  timestamp: number;
  errors: string[];
}

export class PlayerService {
  private readonly API_KEY = process.env.PLUGIN_API_KEY || 'mcadmin-default-key-change-me';
  private readonly PLUGIN_PORT = parseInt(process.env.PLUGIN_PORT || '8080');

  /**
   * Get container IP address for plugin API access
   */
  private async getContainerIP(containerId: string): Promise<string | null> {
    try {
      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      
      // Try to get IP from the first network
      const networks = info.NetworkSettings.Networks;
      const networkNames = Object.keys(networks);
      
      if (networkNames.length > 0) {
        const ip = networks[networkNames[0]].IPAddress;
        return ip || null;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get IP for container ${containerId}:`, error);
      return null;
    }
  }

  /**
   * Check if plugin is available on a server
   */
  private async checkPluginHealth(serverIp: string): Promise<boolean> {
    try {
      const response = await axios.get(`http://${serverIp}:${this.PLUGIN_PORT}/api/health`, {
        timeout: 2000,
      });
      return response.data?.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get players from a specific server
   */
  private async getServerPlayers(serverId: string, serverName: string, serverIp: string): Promise<PlayerData[]> {
    try {
      const response = await axios.get<ServerPlayerResponse>(
        `http://${serverIp}:${this.PLUGIN_PORT}/api/players`,
        {
          headers: {
            'X-API-Key': this.API_KEY,
          },
          timeout: 5000,
        }
      );

      // Add server info to each player
      return response.data.players.map(player => ({
        ...player,
        server: serverName,
        serverId: serverId,
      }));
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Plugin not accessible (connection refused)`);
      } else if (error.response?.status === 401) {
        throw new Error(`Invalid API key`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`Request timeout`);
      }
      throw error;
    }
  }

  /**
   * Get players from all Minecraft servers
   */
  async getAllPlayers(): Promise<AggregatedPlayerResponse> {
    const allPlayers: PlayerData[] = [];
    const errors: string[] = [];
    let serverCount = 0;

    try {
      // List all containers
      const containers = await docker.listContainers({ all: false });

      // Filter Minecraft servers (using itzg/minecraft-server image)
      const minecraftServers = containers.filter(container => 
        container.Image.includes('itzg/minecraft-server') ||
        container.Labels?.['server_type'] === 'minecraft'
      );

      serverCount = minecraftServers.length;

      // Fetch players from each server
      for (const container of minecraftServers) {
        const serverId = container.Id;
        const serverName = container.Labels?.['server_name'] || 
                          container.Names[0]?.replace(/^\//, '') || 
                          'Unknown Server';

        try {
          // Get container IP
          const serverIp = await this.getContainerIP(serverId);
          
          if (!serverIp) {
            errors.push(`${serverName}: No IP address found`);
            continue;
          }

          // Check if plugin is available
          const pluginAvailable = await this.checkPluginHealth(serverIp);
          
          if (!pluginAvailable) {
            errors.push(`${serverName}: Plugin not available or not responding`);
            continue;
          }

          // Fetch player data
          const players = await this.getServerPlayers(serverId, serverName, serverIp);
          allPlayers.push(...players);

        } catch (error: any) {
          errors.push(`${serverName}: ${error.message}`);
        }
      }

      return {
        players: allPlayers,
        totalCount: allPlayers.length,
        serverCount: serverCount,
        timestamp: Date.now(),
        errors: errors,
      };

    } catch (error: any) {
      console.error('Error fetching players:', error);
      throw new Error(`Failed to fetch players: ${error.message}`);
    }
  }

  /**
   * Get players from a specific server by ID
   */
  async getServerPlayersById(serverId: string): Promise<PlayerData[]> {
    try {
      const container = docker.getContainer(serverId);
      const info = await container.inspect();
      
      const serverName = info.Config.Labels?.['server_name'] || 
                        info.Name?.replace(/^\//, '') || 
                        'Unknown Server';

      const serverIp = await this.getContainerIP(serverId);
      
      if (!serverIp) {
        throw new Error('Server IP not found');
      }

      const pluginAvailable = await this.checkPluginHealth(serverIp);
      
      if (!pluginAvailable) {
        throw new Error('Plugin not available');
      }

      return await this.getServerPlayers(serverId, serverName, serverIp);

    } catch (error: any) {
      throw new Error(`Failed to fetch players for server ${serverId}: ${error.message}`);
    }
  }
}

export const playerService = new PlayerService();
