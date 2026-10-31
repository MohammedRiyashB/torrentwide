# Torrentwide signaling Worker

This Cloudflare Worker only brokers WebRTC signaling messages (SDP/ICE) between browsers. It does not accept, persist, or proxy file bytes. Each room is keyed by a random 128-bit share ID and is ephemeral; connected sockets are closed when the room becomes idle.

## Deploy

1. Install Wrangler: `npm install -g wrangler`.
2. From this directory run `wrangler login` then `wrangler deploy`.
3. Set the deployed Worker URL as the GitHub Actions repository variable `VITE_SIGNALING_URL` (for example, `https://torrentwide-signaling.<account>.workers.dev`).
4. Re-run the Pages deployment.

## Important limitations

- The sender browser must stay open and online for this initial direct-transfer transport.
- STUN-only connectivity cannot traverse every NAT/firewall. Production deployments may configure a TURN service; TURN relays traffic but does not store files and may incur charges.
- Expiry is included in the private share ID derivation and checked by the Worker on every signaling connection. A Durable Object alarm closes connected peers when the link expires. No file or share-content record is persisted.
- Multiple receivers can connect directly to the sender. Receiver-to-receiver piece exchange and sender-offline seeding are not yet implemented in this transport version. The UI must not claim otherwise.
- The receiver currently buffers the received file in browser memory. Large-file streaming to disk and resumable chunk verification are follow-up work.
