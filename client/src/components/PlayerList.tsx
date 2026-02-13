import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, MapPin, Heart, Gamepad2, Package, TrendingUp, Award, Wifi, Activity, RefreshCw, AlertCircle, Server } from 'lucide-react';

interface PlayerLocation {
  x: number;
  y: number;
  z: number;
  world: string;
  pitch: number;
  yaw: number;
}

interface InventoryItem {
  slot: number;
  type: string;
  amount: number;
  durability: number;
  displayName?: string;
  enchantments?: string[];
}

interface PlayerStatistics {
  playTime?: number;
  deaths?: number;
  mobKills?: number;
  playerKills?: number;
  jumps?: number;
  distanceWalked?: number;
  distanceFlown?: number;
}

interface PlayerData {
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

interface PlayerListResponse {
  players: PlayerData[];
  totalCount: number;
  serverCount: number;
  timestamp: number;
  errors: string[];
}

export default function PlayerList() {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverCount, setServerCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPlayers = async () => {
    try {
      setError(null);
      const response = await axios.get<PlayerListResponse>('/api/players');
      setPlayers(response.data.players);
      setServerCount(response.data.serverCount);
      setErrors(response.data.errors || []);
      setLastUpdate(new Date());
    } catch (e: any) {
      console.error('Failed to fetch players:', e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();

    if (autoRefresh) {
      const interval = setInterval(fetchPlayers, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatPlayTime = (ticks?: number) => {
    if (!ticks) return 'N/A';
    const seconds = Math.floor(ticks / 20);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDistance = (cm?: number) => {
    if (!cm) return 'N/A';
    const meters = Math.floor(cm / 100);
    if (meters > 1000) {
      return `${(meters / 1000).toFixed(1)}km`;
    }
    return `${meters}m`;
  };

  const getGameModeColor = (mode: string) => {
    switch (mode) {
      case 'SURVIVAL': return 'text-green-400';
      case 'CREATIVE': return 'text-yellow-400';
      case 'ADVENTURE': return 'text-blue-400';
      case 'SPECTATOR': return 'text-gray-400';
      default: return 'text-white';
    }
  };

  const getHealthColor = (health: number, maxHealth: number) => {
    const percentage = (health / maxHealth) * 100;
    if (percentage > 70) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-gray-400">Loading players...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">Error loading players</span>
        </div>
        <p className="text-sm text-gray-400 mt-2">{error}</p>
        <button
          onClick={fetchPlayers}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white">{players.length} Online</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">{serverCount} Servers</span>
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={fetchPlayers}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Errors from servers */}
      {errors.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/50 rounded p-3 mb-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>Plugin not available on some servers:</span>
          </div>
          <ul className="text-xs text-gray-400 space-y-1">
            {errors.map((err, idx) => (
              <li key={idx}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* No players */}
      {players.length === 0 && (
        <div className="text-center py-12 bg-gray-800/50 rounded">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No players online</p>
        </div>
      )}

      {/* Player Grid */}
      {players.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((player) => (
            <div
              key={player.uuid}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer border border-gray-700"
              onClick={() => setSelectedPlayer(player)}
            >
              {/* Player Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://mc-heads.net/avatar/${player.name}/48`}
                    alt={player.name}
                    className="w-12 h-12 rounded"
                  />
                  <div>
                    <h3 className="font-bold text-white">{player.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                        {player.server || 'Unknown'}
                      </span>
                      <span className={`text-xs font-medium ${getGameModeColor(player.gameMode)}`}>
                        {player.gameMode}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Wifi className="w-3 h-3" />
                  <span>{player.ping}ms</span>
                </div>
              </div>

              {/* Health Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    <span>Health</span>
                  </div>
                  <span>{player.health.toFixed(1)} / {player.maxHealth}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getHealthColor(player.health, player.maxHealth)}`}
                    style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-gray-400">
                  <MapPin className="w-3 h-3" />
                  <span>
                    {Math.round(player.location.x)}, {Math.round(player.location.y)}, {Math.round(player.location.z)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Gamepad2 className="w-3 h-3" />
                  <span>Lvl {player.level}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Package className="w-3 h-3" />
                  <span>{player.inventory.length} items</span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Award className="w-3 h-3" />
                  <span>{player.advancementCount} achievements</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-gray-700 p-6">
              <div className="flex items-center gap-4">
                <img
                  src={`https://mc-heads.net/avatar/${selectedPlayer.name}/64`}
                  alt={selectedPlayer.name}
                  className="w-16 h-16 rounded"
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white">{selectedPlayer.name}</h2>
                  <p className="text-sm text-gray-400 mt-1">{selectedPlayer.uuid}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs bg-cyan-600 px-2 py-1 rounded">
                      {selectedPlayer.server}
                    </span>
                    <span className={`text-xs font-medium ${getGameModeColor(selectedPlayer.gameMode)}`}>
                      {selectedPlayer.gameMode}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </h3>
                <div className="bg-gray-900 rounded p-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">World:</span>
                    <span className="text-white ml-2">{selectedPlayer.location.world}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Coordinates:</span>
                    <span className="text-white ml-2">
                      {Math.round(selectedPlayer.location.x)}, {Math.round(selectedPlayer.location.y)}, {Math.round(selectedPlayer.location.z)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Status
                </h3>
                <div className="bg-gray-900 rounded p-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Health:</span>
                    <span className="text-white ml-2">{selectedPlayer.health.toFixed(1)} / {selectedPlayer.maxHealth}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Food:</span>
                    <span className="text-white ml-2">{selectedPlayer.foodLevel} / 20</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Level:</span>
                    <span className="text-white ml-2">{selectedPlayer.level}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">XP:</span>
                    <span className="text-white ml-2">{selectedPlayer.totalExperience}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Ping:</span>
                    <span className="text-white ml-2">{selectedPlayer.ping}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-400">IP:</span>
                    <span className="text-white ml-2 text-xs">{selectedPlayer.address}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Statistics
                </h3>
                <div className="bg-gray-900 rounded p-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Play Time:</span>
                    <span className="text-white ml-2">{formatPlayTime(selectedPlayer.statistics.playTime)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Deaths:</span>
                    <span className="text-white ml-2">{selectedPlayer.statistics.deaths || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Mob Kills:</span>
                    <span className="text-white ml-2">{selectedPlayer.statistics.mobKills || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Player Kills:</span>
                    <span className="text-white ml-2">{selectedPlayer.statistics.playerKills || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Distance Walked:</span>
                    <span className="text-white ml-2">{formatDistance(selectedPlayer.statistics.distanceWalked)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Distance Flown:</span>
                    <span className="text-white ml-2">{formatDistance(selectedPlayer.statistics.distanceFlown)}</span>
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Inventory ({selectedPlayer.inventory.length} items)
                </h3>
                <div className="bg-gray-900 rounded p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {selectedPlayer.inventory.map((item, idx) => (
                      <div key={idx} className="bg-gray-800 rounded p-2">
                        <div className="font-medium text-white">{item.type}</div>
                        <div className="text-gray-400 mt-1">
                          Slot {item.slot} • x{item.amount}
                        </div>
                        {item.enchantments && item.enchantments.length > 0 && (
                          <div className="text-purple-400 text-xs mt-1">
                            {item.enchantments.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Achievements ({selectedPlayer.advancementCount} completed)
                </h3>
                <div className="bg-gray-900 rounded p-4 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {selectedPlayer.achievements.slice(0, 20).map((achievement, idx) => (
                      <span key={idx} className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                        {achievement.split('/').pop()}
                      </span>
                    ))}
                    {selectedPlayer.achievements.length > 20 && (
                      <span className="text-xs text-gray-400 px-2 py-1">
                        +{selectedPlayer.achievements.length - 20} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
