import { DEFAULT_CHUNK_SIZE, verifyShareCredentials } from "./share.js";

const SIGNAL_URL = import.meta.env.VITE_SIGNALING_URL || "";
const ICE_SERVERS = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" }
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function signalingUrl(id, role, expiresAt) {
  if (!SIGNAL_URL) throw new Error("Signaling is not configured. Deploy the Worker and set VITE_SIGNALING_URL.");
  const url = new URL(SIGNAL_URL);
  url.pathname = url.pathname.replace(/\/$/, "") + "/signal/" + encodeURIComponent(id);
  url.searchParams.set("role", role);
  url.searchParams.set("exp", String(expiresAt));
  return url.toString().replace(/^http/, "ws");
}
function connectSignal(id, role, expiresAt, onMessage) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(signalingUrl(id, role, expiresAt));
    const timeout = setTimeout(() => { socket.close(); reject(new Error("Signaling connection timed out.")); }, 12000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(socket); }, { once: true });
    socket.addEventListener("message", (event) => {
      try { onMessage(JSON.parse(event.data)); } catch { /* Ignore malformed signaling frames. */ }
    });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Could not reach the signaling service.")); }, { once: true });
  });
}
function waitIceComplete(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(resolve, 8000);
  });
}

export async function startSender({ id, file, expiresAt, onStatus, onProgress }) {
  const peers = new Map();
  let socket;
  socket = await connectSignal(id, "sender", expiresAt, async (message) => {
    if (message.type !== "receiver-join" || peers.has(message.peerId)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const channel = pc.createDataChannel("torrentwide-file", { ordered: true });
    peers.set(message.peerId, { pc, channel });
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.send(JSON.stringify({ type: "candidate", target: message.peerId, candidate: event.candidate }));
    };
    pc.onconnectionstatechange = () => onStatus(pc.connectionState);
    channel.binaryType = "arraybuffer";
    channel.onopen = async () => {
      onStatus("connected");
      const chunkSize = DEFAULT_CHUNK_SIZE;
      channel.send(JSON.stringify({ type: "file", name: file.name, size: file.size, mime: file.type || "application/octet-stream", chunkSize }));
      let sent = 0;
      for (let offset = 0; offset < file.size; offset += chunkSize) {
        if (channel.readyState !== "open") break;
        const data = await file.slice(offset, offset + chunkSize).arrayBuffer();
        while (channel.bufferedAmount > 4 * 1024 * 1024 && channel.readyState === "open") await wait(30);
        if (channel.readyState !== "open") break;
        channel.send(data);
        sent += data.byteLength;
        onProgress(sent, file.size);
      }
      if (channel.readyState === "open") channel.send(JSON.stringify({ type: "complete", size: sent }));
    };
    await pc.setLocalDescription(await pc.createOffer());
    await waitIceComplete(pc);
    socket.send(JSON.stringify({ type: "offer", target: message.peerId, sdp: pc.localDescription }));
  });
  socket.addEventListener("message", async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const peer = peers.get(msg.peerId);
    if (msg.type === "answer" && msg.sdp && peer) await peer.pc.setRemoteDescription(msg.sdp);
    if (msg.type === "candidate" && msg.candidate && peer) await peer.pc.addIceCandidate(msg.candidate).catch(() => {});
  });
  socket.send(JSON.stringify({ type: "sender-ready" }));
  return {
    close() { socket.close(); for (const { pc } of peers.values()) pc.close(); },
    get peerCount() { return [...peers.values()].filter((p) => p.pc.connectionState === "connected").length; }
  };
}

export async function startReceiver({ id, secret, expiresAt, onStatus, onFile, onProgress }) {
  if (!(await verifyShareCredentials(id, secret, expiresAt))) throw new Error("This private share key does not match the share ID.");
  let pc;
  let received = 0;
  let expected = 0;
  let chunks = [];
  let metadata;
  let socket;
  socket = await connectSignal(id, "receiver", expiresAt, async (message) => {
    if (message.type === "offer") {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (event) => {
        if (event.candidate) socket.send(JSON.stringify({ type: "candidate", target: message.peerId, candidate: event.candidate }));
      };
      pc.onconnectionstatechange = () => onStatus(pc.connectionState);
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channel.binaryType = "arraybuffer";
        channel.onmessage = ({ data }) => {
          if (typeof data === "string") {
            const packet = JSON.parse(data);
            if (packet.type === "file") {
              metadata = packet; expected = packet.size; chunks = [];
              onFile({ name: packet.name, size: packet.size, mime: packet.mime });
            }
            if (packet.type === "complete") {
              const blob = new Blob(chunks, { type: metadata?.mime || "application/octet-stream" });
              onFile({ name: metadata?.name, size: blob.size, mime: blob.type, blob });
              onStatus("complete");
            }
          } else {
            chunks.push(data);
            received += data.byteLength;
            onProgress(received, expected);
          }
        };
      };
      await pc.setRemoteDescription(message.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIceComplete(pc);
      socket.send(JSON.stringify({ type: "answer", target: message.peerId, sdp: pc.localDescription }));
    } else if (message.type === "candidate" && pc && message.candidate) {
      await pc.addIceCandidate(message.candidate).catch(() => {});
    } else if (message.type === "sender-ready") {
      socket.send(JSON.stringify({ type: "receiver-join" }));
    } else if (message.type === "waiting-for-sender") {
      onStatus("waiting-for-sender");
    }
  });
  socket.send(JSON.stringify({ type: "receiver-join" }));
  return { close() { socket.close(); pc?.close(); }, get receivedBytes() { return received; } };
}
