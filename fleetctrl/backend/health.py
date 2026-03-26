import asyncio

import ssh_client
from models import ServerConfig, ServerHealth


def _parse_float(s: str) -> float | None:
    try:
        return float(s.strip().replace(",", "."))
    except (ValueError, AttributeError):
        return None


def _parse_int(s: str) -> int | None:
    try:
        return int(float(s.strip()))
    except (ValueError, AttributeError):
        return None


def get_server_health(server: ServerConfig) -> ServerHealth:
    tags = list(server.tags)
    try:
        ssh_client.get_connection(server)
    except Exception:
        return ServerHealth(
            host=server.host,
            reachable=False,
            cpu_percent=None,
            mem_percent=None,
            container_count=None,
            tags=tags,
        )

    cpu_out, _, cpu_code = ssh_client.run_command(
        server.host, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"
    )
    mem_out, _, mem_code = ssh_client.run_command(
        server.host, "free | grep Mem | awk '{print $3/$2 * 100.0}'"
    )
    ctr_out, _, ctr_code = ssh_client.run_command(server.host, "docker ps -q | wc -l")

    cpu_percent = None
    if cpu_code == 0 and cpu_out.strip():
        raw = cpu_out.strip().split()[0] if cpu_out.strip() else ""
        raw = raw.replace("%", "")
        cpu_percent = _parse_float(raw)

    mem_percent = None
    if mem_code == 0 and mem_out.strip():
        mem_percent = _parse_float(mem_out.strip().split()[0])

    container_count = None
    if ctr_code == 0 and ctr_out.strip():
        container_count = _parse_int(ctr_out.strip().split()[0])

    return ServerHealth(
        host=server.host,
        reachable=True,
        cpu_percent=cpu_percent,
        mem_percent=mem_percent,
        container_count=container_count,
        tags=tags,
    )


async def poll_all_servers(servers: list[ServerConfig]) -> list[ServerHealth]:
    async def one(s: ServerConfig) -> ServerHealth:
        try:
            return await asyncio.to_thread(get_server_health, s)
        except Exception:
            return ServerHealth(
                host=s.host,
                reachable=False,
                cpu_percent=None,
                mem_percent=None,
                container_count=None,
                tags=list(s.tags),
            )

    return list(await asyncio.gather(*[one(s) for s in servers]))
