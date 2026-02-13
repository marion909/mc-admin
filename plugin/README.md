# MCAdmin-DataAPI Plugin

Spigot/Paper plugin that exposes player data via REST API for the MC-Admin dashboard.

## Features

- REST API endpoint for real-time player data
- Detailed player information:
  - Location (coordinates, world)
  - Health, food level, saturation, air
  - Experience and level
  - Game mode and flight status
  - Complete inventory with enchantments
  - Statistics (play time, deaths, kills, distance traveled)
  - Achievements/Advancements count
  - Connection info (ping, IP address)
- API key authentication
- CORS support for web dashboards
- Configurable port and settings

## Build

Requires Java 17+ and Maven:

```bash
cd plugin
mvn clean package
```

The plugin JAR will be in `target/MCAdmin-DataAPI-1.0.0.jar`

## Installation

1. Copy `MCAdmin-DataAPI-1.0.0.jar` to your server's `plugins/` folder
2. Start the server to generate default config
3. Edit `plugins/MCAdmin-DataAPI/config.yml`:
   - Change the `api-key` to a secure random string
   - Adjust port if needed (default: 8080)
4. Restart the server

## Configuration

```yaml
# Port for the REST API server
port: 8080

# API key for authentication (change this!)
api-key: "mcadmin-default-key-change-me"

# Enable/disable the API server
enabled: true

# Log API requests
log-requests: false
```

## API Endpoints

### GET /api/players

Returns all online players with detailed information.

**Headers:**
- `X-API-Key: your-api-key-here`

**Response:**
```json
{
  "players": [
    {
      "uuid": "...",
      "name": "PlayerName",
      "location": {"x": 123, "y": 64, "z": -456, "world": "world"},
      "health": 20.0,
      "gameMode": "SURVIVAL",
      "inventory": [...],
      "statistics": {...},
      "achievements": [...]
    }
  ],
  "count": 1,
  "timestamp": 1234567890,
  "server": "Minecraft Server"
}
```

### GET /api/health

Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "ok",
  "plugin": "MCAdmin-DataAPI",
  "version": "1.0.0"
}
```

## Docker Port Mapping

When running in Docker with `itzg/minecraft-server`, expose the API port:

```bash
docker run -d \
  -p 25565:25565 \
  -p 8080:8080 \
  -e EULA=TRUE \
  ... \
  itzg/minecraft-server
```

## Security Notes

- **Change the default API key** in config.yml
- The API port (8080) should only be accessible from your MC-Admin backend
- Do not expose the API port publicly
- Consider using Docker networks to isolate plugin API access

## Compatibility

- Spigot 1.20.4+
- Paper 1.20.4+
- Requires Java 17+
