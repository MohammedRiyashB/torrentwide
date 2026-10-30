# ULTRA DOWNLOAD HUB: Cloud Torrent Engine & Ultra-Fast Download Platform

A complete cloud torrent download management platform engineered for high-throughput BitTorrent downloading, persistent cloud storage, and mobile delivery to Android devices via Chrome.

---

## 1. System Architecture

```
                  +----------------------------------------------+
                  |         Dedicated Linux VPS / Server         |
                  |     (Must Explicitly Permit P2P Traffic)     |
                  +----------------------------------------------+
                                         |
     [ Inbound Trackers & Peers ]        |        [ Android Chrome ]
                  |                      |                 ^
                  v                      v                 |
       +--------------------+   +------------------+       |
       |  qBittorrent /     |   |   Express.js /   |       |
       |  Native P2P Engine |<->|  FastAPI Backend |-------+ (HTTP 206 Range Streaming)
       +--------------------+   +------------------+
                  |                      |
                  +----------+-----------+
                             |
                             v
                 +-----------------------+
                 |  Persistent Storage   |
                 |  (/storage/completed) |
                 +-----------------------+
```

---

## 2. Android Chrome Mobile Download Guide

Ultra Download Hub is engineered with a **"DOWNLOAD TO PHONE"** workflow designed for mobile devices (tested on Android 12-15 with Google Chrome):

1. **Open the Dashboard**: Navigate to the Ultra Download Hub web app on your Android Chrome browser or desktop.
2. **Complete a Torrent Download**: Upload a `.torrent` file or paste a magnet URI. The cloud engine will download and verify the payload.
3. **Click "DOWNLOAD TO PHONE"**:
   - The platform generates a signed, temporary download token.
   - A QR Code is displayed on desktop screens so you can scan directly with your Android camera.
   - On mobile, tap **"Start Download in Android Chrome"**.
4. **Android Chrome Features**:
   - **HTTP Range Requests**: Chrome downloads the file using `206 Partial Content`.
   - **Resumable Downloads**: If your Wi-Fi drops or you switch to 5G mobile data, Android Chrome will pause and seamlessly resume without restarting from 0%.
   - **Background Downloading**: Chrome will continue downloading in Android's system download manager without requiring the browser tab to stay active.
   - **Storage Destination**: Files arrive in your Android device's default `/sdcard/Download/` folder.

---

## 3. Deployment on P2P-Permitted Linux VPS

> **CRITICAL COMPLIANCE NOTICE**:
> Ensure your hosting provider explicitly allows BitTorrent / P2P network traffic (e.g., Hetzner, OVHcloud, BuyVM, Netcup, Leaseweb). Do NOT run BitTorrent engines on restricted providers or Google Colab.

### Quick Automated Install (Ubuntu / Debian)

```bash
# Clone the repository
git clone <your-repo-url> /opt/ultra-download-hub
cd /opt/ultra-download-hub

# Run the installation script as root
sudo chmod +x deploy/install_vps.sh
sudo ./deploy/install_vps.sh
```

### Manual Docker Compose Deployment

```bash
# 1. Configure environment variables
cp .env.example .env
# Edit .env with your secret keys

# 2. Build and launch services
docker compose up -d --build

# 3. Verify status
docker compose ps
docker compose logs -f ultra-hub
```

---

## 4. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/stats` | Live CPU, RAM, disk space, and network speeds |
| `GET` | `/api/torrents` | List all torrents with progress, speed, and status |
| `POST` | `/api/torrents/upload` | Upload `.torrent` file via multipart form |
| `POST` | `/api/torrents/magnet` | Add torrent by magnet link |
| `POST` | `/api/torrents/preset` | 1-click test with verified legal Linux/Blender presets |
| `POST` | `/api/torrents/:id/pause` | Pause active download |
| `POST` | `/api/torrents/:id/resume` | Resume paused download |
| `POST` | `/api/torrents/:id/recheck`| Re-verify all pieces against SHA-1 hashes |
| `DELETE` | `/api/torrents/:id` | Remove torrent with optional file deletion |
| `GET` | `/api/files` | List all verified files in cloud storage |
| `POST` | `/api/files/:id/token` | Issue signed temporary mobile download token |
| `GET` | `/api/download/:token` | **HTTP 206 Range streaming download endpoint** |
| `POST` | `/api/files/:id/sha256`| Calculate cryptographic SHA-256 integrity hash |
| `GET` | `/api/settings` | Get current performance profile and limits |
| `PUT` | `/api/settings` | Update performance mode (Eco, Balanced, Max) |
| `GET` | `/api/events` | SSE real-time telemetry stream |
| `WS` | `/ws/dashboard` | WebSocket live dashboard feed |

---

## 5. Troubleshooting & Performance Tuning

1. **Slow Download Speeds from Peers**:
   - Check firewall rules: ensure TCP and UDP port `6881` are open (`sudo ufw status`).
   - Switch Performance Mode to **MAX PERFORMANCE MODE** in the Settings tab to maximize connection limits and buffer size.
   - Verify that the torrent has healthy seeders.

2. **Android Chrome Download Interrupted**:
   - Open Android Chrome's `Downloads` tab.
   - Tap `Resume`. Because the server emits `Accept-Ranges: bytes`, Chrome will resume from the exact byte offset.

3. **Storage Quota Exceeded**:
   - Visit the **File Manager** tab and delete unneeded files or completed ISOs after transferring them to your phone.
