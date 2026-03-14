import asyncio
import json
import ipaddress
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional
import docker
from docker.errors import NotFound, APIError
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

# ─── CORS ──────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3500,http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="DockerHQ", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "PUT"],
    allow_headers=["Content-Type"],
)

try:
    docker_client = docker.from_env()
except Exception as e:
    docker_client = None
    print(f"Warning: Could not connect to Docker socket: {e}")


def get_client():
    if docker_client is None:
        raise HTTPException(status_code=503, detail="Docker socket not available")
    return docker_client


# ─── SQLite persistence ────────────────────────────────────────────────────
# Data stored in a named volume so it survives container restarts.
# Mount /data as a Docker volume to persist across recreates.
DB_PATH = Path(os.getenv("DATA_DIR", "/data")) / "dockerhq.db"


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS services (
                id       TEXT PRIMARY KEY,
                name     TEXT NOT NULL,
                url      TEXT NOT NULL,
                icon     TEXT DEFAULT '🔗',
                description TEXT DEFAULT '',
                created_at INTEGER DEFAULT (strftime('%s','now'))
            );
            CREATE TABLE IF NOT EXISTS monitor_targets (
                id    TEXT PRIMARY KEY,
                name  TEXT NOT NULL,
                host  TEXT NOT NULL,
                port  INTEGER NOT NULL,
                label TEXT DEFAULT '',
                created_at INTEGER DEFAULT (strftime('%s','now'))
            );
        """)


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
def startup():
    init_db()


# ─── Models ────────────────────────────────────────────────────────────────

class ContainerAction(str, Enum):
    start = "start"
    stop = "stop"
    restart = "restart"
    remove = "remove"


_BLOCKED_NETS = [
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),
]


def _is_allowed_host(host: str) -> bool:
    try:
        addr = ipaddress.ip_address(host)
        if addr.is_loopback:
            return True
        for net in _BLOCKED_NETS:
            if addr in net:
                return False
        if addr.is_private:
            return False
        return True
    except ValueError:
        return True


class ServiceConfig(BaseModel):
    name: str
    url: str
    icon: Optional[str] = "🔗"
    description: Optional[str] = ""

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, v: str) -> str:
        lower = v.strip().lower()
        if not (lower.startswith("http://") or lower.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v.strip()

    @field_validator("name")
    @classmethod
    def name_max_length(cls, v: str) -> str:
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v


class MonitorTarget(BaseModel):
    name: str
    host: str
    port: int
    label: Optional[str] = ""

    @field_validator("port")
    @classmethod
    def port_in_range(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v

    @field_validator("host")
    @classmethod
    def host_allowed(cls, v: str) -> str:
        if not _is_allowed_host(v):
            raise ValueError("Host is in a blocked network range")
        return v.strip()


# ─── Containers ────────────────────────────────────────────────────────────

@app.get("/api/containers")
def list_containers():
    client = get_client()
    result = []
    for c in client.containers.list(all=True):
        ports = {}
        if c.ports:
            for internal, bindings in c.ports.items():
                if bindings:
                    ports[internal] = [b["HostPort"] for b in bindings]
        result.append({
            "id": c.short_id,
            "full_id": c.id,
            "name": c.name,
            "image": c.image.tags[0] if c.image.tags else c.image.short_id,
            "status": c.status,
            "state": c.attrs.get("State", {}),
            "ports": ports,
            "created": c.attrs.get("Created", ""),
            "labels": c.labels,
        })
    return result


@app.post("/api/containers/{container_id}/{action}")
def container_action(container_id: str, action: ContainerAction):
    client = get_client()
    try:
        container = client.containers.get(container_id)
        if action == ContainerAction.start:
            container.start()
        elif action == ContainerAction.stop:
            container.stop(timeout=10)
        elif action == ContainerAction.restart:
            container.restart(timeout=10)
        elif action == ContainerAction.remove:
            container.remove(force=True)
        return {"status": "ok", "action": action, "container": container_id}
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/containers/{container_id}/logs")
def get_logs(
    container_id: str,
    tail: int = Query(default=200, ge=1, le=2000),
):
    client = get_client()
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        return {"logs": logs, "container": container.name}
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")


@app.websocket("/api/containers/{container_id}/logs/stream")
async def stream_logs(websocket: WebSocket, container_id: str):
    await websocket.accept()
    client = get_client()
    try:
        container = client.containers.get(container_id)
    except NotFound:
        await websocket.send_text(json.dumps({"error": "Container not found"}))
        await websocket.close()
        return

    log_queue: asyncio.Queue = asyncio.Queue(maxsize=500)
    stop_event = asyncio.Event()

    def _read_logs():
        try:
            stream = container.logs(stream=True, follow=True, timestamps=True, tail=50)
            for chunk in stream:
                if stop_event.is_set():
                    break
                line = chunk.decode("utf-8", errors="replace").strip()
                if line:
                    asyncio.get_event_loop().call_soon_threadsafe(
                        lambda l=line: log_queue.put_nowait({"line": l, "ts": time.time()})
                        if not log_queue.full() else None
                    )
        except Exception:
            pass

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _read_logs)

    try:
        while True:
            try:
                msg = await asyncio.wait_for(log_queue.get(), timeout=1.0)
                await websocket.send_text(json.dumps(msg))
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text(json.dumps({"ping": True}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()


# ─── System Stats ──────────────────────────────────────────────────────────

@app.get("/api/system")
def system_info():
    client = get_client()
    info = client.info()
    containers = client.containers.list(all=True)
    running = sum(1 for c in containers if c.status == "running")
    stopped = sum(1 for c in containers if c.status in ("exited", "dead"))
    return {
        "docker_version": info.get("ServerVersion", "unknown"),
        "containers_total": len(containers),
        "containers_running": running,
        "containers_stopped": stopped,
        "images": len(client.images.list()),
        "os": info.get("OperatingSystem", "unknown"),
        "arch": info.get("Architecture", "unknown"),
        "cpus": info.get("NCPU", 0),
        "memory_gb": round(info.get("MemTotal", 0) / (1024 ** 3), 1),
    }


# ─── Health Monitor — SQLite-backed ───────────────────────────────────────

@app.get("/api/monitor/targets")
def get_targets():
    with get_db() as db:
        rows = db.execute("SELECT * FROM monitor_targets ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]


@app.post("/api/monitor/targets")
def add_target(target: MonitorTarget):
    tid = f"{target.host}:{target.port}"
    entry = {**target.model_dump(), "id": tid}
    with get_db() as db:
        existing = db.execute("SELECT id FROM monitor_targets WHERE id = ?", (tid,)).fetchone()
        if not existing:
            db.execute(
                "INSERT INTO monitor_targets (id, name, host, port, label) VALUES (?, ?, ?, ?, ?)",
                (tid, target.name, target.host, target.port, target.label or ""),
            )
    return entry


@app.delete("/api/monitor/targets/{target_id}")
def remove_target(target_id: str):
    with get_db() as db:
        db.execute("DELETE FROM monitor_targets WHERE id = ?", (target_id,))
    return {"removed": target_id}


@app.get("/api/monitor/results")
async def get_results():
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        targets = [dict(r) for r in db.execute("SELECT * FROM monitor_targets").fetchall()]

    async def _check(target: dict) -> tuple[str, dict]:
        host, port = target["host"], target["port"]
        start = time.monotonic()
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=3.0
            )
            latency = round((time.monotonic() - start) * 1000, 1)
            writer.close()
            await writer.wait_closed()
            return target["id"], {"status": "up", "latency_ms": latency, "checked_at": now}
        except Exception:
            return target["id"], {"status": "down", "latency_ms": None, "checked_at": now}

    checks = await asyncio.gather(*[_check(t) for t in targets])
    return dict(checks)


# ─── Services Dashboard — SQLite-backed ───────────────────────────────────

@app.get("/api/services")
def get_services():
    with get_db() as db:
        rows = db.execute("SELECT * FROM services ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]


@app.post("/api/services")
def add_service(service: ServiceConfig):
    sid = str(int(time.time() * 1000))
    entry = {**service.model_dump(), "id": sid}
    with get_db() as db:
        db.execute(
            "INSERT INTO services (id, name, url, icon, description) VALUES (?, ?, ?, ?, ?)",
            (sid, service.name, service.url, service.icon or "🔗", service.description or ""),
        )
    return entry


@app.delete("/api/services/{service_id}")
def remove_service(service_id: str):
    with get_db() as db:
        db.execute("DELETE FROM services WHERE id = ?", (service_id,))
    return {"removed": service_id}


# ─── Static frontend ───────────────────────────────────────────────────────

FRONTEND_DIST = "/app/frontend/dist"

try:
    app.mount("/assets", StaticFiles(directory=f"{FRONTEND_DIST}/assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail=f"No route: /{full_path}")
        return FileResponse(f"{FRONTEND_DIST}/index.html")

except Exception:
    pass  # Dev mode
