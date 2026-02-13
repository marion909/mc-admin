import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Console from '../components/Console';
import FileManager from '../components/FileManager';
import PlayerList from '../components/PlayerList';
import { 
    Folder as FolderIcon, Terminal, Box, Play, Square, 
    Trash2, Plus, Server as ServerIcon, Cpu, Settings, Puzzle, Download, X, ExternalLink, Search, Edit,
    Database as DatabaseIcon, Copy, Lock, Users, Package
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';

type ServerContainer = {
    Id: string;
    Names: string[];
    State: string;
    Status: string;
    Labels: Record<string, string>;
    Ports?: { PublicPort: number }[];
};

type ProxyServer = {
    Id: string;
    Names: string[];
    State: string;
    Status: string;
    Labels: Record<string, string>;
    Ports?: { PublicPort: number }[];
};

type DatabaseServer = {
    Id: string;
    Names: string[];
    State: string;
    Status: string;
    Labels: Record<string, string>;
    Ports?: { PublicPort: number }[];
};

function Dashboard() {
  const { logout, isAuthenticated, isLoading } = useAuth();
  const [servers, setServers] = useState<ServerContainer[]>([]);
  const [proxies, setProxies] = useState<ProxyServer[]>([]);
  const [databases, setDatabases] = useState<DatabaseServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeConsoleId, setActiveConsoleId] = useState<string | null>(null);
  const [activeFileManagerId, setActiveFileManagerId] = useState<string | null>(null);
  const [pluginModalId, setPluginModalId] = useState<string | null>(null);
  const [pluginUrl, setPluginUrl] = useState('');
  const [pluginFile, setPluginFile] = useState<File | null>(null);
  const [pluginUploadMode, setPluginUploadMode] = useState<'url' | 'file' | 'mcadmin'>('url');
  const [installingPlugin, setInstallingPlugin] = useState(false);
  
  // Auth states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '' });

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await axios.post('/api/change-password', {
              currentPassword: passwordForm.current,
              newPassword: passwordForm.new
          });
          alert('Password changed successfully');
          setShowChangePassword(false);
          setPasswordForm({ current: '', new: '' });
      } catch (err: any) {
          alert(`Failed to change password: ${err.response?.data?.error || err.message}`);
      }
  };
  
  // Edit State
  const [editServerId, setEditServerId] = useState<string | null>(null);
  const [editProxyId, setEditProxyId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  
  // Form State
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateProxy, setShowCreateProxy] = useState(false);
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
      name: '',
      port: '25565',
      type: 'PAPER',
      version: 'latest',
      ram: '2G',
      motd: 'A Minecraft Server',
      difficulty: 'easy',
      gamemode: 'survival',
      maxPlayers: 20,
      onlineMode: true,
      useAikarFlags: false,
      viewDistance: 10,
      levelType: 'DEFAULT',
      seed: '',
      icon: ''
  });

  const [proxyFormData, setProxyFormData] = useState({
      name: '',
      port: '25577',
      motd: '&3A Velocity Server',
      showMaxPlayers: 500,
      onlineMode: true,
      forwardingMode: 'LEGACY',
      ram: '512M',
      servers: [{ name: 'lobby', address: 'host.docker.internal:25565' }] as any[],
      tryServers: ['lobby']
  });

  // Database Form Data
  const [dbFormData, setDbFormData] = useState({
      name: '',
      type: 'postgres', // or mysql
      version: '', // default
      user: '',
      password: '',
      database: '',
      port: 0 // auto
  });

  const fetchServers = async () => {
    if (servers.length === 0) setLoading(true);
    try {
        const res = await axios.get('/api/servers');
        setServers(res.data);
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    
    fetchServers();
    fetchProxies();
    fetchDatabases();
    const interval = setInterval(() => {
        fetchServers();
        fetchProxies();
        fetchDatabases();
    }, 5000); 
    return () => clearInterval(interval);
  }, [isAuthenticated, isLoading]);

  const fetchProxies = async () => {
    try {
        const res = await axios.get('/api/proxies');
        setProxies(res.data);
    } catch (err) {
        console.error(err);
    }
  };

  const fetchDatabases = async () => {
      try {
          const res = await axios.get('/api/databases');
          setDatabases(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      try {
          await axios.post('/api/servers', formData);
          setShowCreate(false);
          setFormData({
              name: '',
              port: String(Number(formData.port) + 1), // Auto increment port
              type: 'PAPER',
              version: 'latest',
              ram: '2G',
              motd: 'A Minecraft Server',
              difficulty: 'easy',
              gamemode: 'survival',
              maxPlayers: 20,
              onlineMode: true,
              useAikarFlags: false,
              viewDistance: 10,
              levelType: 'DEFAULT',
              seed: '',
              icon: ''
          });
          setTimeout(fetchServers, 1000);
      } catch (err) {
          alert('Failed to create server');
      } finally {
          setCreating(false);
      }
  };

  const handleAction = async (id: string, action: 'start' | 'stop' | 'delete') => {
      if (action === 'delete' && !confirm('Are you sure? Data will be lost.')) return;
      try {
          if (action === 'delete') {
            await axios.delete(`/api/servers/${id}`);
          } else {
            await axios.post(`/api/servers/${id}/${action}`);
          }
           setTimeout(fetchServers, 500);
      } catch (err) {
          console.error(err);
          alert('Action failed');
      }
  };

  const handleProxyAction = async (id: string, action: 'start' | 'stop' | 'delete') => {
      if (action === 'delete' && !confirm('Are you sure? Proxy data will be lost.')) return;
      try {
          if (action === 'delete') {
            await axios.delete(`/api/proxies/${id}`);
          } else {
            await axios.post(`/api/proxies/${id}/${action}`);
          }
           setTimeout(fetchProxies, 500);
      } catch (err) {
          console.error(err);
          alert('Action failed');
      }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      try {
          await axios.post('/api/databases', dbFormData);
          setShowCreateDb(false);
          fetchDatabases();
          setDbFormData({
            name: '',
            type: 'postgres',
            version: '',
            user: '',
            password: '',
            database: '',
            port: 0
          });
      } catch (err: any) {
          alert(err.response?.data?.error || err.message);
      } finally {
          setCreating(false);
      }
  };

  const handleCreateProxy = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      try {
          await axios.post('/api/proxies', proxyFormData);
          setShowCreateProxy(false);
          setProxyFormData({
              name: '',
              port: String(Number(proxyFormData.port) + 1),
              motd: '&3A Velocity Server',
              showMaxPlayers: 500,
              onlineMode: true,
              forwardingMode: 'LEGACY',
              ram: '512M',
              servers: [{ name: 'lobby', address: 'host.docker.internal:25565' }],
              tryServers: ['lobby']
          });
          setTimeout(fetchProxies, 1000);
      } catch (err: any) {
          alert(`Failed to create proxy: ${err.response?.data?.error || err.message}`);
      } finally {
          setCreating(false);
      }
  };

  const handleProxyInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      setProxyFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
  };

  const addProxyServer = () => {
      setProxyFormData(prev => ({
          ...prev,
          servers: [...prev.servers, { name: '', address: '' }]
      }));
  };

  const removeProxyServer = (index: number) => {
      setProxyFormData(prev => ({
          ...prev,
          servers: prev.servers.filter((_, i) => i !== index)
      }));
  };

  const updateProxyServer = (index: number, field: 'name' | 'address', value: string) => {
      setProxyFormData(prev => ({
          ...prev,
          servers: prev.servers.map((s, i) => i === index ? { ...s, [field]: value } : s)
      }));
  };

  const handleInstallPlugin = async () => {
      if (pluginUploadMode === 'url') {
          if (!pluginUrl || !pluginModalId) return;
          setInstallingPlugin(true);
          try {
              await axios.post(`/api/servers/${pluginModalId}/plugins`, { url: pluginUrl });
              setPluginModalId(null);
              setPluginUrl('');
              alert('Plugin installed successfully! Restart server to load.');
          } catch (err: any) {
              alert(`Failed to install plugin: ${err.response?.data?.error || err.message}`);
          } finally {
              setInstallingPlugin(false);
          }
      } else {
          // File upload mode
          if (!pluginFile || !pluginModalId) return;
          setInstallingPlugin(true);
          try {
              const formData = new FormData();
              formData.append('plugin', pluginFile);
              
              await axios.post(`/api/servers/${pluginModalId}/plugins/upload`, formData, {
                  headers: {
                      'Content-Type': 'multipart/form-data'
                  }
              });
              
              setPluginModalId(null);
              setPluginFile(null);
              alert('Plugin uploaded successfully! Restart server to load.');
          } catch (err: any) {
              alert(`Failed to upload plugin: ${err.response?.data?.error || err.message}`);
          } finally {
              setInstallingPlugin(false);
          }
      }
  };

  const openEditServer = async (serverId: string) => {
      try {
          const res = await axios.get(`/api/servers/${serverId}/config`);
          setEditFormData(res.data);
          setEditServerId(serverId);
      } catch (err: any) {
          alert(`Failed to load server config: ${err.response?.data?.error || err.message}`);
      }
  };

  const openEditProxy = async (proxyId: string) => {
      try {
          const res = await axios.get(`/api/proxies/${proxyId}/config`);
          setEditFormData(res.data);
          setEditProxyId(proxyId);
      } catch (err: any) {
          alert(`Failed to load proxy config: ${err.response?.data?.error || err.message}`);
      }
  };

  const handleUpdateServer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editServerId || !editFormData) return;
      setCreating(true);
      try {
          await axios.put(`/api/servers/${editServerId}/config`, editFormData);
          setEditServerId(null);
          setEditFormData(null);
          alert('Server updated! Restart to apply changes.');
          setTimeout(fetchServers, 500);
      } catch (err: any) {
          alert(`Failed to update server: ${err.response?.data?.error || err.message}`);
      } finally {
          setCreating(false);
      }
  };

  const handleUpdateProxy = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editProxyId || !editFormData) return;
      setCreating(true);
      try {
          await axios.put(`/api/proxies/${editProxyId}/config`, editFormData);
          setEditProxyId(null);
          setEditFormData(null);
          alert('Proxy updated! Restart to apply changes.');
          setTimeout(fetchProxies, 500);
      } catch (err: any) {
          alert(`Failed to update proxy: ${err.response?.data?.error || err.message}`);
      } finally {
          setCreating(false);
      }
  };

  const configureServerForProxy = async (serverId: string) => {
      if (!confirm('This will set online-mode=false and enable Velocity forwarding. Continue?')) return;
      try {
          const res = await axios.post(`/api/servers/${serverId}/configure-proxy`);
          alert(res.data.message || 'Server configured for proxy! Restart to apply.');
      } catch (err: any) {
          alert(`Failed to configure: ${err.response?.data?.error || err.message}`);
      }
  };

  const recreateServerForProxy = async (serverId: string) => {
      if (!confirm('⚠️ This will RECREATE the container with ONLINE_MODE=FALSE.\n\nYour world data and plugins are SAFE (stored in volumes).\n\nThe server will be stopped and recreated. Continue?')) return;
      try {
          const res = await axios.post(`/api/servers/${serverId}/recreate-for-proxy`);
          alert(res.data.message || 'Server recreated! Start it now.');
          setTimeout(fetchServers, 1000);
          setEditServerId(null);
      } catch (err: any) {
          alert(`Failed to recreate: ${err.response?.data?.error || err.message}`);
      }
  };

  const copySecretFromProxy = async (serverId: string) => {
      // Get list of proxies to choose from
      if (proxies.length === 0) {
          alert('No proxies found. Create a proxy with MODERN mode first.');
          return;
      }

      let proxyId: string;

      if (proxies.length === 1) {
          // Auto-select if only one proxy
          proxyId = proxies[0].Id;
          const proxyName = proxies[0].Labels['server_name'] || proxies[0].Names[0];
          if (!confirm(`Copy secret from proxy "${proxyName}"?`)) return;
      } else {
          // Let user choose
          const proxyNames = proxies.map(p => p.Labels['server_name'] || p.Names[0]);
          const choice = prompt(`Copy secret from which proxy?\n\n${proxyNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEnter number:`);
          
          if (!choice) return;
          
          const index = parseInt(choice.trim()) - 1;
          if (isNaN(index) || index < 0 || index >= proxies.length) {
              alert(`Invalid selection. Please enter a number between 1 and ${proxies.length}.`);
              return;
          }

          proxyId = proxies[index].Id;
      }

      try {
          const res = await axios.post(`/api/servers/${serverId}/copy-secret/${proxyId}`);
          alert(res.data.message || 'Secret copied! Restart server to apply.');
      } catch (err: any) {
          alert(`Failed to copy secret: ${err.response?.data?.error || err.message}`);
      }
  };

  const showProxySecret = async (proxyId: string) => {
      try {
          const res = await axios.get(`/api/proxies/${proxyId}/secret`);
          prompt('Forwarding Secret (MODERN mode):\nCopy this to your Paper server config if manual setup needed:', res.data.secret);
      } catch (err: any) {
          alert(`Failed to get secret: ${err.response?.data?.error || err.message}`);
      }
  };

  /*
  const quickSetProxyForwarding = async (proxyId: string, mode: string) => {
      try {
          await axios.put(`/api/proxies/${proxyId}/config`, { forwardingMode: mode });
          alert(`Forwarding mode set to ${mode}. Restart proxy to apply.`);
          setTimeout(fetchProxies, 500);
      } catch (err: any) {
          alert(`Failed: ${err.response?.data?.error || err.message}`);
      }
  };
  */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
             <div className="bg-green-600 p-2 rounded-lg">
                <Box className="w-6 h-6 text-white" />
             </div>
             <h1 className="text-2xl font-bold tracking-tight">MC-Admin</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> New Server
            </button>
            <button 
              onClick={() => setShowCreateProxy(!showCreateProxy)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-md font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> New Proxy Server
            </button>
            <button 
              onClick={() => setShowCreateDb(!showCreateDb)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md font-medium transition-colors border border-slate-600"
            >
              <Plus className="w-4 h-4" /> New Database
            </button>
            <div className="w-px h-8 bg-slate-800 mx-2"></div>
             <button 
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-md font-medium transition-colors border border-slate-700"
            >
              <Lock className="w-4 h-4" /> Password
            </button>
             <button 
              onClick={logout}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-md font-medium transition-colors border border-red-500/20"
            >
              Logout
            </button>
          </div>
        </header>

        {showCreate && (
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg mb-8 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-2 mb-6 text-slate-200">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Server Configuration</h3>
                </div>
                
                <form onSubmit={handleCreate}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        {/* Core Settings */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Core</h4>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Server Name</label>
                                <input 
                                    name="name"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 focus:ring-1 ring-blue-500 outline-none text-sm" 
                                    value={formData.name} onChange={handleInputChange}
                                    placeholder="Survival-01" required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Port</label>
                                <input 
                                    name="port"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.port} onChange={handleInputChange}
                                    type="number" required
                                />
                            </div>
                        </div>

                        {/* Software */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Software</h4>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Type</label>
                                <select 
                                    name="type"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.type} onChange={handleInputChange}
                                >
                                    <option value="PAPER">Paper</option>
                                    <option value="VANILLA">Vanilla</option>
                                    <option value="SPIGOT">Spigot</option>
                                    <option value="FORGE">Forge</option>
                                    <option value="FABRIC">Fabric</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Version</label>
                                <input 
                                    name="version"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.version} onChange={handleInputChange}
                                    placeholder="latest"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">RAM</label>
                                <input 
                                    name="ram"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.ram} onChange={handleInputChange}
                                    placeholder="2G"
                                />
                            </div>
                        </div>

                        {/* Gameplay */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider">Gameplay</h4>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">Gamemode</label>
                                <select 
                                    name="gamemode"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.gamemode} onChange={handleInputChange}
                                >
                                    <option value="survival">Survival</option>
                                    <option value="creative">Creative</option>
                                    <option value="adventure">Adventure</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
                                <select 
                                    name="difficulty"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.difficulty} onChange={handleInputChange}
                                >
                                    <option value="peaceful">Peaceful</option>
                                    <option value="easy">Easy</option>
                                    <option value="normal">Normal</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Max Players</label>
                                <input 
                                    name="maxPlayers"
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.maxPlayers} onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* World Settings */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-teal-400 uppercase tracking-wider">World</h4>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Level Type</label>
                                <select 
                                    name="levelType"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.levelType || 'DEFAULT'} onChange={handleInputChange}
                                >
                                    <option value="DEFAULT">Default</option>
                                    <option value="FLAT">Flat</option>
                                    <option value="LARGEBIOMES">Large Biomes</option>
                                    <option value="AMPLIFIED">Amplified</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Seed</label>
                                <input 
                                    name="seed"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.seed || ''} onChange={handleInputChange}
                                    placeholder="Random"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">View Distance</label>
                                <input 
                                    name="viewDistance"
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.viewDistance} onChange={handleInputChange}
                                />
                            </div>
                        </div>

                         {/* Advanced */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-orange-400 uppercase tracking-wider">Advanced</h4>
                            <div className="flex items-center gap-2">
                                <input 
                                    name="onlineMode"
                                    type="checkbox"
                                    id="onlineMode"
                                    checked={formData.onlineMode}
                                    onChange={handleInputChange}
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-950"
                                />
                                <label htmlFor="onlineMode" className="text-sm text-slate-300">Online Mode</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    name="useAikarFlags"
                                    type="checkbox"
                                    id="useAikarFlags"
                                    checked={formData.useAikarFlags}
                                    onChange={handleInputChange}
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-950"
                                />
                                <label htmlFor="useAikarFlags" className="text-sm text-slate-300">Use Aikar Flags</label>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">MOTD</label>
                                <input 
                                    name="motd"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.motd} onChange={handleInputChange}
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">Pack/Image Icon URL</label>
                                <input 
                                    name="icon"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={formData.icon || ''} onChange={handleInputChange}
                                    placeholder="http://..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                        <button 
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="bg-transparent hover:bg-slate-800 px-4 py-2 rounded font-medium text-slate-400 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            disabled={creating}
                            className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            {creating ? 'Deploying...' : <><Play className="w-4 h-4 fill-current" /> Deploy Server</>}
                        </button>
                    </div>
                </form>
            </div>
        )}

        {showCreateProxy && (
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg mb-8 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-2 mb-6 text-slate-200">
                    <ServerIcon className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Velocity Proxy Configuration</h3>
                </div>
                
                <form onSubmit={handleCreateProxy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Basic Settings */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Basic Settings</h4>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Proxy Name</label>
                                <input 
                                    name="name"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 focus:ring-1 ring-purple-500 outline-none text-sm" 
                                    value={proxyFormData.name} onChange={handleProxyInputChange}
                                    placeholder="proxy-01" required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Port</label>
                                <input 
                                    name="port"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={proxyFormData.port} onChange={handleProxyInputChange}
                                    placeholder="25577" required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">MOTD</label>
                                <input 
                                    name="motd"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={proxyFormData.motd} onChange={handleProxyInputChange}
                                    placeholder="&3A Velocity Server"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Max Players (Display)</label>
                                <input 
                                    name="showMaxPlayers"
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={proxyFormData.showMaxPlayers} onChange={handleProxyInputChange}
                                />
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Advanced Settings</h4>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">RAM</label>
                                <input 
                                    name="ram"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={proxyFormData.ram} onChange={handleProxyInputChange}
                                    placeholder="512M"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Forwarding Mode</label>
                                <select 
                                    name="forwardingMode"
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                    value={proxyFormData.forwardingMode} onChange={handleProxyInputChange}
                                >
                                    <option value="NONE">NONE</option>
                                    <option value="LEGACY">LEGACY (Compatible with all servers)</option>
                                    <option value="BUNGEEGUARD">BUNGEEGUARD</option>
                                    <option value="MODERN">MODERN (Paper only, needs secret)</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">💡 LEGACY works with all server types</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    name="onlineMode"
                                    type="checkbox"
                                    className="w-4 h-4" 
                                    checked={proxyFormData.onlineMode} 
                                    onChange={(e) => setProxyFormData(prev => ({ ...prev, onlineMode: e.target.checked }))}
                                />
                                <label className="text-sm text-slate-300">Online Mode (Mojang Auth)</label>
                            </div>
                        </div>
                    </div>

                    {/* Backend Servers */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Backend Servers</h4>
                            <button 
                                type="button"
                                onClick={addProxyServer}
                                className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-xs font-medium transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Add Server
                            </button>
                        </div>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {proxyFormData.servers.map((server, idx) => (
                                <div key={idx} className="flex gap-3 items-end bg-slate-950 p-3 rounded border border-slate-800">
                                    <div className="flex-1">
                                        <label className="block text-xs text-slate-400 mb-1">Server Name</label>
                                        <input 
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                            value={server.name}
                                            onChange={(e) => updateProxyServer(idx, 'name', e.target.value)}
                                            placeholder="lobby" required
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-slate-400 mb-1">Address (IP:Port)</label>
                                        <input 
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 outline-none text-sm" 
                                            value={server.address}
                                            onChange={(e) => updateProxyServer(idx, 'address', e.target.value)}
                                            placeholder="host.docker.internal:25565" required
                                        />
                                    </div>
                                    {proxyFormData.servers.length > 1 && (
                                        <button 
                                            type="button"
                                            onClick={() => removeProxyServer(idx)}
                                            className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowCreateProxy(false)}
                            className="bg-transparent hover:bg-slate-800 px-4 py-2 rounded font-medium text-slate-400 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            disabled={creating}
                            className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded font-medium disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/20"
                        >
                            {creating ? 'Deploying...' : <><Play className="w-4 h-4 fill-current" /> Deploy Proxy</>}
                        </button>
                    </div>
                </form>
            </div>
        )}

        {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-full max-w-md shadow-xl">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-blue-500" />
                        Change Password
                    </h3>
                    <button onClick={() => setShowChangePassword(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handlePasswordChange}>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Current Password</label>
                            <input 
                                type="password"
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={passwordForm.current}
                                onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">New Password</label>
                            <input 
                                type="password"
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={passwordForm.new}
                                onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowChangePassword(false)}
                            className="px-4 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors font-bold"
                        >
                            Change Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

        {/* ... Rest of the UI remains the same ... */}
        {activeConsoleId && (
            <Console 
                serverId={activeConsoleId} 
                onClose={() => setActiveConsoleId(null)} 
            />
        )}
        
        {activeFileManagerId && (
            <FileManager 
                serverId={activeFileManagerId} 
                onClose={() => setActiveFileManagerId(null)} 
            />
        )}

        {pluginModalId && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-slate-900 w-full max-w-xl rounded-lg shadow-2xl border border-slate-700 overflow-hidden">
                    <header className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <Puzzle className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold">Install Plugin</h3>
                        </div>
                        <button onClick={() => {
                            setPluginModalId(null);
                            setPluginUrl('');
                            setPluginFile(null);
                            setPluginUploadMode('url');
                        }} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </header>
                    
                    {/* Tab Switcher */}
                    <div className="flex border-b border-slate-700 bg-slate-800/50">
                        <button 
                            onClick={() => setPluginUploadMode('mcadmin')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                pluginUploadMode === 'mcadmin' 
                                    ? 'bg-slate-900 text-purple-400 border-b-2 border-purple-400' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            ⭐ MC-Admin Plugins
                        </button>
                        <button 
                            onClick={() => setPluginUploadMode('url')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                pluginUploadMode === 'url' 
                                    ? 'bg-slate-900 text-purple-400 border-b-2 border-purple-400' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            📥 Download from URL
                        </button>
                        <button 
                            onClick={() => setPluginUploadMode('file')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                pluginUploadMode === 'file' 
                                    ? 'bg-slate-900 text-purple-400 border-b-2 border-purple-400' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            📤 Upload JAR File
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        {pluginUploadMode === 'mcadmin' ? (
                            <>
                                <div className="bg-purple-900/20 border border-purple-800/50 rounded p-4">
                                    <h4 className="text-sm font-semibold text-purple-300 mb-2">🌟 Official MC-Admin Plugins</h4>
                                    <p className="text-xs text-slate-400">
                                        Diese Plugins wurden speziell für MC-Admin entwickelt und sind vollständig kompatibel mit dem Admin Panel.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {/* MCAdmin-DataAPI Plugin */}
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-purple-500 transition-all">
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h5 className="font-semibold text-purple-400 flex items-center gap-2">
                                                        <Users className="w-4 h-4" />
                                                        MCAdmin-DataAPI
                                                        <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded border border-green-800">v1.0.0</span>
                                                    </h5>
                                                    <p className="text-xs text-slate-400 mt-1">Player Data & Statistics API</p>
                                                </div>
                                            </div>
                                            
                                            <p className="text-sm text-slate-300 mb-3">
                                                Stellt REST API zur Verfügung für Echtzeit-Spielerdaten: Position, Health, Inventar, Statistiken und Achievements. 
                                                Erforderlich für die Players-Tab Funktion im Dashboard.
                                            </p>

                                            <div className="space-y-2 text-xs">
                                                <div className="flex gap-2">
                                                    <span className="text-slate-500">📋 API Port:</span>
                                                    <span className="text-slate-300 font-mono">8080</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className="text-slate-500">✅ Kompatibel:</span>
                                                    <span className="text-slate-300">Spigot 1.20+, Paper 1.20+</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className="text-slate-500">📦 Abhängigkeiten:</span>
                                                    <span className="text-slate-300">Keine</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 p-3 bg-slate-900 rounded border border-slate-700">
                                                <p className="text-xs font-semibold text-yellow-400 mb-2">⚙️ Konfiguration erforderlich:</p>
                                                <div className="space-y-1 text-xs text-slate-400">
                                                    <p>1. Port 8080 im Docker Container veröffentlichen</p>
                                                    <p>2. API Key in <span className="font-mono text-purple-400">plugins/MCAdmin-DataAPI/config.yml</span> setzen</p>
                                                    <p>3. Server neustarten</p>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => {
                                                    setPluginUrl('http://localhost:3001/api/mc-admin-plugins/MCAdmin-DataAPI-1.0.0.jar');
                                                    handleInstallPlugin();
                                                }}
                                                className="w-full mt-4 bg-purple-600 hover:bg-purple-500 rounded px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                Plugin installieren
                                            </button>
                                        </div>
                                    </div>

                                    {/* Placeholder for future plugins */}
                                    <div className="bg-slate-800/50 border border-slate-700 border-dashed rounded-lg p-6 text-center">
                                        <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500">Weitere MC-Admin Plugins kommen bald...</p>
                                        <p className="text-xs text-slate-600 mt-1">Check GitHub für Updates</p>
                                    </div>
                                </div>
                            </>
                        ) : pluginUploadMode === 'url' ? (
                            <>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Plugin JAR URL</label>
                                    <input 
                                        type="url"
                                        placeholder="https://example.com/plugin.jar"
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-4 py-2 outline-none focus:ring-2 ring-purple-500"
                                        value={pluginUrl}
                                        onChange={(e) => setPluginUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Enter direct download URL for .jar file</p>
                                </div>

                        <div className="flex gap-2">
                            <a href="https://mcpluginfinder.com/" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm transition-colors">
                                <Search className="w-4 h-4" />
                                Search Plugins
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <a href="https://modrinth.com/plugins" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-green-900/30 hover:bg-green-900/50 border border-green-800 rounded px-3 py-2 text-sm transition-colors text-green-300">
                                Modrinth
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <a href="https://hangar.papermc.io/" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800 rounded px-3 py-2 text-sm transition-colors text-blue-300">
                                Hangar
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700 rounded p-3 max-h-64 overflow-y-auto">
                            <h4 className="text-sm font-semibold mb-2 text-slate-300">Popular Plugins:</h4>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-purple-400 mb-1">🔐 Permissions & Admin</p>
                                    <div className="space-y-1">
                                        <button onClick={() => setPluginUrl('https://download.luckperms.net/1620/bukkit/loader/LuckPerms-Bukkit-5.5.32.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">LuckPerms - Advanced permissions</button>
                                        <button onClick={() => setPluginUrl('https://github.com/EssentialsX/Essentials/releases/download/2.21.2/EssentialsX-2.21.2.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">EssentialsX - Core commands</button>
                                        <button onClick={() => setPluginUrl('https://ci.lucko.me/job/spark/514/artifact/spark-bukkit/build/libs/spark-1.10.165-bukkit.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">Spark - Performance profiler</button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-green-400 mb-1">🌍 World Management</p>
                                    <div className="space-y-1">
                                        <button onClick={() => setPluginUrl('https://hangarcdn.papermc.io/plugins/EngineHub/WorldEdit/versions/7.4.0/PAPER/worldedit-bukkit-7.4.0.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">WorldEdit - Map editor</button>
                                        <button onClick={() => setPluginUrl('https://hangarcdn.papermc.io/plugins/pop4959/Chunky/versions/1.4.40/PAPER/Chunky-Bukkit-1.4.40.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">Chunky - Chunk pre-generator</button>
                                        <button onClick={() => setPluginUrl('https://github.com/Multiverse/Multiverse-Core/releases/download/5.5.2/multiverse-core-5.5.2.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">Multiverse-Core - Multi-world</button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-yellow-400 mb-1">🛡️ Protection & Security</p>
                                    <div className="space-y-1">
                                        <button onClick={() => setPluginUrl('https://github.com/dmulloy2/ProtocolLib/releases/download/5.4.0/ProtocolLib.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">ProtocolLib - Packet manipulation</button>
                                        <button onClick={() => setPluginUrl('https://github.com/MilkBowl/Vault/releases/download/1.7.3/Vault.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">Vault - Economy & permissions API</button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-orange-400 mb-1">🎮 Gameplay Enhancements</p>
                                    <div className="space-y-1">
                                        <button onClick={() => setPluginUrl('https://hangarcdn.papermc.io/plugins/HelpChat/PlaceholderAPI/versions/2.12.2/PAPER/PlaceholderAPI-2.12.2.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">PlaceholderAPI - Dynamic placeholders</button>
                                        <button onClick={() => setPluginUrl('https://hangarcdn.papermc.io/plugins/ViaVersion/ViaVersion/versions/5.7.1/PAPER/ViaVersion-5.7.1.jar')} className="block w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs text-blue-400">ViaVersion - Multi-version support</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Select JAR File</label>
                                    <div className="relative">
                                        <input 
                                            type="file"
                                            accept=".jar"
                                            onChange={(e) => setPluginFile(e.target.files?.[0] || null)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-4 py-2 outline-none focus:ring-2 ring-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 file:cursor-pointer"
                                        />
                                    </div>
                                    {pluginFile && (
                                        <div className="mt-3 p-3 bg-slate-800 border border-slate-700 rounded">
                                            <p className="text-xs text-slate-400">Selected file:</p>
                                            <p className="text-sm font-mono text-purple-400 mt-1">{pluginFile.name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{(pluginFile.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 mt-2">Upload a .jar plugin file from your computer</p>
                                </div>
                                
                                <div className="bg-blue-900/20 border border-blue-800/50 rounded p-3">
                                    <p className="text-xs text-blue-300">
                                        💡 <strong>Tip:</strong> Make sure the plugin is compatible with your server version. 
                                        Check the plugin documentation for required dependencies.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="bg-slate-800 p-4 flex justify-end gap-3 border-t border-slate-700">
                        <button 
                            onClick={() => {
                                setPluginModalId(null);
                                setPluginUrl('');
                                setPluginFile(null);
                                setPluginUploadMode('url');
                            }}
                            className="px-4 py-2 rounded hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleInstallPlugin}
                            disabled={(pluginUploadMode === 'url' && !pluginUrl) || (pluginUploadMode === 'file' && !pluginFile) || installingPlugin}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center gap-2"
                        >
                            {installingPlugin ? (
                                <>Installing...</>
                            ) : (
                                <>{pluginUploadMode === 'url' ? <><Download className="w-4 h-4" /> Install</> : <><Download className="w-4 h-4" /> Upload</>}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Create Database Modal */}
        {showCreateDb && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-slate-900 w-full max-w-lg rounded-lg shadow-2xl border border-slate-700 overflow-hidden">
                    <header className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <DatabaseIcon className="w-5 h-5 text-slate-400" />
                            Create Database
                        </h3>
                        <button onClick={() => setShowCreateDb(false)} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </header>
                    <form onSubmit={handleCreateDatabase}>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Database Name (Container Name)</label>
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm focus:border-blue-500 transition-colors"
                                    placeholder="my-plugin-db"
                                    value={dbFormData.name}
                                    onChange={(e) => setDbFormData({...dbFormData, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Type</label>
                                    <select 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={dbFormData.type}
                                        onChange={(e) => setDbFormData({...dbFormData, type: e.target.value})}
                                    >
                                        <option value="postgres">PostgreSQL</option>
                                        <option value="mysql">MySQL</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Version (Optional)</label>
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        placeholder={dbFormData.type === 'postgres' ? '15-alpine' : '8.0'}
                                        value={dbFormData.version}
                                        onChange={(e) => setDbFormData({...dbFormData, version: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">User</label>
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        placeholder={dbFormData.type === 'postgres' ? 'postgres' : 'minecraft'}
                                        value={dbFormData.user}
                                        onChange={(e) => setDbFormData({...dbFormData, user: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Password</label>
                                    <input 
                                        type="password"
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={dbFormData.password}
                                        onChange={(e) => setDbFormData({...dbFormData, password: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Database Name (Schema)</label>
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                    placeholder="minecraft"
                                    value={dbFormData.database}
                                    onChange={(e) => setDbFormData({...dbFormData, database: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="bg-slate-800 p-4 flex justify-end gap-3 border-t border-slate-700">
                             <button 
                                type="button"
                                onClick={() => setShowCreateDb(false)}
                                className="px-4 py-2 rounded hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={creating}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors"
                            >
                                {creating ? 'Creating...' : 'Create Database'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Edit Server Modal */}
        {editServerId && editFormData && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-slate-900 w-full max-w-3xl rounded-lg shadow-2xl border border-slate-700 overflow-hidden max-h-[90vh] overflow-y-auto">
                    <header className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-blue-400" />
                            <h3 className="font-semibold">Edit Server Configuration</h3>
                        </div>
                        <button onClick={() => setEditServerId(null)} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </header>
                    <form onSubmit={handleUpdateServer}>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">MOTD (Message of the Day)</label>
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.motd || ''}
                                        onChange={(e) => setEditFormData({...editFormData, motd: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
                                    <select 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.difficulty || 'easy'}
                                        onChange={(e) => setEditFormData({...editFormData, difficulty: e.target.value})}
                                    >
                                        <option value="peaceful">Peaceful</option>
                                        <option value="easy">Easy</option>
                                        <option value="normal">Normal</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Game Mode</label>
                                    <select 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.gamemode || 'survival'}
                                        onChange={(e) => setEditFormData({...editFormData, gamemode: e.target.value})}
                                    >
                                        <option value="survival">Survival</option>
                                        <option value="creative">Creative</option>
                                        <option value="adventure">Adventure</option>
                                        <option value="spectator">Spectator</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Max Players</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.maxPlayers || 20}
                                        onChange={(e) => setEditFormData({...editFormData, maxPlayers: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">View Distance</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.viewDistance || 10}
                                        onChange={(e) => setEditFormData({...editFormData, viewDistance: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-6">
                                    <input 
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={editFormData.onlineMode !== false}
                                        onChange={(e) => setEditFormData({...editFormData, onlineMode: e.target.checked})}
                                    />
                                    <label className="text-sm">Online Mode</label>
                                </div>
                            </div>
                            <div className="bg-purple-900/20 border border-purple-800/50 rounded p-3">
                                <div className="flex items-start gap-2">
                                    <ServerIcon className="w-4 h-4 text-purple-400 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-purple-300 mb-1">Proxy Backend Setup</p>
                                        <p className="text-xs text-slate-400 mb-2">To use this server behind a Velocity proxy:</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <button 
                                                type="button"
                                                onClick={() => configureServerForProxy(editServerId!)}
                                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium transition-colors"
                                            >
                                                Configure for Proxy
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => copySecretFromProxy(editServerId!)}
                                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-medium transition-colors"
                                            >
                                                Copy Secret from Proxy
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => recreateServerForProxy(editServerId!)}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors"
                                            >
                                                🔄 Recreate for Proxy
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            <span className="font-semibold">Configure:</span> File-based (may not work if env var set). <br/>
                                            <span className="font-semibold">Recreate:</span> ⚠️ Stops & recreates container with ONLINE_MODE=FALSE (data safe).
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">✨ Changes will be written to server.properties. Restart server to apply.</p>
                        </div>
                        <div className="bg-slate-800 p-4 flex justify-end gap-3 border-t border-slate-700">
                            <button 
                                type="button"
                                onClick={() => setEditServerId(null)}
                                className="px-4 py-2 rounded hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={creating}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors"
                            >
                                {creating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}



        {/* Edit Proxy Modal */}
        {editProxyId && editFormData && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-slate-900 w-full max-w-3xl rounded-lg shadow-2xl border border-purple-900/30 overflow-hidden max-h-[90vh] overflow-y-auto">
                    <header className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold">Edit Proxy Configuration</h3>
                        </div>
                        <button onClick={() => setEditProxyId(null)} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </header>
                    <form onSubmit={handleUpdateProxy}>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">MOTD</label>
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.motd || ''}
                                        onChange={(e) => setEditFormData({...editFormData, motd: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Max Players (Display)</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.showMaxPlayers || 500}
                                        onChange={(e) => setEditFormData({...editFormData, showMaxPlayers: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Forwarding Mode</label>
                                    <select 
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none text-sm"
                                        value={editFormData.forwardingMode || 'MODERN'}
                                        onChange={(e) => setEditFormData({...editFormData, forwardingMode: e.target.value})}
                                    >
                                        <option value="NONE">NONE</option>
                                        <option value="LEGACY">LEGACY (Recommended)</option>
                                        <option value="BUNGEEGUARD">BUNGEEGUARD</option>
                                        <option value="MODERN">MODERN</option>
                                    </select>
                                    <p className="text-xs text-yellow-500 mt-1">⚠️ Connection issues? Try LEGACY mode</p>
                                </div>
                                <div className="flex items-center gap-2 mt-6">
                                    <input 
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={editFormData.onlineMode !== false}
                                        onChange={(e) => setEditFormData({...editFormData, onlineMode: e.target.checked})}
                                    />
                                    <label className="text-sm">Online Mode</label>
                                </div>
                            </div>
                            
                            {/* Server List */}
                            {editFormData.servers && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-semibold text-purple-400">Backend Servers</h4>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const newServer = { name: '', address: 'host.docker.internal:25565' };
                                                setEditFormData({...editFormData, servers: [...editFormData.servers, newServer]});
                                            }}
                                            className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors"
                                        >
                                            + Add Server
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {editFormData.servers.map((srv: any, idx: number) => (
                                            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                                                <input 
                                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                                    placeholder="Name"
                                                    value={srv.name}
                                                    onChange={(e) => {
                                                        const updated = [...editFormData.servers];
                                                        updated[idx].name = e.target.value;
                                                        setEditFormData({...editFormData, servers: updated});
                                                    }}
                                                />
                                                <input 
                                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                                    placeholder="Address"
                                                    value={srv.address}
                                                    onChange={(e) => {
                                                        const updated = [...editFormData.servers];
                                                        updated[idx].address = e.target.value;
                                                        setEditFormData({...editFormData, servers: updated});
                                                    }}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = editFormData.servers.filter((_: any, i: number) => i !== idx);
                                                        setEditFormData({...editFormData, servers: updated});
                                                    }}
                                                    className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors"
                                                    title="Remove server"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Secret Management */}
                            {(editFormData.forwardingMode === 'MODERN' || editFormData.forwardingMode === 'BUNGEEGUARD') && (
                                <div className="bg-orange-900/20 border border-orange-800/50 rounded p-3">
                                    <div className="flex items-start gap-2">
                                        <ServerIcon className="w-4 h-4 text-orange-400 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-orange-300 mb-1">Forwarding Secret</p>
                                            <p className="text-xs text-slate-400 mb-2">MODERN and BUNGEEGUARD modes require a shared secret. View it here:</p>
                                            <button 
                                                type="button"
                                                onClick={() => showProxySecret(editProxyId!)}
                                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-medium transition-colors"
                                            >
                                                Show Secret
                                            </button>
                                            <p className="text-xs text-slate-500 mt-2">Copy this secret to your backend servers using "Copy Secret from Proxy" button</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <p className="text-xs text-slate-500">✨ Changes will be written to velocity.toml. Restart proxy to apply.</p>
                        </div>
                        <div className="bg-slate-800 p-4 flex justify-end gap-3 border-t border-slate-700">
                            <button 
                                type="button"
                                onClick={() => setEditProxyId(null)}
                                className="px-4 py-2 rounded hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={creating}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded font-medium transition-colors"
                            >
                                {creating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Players Section */}
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-cyan-400 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Online Players
            </h2>
            <PlayerList />
        </div>

        {/* Minecraft Servers Section */}
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-green-400 flex items-center gap-2">
                <ServerIcon className="w-5 h-5" />
                Minecraft Servers
            </h2>
            <div className="grid grid-cols-1 gap-4">
                {servers.length === 0 && !loading && (
                    <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                        <ServerIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No servers found. Create one to get started.</p>
                    </div>
                )}

                {servers.map(server => (
                    <div key={server.Id} className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex items-center justify-between hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-4">
                         <div className={clsx("w-3 h-3 rounded-full transition-all duration-500", server.State === 'running' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500")} />
                         <div>
                             <h3 className="font-bold text-lg">{server.Labels['server_name'] || server.Names[0]}</h3>
                             <div className="flex gap-4 text-sm text-slate-400 mt-1">
                                <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> {server.Ports?.[0]?.PublicPort || '???'}</span>
                                <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {server.Labels['server_type'] || 'MC'}</span>
                                <span className="px-2 py-0.5 bg-slate-800 rounded text-xs border border-slate-700">{server.Status}</span>
                             </div>
                         </div>
                    </div>

                    <div className="flex items-center gap-2">
                         <button onClick={() => setActiveConsoleId(server.Id)} className="p-2 hover:bg-slate-800 text-slate-300 rounded-md transition-colors border border-transparent hover:border-slate-600" title="Console">
                            <Terminal className="w-5 h-5" />
                         </button>

                         <button onClick={() => setActiveFileManagerId(server.Id)} className="p-2 hover:bg-slate-800 text-slate-300 rounded-md transition-colors border border-transparent hover:border-slate-600" title="File Manager">
                            <FolderIcon className="w-5 h-5" />
                         </button>

                         <button onClick={() => openEditServer(server.Id)} className="p-2 hover:bg-blue-900/30 text-blue-400 rounded-md transition-colors border border-transparent hover:border-blue-900" title="Edit Server">
                            <Edit className="w-5 h-5" />
                         </button>

                         <button onClick={() => setPluginModalId(server.Id)} className="p-2 hover:bg-purple-900/30 text-purple-400 rounded-md transition-colors border border-transparent hover:border-purple-900" title="Install Plugin">
                            <Puzzle className="w-5 h-5" />
                         </button>

                         {server.State !== 'running' ? (
                            <button onClick={() => handleAction(server.Id, 'start')} className="p-2 hover:bg-green-900/30 text-green-400 rounded-md transition-colors border border-transparent hover:border-green-900" title="Start">
                                <Play className="w-5 h-5" />
                            </button>
                         ) : (
                            <button onClick={() => handleAction(server.Id, 'stop')} className="p-2 hover:bg-yellow-900/30 text-yellow-400 rounded-md transition-colors border border-transparent hover:border-yellow-900" title="Stop">
                                <Square className="w-5 h-5" />
                            </button>
                         )}
                         
                         <button onClick={() => handleAction(server.Id, 'delete')} className="p-2 hover:bg-red-900/30 text-red-400 rounded-md transition-colors border border-transparent hover:border-red-900" title="Delete">
                            <Trash2 className="w-5 h-5" />
                         </button>
                    </div>
                </div>
            ))}
            </div>
        </div>
        <div className="mt-8">
            <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2">
                <ServerIcon className="w-5 h-5" />
                Velocity Proxies
            </h2>
            <div className="grid grid-cols-1 gap-4">
                {proxies.length === 0 && !loading && (
                    <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-lg border border-purple-900/30 border-dashed">
                        <ServerIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No proxies found. Create one to get started.</p>
                    </div>
                )}
                {proxies.map(proxy => (
                        <div key={proxy.Id} className="bg-slate-900 border border-purple-900/30 rounded-lg p-5 flex items-center justify-between hover:border-purple-700/50 transition-colors">
                            <div className="flex items-center gap-4">
                                 <div className={clsx("w-3 h-3 rounded-full transition-all duration-500", proxy.State === 'running' ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "bg-red-500")} />
                                 <div>
                                     <h3 className="font-bold text-lg">{proxy.Labels['server_name'] || proxy.Names[0]}</h3>
                                     <div className="flex gap-4 text-sm text-slate-400 mt-1">
                                        <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> {proxy.Ports?.[0]?.PublicPort || '???'}</span>
                                        <span className="flex items-center gap-1"><ServerIcon className="w-3 h-3" /> Velocity Proxy</span>
                                        <span className="px-2 py-0.5 bg-purple-900/20 rounded text-xs border border-purple-900">{proxy.Status}</span>
                                     </div>
                                 </div>
                            </div>

                            <div className="flex items-center gap-2">
                                 <button onClick={() => setActiveConsoleId(proxy.Id)} className="p-2 hover:bg-slate-800 text-slate-300 rounded-md transition-colors border border-transparent hover:border-slate-600" title="Console">
                                    <Terminal className="w-5 h-5" />
                                 </button>

                                 <button onClick={() => setActiveFileManagerId(proxy.Id)} className="p-2 hover:bg-slate-800 text-slate-300 rounded-md transition-colors border border-transparent hover:border-slate-600" title="File Manager">
                                    <FolderIcon className="w-5 h-5" />
                                 </button>

                                 <button onClick={() => setPluginModalId(proxy.Id)} className="p-2 hover:bg-purple-900/30 text-purple-400 rounded-md transition-colors border border-transparent hover:border-purple-900" title="Install Plugin">
                                    <Puzzle className="w-5 h-5" />
                                 </button>

                                 <button onClick={() => openEditProxy(proxy.Id)} className="p-2 hover:bg-blue-900/30 text-blue-400 rounded-md transition-colors border border-transparent hover:border-blue-900" title="Edit Proxy">
                                    <Edit className="w-5 h-5" />
                                 </button>

                                 {proxy.State !== 'running' ? (
                                    <button onClick={() => handleProxyAction(proxy.Id, 'start')} className="p-2 hover:bg-purple-900/30 text-purple-400 rounded-md transition-colors border border-transparent hover:border-purple-900" title="Start">
                                        <Play className="w-5 h-5" />
                                    </button>
                                 ) : (
                                    <button onClick={() => handleProxyAction(proxy.Id, 'stop')} className="p-2 hover:bg-yellow-900/30 text-yellow-400 rounded-md transition-colors border border-transparent hover:border-yellow-900" title="Stop">
                                        <Square className="w-5 h-5" />
                                    </button>
                                 )}
                                 
                                 <button onClick={() => handleProxyAction(proxy.Id, 'delete')} className="p-2 hover:bg-red-900/30 text-red-400 rounded-md transition-colors border border-transparent hover:border-red-900" title="Delete">
                                    <Trash2 className="w-5 h-5" />
                                 </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

         {/* Databases Section */}
         <div className="mt-8 mb-20">
            <h2 className="text-xl font-bold mb-4 text-slate-400 flex items-center gap-2">
                <DatabaseIcon className="w-5 h-5" />
                Databases
            </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {databases.length === 0 && (
                    <div className="col-span-full text-center py-6 text-slate-600 bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">
                        <DatabaseIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No databases configured.</p>
                    </div>
                )}
                {databases.map(db => {
                    const dbType = db.Labels['db_type'] || 'unknown';
                    const publicPort = db.Ports?.[0]?.PublicPort || '0';
                    const host = 'host.docker.internal';
                    const jdbcUrl = dbType === 'postgres' 
                        ? `jdbc:postgresql://${host}:${publicPort}/${db.Labels['server_name']}`
                        : `jdbc:mysql://${host}:${publicPort}/${db.Labels['server_name']}`;

                    return (
                        <div key={db.Id} className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors">
                             <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={clsx("w-2 h-2 rounded-full", db.State === 'running' ? "bg-green-500" : "bg-red-500")} />
                                    <h3 className="font-bold text-lg">{db.Labels['server_name'] || db.Names[0]}</h3>
                                    <span className="text-xs uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-400">{dbType}</span>
                                </div>
                                <div className="flex gap-2">
                                     <button onClick={() => handleProxyAction(db.Id, 'delete')} className="p-1.5 hover:bg-red-900/30 text-red-400 rounded transition-colors" title="Delete">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                </div>
                             </div>

                             <div className="bg-slate-950 rounded p-3 text-xs font-mono text-slate-400 space-y-2 relative group">
                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span>Host:</span>
                                    <span className="text-white select-all">{host}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span>Port:</span>
                                    <span className="text-white select-all">{publicPort}</span>
                                </div>
                                 <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span>Internal Port:</span>
                                    <span className="text-white">{dbType === 'postgres' ? '5432' : '3306'}</span>
                                </div>
                                <div className="pt-1">
                                    <div className="text-[10px] text-slate-500 mb-0.5">JDBC URL</div>
                                    <div className="text-blue-300 break-all select-all leading-tight">{jdbcUrl}</div>
                                </div>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(jdbcUrl)}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-slate-800 p-1 rounded text-slate-300 hover:text-white transition-all"
                                    title="Copy JDBC URL"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                             </div>
                        </div>
                    );
                })}
             </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
