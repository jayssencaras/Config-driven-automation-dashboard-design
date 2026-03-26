from pathlib import Path

import yaml

from models import FleetConfig, ServerConfig, ServiceConfig

_DEFAULT_PATH = Path(__file__).resolve().parent / "fleet.yml"


def _as_str_list(val, field: str, errors: list[str]) -> list[str]:
    if val is None:
        errors.append(f"Missing required field: {field}")
        return []
    if not isinstance(val, list):
        errors.append(f"{field} must be a list")
        return []
    out = []
    for i, item in enumerate(val):
        if not isinstance(item, str):
            errors.append(f"{field}[{i}] must be a string")
        else:
            out.append(item)
    return out


def validate_config(raw: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not isinstance(raw, dict):
        return False, ["Root YAML must be a mapping (object)"]

    fleet = raw.get("fleet")
    if fleet is None:
        return False, ["Missing top-level key: fleet"]
    if not isinstance(fleet, dict):
        return False, ["fleet must be a mapping (object)"]

    name = fleet.get("name")
    if name is None or (isinstance(name, str) and not name.strip()):
        errors.append("fleet.name is required and must be non-empty")
    elif not isinstance(name, str):
        errors.append("fleet.name must be a string")

    ver = fleet.get("version")
    if ver is None:
        errors.append("fleet.version is required")
    elif not isinstance(ver, (int, float)):
        errors.append("fleet.version must be a number")

    servers = fleet.get("servers")
    if servers is None:
        errors.append("fleet.servers is required")
    elif not isinstance(servers, list):
        errors.append("fleet.servers must be a list")
    elif len(servers) < 1:
        errors.append("fleet.servers must contain at least one server")

    services = fleet.get("services")
    if services is None:
        errors.append("fleet.services is required")
    elif not isinstance(services, list):
        errors.append("fleet.services must be a list")
    elif len(services) < 1:
        errors.append("fleet.services must contain at least one service")

    if isinstance(servers, list):
        for i, s in enumerate(servers):
            if not isinstance(s, dict):
                errors.append(f"fleet.servers[{i}] must be a mapping")
                continue
            for key in ("host", "user", "key"):
                if not s.get(key) or (isinstance(s.get(key), str) and not str(s[key]).strip()):
                    errors.append(f"fleet.servers[{i}].{key} is required")
            _as_str_list(s.get("tags"), f"fleet.servers[{i}].tags", errors)

    if isinstance(services, list):
        for i, svc in enumerate(services):
            if not isinstance(svc, dict):
                errors.append(f"fleet.services[{i}] must be a mapping")
                continue
            if not svc.get("name") or not str(svc["name"]).strip():
                errors.append(f"fleet.services[{i}].name is required")
            if not svc.get("image") or not str(svc["image"]).strip():
                errors.append(f"fleet.services[{i}].image is required")
            if not svc.get("target") or not str(svc["target"]).strip():
                errors.append(f"fleet.services[{i}].target is required")

    return len(errors) == 0, errors


def load_config(path: str | Path | None = None) -> FleetConfig:
    p = Path(path) if path else _DEFAULT_PATH
    raw_text = p.read_text(encoding="utf-8")
    raw = yaml.safe_load(raw_text)
    if raw is None:
        raise ValueError("fleet.yml is empty or invalid YAML")
    ok, errs = validate_config(raw)
    if not ok:
        raise ValueError("; ".join(errs))
    fleet = raw["fleet"]
    servers = [
        ServerConfig(
            host=s["host"],
            user=s["user"],
            key=s["key"],
            tags=list(s.get("tags") or []),
        )
        for s in fleet["servers"]
    ]
    services = [
        ServiceConfig(
            name=x["name"],
            image=x["image"],
            replicas=int(x.get("replicas", 1)),
            target=x["target"],
            ports=list(x.get("ports") or []),
            env=dict(x.get("env") or {}),
            health_check=str(x.get("health_check", "/healthz")),
        )
        for x in fleet["services"]
    ]
    return FleetConfig(
        name=fleet["name"],
        version=float(fleet["version"]),
        dry_run=bool(fleet.get("dry_run", False)),
        servers=servers,
        services=services,
    )


def save_config(config_dict: dict, path: str | Path | None = None) -> None:
    p = Path(path) if path else _DEFAULT_PATH
    ok, errs = validate_config(config_dict)
    if not ok:
        raise ValueError("; ".join(errs))
    text = yaml.safe_dump(config_dict, default_flow_style=False, sort_keys=False, allow_unicode=True)
    p.write_text(text, encoding="utf-8")
