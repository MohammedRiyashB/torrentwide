from __future__ import annotations

import asyncio
import base64
import io
import os
import mimetypes
from pathlib import Path
import re
import tempfile
import time
from typing import Any
from urllib.parse import parse_qs, urlparse

import qbittorrentapi
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from torf import Torrent

from . import models  # noqa: F401 — registers ORM tables
from .auth import get_current_user
from .auth_routes import router as auth_router
from .database import Base, SessionLocal, engine, get_db
from .models import TorrentRecord, User
import jwt
from datetime import datetime, timezone

APP_NAME = "Torrentwide API"
QBIT_HOST = os.getenv("QBITTORRENT_HOST", "http://qbittorrent:8080")
QBIT_USER = os.getenv("QBITTORRENT_USER", "admin")
QBIT_PASSWORD = os.getenv("QBITTORRENT_PASSWORD", "")
DOWNLOAD_PATH = os.getenv("TORRENT_DOWNLOAD_PATH", "/downloads")
ALLOWED_ORIGINS = [v.strip() for v in os.getenv("CORS_ORIGINS", "").split(",") if v.strip()]

app = FastAPI(title=APP_NAME, version="0.2.0")
app.include_router(auth_router)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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


def magnet_info_hash(uri: str) -> str:
    if not uri.startswith("magnet:?"):
        raise HTTPException(status_code=400, detail="A valid magnet URI is required")
    xt_values = parse_qs(urlparse(uri).query).get("xt", [])
    for value in xt_values:
        match = re.fullmatch(r"urn:btih:([a-fA-F0-9]{40}|[A-Z2-7a-z2-7]{32})", value)
        if not match:
            continue
        raw = match.group(1)
        if len(raw) == 40:
            return raw.lower()
        try:
            return base64.b32decode(raw.upper()).hex()
        except Exception:
            continue
    raise HTTPException(status_code=400, detail="Magnet link must contain a valid BitTorrent info hash")


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


