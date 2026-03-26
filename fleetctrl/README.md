# FleetCtrl

FleetCtrl is a config-driven dashboard for managing Dockerized applications on multiple remote hosts from a single `fleet.yml` file. The UI shows service status, server health (CPU, memory, container counts), and a YAML editor, while the FastAPI backend reads `fleet.yml` on every relevant request (no in-memory config cache), talks to hosts over SSH and the Docker API, and streams deploy progress over a WebSocket as newline-delimited JSON.

## Prerequisites

- **Python** 3.11 or newer
- **Node.js** 18 or newer
- **Docker** installed and running on each remote server you manage (the backend uses `docker` over `ssh://user@host`)
- SSH key-based access from the machine running FleetCtrl to each server defined in `fleet.yml`

## Setup

### Backend

```bash
cd fleetctrl/backend
pip install -r requirements.txt
```

### Frontend

```bash
cd fleetctrl/frontend
npm install
```

### Configure `fleetctrl/backend/fleet.yml`

Edit `fleet.yml` with real hosts, SSH users, paths to private keys, server tags, and service definitions. Keys on disk must be readable by the process running the API. The Docker daemon on each host must be reachable for your SSH user (often via the `docker` group).

### Run (two terminals)

**Backend** (from `fleetctrl/backend`):

```bash
uvicorn main:app --reload --port 8000
```

**Frontend** (from `fleetctrl/frontend`):

```bash
npm run dev
```

Open the app at [http://localhost:5173](http://localhost:5173). The UI expects the API at [http://localhost:8000](http://localhost:8000).

---

## `fleet.yml` schema

Top-level YAML must contain a `fleet` object. Annotated example:

```yaml
fleet:
  # Display name for this fleet
  name: production
  # Numeric version (used for your own tracking)
  version: 1.0
  # When true, the WebSocket deploy pipeline skips real pulls/deploys
  dry_run: false

  # At least one server; SSH + Docker are used per host
  servers:
    - host: 10.0.0.5          # Hostname or IP
      user: deploy            # SSH user
      key: ~/.ssh/id_ed25519  # Path to private key on the API machine
      tags: [prod, web]       # Tags services can target

  # At least one service; target must match a tag on exactly one chosen server
  services:
    - name: api               # Docker container name
      image: nginx:alpine
      replicas: 1             # Informational for now; deploy runs one container per service entry
      target: web             # Must appear in servers[].tags
      ports:
        - "8080:80"           # host:container TCP mapping
      env:
        LOG_LEVEL: info
      health_check: /healthz  # Informational; status comes from Docker state
```

Validation rules enforced by the API include: non-empty `fleet.name`, numeric `fleet.version`, at least one server and one service, and required fields on each server (`host`, `user`, `key`) and service (`name`, `image`, `target`).

---

## Deploy pipeline (end-to-end)

1. **Config** — You click **Deploy All** in the UI. The frontend opens a WebSocket to `/ws/deploy` and sends `{"action":"deploy_all"}`.
2. **Parse** — The backend loads `fleet.yml` from disk, validates it, and emits a `config_parse` event (newline-delimited JSON).
3. **Per service (sequential)** — For each service, the backend resolves the server whose `tags` include the service `target`, verifies Docker-over-SSH connectivity, pulls the image, stops/removes any existing container with the same name, runs a new container with ports, env, and `unless-stopped` restart policy, then inspects container state for a `health_check` stage message.
4. **Dry run** — If `dry_run: true`, SSH/Docker steps are skipped after connect checks where applicable, and stages are marked `skipped`.
5. **Stream** — Each stage is sent as one JSON object per line (`stage`, `service`, `status`, `message`, `timestamp`). The UI updates the pipeline strip and activity log; when `done` is received, the frontend records “last deploy” time and refreshes service data.

REST endpoints also support **redeploy** and **stop** per service (`POST /api/services/{name}/deploy` and `/stop`).

---

## Project layout

```
fleetctrl/
├── backend/          # FastAPI app, fleet.yml, Python modules
├── frontend/         # Vite + React + Tailwind
└── README.md
```

## Security note

FleetCtrl can start/stop containers and run remote commands as configured. Restrict network access to the API, protect `fleet.yml` and SSH keys, and use least-privilege Docker/SSH users.
