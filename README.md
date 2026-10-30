# Torrentwide

Torrentwide is a browser-first BitTorrent client. The torrent engine runs on the visitor's device using [WebTorrent](https://webtorrent.io/) and WebRTC. There is no Torrentwide torrent server, remote download worker, or cloud file storage.

## Run locally

Use Node.js 22 or newer:

```bash
npm install
npm test
npm run build
npm run dev
```

Vite serves the local app from the root path. Production is published as a static site over HTTPS.

## Add a torrent

- Choose a local `.torrent` file or paste a magnet URI.
- For a `.torrent` file, Torrentwide reads the BitTorrent private flag before adding any public trackers. Private torrents are not given public WebRTC trackers.
- For magnet links, the **Add public WebRTC trackers** option is off by default. Enable it only for public swarms to improve browser peer discovery; keep it off for private torrents. Trackers and peers can see the client's public IP address and the info hash.
- Metadata, peer count, verified download progress, upload rate, and network warnings are shown in the live transfer panel.
- Save completed files through the browser's File System Access save picker. The file is streamed to the chosen destination rather than first assembling the entire file in JavaScript memory.

## Browser compatibility is a real limitation

Browser WebTorrent uses WebRTC data channels. It cannot connect directly to ordinary BitTorrent TCP/UDP peers. A swarm must contain WebRTC-capable peers or provide compatible web seeds. Therefore, a valid magnet link or healthy desktop torrent swarm may still report zero browser-compatible peers. Adding more trackers cannot turn TCP/UDP peers into WebRTC peers.

Torrentwide uses WebRTC-capable tracker endpoints for public magnet sources and public `.torrent` metadata. Tracker availability, browser networking policy, NAT/firewall conditions, and whether the swarm has browser-capable peers all affect the result. There is no guaranteed connection time.

## Local storage and saving

Torrent pieces are stored on the device in the browser's Origin Private File System (OPFS) using `fs-access-chunk-store`. This is local browser storage, not cloud storage. The browser may reclaim site data, and available quota varies by device. Keep Torrentwide open while downloading and while saving a completed file. Stopping a session disconnects peers while retaining the local piece store for possible re-use.

## Privacy and safety

- No account or Torrentwide server is required.
- P2P peers and trackers can observe the visitor's network address as part of normal BitTorrent operation.
- Public WebRTC trackers are never added automatically to a `.torrent` file marked private.
- For magnet links, disable public tracker injection when using a private swarm.
- Download and share only content you are legally allowed to access.

## Deployment

GitHub Actions builds and deploys the `feat/browser-webtorrent-redesign` branch to GitHub Pages. The Vite base path is selected automatically for that Pages build; local development uses the root path. The `main` branch is separate and is not modified by the redesign workflow.
