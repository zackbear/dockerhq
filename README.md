# DockerHQ

One container that replaces Portainer + Dozzle + Uptime Kuma + Homepage.

## What's inside

| Tab | What it does |
|---|---|
| Dashboard | Service launcher + active container overview |
| Containers | Start / stop / restart any container |
| Logs | Real-time log streaming with search + filtering |
| Monitor | TCP health checks with latency history |

## Run it

```bash
docker compose up -d --build
```

Then open http://localhost:3500

## Requirements

- Docker socket at `/var/run/docker.sock` (mounted read-only for safety)
- Port 3500 free on your host (change in docker-compose.yml if needed)

## Dev mode

Run backend and frontend separately:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # proxies /api to :8000, served at :5173
```

## Notes

- Monitor targets persist in memory only — restart clears them. Mount a volume or swap to SQLite if you want persistence.
- Docker socket is mounted read-only. Container actions (start/stop/restart/remove) use the Docker SDK which requires read-write. Change `:ro` to `:rw` in docker-compose.yml to enable those actions.
- Logs stream over WebSocket. If you put this behind a reverse proxy (nginx, Caddy), make sure WebSocket upgrade headers are forwarded.
