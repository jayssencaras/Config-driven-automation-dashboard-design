import asyncio
import json
import logging
import time
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import config as fleet_config
import docker_manager
import health
from config import load_config, save_config, validate_config
from models import FleetConfig, ServiceStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent / "fleet.yml"

app = FastAPI(title="FleetCtrl API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        body = detail
    else:
        body = {"success": False, "errors": [str(detail)], "message": str(detail)}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "errors": jsonable_encoder(exc.errors()),
            "message": "Validation failed",
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "An unexpected error occurred",
            "errors": [str(exc)],
        },
    )


class ConfigPostBody(BaseModel):
    yaml_content: str


def _find_server_for_service(fleet: FleetConfig, target_tag: str):
    for s in fleet.servers:
        if target_tag in s.tags:
            return s
    return None


async def _service_statuses(fleet: FleetConfig) -> list[ServiceStatus]:
    async def one(svc):
        server = _find_server_for_service(fleet, svc.target)
        if server is None:
            return ServiceStatus(
                name=svc.name,
                status="down",
                server="—",
                image=svc.image,
                container_id=None,
                uptime=None,
            )
        try:
            return await asyncio.to_thread(docker_manager.get_service_status, server, svc.name)
        except Exception:
            return ServiceStatus(
                name=svc.name,
                status="warn",
                server=server.host,
                image=svc.image,
                container_id=None,
                uptime=None,
            )

    return list(await asyncio.gather(*[one(s) for s in fleet.services]))


@app.get("/api/config")
async def get_config():
    try:
        raw = CONFIG_PATH.read_text(encoding="utf-8")
        fleet = fleet_config.load_config(CONFIG_PATH)
        return {"raw": raw, "parsed": fleet.model_dump()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"success": False, "errors": ["fleet.yml not found"]})
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "errors": [str(e)]},
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "errors": [str(e)]},
        )


@app.post("/api/config")
async def post_config(body: ConfigPostBody):
    try:
        raw = yaml.safe_load(body.yaml_content)
    except yaml.YAMLError as e:
        return {"success": False, "errors": [f"YAML parse error: {e}"]}

    ok, errs = validate_config(raw if isinstance(raw, dict) else {})
    if not ok:
        return {"success": False, "errors": errs}

    try:
        fleet_config.save_config(raw, CONFIG_PATH)
    except ValueError as e:
        return {"success": False, "errors": [str(e)]}
    except Exception as e:
        return {"success": False, "errors": [str(e)]}

    return {"success": True, "errors": []}


@app.get("/api/services")
async def get_services():
    try:
        fleet = fleet_config.load_config(CONFIG_PATH)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "message": str(e), "errors": [str(e)]},
        )
    statuses = await _service_statuses(fleet)
    return [s.model_dump() for s in statuses]


@app.post("/api/services/{name}/deploy")
async def deploy_one(name: str):
    try:
        fleet = fleet_config.load_config(CONFIG_PATH)
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(e)},
        )
    svc = next((s for s in fleet.services if s.name == name), None)
    if not svc:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": f"Service '{name}' not in config"},
        )
    server = _find_server_for_service(fleet, svc.target)
    if not server:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": f"No server with tag '{svc.target}'"},
        )
    try:
        result = docker_manager.deploy_service(server, svc)
    except Exception as e:
        return {"success": False, "message": str(e)}
    return {
        "success": bool(result.get("success")),
        "message": result.get("message", ""),
    }


@app.post("/api/services/{name}/stop")
async def stop_one(name: str):
    try:
        fleet = fleet_config.load_config(CONFIG_PATH)
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(e)},
        )
    svc = next((s for s in fleet.services if s.name == name), None)
    if not svc:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": f"Service '{name}' not in config"},
        )
    server = _find_server_for_service(fleet, svc.target)
    if not server:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": f"No server with tag '{svc.target}'"},
        )
    try:
        result = docker_manager.stop_service(server, svc.name)
    except Exception as e:
        return {"success": False, "message": str(e)}
    return {
        "success": bool(result.get("success")),
        "message": result.get("message", ""),
    }


