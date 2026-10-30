# Torrentwide

**A browser-native, client-side peer-to-peer torrent downloader.**

Torrentwide uses [WebTorrent](https://webtorrent.io/) in the browser. The browser connects directly to WebRTC-capable torrent peers; torrent pieces are handled on the visitor's device and selected files can be streamed to a user-approved local save destination.

## What it does

- Add a magnet URI or select/drop a `.torrent` file.
- Discover WebRTC peers and show live peer count, progress, download speed, upload speed and ETA.
- List files in a multi-file torrent and save a selected file with the browser's File System Access API.
- Remove a torrent to stop its activity in this browser session.
- Responsive dark emerald interface with animated ambient background.

## Important compatibility limits

This is a **browser WebRTC torrent client**, not a full desktop BitTorrent client. Browsers cannot open raw BitTorrent TCP/UDP peer connections. A torrent needs WebRTC-compatible peers (for example, peers running WebTorrent or a compatible WebTorrent tracker/network). A magnet link with ordinary TCP/UDP seeders only may remain at zero peers.

Use a current Chrome/Chromium browser over HTTPS. Saving uses `showSaveFilePicker()` when available and requires the user to approve the destination. Keep the tab open while transferring; browsers may suspend work when the tab is backgrounded or the device sleeps.

Downloading automatically makes received pieces available to other peers while the torrent remains active. Use the remove control to stop the torrent and its sharing activity. Only download and share content you are authorized to access.

## No torrent backend

The actual torrent transfer does not use a Torrentwide cloud server, qBittorrent daemon, API, or cloud file storage. Hosting serves only the static website assets. The browser's WebRTC connections perform peer-to-peer transfer.

## Local development

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

The static production output is in `dist/`.

## Free static hosting

Deploy the repository to a static host such as Vercel or Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- No backend service or environment variables are required.
- Use HTTPS; WebRTC and local file access require a secure context (localhost is allowed for development).

## Project stack

- React + TypeScript
- Vite
- WebTorrent 3.x
- WebRTC
- File System Access API
- Lucide icons
