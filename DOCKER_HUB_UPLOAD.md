# Docker Hub Upload Instructions

## Vorbereitung

1. **Docker Hub Account erstellen** (falls noch nicht vorhanden):
   - Gehe zu https://hub.docker.com
   - Registriere dich oder logge dich ein

2. **Docker Hub Login** im Terminal:
   ```bash
   docker login
   ```
   Gib deinen Docker Hub Username und Password ein.

## Image erstellen und hochladen

### 1. Image mit Tag für Docker Hub bauen

```bash
# Ersetze 'deinusername' mit deinem Docker Hub Username
docker build -t deinusername/mc-admin:latest .

# Optional: Auch mit Versionsnummer taggen
docker tag deinusername/mc-admin:latest deinusername/mc-admin:1.0.0
```

### 2. Image zu Docker Hub pushen

```bash
# Latest Version pushen
docker push deinusername/mc-admin:latest

# Optional: Versionierte Version pushen
docker push deinusername/mc-admin:1.0.0
```

### 3. README auf Docker Hub hochladen

**Option A: Über Docker Hub Web Interface**
1. Gehe zu https://hub.docker.com/r/deinusername/mc-admin
2. Klicke auf den "Description" Tab
3. Kopiere den Inhalt der README.md
4. Füge ihn in das Editor-Feld ein
5. Klicke "Update"

**Option B: Mit docker-pushrm Tool**
```bash
# Tool installieren
docker run --rm -v "${PWD}:/workspace" -e DOCKER_USER=deinusername -e DOCKER_PASS=deinpassword chko/docker-pushrm:1 --file /workspace/README.md deinusername/mc-admin
```

## Vollständiges Beispiel

```bash
# 1. Login
docker login

# 2. Image bauen
docker build -t deinusername/mc-admin:latest .

# 3. Pushen
docker push deinusername/mc-admin:latest

# 4. README manuell auf Docker Hub hochladen (siehe Option A oben)
```

## Repository Public machen

1. Gehe zu https://hub.docker.com/r/deinusername/mc-admin/settings
2. Stelle sicher dass "Visibility" auf "Public" steht

## Verwendung des Images von Docker Hub

Andere Nutzer können dein Image dann so verwenden:

```bash
docker run -d \
  --name mc-admin \
  -p 3000:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./data:/app/data \
  deinusername/mc-admin:latest
```

## Automatische Builds (Optional)

Du kannst auch Automated Builds auf Docker Hub einrichten:

1. Gehe zu https://hub.docker.com/r/deinusername/mc-admin/builds
2. Verbinde dein GitHub Repository
3. Konfiguriere Build-Regeln
4. Docker Hub baut dann automatisch bei jedem Git Push

## Tags Best Practices

- `latest` - Aktuelle stabile Version
- `1.0.0` - Spezifische Version
- `dev` - Development Version
- `1.0.0-alpine` - Varianten

```bash
docker build -t deinusername/mc-admin:latest .
docker build -t deinusername/mc-admin:1.0.0 .
docker build -t deinusername/mc-admin:dev .
```
