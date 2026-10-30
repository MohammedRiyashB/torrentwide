# Torrentwide FastAPI backend — initial migration

This is the first migration slice: FastAPI health checks and authenticated qBittorrent operations.

## Included
- `GET /health` liveness endpoint
- Bearer-token protected `GET /api/health` and `GET /api/torrents`
- Bearer-token protected magnet add, pause, resume and delete endpoints
- Real qBittorrent Web API integration; no simulated progress

## Run locally
1. Start qBittorrent with its Web UI reachable from this service.
2. Copy `.env.example` to `.env`; set unique credentials and a long random API token.
3. Install dependencies: `python -m pip install -r requirements.txt`
4. From this directory run: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
5. Open `/docs` for interactive API documentation.

## Security and deployment
- Never commit `.env`, API tokens, qBittorrent credentials or database passwords.
- Keep the qBittorrent Web UI private; do not expose port 8080 publicly.
- Set `CORS_ORIGINS` to the exact frontend origin.
- The existing frontend still calls same-origin `/api/*` routes without a bearer token. It is not connected to this service yet; a coordinated API-client migration is required.
- Reliable torrenting requires a persistent host, writable persistent download volume and P2P networking. Free serverless hosting is not suitable for a continuously running torrent engine.
- This first slice does not yet implement the complete frontend API contract (file manager, tokens, audit logs, history, settings, streaming or SSE). These remain migration work.
