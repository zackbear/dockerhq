# DockerHQ

**One container that replaces four.**

DockerHQ is a self-hosted Docker management dashboard that consolidates Portainer, Dozzle, Uptime Kuma, and Homepage into a single lightweight app — one port, one `docker compose up`, zero context switching.

![DockerHQ Dashboard](https://img.shields.io/badge/status-active-3dd68c?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-4d8eff?style=flat-square) ![Docker](https://img.shields.io/badge/docker-ready-4d8eff?style=flat-square)

---

## What's inside

| Tab | Replaces | What it does |
|---|---|---|
| **Dashboard** | Homepage | Service launcher + live container overview + stat cards |
| **Containers** | Portainer | Start, stop, restart any container — filterable table with status badges |
| **Logs** | Dozzle | Real-time log streaming over WebSocket, color-coded by level, filterable |
| **Monitor** | Uptime Kuma | TCP health checks with latency history sparklines and uptime % |

All data (service bookmarks, monitor targets) is persisted in SQLite — survives container restarts.

---

## Quick start

```bash
git clone https://github.com/zackbear/dockerhq.git
cd dockerhq
docker compose up -d --build
```

Open **http://localhost:3500**

---

## Requirements

- Docker Engine 20.10+
- Docker Compose v2
- Port 3500 free (change in `docker-compose.yml` if needed)

---

## Configuration

All config is via environment variables in `docker-compose.yml`:

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | `http://localhost:3500` | Comma-separated CORS origins |
| `DATA_DIR` | `/data` | Path inside container for SQLite database |

### Change the port

```yaml
# docker-compose.yml
ports:
  - "8080:8000"   # change 3500 to any free port
```

### Put it behind a reverse proxy (nginx)

```nginx
location / {
    proxy_pass http://localhost:3500;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";  # required for WebSocket log streaming
    proxy_set_header Host $host;
}
```

---

## Data persistence

Services and monitor targets are stored in a SQLite database mounted at `/data/dockerhq.db` inside the container. The `dockerhq_data` Docker volume keeps this data across restarts and recreates.

```bash
# Backup your data
docker cp dockerhq:/data/dockerhq.db ./dockerhq-backup.db

# Restore
docker cp ./dockerhq-backup.db dockerhq:/data/dockerhq.db
```

---

## Development

Run frontend and backend separately for hot reload:

```bash
# Backend
cd backend
pip install -r requirements.txt
DATA_DIR=./data uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api → :8000, served at :5173
```

---

## Architecture

```
dockerhq/
├── backend/
│   ├── main.py          # FastAPI — containers, logs, monitor, services
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Layout, nav, polling
│   │   ├── index.css                # Design tokens
│   │   └── components/
│   │       ├── Dashboard.jsx        # Overview + service launcher
│   │       ├── Containers.jsx       # Container table + actions
│   │       ├── Logs.jsx             # Log viewer + WebSocket streaming
│   │       ├── Monitor.jsx          # TCP health monitor
│   │       └── ui.jsx               # Shared primitives (Btn, Input, Badge...)
│   ├── package.json
│   └── vite.config.js
├── Dockerfile           # Multi-stage: Node builds frontend, Python serves all
└── docker-compose.yml
```

**Stack:** FastAPI + Python docker SDK (backend) · React + Vite (frontend) · SQLite (persistence) · WebSockets (log streaming)

---

## Security notes

- Docker socket is mounted read-write — required for start/stop/restart. Run on trusted networks only.
- CORS is locked to `localhost:3500` by default. Set `ALLOWED_ORIGINS` to open it up.
- Monitor host validation blocks RFC-1918 private ranges (except loopback) to prevent SSRF.
- Service URLs are validated to `http://` or `https://` only — no `javascript:` URLs.
- Log tail is capped at 2000 lines to prevent OOM.

---

## License

MIT