def owned_record(db: Session, user: User, torrent_id: str) -> TorrentRecord:
    record = db.scalar(
        select(TorrentRecord).where(
            TorrentRecord.info_hash == torrent_id.lower(),
            TorrentRecord.user_id == user.id,
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Torrent not found for this account")
    return record


@app.websocket("/api/torrents/ws")
async def torrent_updates(websocket: WebSocket) -> None:
    # Authenticate via the first WebSocket message, never a URL query parameter.
    origin = websocket.headers.get("origin")
    if not origin or origin not in ALLOWED_ORIGINS:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    db = SessionLocal()
    try:
        try:
            auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
            token = auth_message.get("token") if isinstance(auth_message, dict) else None
            if not token or len(os.getenv("JWT_SECRET", "")) < 32:
                await websocket.close(code=1008)
                return
            try:
                payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
                user_id = int(payload["sub"])
            except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
                await websocket.close(code=1008)
                return
            user = db.get(User, user_id)
            if user is None:
                await websocket.close(code=1008)
                return

            while True:
                if float(payload.get("exp", 0)) <= time.time():
                    await websocket.close(code=1008)
                    return
                records = db.scalars(
                    select(TorrentRecord).where(TorrentRecord.user_id == user_id)
                ).all()
                hashes = [record.info_hash for record in records]
                try:
                    items = qbit().torrents_info(torrent_hashes=hashes) if hashes else []
                    await websocket.send_json({
                        "type": "torrent_update",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "torrents": [serialize_torrent(item) for item in items],
                    })
                except HTTPException:
                    await websocket.send_json({"type": "error", "message": "Torrent engine temporarily unavailable"})
                await asyncio.sleep(2)
        except asyncio.TimeoutError:
            await websocket.close(code=1008)
    except WebSocketDisconnect:
        pass
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": APP_NAME}


@app.get("/api/health")
def api_health(user: User = Depends(get_current_user)) -> dict[str, Any]:
    client = qbit()
    return {"status": "ok", "torrent_engine": client.app.version}


@app.get("/api/torrents")
def list_torrents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    records = db.scalars(select(TorrentRecord).where(TorrentRecord.user_id == user.id)).all()
    hashes = [record.info_hash for record in records]
    if not hashes:
        return []
    items = qbit().torrents_info(torrent_hashes=hashes)
    return [serialize_torrent(item) for item in items]


@app.post("/api/torrents/upload")
def upload_torrent_file(
    torrentFile: UploadFile = File(...),
    isSequential: bool = Form(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    filename = (torrentFile.filename or "").strip()
    if not filename.lower().endswith(".torrent"):
        raise HTTPException(status_code=400, detail="Upload a .torrent file")
    content = torrentFile.file.read(10 * 1024 * 1024 + 1)
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Torrent file must be between 1 byte and 10 MB")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".torrent", delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        metadata = Torrent.read(temp_path)
        info_hash = str(metadata.infohash).lower()
        if not re.fullmatch(r"[a-f0-9]{40}", info_hash):
            raise ValueError("Invalid torrent info hash")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid BitTorrent metadata file") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

    existing_record = db.scalar(select(TorrentRecord).where(TorrentRecord.info_hash == info_hash))
    if existing_record:
        if existing_record.user_id == user.id:
            return {"status": "already_added", "infoHash": info_hash, "message": "This torrent is already in your account"}
        raise HTTPException(status_code=409, detail="This torrent is already managed by another account")

    client = qbit()
    if client.torrents_info(torrent_hashes=info_hash):
        raise HTTPException(status_code=409, detail="This torrent already exists in the engine and cannot be claimed automatically")

    try:
        result = client.torrents_add(
            torrent_files=io.BytesIO(content),
            save_path=DOWNLOAD_PATH,
            is_sequential=isSequential,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="qBittorrent could not add this torrent file") from exc
    if str(result).lower() not in {"ok.", "ok", "none"}:
        raise HTTPException(status_code=502, detail="qBittorrent rejected the torrent file")

    db.add(TorrentRecord(info_hash=info_hash, user_id=user.id, name=filename))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        try:
            client.torrents_delete(torrent_hashes=info_hash, delete_files=False)
        except Exception:
            pass
        raise HTTPException(status_code=409, detail="Torrent ownership conflict; please retry") from exc
    return {"status": "added", "infoHash": info_hash, "message": "Torrent file submitted to qBittorrent"}


@app.post("/api/torrents/magnet")
def add_magnet(
    payload: MagnetRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    info_hash = magnet_info_hash(payload.magnetUri)
    existing_record = db.scalar(select(TorrentRecord).where(TorrentRecord.info_hash == info_hash))
    if existing_record:
        if existing_record.user_id == user.id:
            return {"status": "already_added", "infoHash": info_hash, "message": "This torrent is already in your account"}
        raise HTTPException(status_code=409, detail="This torrent is already managed by another account")

    client = qbit()
    existing_engine_item = client.torrents_info(torrent_hashes=info_hash)
    if existing_engine_item:
        raise HTTPException(status_code=409, detail="This torrent already exists in the engine and cannot be claimed automatically")

    try:
        result = client.torrents_add(
            urls=payload.magnetUri,
            save_path=DOWNLOAD_PATH,
            is_sequential=payload.isSequential,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="qBittorrent could not add this magnet") from exc
    if str(result).lower() not in {"ok.", "ok", "none"}:
        raise HTTPException(status_code=502, detail="qBittorrent rejected the magnet")

    record = TorrentRecord(
        info_hash=info_hash,
        user_id=user.id,
        name=payload.name or "",
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Do not expose a torrent whose ownership could not be recorded.
        try:
            client.torrents_delete(torrent_hashes=info_hash, delete_files=False)
        except Exception:
            pass
        raise HTTPException(status_code=409, detail="Torrent ownership conflict; please retry") from exc
    return {"status": "added", "infoHash": info_hash, "message": "Magnet submitted to qBittorrent"}


def torrent_file_path(torrent_id: str, file_index: int, user: User, db: Session) -> tuple[Path, Any]:
    record = owned_record(db, user, torrent_id)
    try:
        files = qbit().torrents_files(torrent_hash=record.info_hash)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not retrieve torrent file metadata") from exc
    selected = next((item for item in files if int(getattr(item, "index", -1)) == file_index), None)
    if selected is None:
        raise HTTPException(status_code=404, detail="Torrent file not found")
    relative_name = str(getattr(selected, "name", ""))
    root = Path(DOWNLOAD_PATH).resolve()
    candidate = (root / relative_name).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsafe torrent file path")
    return candidate, selected


@app.get("/api/torrents/{torrent_id}/files")
def list_torrent_files(
    torrent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    record = owned_record(db, user, torrent_id)
    try:
        files = qbit().torrents_files(torrent_hash=record.info_hash)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not retrieve torrent file metadata") from exc
    return [
        {
            "index": int(getattr(item, "index", 0)),
            "name": str(getattr(item, "name", "")),
            "size": int(getattr(item, "size", 0) or 0),
            "progress": round(float(getattr(item, "progress", 0) or 0) * 100, 2),
            "priority": int(getattr(item, "priority", 0) or 0),
            "isSeed": bool(getattr(item, "is_seed", False)),
        }
        for item in files
    ]


@app.get("/api/torrents/{torrent_id}/files/{file_index}/download")
async def download_torrent_file(
    torrent_id: str,
    file_index: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path, _metadata = torrent_file_path(torrent_id, file_index, user, db)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File is not available on disk yet")
    size = path.stat().st_size
    range_header = request.headers.get("range")
    start, end, status_code = 0, max(size - 1, 0), 200
    if range_header:
        match = re.fullmatch(r"bytes=(\\d*)-(\\d*)", range_header.strip())
        if not match:
            raise HTTPException(status_code=416, detail="Invalid byte range", headers={"Content-Range": f"bytes */{size}"})
        first, last = match.groups()
        if not first and not last:
            raise HTTPException(status_code=416, detail="Invalid byte range", headers={"Content-Range": f"bytes */{size}"})
        if not first:
            start = max(size - int(last), 0)
        else:
            start = int(first)
        if last and first:
            end = min(int(last), size - 1)
        if start >= size or end < start:
            raise HTTPException(status_code=416, detail="Requested range is not satisfiable", headers={"Content-Range": f"bytes */{size}"})
        status_code = 206
    length = max(end - start + 1, 0)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"

    async def stream_file():
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining:
                chunk = handle.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(length),
        "Content-Disposition": "attachment; filename=\"" + path.name.replace(chr(34), "") + "\"",
    }
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return StreamingResponse(stream_file(), status_code=status_code, media_type=media_type, headers=headers)


class FileSelectionRequest(BaseModel):
    fileIds: list[int] = Field(min_length=1, max_length=500)


@app.post("/api/torrents/{torrent_id}/select-files")
def select_torrent_files(
    torrent_id: str,
    payload: FileSelectionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    record = owned_record(db, user, torrent_id)
    client = qbit()
    try:
        files = client.torrents_files(torrent_hash=record.info_hash)
        valid_ids = {int(getattr(item, "index", -1)) for item in files}
        if any(file_id not in valid_ids for file_id in payload.fileIds):
            raise HTTPException(status_code=400, detail="One or more file IDs are invalid")
        client.torrents_file_priority(
            torrent_hash=record.info_hash,
            file_ids=payload.fileIds,
            priority=1,
        )
        return {"status": "updated", "message": "Selected files set to normal priority"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not update torrent file priorities") from exc


@app.post("/api/torrents/{torrent_id}/pause")
def pause_torrent(
    torrent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    record = owned_record(db, user, torrent_id)
    qbit().torrents_pause(torrent_hashes=record.info_hash)
    return {"status": "paused"}


@app.post("/api/torrents/{torrent_id}/resume")
def resume_torrent(
    torrent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    record = owned_record(db, user, torrent_id)
    qbit().torrents_resume(torrent_hashes=record.info_hash)
    return {"status": "resumed"}


@app.delete("/api/torrents/{torrent_id}")
def delete_torrent(
    torrent_id: str,
    deleteFiles: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    record = owned_record(db, user, torrent_id)
    qbit().torrents_delete(torrent_hashes=record.info_hash, delete_files=deleteFiles)
    db.delete(record)
    db.commit()
    return {"status": "deleted"}