@app.get("/api/servers/health")
async def servers_health():
    try:
        fleet = fleet_config.load_config(CONFIG_PATH)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "errors": [str(e)]},
        )
    rows = await health.poll_all_servers(fleet.servers)
    return [r.model_dump() for r in rows]


def _ws_line(obj: dict) -> str:
    obj["timestamp"] = time.time()
    return json.dumps(obj) + "\n"


@app.websocket("/ws/deploy")
async def ws_deploy(ws: WebSocket):
    await ws.accept()

    async def send_stage(stage: str, service: str | None, status: str, message: str):
        await ws.send_text(
            _ws_line(
                {
                    "stage": stage,
                    "service": service,
                    "status": status,
                    "message": message,
                }
            )
        )

    try:
        init = await ws.receive_text()
        data = json.loads(init)
        action = data.get("action")
        target_service = data.get("service")

        try:
            fleet = fleet_config.load_config(CONFIG_PATH)
        except Exception as e:
            await send_stage("error", None, "error", str(e))
            await ws.close()
            return

        await send_stage("config_parse", None, "ok", f"Loaded fleet '{fleet.name}'")

        if action == "deploy_one" and target_service:
            to_run = [s for s in fleet.services if s.name == target_service]
            if not to_run:
                await send_stage("error", target_service, "error", "Service not found")
                await ws.close()
                return
        elif action == "deploy_all":
            to_run = list(fleet.services)
        else:
            await send_stage("error", None, "error", "Invalid action")
            await ws.close()
            return

        for svc in to_run:
            server = _find_server_for_service(fleet, svc.target)
            if not server:
                await send_stage(
                    "deploy",
                    svc.name,
                    "error",
                    f"No server for tag '{svc.target}'",
                )
                continue

            await send_stage("ssh_connect", svc.name, "ok", f"{server.user}@{server.host}")

            if fleet.dry_run:
                await send_stage("image_pull", svc.name, "skipped", "dry_run")
                await send_stage("deploy", svc.name, "skipped", "dry_run")
                await send_stage("health_check", svc.name, "skipped", "dry_run")
                continue

            try:
                await asyncio.to_thread(docker_manager.get_client, server)
            except Exception as e:
                await send_stage("ssh_connect", svc.name, "error", str(e))
                await send_stage("error", svc.name, "error", str(e))
                continue

            await send_stage("image_pull", svc.name, "running", f"Pulling {svc.image}")
            try:
                client = docker_manager.get_client(server)
                await asyncio.to_thread(client.images.pull, svc.image)
            except Exception as e:
                await send_stage("image_pull", svc.name, "error", str(e))
                await send_stage("error", svc.name, "error", str(e))
                continue
            await send_stage("image_pull", svc.name, "ok", "Image ready")

            await send_stage("deploy", svc.name, "running", "Starting container")
            res = await asyncio.to_thread(docker_manager.deploy_service, server, svc)
            if not res.get("success"):
                await send_stage("deploy", svc.name, "error", res.get("message", "deploy failed"))
                await send_stage("error", svc.name, "error", res.get("message", "deploy failed"))
                continue
            await send_stage("deploy", svc.name, "ok", res.get("message", "Deployed"))

            await send_stage("health_check", svc.name, "running", "Checking container state")
            st = await asyncio.to_thread(docker_manager.get_service_status, server, svc.name)
            hc_msg = f"status={st.status}"
            await send_stage(
                "health_check",
                svc.name,
                "ok" if st.status == "up" else "warn",
                hc_msg,
            )

        await send_stage("done", None, "ok", "Pipeline complete")
    except WebSocketDisconnect:
        pass
    except json.JSONDecodeError as e:
        try:
            await ws.send_text(_ws_line({"stage": "error", "service": None, "status": "error", "message": str(e)}))
        except Exception:
            pass
    except Exception as e:
        try:
            await ws.send_text(_ws_line({"stage": "error", "service": None, "status": "error", "message": str(e)}))
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
