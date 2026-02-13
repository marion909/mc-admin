# Players Feature - Installation & Setup Guide

## Overview

Das neue Players-Feature zeigt alle online Spieler aller Minecraft-Server mit vollständigen Details (Position, Gesundheit, Inventar, Statistiken, Achievements) an.

## Architektur

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  MC-Admin UI    │ ◄─────► │  MC-Admin Backend │ ◄─────► │  Minecraft     │
│  PlayerList.tsx │  HTTP   │  playerService.ts │   HTTP  │  Server Plugin │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                                                   │
                                                          MCAdmin-DataAPI Plugin
                                                          REST API Port 8080
```

## Installation Steps

### 1. Plugin bauen (benötigt Maven)

Das Spigot/Paper Plugin muss gebaut und auf jeden Minecraft-Server installiert werden:

```bash
cd plugin
mvn clean package
```

**Wichtig**: Falls Maven nicht installiert ist:
- Windows: Download von https://maven.apache.org/download.cgi
- Oder nutze einen Online-Build-Service
- Alternativ: Nutze das pre-built JAR (falls vorhanden)

Das gebaute JAR liegt dann in: `plugin/target/MCAdmin-DataAPI-1.0.0.jar`

### 2. Plugin auf Server deployen

Kopiere das JAR in die plugins-Verzeichnisse aller Server:

```bash
# Beispiel für mc-lobby
cp plugin/target/MCAdmin-DataAPI-1.0.0.jar server/data/servers/mc-lobby/plugins/

# Wiederhole für alle Server:
# - CB1
# - Skyblock
# - BedWars
# - etc.
```

### 3. Plugin konfigurieren

Nach dem ersten Start erstellt das Plugin eine Config:
`server/data/servers/[server-name]/plugins/MCAdmin-DataAPI/config.yml`

**Wichtig**: Ändere den API-Key!

```yaml
# Port für REST API
port: 8080

# API Key (ÄNDERN!)
api-key: "dein-sicherer-key-hier"  # ← WICHTIG!

# Plugin aktivieren/deaktivieren
enabled: true

# API-Requests loggen
log-requests: false
```

**Der gleiche API-Key muss in MC-Admin Backend gesetzt werden:**

```bash
# In Docker Container oder .env
PLUGIN_API_KEY=dein-sicherer-key-hier
```

### 4. Docker Ports exponieren

Jeder Minecraft-Server-Container muss Port 8080 exponieren:

**Option A: Manuell beim Start**
```bash
docker run -d \
  -p 25565:25565 \
  -p 8080:8080 \  # ← Plugin API Port
  -e EULA=TRUE \
  ... \
  itzg/minecraft-server
```

**Option B: docker-compose.yml** (Empfohlen)
```yaml
services:
  mc-lobby:
    image: itzg/minecraft-server
    ports:
      - "25565:25565"
      - "8080:8080"  # Plugin API
    # ...
  
  cb1:
    image: itzg/minecraft-server
    ports:
      - "25566:25565"
      - "8081:8080"  # Plugin API (anderer Host-Port!)
    # ...
```

**Wichtig**: Jeder Server braucht einen **unterschiedlichen Host-Port** für die Plugin-API!
- mc-lobby: 8080 → 8080
- CB1: 8081 → 8080
- Skyblock: 8082 → 8080
- BedWars: 8083 → 8080

### 5. Server neu starten

Nach Plugin-Installation müssen die Server neu gestartet werden:

```bash
# Via MC-Admin UI: Stop Button → Start Button
# Oder via Docker:
docker restart mc-lobby
docker restart cb1
# etc.
```

**Plugin-Log prüfen**:
```bash
docker exec mc-lobby tail -f /data/logs/latest.log
# Suche nach: "MCAdmin-DataAPI enabled on port 8080"
```

### 6. Plugin testen

Teste ob das Plugin erreichbar ist:

```bash
# Health Check (kein API-Key nötig)
curl http://localhost:8080/api/health

# Expected Response:
# {"status":"ok","plugin":"MCAdmin-DataAPI","version":"1.0.0"}

# Player Data (mit API-Key)
curl -H "X-API-Key: dein-sicherer-key-hier" http://localhost:8080/api/players
```

### 7. MC-Admin Backend neu builden

Das Backend muss neu gebaut werden, da neue Dependencies (axios) hinzugefügt wurden:

```bash
cd C:\Projekte\MC-Admin
docker stop mc-admin
docker rm mc-admin

# Rebuild
docker build -t marion898/mc-admin:latest .

# Start
docker run -d --name mc-admin \
  -p 3000:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "${PWD}/server/data:/app/data" \
  -e PLUGIN_API_KEY=dein-sicherer-key-hier \
  marion898/mc-admin:latest
