# MC-Admin Deployment Guide

## Docker Run Command

Wenn du MC-Admin in Docker ausführst, **MUSS** die `HOST_DATA_PATH` Umgebungsvariable gesetzt werden, damit neue Minecraft-Server korrekt gemountet werden:

### Windows Host

```bash
docker run -d --name mc-admin \
  -p 3000:3001 \
  -v //./pipe/docker_engine:/var/run/docker.sock \
  -v "C:/Projekte/MC-Admin/server/data:/app/data" \
  -e "HOST_DATA_PATH=C:/Projekte/MC-Admin/server/data/servers" \
  marion898/mc-admin:latest
```

**Wichtig**: 
- Ersetze `C:/Projekte/MC-Admin` mit deinem tatsächlichen Projekt-Pfad
- Verwende **Forward Slashes** `/` auch unter Windows (Docker kompatibel)
- `HOST_DATA_PATH` muss auf das `servers`-Unterverzeichnis zeigen

### Linux Host

```bash
docker run -d --name mc-admin \
  -p 3000:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "/path/to/MC-Admin/server/data:/app/data" \
  -e "HOST_DATA_PATH=/path/to/MC-Admin/server/data/servers" \
  marion898/mc-admin:latest
```

### PowerShell (Windows)

```powershell
$projectPath = "C:\Projekte\MC-Admin"
docker run -d --name mc-admin `
  -p 3000:3001 `
  -v /var/run/docker.sock:/var/run/docker.sock `
  -v "${projectPath}/server/data:/app/data" `
  -e "HOST_DATA_PATH=${projectPath}\server\data\servers" `
  marion898/mc-admin:latest
```

## Warum ist HOST_DATA_PATH notwendig?

MC-Admin läuft selbst in einem Container und erstellt *andere* Container (Minecraft-Server). 

Wenn ein neuer Minecraft-Server erstellt wird:
1. MC-Admin (Container) erstellt ein Verzeichnis in `/app/data/servers/mc-servername`
2. Dieses Verzeichnis ist vom Host gemountet
3. Der neue Minecraft-Server-Container braucht einen **Host-Pfad** für sein Volume-Mount
4. **OHNE** `HOST_DATA_PATH`: MC-Admin verwendet den Container-Pfad `/app/data/servers/mc-servername` → ❌ **Daten bleiben im Container**
5. **MIT** `HOST_DATA_PATH`: MC-Admin berechnet den korrekten Host-Pfad `C:\Projekte\MC-Admin\server\data\servers\mc-servername` → ✅ **Daten auf Host**

## docker-compose.yml (Empfohlen)

Besser als `docker run` ist eine `docker-compose.yml`:

```yaml
services:
  mc-admin:
    image: marion898/mc-admin:latest
    container_name: mc-admin
    ports:
      - "3000:3001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./server/data:/app/data
    environment:
      - HOST_DATA_PATH=/absolute/path/to/server/data/servers
    restart: unless-stopped
```

**Windows docker-compose.yml**:
```yaml
services:
  mc-admin:
    image: marion898/mc-admin:latest
    container_name: mc-admin
    ports:
      - "3000:3001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - C:/Projekte/MC-Admin/server/data:/app/data
    environment:
      - HOST_DATA_PATH=C:/Projekte/MC-Admin/server/data/servers
    restart: unless-stopped
```

Dann starten mit:
```bash
docker-compose up -d
```

## Troubleshooting

### Problem: Neue Server-Daten erscheinen nicht im Host-Verzeichnis

**Symptom**: Nach dem Erstellen eines neuen Servers siehst du die Dateien nicht in `server/data/servers/mc-servername` auf dem Host.

**Diagnose**:
```bash
# 1. Prüfe ob HOST_DATA_PATH gesetzt ist
docker exec mc-admin printenv HOST_DATA_PATH

# 2. Prüfe Volume-Mounts des Servers
docker inspect mc-servername --format '{{json .Mounts}}' | ConvertFrom-Json

# Source sollte ein Windows-Pfad sein (C:\...), NICHT /app/data/...
```

**Lösung**:
1. Container mit `HOST_DATA_PATH` neu starten (siehe oben)
2. Betroffene Minecraft-Server löschen und neu erstellen

### Problem: FileManager zeigt keine Dateien

**Symptom**: FileManager ist leer nach Server-Erstellung.

**Ursachen**:
1. Server braucht 30-60 Sekunden zum Initialisieren
2. Volume-Mount fehlt oder ist falsch

**Lösung**:
1. Warte 30-60 Sekunden
2. Klicke auf "Refresh" Button im FileManager
3. Prüfe Volume-Mount (siehe oben)

## Bestehende Server migrieren

Wenn du bereits Server mit falschem Mount erstellt hast:

```bash
# 1. Server stoppen
docker stop mc-servername

# 2. Daten aus Container extrahieren (falls vorhanden)
docker cp mc-servername:/data ./backup-servername

# 3. Container löschen
docker rm mc-servername

# 4. Server über MC-Admin UI neu erstellen
# 5. Daten zurückkopieren (falls nötig)
cp ./backup-servername/* ./server/data/servers/mc-servername/
```

## Environment Variables

| Variable | Pflicht | Beschreibung | Beispiel |
|----------|---------|--------------|----------|
| `HOST_DATA_PATH` | ✅ Ja | Absoluter Pfad zum servers-Verzeichnis auf dem Host | `C:/Projekte/MC-Admin/server/data/servers` |
| `PLUGIN_API_KEY` | ❌ Optional | API-Key für MCAdmin-DataAPI Plugin | `my-secure-key-123` |
| `CONTAINER_DATA_PATH` | ❌ Optional | Container-interner Pfad (Standard: `/app/data/servers`) | `/app/data/servers` |

## Deployment Checklist

Beim Deployment/Update:

- [ ] `HOST_DATA_PATH` Umgebungsvariable gesetzt
- [ ] Volume-Mounts korrekt (`/var/run/docker.sock` und `./server/data:/app/data`)
- [ ] Port 3000 verfügbar
- [ ] Docker Socket zugänglich
- [ ] **Windows**: Docker Desktop läuft, WSL2 enabled
- [ ] Nach erstem Start: Prüfe ob neue Server korrekt gemountet werden

## Development vs Production

### Development (ohne Container)

```bash
cd server
npm install
npm run dev

# Separates Terminal:
cd client
npm install
npm run dev
```

In diesem Fall ist `HOST_DATA_PATH` nicht nötig, da der Code direkt auf dem Host läuft.

### Production (Container)

Immer `HOST_DATA_PATH` setzen (siehe oben)!
