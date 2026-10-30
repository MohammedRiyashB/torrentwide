# Torrentwide FastAPI backend — migration foundation

Python FastAPI backend with qBittorrent Web API integration and PostgreSQL-backed user accounts.

## Implemented in this branch
- `GET /health`: public liveness check
- `POST /api/auth/register`: create an account (email + password of at least 12 characters)
- `POST /api/auth/login`: OAuth2 password-form login; returns a short-lived JWT
- `GET /api/auth/me`: return the authenticated account
- qBittorrent operations: list torrents, add magnet, pause, resume and delete
- Docker Compose stack: API, PostgreSQL and qBittorrent with persistent named volumes

## Local setup
1. Install Docker Engine and the Docker Compose plugin.
2. From this directory, copy `.env.example` to `.env`.
3. Set unique random values for `JWT_SECRET` (at least 32 characters), `TORRENTWIDE_API_TOKEN`, `POSTGRES_PASSWORD` and `QBITTORRENT_PASSWORD`. Ensure the password in `DATABASE_URL` matches `POSTGRES_PASSWORD`.
4. Start services: `docker compose --env-file .env up --build -d`.
5. Check `http://localhost:8000/health` and open `http://localhost:8000/docs`.

## Authentication notes
- Passwords are hashed using Argon2 via pwdlib; plaintext passwords are never stored.
- Access tokens are signed JWTs and expire after the configured `ACCESS_TOKEN_MINUTES` (default 60).
- Registration is currently open. Before public launch, add email verification, abuse/rate limiting, account recovery and a registration policy.
- The existing torrent endpoints still use the temporary server-wide bearer token. The next security step is to replace that with per-user JWT authorization and associate each torrent with its owner.
- Never put JWT secrets, API tokens, database credentials or qBittorrent credentials in frontend environment variables or commit real `.env` files.

## Important integration/deployment limits
- The React frontend has not yet been migrated to these FastAPI endpoints. Its existing relative `/api/*` calls will continue hitting Vercel until an API base URL and authenticated API client are implemented.
- This is an initial foundation, not a production-ready full feature migration. File manager, torrent-file upload, file selection, download streaming/HTTP Range, history, audit logs, settings and live SSE/WebSocket events are still outstanding.
- Reliable torrenting needs an always-on host, persistent writable storage and P2P networking. Free serverless hosting is not suitable for a continuously running torrent engine.
- Keep qBittorrent's Web UI private; only the FastAPI container should reach it over the internal Docker network.


## Frontend connection (migration in progress)
- Set Vercel project environment variable `VITE_API_BASE_URL` to the public HTTPS origin of the FastAPI service (no trailing slash), then redeploy the frontend.
- The React app now displays a login/register gate and sends bearer JWTs through its API helper for fetch-based API requests.
- Registration requires a valid email and a password of at least 12 characters.
- Do not put server secrets in Vercel frontend variables. Only the public API origin belongs in `VITE_API_BASE_URL`.
- Existing SSE EventSource and non-torrent API features have not yet been migrated. Torrent file upload, file manager, history, settings, audit log and streaming still need dedicated FastAPI endpoints and authenticated client integration.


## Per-account torrent ownership
- The API records each added magnet's BitTorrent info hash against the authenticated user in PostgreSQL.
- List, pause, resume and delete operations are restricted to hashes owned by the signed-in account. Unknown or other-account hashes return 404.
- Existing qBittorrent jobs that predate ownership records are intentionally not automatically claimed or exposed; migrate them through a controlled admin process.
- A single shared qBittorrent daemon is still used. This is account-level API isolation, not separate resource quotas or a hostile multi-tenant sandbox.
- Magnet submission currently supports links with valid 40-character hexadecimal or 32-character Base32 BTIH hashes. Torrent-file upload is not implemented yet.


## Uploading .torrent metadata
- Authenticated users can upload a `.torrent` file to `POST /api/torrents/upload` using multipart fields `torrentFile` and optional `isSequential`.
- Uploads are limited to 10 MB and must contain valid BitTorrent metadata.
- The backend calculates the info hash, checks account ownership conflicts, submits the metadata to qBittorrent, and records ownership in PostgreSQL.
- The endpoint does not accept arbitrary files as torrent metadata. Downloaded payload files remain in the qBittorrent downloads volume.


## Live torrent updates
- Authenticated clients connect to `/api/torrents/ws` using WebSocket (WSS behind HTTPS).
- The client sends its bearer JWT in the first WebSocket JSON message: `{"token":"..."}`. Tokens are not placed in URL query strings.
- The server validates the JWT, checks that the user still exists, enforces token expiry during the session, and sends only torrents recorded for that user.
- Update messages use `type: "torrent_update"` and include the same torrent objects as `GET /api/torrents`.
- The backend currently samples qBittorrent every 2 seconds; this is WebSocket push delivery over periodic engine polling, not native qBittorrent event streaming.
- The React dashboard uses WebSockets and falls back to 5-second authenticated HTTP polling if the socket closes.
- Configure `CORS_ORIGINS` with the exact frontend origins for production. Use HTTPS/WSS in production.