```

### 8. UI testen

Öffne MC-Admin Dashboard: http://localhost:3000

Die Players-Section sollte oben erscheinen:
- ✅ "Online Players" Header mit Cyan-Icon
- ✅ Player-Cards mit Avatar, Name, Server, Position
- ✅ Auto-Refresh alle 5 Sekunden
- ✅ Klick auf Player öffnet Detail-Modal

**Falls keine Spieler angezeigt werden**:
1. Prüfe ob Spieler auf Servern online sind
2. Prüfe Browser-Console auf Fehler (F12)
3. Prüfe MC-Admin Backend Logs: `docker logs mc-admin`
4. Prüfe ob Plugin API erreichbar ist (siehe Schritt 6)

## Troubleshooting

### "Plugin not available on some servers"

**Gelbe Warnung im UI**: Plugin ist nicht auf allen Servern installiert/erreichbar.

**Lösung**:
1. Prüfe ob Plugin JAR in `plugins/` Ordner liegt
2. Prüfe Server-Log: `docker exec [server] tail /data/logs/latest.log`
3. Prüfe ob Port 8080 exponiert ist: `docker port [container]`
4. Teste Plugin-API: `curl http://localhost:8080/api/health`

### "Invalid or missing API key"

**401 Unauthorized Error**

**Lösung**:
1. Prüfe ob API-Key in Plugin-Config gesetzt ist
2. Prüfe ob gleicher Key in MC-Admin Backend als ENV-Variable gesetzt ist:
   ```bash
   docker exec mc-admin printenv | grep PLUGIN_API_KEY
   ```
3. Keys müssen **exakt** übereinstimmen (case-sensitive)

### "Connection refused"

**500 Error im Network-Tab**

**Lösung**:
1. Plugin ist nicht gestartet → Server-Log prüfen
2. Port nicht exponiert → `docker port [container]` prüfen
3. Container-Netzwerk-Problem → Container-IP prüfen:
   ```bash
   docker inspect [container-id] | grep IPAddress
   ```

### "No players online" obwohl Spieler auf Server sind

**Dashboard zeigt 0 Players**

**Lösung**:
1. Login auf Server und sende `/list` Befehl
2. Prüfe Plugin-API direkt: `curl -H "X-API-Key: ..." http://localhost:8080/api/players`
3. Falls Plugin-API funktioniert aber MC-Admin nicht:
   - Container-Netzwerk-Problem
   - API-Key-Mismatch
   - MC-Admin Backend-Log prüfen

### Maven-Build schlägt fehl

**"mvn: command not found"**

**Lösungen**:
1. **Maven installieren**:
   - Download: https://maven.apache.org/download.cgi
   - Entpacken nach `C:\Program Files\Apache\Maven`
   - PATH Variable setzen: `C:\Program Files\Apache\Maven\bin`

2. **IntelliJ IDEA nutzen**:
   - Plugin-Projekt öffnen
   - Maven-Panel → Lifecycle → package

3. **GitHub Actions nutzen** (online):
   - Plugin auf GitHub hochladen
   - GitHub Action mit Maven-Build erstellen
   - JAR aus Artifacts herunterladen

## Environment Variables

```bash
# MC-Admin Backend
PLUGIN_API_KEY=your-secure-key-here  # Same as plugin config
PLUGIN_PORT=8080                      # Default: 8080
```

## File Structure

```
MC-Admin/
├── plugin/                          # ← Minecraft Plugin (NEU)
│   ├── pom.xml                      # Maven build config
│   ├── README.md                    # Plugin docs
│   └── src/main/
│       ├── java/com/mcadmin/dataapi/
│       │   ├── MCAdminDataAPI.java  # Main plugin class
│       │   └── PlayerDataHandler.java # REST API handler
│       └── resources/
│           ├── plugin.yml           # Spigot metadata
│           └── config.yml           # Default config
│
├── server/
│   ├── src/
│   │   ├── playerService.ts         # ← Backend service (NEU)
│   │   └── index.ts                 # ← Updated (new endpoints)
│   └── data/servers/
│       ├── mc-lobby/plugins/        # ← Plugin JARs hier
│       ├── cb1/plugins/
│       └── ...
│
└── client/
    ├── src/
    │   ├── components/
    │   │   └── PlayerList.tsx       # ← Player UI (NEU)
    │   └── pages/
    │       └── Dashboard.tsx        # ← Updated (Players section)
    └── ...
```

## API Reference

### Backend Endpoints

**GET /api/players**
- **Auth**: JWT Token required
- **Response**:
  ```json
  {
    "players": [...],
    "totalCount": 5,
    "serverCount": 3,
    "timestamp": 1234567890,
    "errors": ["server1: Plugin not available"]
  }
  ```

**GET /api/servers/:id/players**
- **Auth**: JWT Token required
- **Response**:
  ```json
  {
    "players": [...],
    "count": 2,
    "serverId": "abc123",
    "timestamp": 1234567890
  }
  ```

### Plugin Endpoints

**GET /api/health**
- **Auth**: None
- **Response**: `{"status":"ok","plugin":"MCAdmin-DataAPI","version":"1.0.0"}`

**GET /api/players**
- **Auth**: X-API-Key header
- **Response**: Full player data array

## Next Steps

1. ☐ Maven installieren
2. ☐ Plugin bauen (`mvn clean package`)
3. ☐ Plugin auf alle Server deployen
4. ☐ API-Keys konfigurieren
5. ☐ Docker Ports exponieren
6. ☐ Server neu starten
7. ☐ MC-Admin Container rebuilden
8. ☐ UI testen mit online Spielern

## Support

Bei Problemen:
1. Logs prüfen: `docker logs mc-admin`
2. Plugin-Logs: `docker exec [server] tail /data/logs/latest.log`
3. Network-Check: `docker inspect [container]`
4. API-Test: `curl` Befehle aus Troubleshooting-Section
