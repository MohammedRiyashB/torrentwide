from __future__ import annotations

import os
from typing import Any

import qbittorrentapi
from .database import Base, engine
from . import models  # noqa: F401 — registers ORM tables
from .auth_routes import router as auth_router
from .auth import get_current_user
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_NAME = "Torrentwide API"
QBIT_HOST = os.getenv("QBITTORRENT_HOST", "http://qbittorrent:8080")
QBIT_USER = os.getenv("QBITTORRENT_USER", "admin")
QBIT_PASSWORD = os.getenv("QBITTORRENT_PASSWORD", "")
DOWNLOAD_PATH = os.getenv("TORRENT_DOWNLOAD_PATH", "/downloads")
ALLOWED_ORIGINS = [v.strip() for v in os.getenv("CORS_ORIGINS", "").split(",") if v.strip()]

app = FastAPI(title=APP_NAME, version="0.1.0")
app.include_router(auth_router)

@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class MagnetRequest(BaseModel):
    magnetUri: str = Field(min_length=10, max_length=8192)
    name: str | None = Field(default=None, max_length=255)
    isSequential: bool = False


def qbit() -> qbittorrentapi.Client:
    if not QBIT_PASSWORD:
        raise HTTPException(status_code=503, detail="qBittorrent credentials are not configured")
    client = qbittorrentapi.Client(host=QBIT_HOST, username=QBIT_USER, password=QBIT_PASSWORD)
    try:
        client.auth_log_in()
    except qbittorrentapi.LoginFailed as exc:
        raise HTTPException(status_code=502, detail="qBittorrent authentication failed") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="qBittorrent is unavailable") from exc
    return client


def serialize_torrent(item: Any) -> dict[str, Any]:
    progress = float(getattr(item, "progress", 0) or 0)
    state = str(getattr(item, "state", "unknown"))
    if progress >= 1:
        status = "completed"
    elif "paused" in state:
        status = "paused"
    elif "error" in state or "missing" in state:
        status = "error"
    else:
        status = "downloading"
    return {
        "id": item.hash,
        "name": item.name,
        "infoHash": item.hash,
        "totalSize": int(getattr(item, "size", 0) or 0),
        "downloadedSize": int(getattr(item, "downloaded", 0) or 0),
        "uploadedSize": int(getattr(item, "uploaded", 0) or 0),
        "progress": round(progress * 100, 2),
        "downloadSpeed": int(getattr(item, "dlspeed", 0) or 0),
        "uploadSpeed": int(getattr(item, "upspeed", 0) or 0),
        "eta": int(getattr(item, "eta", 0) or 0),
        "status": status,
        "errorMessage": state if status == "error" else None,
        "connectedPeers": int(getattr(item, "num_seeds", 0) or 0) + int(getattr(item, "num_leechs", 0) or 0),
        "seeders": int(getattr(item, "num_seeds", 0) or 0),
        "leechers": int(getattr(item, "num_leechs", 0) or 0),
        "trackers": [],
        "files": [],
        "addedAt": int(getattr(item, "added_on", 0) or 0) * 1000,
        "savePath": str(getattr(item, "save_path", DOWNLOAD_PATH)),
        "isSequential": False,
        "ratio": float(getattr(item, "ratio", 0) or 0),
        "source": "magnet",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": APP_NAME}


@app.get("/api/health", dependencies=[Depends(get_current_user)])
def api_health() -> dict[str, Any]:
    client = qbit()
    return {"status": "ok", "torrent_engine": client.app.version}


@app.get("/api/torrents", dependencies=[Depends(get_current_user)])
def list_torrents() -> list[dict[str, Any]]:
    return [serialize_torrent(t) for t in qbit().torrents_info()]


@app.post("/api/torrents/magnet", dependencies=[Depends(require_token)])
def add_magnet(payload: MagnetRequest) -> dict[str, str]:
    if not payload.magnetUri.startswith("magnet:?"):
        raise HTTPException(status_code=400, detail="A valid magnet URI is required")
    try:
        result = qbit().torrents_add(
            urls=payload.magnetUri,
            save_path=DOWNLOAD_PATH,
            is_sequential=payload.isSequential,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="qBittorrent could not add this magnet") from exc
    if str(result).lower() not in {"ok.", "ok", "none"}:
        raise HTTPException(status_code=502, detail="qBittorrent rejected the magnet")
    return {"status": "added", "message": "Magnet submitted to qBittorrent"}


@app.post("/api/torrents/{torrent_id}/pause", dependencies=[Depends(require_token)])
def pause_torrent(torrent_id: str) -> dict[str, str]:
    qbit().torrents_pause(torrent_hashes=torrent_id)
    return {"status": "paused"}


@app.post("/api/torrents/{torrent_id}/resume", dependencies=[Depends(require_token)])
def resume_torrent(torrent_id: str) -> dict[str, str]:
    qbit().torrents_resume(torrent_hashes=torrent_id)
    return {"status": "resumed"}


@app.delete("/api/torrents/{torrent_id}", dependencies=[Depends(require_token)])
def delete_torrent(torrent_id: str, deleteFiles: bool = False) -> dict[str, str]:
    qbit().torrents_delete(torrent_hashes=torrent_id, delete_files=deleteFiles)
    return {"status": "deleted"}
