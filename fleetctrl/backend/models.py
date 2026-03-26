from pydantic import BaseModel


class ServerConfig(BaseModel):
    host: str
    user: str
    key: str  # path to SSH private key
    tags: list[str]


class ServiceConfig(BaseModel):
    name: str
    image: str
    replicas: int = 1
    target: str  # matches a server tag
    ports: list[str] = []
    env: dict[str, str] = {}
    health_check: str = "/healthz"


class FleetConfig(BaseModel):
    name: str
    version: float
    dry_run: bool = False
    servers: list[ServerConfig]
    services: list[ServiceConfig]


class ServiceStatus(BaseModel):
    name: str
    status: str  # "up" | "down" | "warn"
    server: str
    image: str
    container_id: str | None
    uptime: str | None


class ServerHealth(BaseModel):
    host: str
    reachable: bool
    cpu_percent: float | None
    mem_percent: float | None
    container_count: int | None
    tags: list[str]
