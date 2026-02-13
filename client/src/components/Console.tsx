import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import { Send } from 'lucide-react';
import 'xterm/css/xterm.css';

interface ConsoleProps {
    serverId: string;
    onClose: () => void;
}

const Console: React.FC<ConsoleProps> = ({ serverId, onClose }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const termRef = useRef<Terminal | null>(null);
    const [command, setCommand] = useState('');
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            theme: {
                background: '#1e293b', // slate-800
                foreground: '#f8fafc',
                cursor: '#ffffff'
            },
            fontFamily: 'monospace',
            fontSize: 14,
            cursorBlink: true,
            allowProposedApi: true
        });
        
        termRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        // Use requestAnimationFrame to ensure the container is rendered and has dimensions
        const initTerminal = () => {
             if (!terminalRef.current) return;
             
             // Open terminal
             try {
                term.open(terminalRef.current);
                fitAddon.fit();
             } catch (e) {
                 console.error("Terminal open failed", e);
             }

            // Connect Socket
            const socket = io('/', { 
                 path: '/socket.io',
            });
    
            socketRef.current = socket;
    
            socket.on('connect', () => {
                console.log('[Console] Socket connected');
                term.writeln('\x1b[32mConnected to Server Console...\x1b[0m');
                socket.emit('join-console', serverId);
                console.log('[Console] Joined console for server:', serverId);
            });
    
            socket.on('console-data', (data: string) => {
                term.write(data);
            });
    
            term.onData(data => {
                console.log('[Console] Terminal input:', JSON.stringify(data));
                socket.emit('console-input', data);
            });
        };

        const timerId = setTimeout(initTerminal, 10);

        const handleResize = () => {
            try {
                fitAddon.fit();
            } catch (e) {
                console.warn("Fit failed", e);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(timerId);
            window.removeEventListener('resize', handleResize);
            if (socketRef.current) socketRef.current.disconnect();
            term.dispose();
        };
    }, [serverId]);

    const sendCommand = () => {
        if (!command.trim() || !socketRef.current) return;
        
        console.log('[Console] Sending command:', command);
        
        // Write command to terminal for visual feedback
        if (termRef.current) {
            termRef.current.writeln(`\x1b[36m> ${command}\x1b[0m`);
        }
        
        // Send command with carriage return and newline (required for some terminals)
        socketRef.current.emit('console-input', command + '\r\n');
        console.log('[Console] Command sent via socket');
        
        // Add to history
        setCommandHistory(prev => [...prev, command]);
        setHistoryIndex(-1);
        setCommand('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            sendCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setCommand(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex >= 0) {
                const newIndex = historyIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setHistoryIndex(-1);
                    setCommand('');
                } else {
                    setHistoryIndex(newIndex);
                    setCommand(commandHistory[newIndex]);
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-900 w-full max-w-4xl h-[80vh] rounded-lg shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
                <header className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
                    <h3 className="font-mono text-sm px-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        root@mc-server:~#
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white px-2">Esc</button>
                </header>
                <div className="flex-1 p-1 bg-[#1e293b] overflow-hidden" ref={terminalRef} />
                <div className="bg-slate-800 p-3 border-t border-slate-700 flex gap-2">
                    <input 
                        type="text"
                        value={command}
                        onChange={e => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Befehl eingeben... (z.B. help, stop, list)"
                        className="flex-1 bg-slate-950 text-slate-200 px-4 py-2 rounded font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <button 
                        onClick={sendCommand}
                        disabled={!command.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Senden
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Console;
