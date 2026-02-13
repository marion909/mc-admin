import { Server, Socket } from 'socket.io';
import { dockerService } from './dockerService.js';
import Docker from 'dockerode';

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock';
const docker = new Docker({ socketPath });

export const setupSocket = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log('Client connected:', socket.id);
        
        let stream: any = null;
        let currentContainerId: string | null = null;

        socket.on('join-console', async (containerId: string) => {
            console.log(`Socket ${socket.id} joining console ${containerId}`);
            currentContainerId = containerId;
            
            try {
                const container = docker.getContainer(containerId);
                const info = await container.inspect();
                 
                if (!info.State.Running) {
                    socket.emit('console-data', '\r\nServer is offline.\r\n');
                    return;
                }

                // Attach to container with stdin explicitly enabled
                stream = await container.attach({
                    stream: true,
                    stdout: true,
                    stderr: true,
                    stdin: true,
                    hijack: true, // Important for stdin to work properly
                    logs: true
                });

                console.log(`[${socket.id}] Stream attached to ${containerId}`);

                stream.on('data', (chunk: Buffer) => {
                    if (info.Config.Tty) {
                        socket.emit('console-data', chunk.toString('utf-8'));
                    } else {
                        // Demultiplex stream (remove 8-byte header)
                        // Header: [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4]
                        let current = 0;
                        while (current < chunk.length) {
                            // If remaining buffer is smaller than header, stop 
                            // (In a production app we should buffer this remainder)
                            if (chunk.length - current < 8) break;

                            const type = chunk[current]; // 1=stdout, 2=stderr
                            const size = chunk.readUInt32BE(current + 4);
                            
                            const contentStart = current + 8;
                            const contentEnd = contentStart + size;

                            if (contentEnd > chunk.length) {
                                // Partial frame - print what we have (or buffer it)
                                // For simplicity, we'll print what we have
                                const payload = chunk.subarray(contentStart);
                                socket.emit('console-data', payload.toString('utf-8'));
                                break; 
                            } else {
                                const payload = chunk.subarray(contentStart, contentEnd);
                                socket.emit('console-data', payload.toString('utf-8'));
                                current = contentEnd;
                            }
                        }
                    }
                });

                stream.on('end', () => {
                    socket.emit('console-data', '\r\nConnection closed.\r\n');
                });

            } catch (err: any) {
                console.error('Attach Error:', err);
                socket.emit('console-data', `\r\nError attaching to console: ${err.message}\r\n`);
            }
        });

        // Handle Input - outside of join-console so it persists
        socket.on('console-input', (command: string) => {
            console.log(`[${socket.id}] Received command:`, JSON.stringify(command));
            if (stream && currentContainerId) {
                console.log(`[${socket.id}] Writing to container ${currentContainerId}`);
                stream.write(command);
            } else {
                console.log(`[${socket.id}] No active stream or container`);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            if (stream) {
                stream.end();
            }
        });
    });
};
