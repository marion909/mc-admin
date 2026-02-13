# MC-Admin

Modern web-based Minecraft server manager with console, file manager & Docker integration.

## Features

- 🎮 **Minecraft Server Management**: Create, start, stop, and configure Paper, Spigot, Vanilla, Forge, and Fabric servers
- 🔌 **Velocity Proxy Support**: Set up and manage Velocity proxy servers with automatic modern forwarding
- 🗄️ **Database Management**: Deploy PostgreSQL and MySQL databases with one click
- 📁 **File Manager**: Browse and edit server files directly from the web interface
- 🖥️ **Live Console**: Real-time server console with command execution
- 🔧 **Configuration Editor**: Visual editor for server.properties and other config files
- 🧩 **Plugin Installation**: Install plugins via URL or file upload
- 🔒 **Secure Authentication**: Login system with password change functionality
- 🐳 **Docker-Based**: All servers run in isolated Docker containers

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Docker socket access (`/var/run/docker.sock`)

### Run with Docker

```bash
docker run -d \
  --name mc-admin \
  -p 3000:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./data:/app/data \
  marion898/mc-admin:latest
```

Then open your browser and navigate to `http://localhost:3000`

### Default Credentials

- **Username**: admin
- **Password**: admin123

⚠️ **Important**: Change the default password immediately after first login using the "Password" button in the dashboard!

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `JWT_SECRET` | Secret key for JWT tokens | `mc-admin-secret-key-change-me` |
| `CONTAINER_DATA_PATH` | Path inside container for data | `/app/data/servers` |

## Volumes

| Volume | Description |
|--------|-------------|
| `/var/run/docker.sock` | Docker socket (required for container management) |
| `/app/data` | Persistent data storage for servers, databases, and config |

## Ports

| Port | Description |
|------|-------------|
| `3001` | Web interface and API |

## Usage

### Creating a Minecraft Server

1. Click **"New Server"** in the dashboard
2. Configure server settings:
   - **Name**: Server identifier
   - **Type**: Paper, Vanilla, Spigot, Forge, or Fabric
   - **Version**: Minecraft version (e.g., `1.20.1`)
   - **Memory**: RAM allocation (e.g., `2G`)
   - **Port**: External port (e.g., `25565`)
3. Click **"Create"**
4. Wait for the server to initialize
5. Use the console or file manager to manage your server

### Creating a Velocity Proxy

1. Click **"New Proxy Server"**
2. Configure proxy settings:
   - **Name**: Proxy identifier
   - **Version**: Velocity version
   - **Port**: External port
   - **Servers**: Comma-separated list of backend servers
3. The proxy will automatically generate a forwarding secret
4. Configure your backend servers to use modern forwarding

### Creating a Database

1. Click **"New Database"**
2. Select database type (PostgreSQL or MySQL)
3. Configure credentials and settings
4. The JDBC URL will be displayed for easy connection

## Architecture

MC-Admin consists of three main components:

1. **Frontend** (React + TypeScript + Tailwind CSS): Modern, responsive web interface
2. **Backend** (Express + TypeScript): REST API and WebSocket server for real-time console
3. **Docker Integration** (Dockerode): Container orchestration for Minecraft servers

## Security Notes

- Change default credentials immediately after first login
- Store JWT_SECRET securely in production
- Access to Docker socket grants root-level privileges - secure your deployment accordingly
- Use reverse proxy with HTTPS in production environments

## Building from Source

```bash
# Clone the repository
git clone https://github.com/marion909/mc-admin.git
cd mc-admin

# Build the Docker image
docker build -t marion898/mc-admin .

# Run the container
docker run -d \
  --name mc-admin \
  -p 3000:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./data:/app/data \
  marion898/mc-admin
```

## Development

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Start development servers
# Terminal 1 - Frontend
cd client && npm run dev

# Terminal 2 - Backend
cd server && npm run dev
```

## Technology Stack

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- Axios
- Socket.IO Client
- Xterm.js (terminal emulator)
- React Router

### Backend
- Node.js
- Express
- TypeScript
- Dockerode (Docker API)
- Socket.IO
- JWT Authentication
- bcryptjs

## Support

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/marion909/mc-admin).

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided as-is. Always back up your Minecraft server data before making changes. The authors are not responsible for any data loss or server issues.
