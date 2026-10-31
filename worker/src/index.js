export class ShareRoom {
  constructor(state, env) { this.state = state; this.env = env; this.sockets = new Map(); this.expiresAt = 0; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "torrentwide-signaling", storesFiles: false });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket required", { status: 426 });
    const role = url.searchParams.get("role");
    if (!["sender", "receiver"].includes(role)) return new Response("Invalid role", { status: 400 });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    const peerId = crypto.randomUUID();
    server.accept();
    this.sockets.set(peerId, { socket: server, role });
    server.addEventListener("message", (event) => this.message(peerId, event.data));
    server.addEventListener("close", () => this.remove(peerId));
    server.addEventListener("error", () => this.remove(peerId));
    server.send(JSON.stringify({ type: "joined", peerId }));
    return new Response(null, { status: 101, webSocket: client });
  }
  message(peerId, raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    const source = this.sockets.get(peerId); if (!source) return;
    if (message.type === "sender-ready" && source.role === "sender") {
      for (const [id, peer] of this.sockets) if (peer.role === "receiver") this.send(peer, { type: "sender-ready" });
      return;
    }
    if (message.type === "receiver-join" && source.role === "receiver") {
      const sender = [...this.sockets.values()].find(peer => peer.role === "sender");
      if (!sender) { this.send(source, { type: "waiting-for-sender" }); return; }
      const targetId = [...this.sockets].find(([, peer]) => peer === sender)?.[0];
      this.send(sender, { type: "receiver-join", peerId });
      source.peerId = targetId;
      return;
    }
    const target = this.sockets.get(message.target);
    if (!target || !["offer", "answer", "candidate"].includes(message.type)) return;
    this.send(target, { ...message, peerId });
  }
  send(peer, payload) { try { if (peer.socket.readyState === 1) peer.socket.send(JSON.stringify(payload)); } catch {} }
  remove(id) { this.sockets.delete(id); if (this.sockets.size === 0) this.state.storage.setAlarm(Date.now() + 60_000); }
  async alarm() { for (const [id, peer] of this.sockets) { try { peer.socket.close(1000, "Room idle"); } catch {} this.sockets.delete(id); } }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "torrentwide-signaling", storesFiles: false });
    const match = url.pathname.match(/^\/signal\/([a-f0-9]{32})$/i);
    if (!match) return new Response("Not found", { status: 404 });
    const id = match[1].toLowerCase();
    const stub = env.SHARE_ROOMS.get(env.SHARE_ROOMS.idFromName(id));
    return stub.fetch(request);
  }
};
