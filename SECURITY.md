# Security Policy

## Supported Versions

DockerHQ follows a rolling release model — only the latest version on the `main` branch receives security fixes.

| Version | Supported |
|---------|-----------|
| latest (main) | ✅ |
| older commits | ❌ |

Always run `docker compose pull && docker compose up -d --build` to stay on the latest version.

---

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report security issues privately via one of these methods:

- **GitHub Private Reporting**: Use the [Security tab → Report a vulnerability](https://github.com/zackbear/dockerhq/security/advisories/new) button on this repo
- **Email**: Contact the maintainer directly through GitHub

### What to include

A useful report includes:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept, curl commands, config snippets)
- The component affected (backend API, frontend, Docker config, etc.)
- Any suggested fix if you have one

### Response timeline

| Stage | Target time |
|-------|-------------|
| Initial acknowledgment | Within 72 hours |
| Confirmation of issue | Within 7 days |
| Fix or mitigation | Within 14 days for critical, 30 days for others |
| Public disclosure | After fix is released |

---

## Security model

DockerHQ is designed for **trusted local network use**. Key things to know:

### Docker socket access
The Docker socket (`/var/run/docker.sock`) is mounted read-write. Anyone who can reach the DockerHQ UI can start, stop, restart, and remove containers on your host. **Do not expose port 3500 to the public internet.**

### No authentication
DockerHQ does not include built-in user authentication. If you need to expose it beyond localhost, place it behind a reverse proxy with authentication (e.g. nginx + basic auth, Authelia, Cloudflare Access).

### CORS
CORS is locked to `localhost:3500` by default. Only widen this if you know what you are doing.

### Input validation
- Service URLs are validated to `http://` or `https://` only — `javascript:` URLs are rejected
- Monitor port numbers are validated to the range 1–65535
- Monitor hosts block RFC-1918 private ranges (except loopback) to prevent SSRF
- Log tail lines are capped at 2000 to prevent OOM

### Data
All persisted data (service bookmarks, monitor targets) is stored in a SQLite file inside a Docker volume. No data leaves your machine.

---

## Known limitations

- No authentication or authorization layer (by design for simplicity — add a proxy if needed)
- Docker socket access grants effective root on the host
- WebSocket log streaming has no rate limiting

These are accepted trade-offs for a local-network tool. If you run this in a multi-user or internet-facing environment, apply appropriate network-level controls.
