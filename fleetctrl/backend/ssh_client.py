import threading
from typing import Any

import paramiko

from models import ServerConfig

_POOL_LOCK = threading.Lock()
_POOL: dict[str, paramiko.SSHClient] = {}
_CONNECT_TIMEOUT = 10


def _make_client(server: ServerConfig) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=server.host,
            username=server.user,
            key_filename=server.key,
            timeout=_CONNECT_TIMEOUT,
            banner_timeout=_CONNECT_TIMEOUT,
            auth_timeout=_CONNECT_TIMEOUT,
        )
    except Exception as e:
        raise ConnectionError(
            f"SSH connection to {server.user}@{server.host} failed: {e}"
        ) from e
    return client


def get_connection(server: ServerConfig) -> paramiko.SSHClient:
    host = server.host
    with _POOL_LOCK:
        existing = _POOL.get(host)
        if existing is not None:
            t = existing.get_transport()
            if t is not None and t.is_active():
                return existing
            try:
                existing.close()
            except Exception:
                pass
            del _POOL[host]
        client = _make_client(server)
        _POOL[host] = client
        return client


def run_command(host: str, cmd: str) -> tuple[str, str, int]:
    with _POOL_LOCK:
        client = None
        for _h, c in _POOL.items():
            if _h == host:
                client = c
                break
    if client is None:
        return "", "No SSH connection pooled for this host", 1
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    try:
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        return out, err, code
    except Exception as e:
        return "", str(e), 1


def test_connection(server: ServerConfig) -> bool:
    try:
        c = get_connection(server)
        t = c.get_transport()
        return t is not None and t.is_active()
    except Exception:
        return False
