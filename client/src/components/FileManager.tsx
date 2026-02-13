import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FileText, ArrowLeft, Save, X, Trash2 } from 'lucide-react';

interface FileManagerProps {
    serverId: string;
    onClose: () => void;
}

interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
}

const FileManager: React.FC<FileManagerProps> = ({ serverId, onClose }) => {
    const [path, setPath] = useState('.');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [loading, setLoading] = useState(false);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/servers/${serverId}/files?path=${path}`);
            setFiles(res.data);
        } catch (err) {
            console.error(err);
            alert('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [path, serverId]);

    const handleOpen = async (entry: FileEntry) => {
        if (entry.isDirectory) {
            setPath(entry.path);
        } else {
            setLoading(true);
            try {
                const res = await axios.get(`/api/servers/${serverId}/files/content?path=${entry.path}`);
                setFileContent(res.data);
                setEditingFile(entry.path);
            } catch (err) {
                alert('Could not read file');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!editingFile) return;
        setLoading(true);
        try {
            await axios.post(`/api/servers/${serverId}/files/content`, {
                path: editingFile,
                content: fileContent
            });
            alert('Saved!');
        } catch (err) {
            alert('Failed to save');
        } finally {
            setLoading(false);
        }
    };

    const handleUp = () => {
        if (path === '.') return;
        const parts = path.split('/');
        parts.pop();
        setPath(parts.length === 0 || (parts.length === 1 && parts[0] === '') ? '.' : parts.join('/'));
    };

    const handleDelete = async (entry: FileEntry, e: React.MouseEvent) => {
        e.stopPropagation();
        
        const itemType = entry.isDirectory ? 'Ordner' : 'Datei';
        const confirmed = confirm(`${itemType} "${entry.name}" wirklich löschen?${entry.isDirectory ? ' (Alle Inhalte werden gelöscht!)' : ''}`);
        
        if (!confirmed) return;
        
        setLoading(true);
        try {
            await axios.delete(`/api/servers/${serverId}/files?path=${entry.path}`);
            await loadFiles();
        } catch (err) {
            console.error(err);
            alert(`Fehler beim Löschen: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
            <div className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl flex flex-col border border-slate-700">
                <header className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                             <Folder className="text-blue-400" /> File Manager
                        </h2>
                        <div className="bg-slate-950 px-3 py-1 rounded text-sm font-mono text-slate-400">
                           /{path === '.' ? '' : path}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded"><X className="w-5 h-5" /></button>
                </header>

                <div className="flex-1 overflow-hidden flex">
                    {editingFile ? (
                        <div className="flex-1 flex flex-col">
                             <div className="bg-slate-800/50 p-2 flex items-center justify-between border-b border-slate-700">
                                <button onClick={() => setEditingFile(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white">
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </button>
                                <span className="font-mono text-sm">{editingFile}</span>
                                <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm text-white">
                                    <Save className="w-4 h-4" /> Save
                                </button>
                             </div>
                             <textarea 
                                className="flex-1 bg-slate-950 text-slate-200 font-mono p-4 outline-none resize-none text-sm"
                                value={fileContent}
                                onChange={e => setFileContent(e.target.value)}
                             />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto p-4">
                            {path !== '.' && (
                                <div onClick={handleUp} className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded cursor-pointer text-slate-400 mb-2">
                                    <ArrowLeft className="w-5 h-5" /> ..
                                </div>
                            )}
                            
                            {loading && <p className="text-slate-500 p-4">Loading...</p>}

                            {!loading && files.map(file => (
                                <div 
                                    key={file.name} 
                                    className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded border-b border-slate-800/50 last:border-0 group"
                                >
                                    <div onClick={() => handleOpen(file)} className="flex items-center gap-3 flex-1 cursor-pointer">
                                        {file.isDirectory ? 
                                            <Folder className="w-5 h-5 text-yellow-500" /> : 
                                            <FileText className="w-5 h-5 text-slate-400" />
                                        }
                                        <span className={file.isDirectory ? 'font-semibold text-slate-200' : 'text-slate-300'}>{file.name}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(file, e)}
                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-600/20 rounded transition-all text-red-400 hover:text-red-300"
                                        title={`${file.isDirectory ? 'Ordner' : 'Datei'} löschen`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileManager;
