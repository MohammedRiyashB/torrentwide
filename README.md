# Torrentwide

Torrentwide is being redesigned as a browser-first, peer-to-peer file sharing app. It no longer uses BitTorrent, magnet links, torrent metadata, or cloud file storage.

## Architecture

- React + Vite frontend, hosted as a static site (GitHub Pages).
- WebRTC data channels carry file bytes directly between sender and receiver browsers.
- A small Cloudflare Worker + Durable Object brokers WebSocket signaling (SDP/ICE) only. It does not accept, store, or proxy file bytes.
- Share IDs are random 128-bit values. A 256-bit secret is carried in the URL fragment so it is not sent in HTTP requests or referrer headers.
- Share expiry options are 1, 7, 30 days, or a custom date/time. The current client enforces expiry; server-side revocation/expiry records are not yet implemented.

## Run locally

Node.js 22 or newer:

```bash
npm install
npm test
npm run build
npm run dev
```

## Signaling deployment

See [worker/README.md](worker/README.md). Deploy the Cloudflare Worker, then set the GitHub repository variable `VITE_SIGNALING_URL` to its HTTPS base URL and run the Pages deployment again.

## Current implementation boundaries

The current transport supports direct sender-to-receiver WebRTC sessions and multiple receivers connected directly to the sender. The sender tab must remain open and online. Receiver-assisted piece exchange, sender-offline seeding, resumable transfers, disk-streamed large-file downloads, server-enforced expiry, and TURN configuration are not implemented yet. The receiver currently buffers file chunks in memory; avoid very large files.

STUN-only connectivity cannot traverse every NAT/firewall. A TURN relay can improve reliability but may incur operating costs; it still need not store file contents.

## Privacy

File contents are not uploaded to the signaling service. The service exchanges only connection setup messages. The private link key is in the URL fragment. Anyone with the complete private link can access the share while the sender is online and the link has not expired.
