import { DEFAULT_CHUNK_SIZE, verifyShareCredentials } from "./share.js";
const SIGNAL_URL = import.meta.env.VITE_SIGNALING_URL || "";
const ICE_SERVERS = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function signalingUrl(id, role, expiresAt) {
  if (!SIGNAL_URL) throw new Error("Signaling is not configured yet. Deploy the Torrentwide signaling Worker and set VITE_SIGNALING_URL.");
  const url = new URL(SIGNAL_URL);
  url.pathname = url.pathname.replace(/\/$/, "") + "/signal/" + encodeURIComponent(id);
  url.searchParams.set("role", role);\n  url.searchParams.set("exp", String(expiresAt));
  return url.toString().replace(/^http/, "ws");
}
export function connectSignal(id, role, onMessage) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(signalingUrl(id, role));
    const timeout = setTimeout(() => { socket.close(); reject(new Error("Signaling connection timed out.")); }, 12000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(socket); }, { once: true });
    socket.addEventListener("message", (event) => {
      try { onMessage(JSON.parse(event.data)); } catch { /* ignore malformed signal */ }
    });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Could not reach the signaling service.")); }, { once: true });
  });
}
function waitIceComplete(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(resolve, 8000);
  });
}
export async function startSender({ id, file, expiresAt, onStatus, onProgress }) {
  const peers = new Map();
  const socket = await connectSignal(id, "sender", async (message) => {
    if (message.type !== "receiver-join" || peers.has(message.peerId)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const channel = pc.createDataChannel("torrentwide-file", { ordered: true });
    peers.set(message.peerId, { pc, channel });
    pc.onicecandidate = (event) => { if (event.candidate) socket.send(JSON.stringify({ type: "candidate", target: message.peerId, candidate: event.candidate })); };
    pc.onconnectionstatechange = () => onStatus(pc.connectionState);
    channel.binaryType = "arraybuffer";
    channel.onopen = async () => {
      onStatus("connected");
      const chunkSize = DEFAULT_CHUNK_SIZE;
      channel.send(JSON.stringify({ type: "file", name: file.name, size: file.size, mime: file.type || "application/octet-stream", chunkSize, chunks: Math.ceil(file.size / chunkSize) }));
      let sent = 0;
      for (let offset = 0; offset < file.size; offset += chunkSize) {
        if (channel.readyState !== "open") break;
        const data = await file.slice(offset, offset + chunkSize).arrayBuffer();
        while (channel.bufferedAmount > 4 * 1024 * 1024 && channel.readyState === "open") await wait(30);
        channel.send(data); sent += data.byteLength; onProgress(sent, file.size);
      }
      if (channel.readyState === "open") channel.send(JSON.stringify({ type: "complete", size: sent }));
    };
    pc.ondatachannel = () => {};
    await pc.setLocalDescription(await pc.createOffer());
    await waitIceComplete(pc);
    socket.send(JSON.stringify({ type: "offer", target: message.peerId, sdp: pc.localDescription }));
  });
  socket.send(JSON.stringify({ type: "sender-ready" }));
  socket.addEventListener("message", async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "answer" && msg.sdp) await peers.get(msg.peerId)?.pc.setRemoteDescription(msg.sdp);
    if (msg.type === "candidate" && msg.candidate) await peers.get(msg.peerId)?.pc.addIceCandidate(msg.candidate).catch(() => {});
  });
  return { close() { socket.close(); for (const { pc } of peers.values()) pc.close(); }, get peerCount() { return [...peers.values()].filter(p => p.pc.connectionState === "connected").length; } };
}
export async function startReceiver({ id, onStatus, onFile, onProgress }) {
  let pc;
  let received = 0;
  let expected = 0;
  let chunks = [];
  let metadata;
  const socket = await connectSignal(id, "receiver", async (message) => {
    if (message.type === "offer") {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (event) => { if (event.candidate) socket.send(JSON.stringify({ type: "candidate", target: message.peerId, candidate: event.candidate })); };
      pc.onconnectionstatechange = () => onStatus(pc.connectionState);
      pc.ondatachannel = (event) => {
        const channel = event.channel; channel.binaryType = "arraybuffer";
        channel.onmessage = async ({ data }) => {
          if (typeof data === "string") {
            const packet = JSON.parse(data);
            if (packet.type === "file") { metadata = packet; expected = packet.size; chunks = []; onFile({ name: packet.name, size: packet.size, mime: packet.mime }); }
            if (packet.type === "complete") {
              const blob = new Blob(chunks, { type: metadata?.mime || "application/octet-stream" });
              onFile({ name: metadata?.name, size: blob.size, mime: blob.type, blob }); onStatus("complete");
            }
          } else {
            chunks.push(data); received += data.byteLength; onProgress(received, expected);
            await sha256(data).catch(() => null);
          }
        };
      };
      await pc.setRemoteDescription(message.sdp);
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await waitIceComplete(pc);
      socket.send(JSON.stringify({ type: "answer", target: message.peerId, sdp: pc.localDescription }));
    } else if (message.type === "candidate" && pc && message.candidate) await pc.addIceCandidate(message.candidate).catch(() => {});\n    else if (message.type === "sender-ready") socket.send(JSON.stringify({ type: "receiver-join" }));\n    else if (message.type === "waiting-for-sender") onStatus("waiting-for-sender");
  });
  socket.send(JSON.stringify({ type: "receiver-join" }));
  return { close() { socket.close(); pc?.close(); }, get receivedBytes() { return received; } };
}
