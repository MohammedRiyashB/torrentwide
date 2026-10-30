# Torrentwide

Torrentwide is a browser-first peer-to-peer torrent client. The download engine runs in the visitor's browser with [WebTorrent](https://webtorrent.io/) and WebRTC. There is no torrent-processing backend, remote download server, or cloud file storage in this architecture.

## Run locally

```bash
npm install
npm run dev
```

Build for static hosting:

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` folder to any HTTPS static host (for example, Vercel static hosting or GitHub Pages with an appropriate base path). WebRTC requires a secure context, so production must use HTTPS.

## Browser P2P compatibility

WebTorrent in a browser uses WebRTC data channels. It cannot connect to ordinary BitTorrent TCP/UDP peers. A swarm needs WebTorrent/WebRTC-capable peers or compatible WebRTC trackers/web seeds. Consequently, a valid magnet link may still show zero browser-compatible peers.

Downloads and uploads happen on the visitor's device/network. While a torrent is active, the browser client can seed pieces to other peers. Use **Stop session** to stop and remove the active torrent from the page.

## Saving files

After the torrent completes, use **Save** next to a file. The app feature-detects the browser File System Access save picker and streams the selected torrent file to the user-chosen destination. Browser support and available storage vary by device. Keep the tab open until the save operation finishes.

## Privacy and safety

- No account or Torrentwide server is required for the P2P transfer.
- The browser connects to peers and trackers specified by the torrent plus the configured WebTorrent trackers.
- Your IP address is visible to peers and trackers as part of normal P2P operation.
- Download and share only content you are legally allowed to access.
