import threading
from datetime import datetime, timezone

import docker
from docker.errors import DockerException, ImageNotFound, NotFound

from models import ServerConfig, ServiceConfig, ServiceStatus

_CLIENT_LOCK = threading.Lock()
_clients: dict[str, docker.DockerClient] = {}


def _client_key(server: ServerConfig) -> str:
    return f"{server.user}@{server.host}"


def get_client(server: ServerConfig) -> docker.DockerClient:
    key = _client_key(server)
    with _CLIENT_LOCK:
        if key in _clients:
            return _clients[key]
        base_url = f"ssh://{server.user}@{server.host}"
        try:
            client = docker.DockerClient(base_url=base_url)
            client.ping()
        except Exception as e:
            raise ConnectionError(f"Docker over SSH failed for {key}: {e}") from e
        _clients[key] = client
        return client


def _container_uptime(attrs: dict) -> str | None:
    started = attrs.get("State", {}).get("StartedAt")
    if not started or started == "0001-01-01T00:00:00Z":
        return None
    try:
        if started.endswith("Z"):
            started = started[:-1] + "+00:00"
        t0 = datetime.fromisoformat(started.replace("Z", "+00:00"))
        if t0.tzinfo is None:
            t0 = t0.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - t0
        secs = int(delta.total_seconds())
        if secs < 60:
            return f"{secs}s"
        if secs < 3600:
            return f"{secs // 60}m"
        if secs < 86400:
            return f"{secs // 3600}h"
        return f"{secs // 86400}d"
    except Exception:
        return None


def list_containers(server: ServerConfig) -> list[dict]:
    try:
        client = get_client(server)
    except Exception:
        return []
    try:
        containers = client.containers.list(all=True)
    except DockerException:
        return []
    out: list[dict] = []
    for c in containers:
        attrs = c.attrs
        name = (attrs.get("Name") or "").lstrip("/")
        img = attrs.get("Config", {}).get("Image") or ""
        st = attrs.get("State", {})
        status = st.get("Status") or attrs.get("Status", "unknown")
        cid = attrs.get("Id", "")[:12] or None
        out.append(
            {
                "name": name,
                "image": img,
                "status": status,
                "id": cid,
                "uptime": _container_uptime(attrs),
            }
        )
    return out


def _parse_ports(ports: list[str]) -> dict:
    mapping: dict = {}
    for p in ports:
        if not p or not isinstance(p, str):
            continue
        parts = [x.strip() for x in p.split(":")]
        if len(parts) == 2:
            host_p, ctr_p = parts[0], parts[1]
            try:
                mapping[f"{ctr_p}/tcp"] = int(host_p)
            except ValueError:
                pass
        elif len(parts) == 1:
            try:
                pp = int(parts[0])
                mapping[f"{pp}/tcp"] = pp
            except ValueError:
                pass
    return mapping


def deploy_service(server: ServerConfig, service: ServiceConfig) -> dict:
    try:
        client = get_client(server)
    except Exception as e:
        return {"success": False, "container_id": "", "message": str(e)}
    try:
        client.images.pull(service.image)
    except ImageNotFound:
        return {"success": False, "container_id": "", "message": f"Image not found: {service.image}"}
    except DockerException as e:
        return {"success": False, "container_id": "", "message": f"Pull failed: {e}"}

    try:
        for c in client.containers.list(all=True):
            name = (c.attrs.get("Name") or "").lstrip("/")
            if name == service.name:
                c.stop(timeout=10)
                c.remove(force=True)
    except DockerException as e:
        return {"success": False, "container_id": "", "message": f"Stop/remove failed: {e}"}

    ports = _parse_ports(service.ports)
    try:
        container = client.containers.run(
            service.image,
            name=service.name,
            detach=True,
            ports=ports or None,
            environment=service.env or None,
            restart_policy={"Name": "unless-stopped"},
        )
        cid = container.id[:12] if container.id else ""
        return {"success": True, "container_id": cid, "message": "Deployed"}
    except DockerException as e:
        return {"success": False, "container_id": "", "message": str(e)}


def stop_service(server: ServerConfig, service_name: str) -> dict:
    try:
        client = get_client(server)
    except Exception as e:
        return {"success": False, "message": str(e)}
    try:
        c = client.containers.get(service_name)
        c.stop(timeout=10)
        return {"success": True, "message": "Stopped"}
    except NotFound:
        return {"success": False, "message": f"Container '{service_name}' not found"}
    except DockerException as e:
        return {"success": False, "message": str(e)}


def _status_from_container(name: str, image_cfg: str, attrs: dict) -> str:
    st = attrs.get("State", {})
    running = st.get("Running", False)
    status = (st.get("Status") or "").lower()
    health = st.get("Health", {})
    h_status = (health.get("Status") or "").lower()
    if running:
        if h_status == "unhealthy":
            return "warn"
        if "health" in status and "unhealthy" in status:
            return "warn"
        return "up"
    if "restarting" in status:
        return "warn"
    return "down"


def get_service_status(server: ServerConfig, service_name: str) -> ServiceStatus:
    try:
        client = get_client(server)
    except Exception:
        return ServiceStatus(
            name=service_name,
            status="down",
            server=server.host,
            image="",
            container_id=None,
            uptime=None,
        )
    try:
        c = client.containers.get(service_name)
        attrs = c.attrs
        img = attrs.get("Config", {}).get("Image") or ""
        cid = attrs.get("Id", "")[:12] or None
        stat = _status_from_container(service_name, img, attrs)
        return ServiceStatus(
            name=service_name,
            status=stat,
            server=server.host,
            image=img,
            container_id=cid,
            uptime=_container_uptime(attrs),
        )
    except NotFound:
        return ServiceStatus(
            name=service_name,
            status="down",
            server=server.host,
            image="",
            container_id=None,
            uptime=None,
        )
    except DockerException:
        return ServiceStatus(
            name=service_name,
            status="warn",
            server=server.host,
            image="",
            container_id=None,
            uptime=None,
        )
