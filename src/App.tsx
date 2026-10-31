import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownToLine, Check, CircleHelp, CloudOff, Copy, FileUp, Globe2, Link2, LoaderCircle, Radio, ShieldCheck, Sparkles, Upload, Wifi, X } from "lucide-react";
import { createShareCredentials, buildShareUrl, parseShareLocation, getExpiryTimestamp, isExpired } from "./lib/share.js";
import { startSender, startReceiver } from "./lib/peer.js";

const fmt = (n) => {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4);
  return (n / 1024 ** i).toFixed(i ? 2 : 0) + " " + units[i];
};
const fmtDate = (n) => new Date(n).toLocaleString();

export default function App() {
  const [file, setFile] = useState(null);
  const [expiry, setExpiry] = useState("7");
  const [customDate, setCustomDate] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [role, setRole] = useState("idle");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [transferFile, setTransferFile] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [status, setStatus] = useState("");
  const session = useRef(null);
  const receiver = useMemo(() => parseShareLocation(window.location), []);
  const expiryAt = useMemo(() => expiry === "custom" ? new Date(customDate).getTime() : getExpiryTimestamp(Number(expiry)), [expiry, customDate]);

  useEffect(() => () => session.current?.close?.(), []);
  useEffect(() => {
    if (!receiver) return;
    if (isExpired(receiver.expiresAt)) { setRole("receiver"); setPhase("expired"); setError("This private share link has expired."); return; }
    setRole("receiver"); setPhase("ready");
  }, [receiver]);

  const createLink = async () => {
    setError(""); setStatus("");
    if (!file) return setError("Choose a file from your device first.");
    if (expiry === "custom" && (!customDate || !Number.isFinite(expiryAt) || expiryAt <= Date.now())) return setError("Choose a future expiry date and time.");
    try {
      const { id, secret } = await createShareCredentials();
      const expiresAt = expiryAt;
      const url = buildShareUrl(window.location.href.split("?")[0].split("#")[0], id, secret, expiresAt);
      setShareUrl(url); setRole("sender"); setPhase("connecting"); setProgress(0); setTotal(file.size);
      session.current?.close?.();
      session.current = await startSender({ id, file, expiresAt, onStatus: (s) => { setStatus(s); if (s === "connected") setPhase("transferring"); }, onProgress: (sent, size) => { setProgress(sent); setTotal(size); setPhase("transferring"); } });
      setPhase("waiting");
      setStatus("Share is ready. Keep this tab open and online while recipients download.");
    } catch (e) { setPhase("error"); setError(e instanceof Error ? e.message : "Could not create this share."); }
  };

  const connectDownload = async () => {
    if (!receiver || isExpired(receiver.expiresAt)) return setError("This share link is invalid or expired.");
    setError(""); setPhase("connecting");
    try {
      session.current?.close?.();
      session.current = await startReceiver({
        id: receiver.id,
        onStatus: (s) => { setStatus(s); if (s === "connected") setPhase("transferring"); if (s === "complete") setPhase("complete"); },
        onFile: (f) => { setTransferFile(f); if (f.blob) setPhase("complete"); },
        onProgress: (n, size) => { setProgress(n); setTotal(size); setPhase("transferring"); }
      });
      setStatus("Waiting for the sender to accept the peer connection. The sender must be online.");
    } catch (e) { setPhase("error"); setError(e instanceof Error ? e.message : "Could not connect to sender."); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setStatus("Private share link copied."); }
    catch { setError("Clipboard access failed. Select and copy the link manually."); }
  };
  const saveReceived = () => {
    if (!transferFile?.blob) return;
    const url = URL.createObjectURL(transferFile.blob);
    const a = document.createElement("a"); a.href = url; a.download = transferFile.name || "download"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const stop = () => { session.current?.close?.(); session.current = null; setPhase("idle"); setStatus("Peer session disconnected."); };
  const percent = total ? Math.min(100, progress / total * 100) : 0;

  return <div className="app-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="grid-overlay" />
    <header className="topbar">
      <a className="brand" href={window.location.pathname}><span className="brand-mark"><Globe2 size={21} /></span><span>torrent<span className="brand-accent">wide</span><small>PRIVATE BROWSER FILE SHARING</small></span></a>
      <div className="top-status"><span className="live-dot" /><span>DIRECT P2P NETWORK</span></div>
      <button className="icon-button" onClick={() => setInfo(!info)} aria-label="About Torrentwide"><CircleHelp size={19} /></button>
    </header>
    <main className="main-content" id="top">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> YOUR FILE. YOUR DEVICE. YOUR LINK.</div>
        <h1>Share files<br /><span>without the cloud.</span></h1>
        <p className="hero-copy">Create a private link and send files directly between browsers. Torrentwide coordinates the connection — your file stays on your device.</p>
      </section>
      {info && <div className="info-panel"><ShieldCheck size={18} /><div><strong>Private by design</strong><p>File bytes travel over an encrypted WebRTC data channel. The signaling service only exchanges connection setup messages; it does not store or relay your files. Keep the sender tab open during the transfer.</p></div><button className="tiny-close" onClick={() => setInfo(false)}><X size={16} /></button></div>}
      {role === "receiver" ? <section className="download-card">
        <div className="card-heading"><div><span className="section-kicker">01 / PRIVATE SHARE</span><h2>Someone shared a file with you</h2></div><span className="local-pill"><ShieldCheck size={13} /> PRIVATE LINK</span></div>
        <div className="info-panel" style={{ margin: "22px 0 0" }}><Link2 size={18} /><div><strong>Link expiry</strong><p>{receiver && fmtDate(receiver.expiresAt)}</p></div></div>
        <button className="primary-button" onClick={connectDownload} disabled={phase === "connecting" || phase === "transferring" || phase === "complete" || phase === "expired"}><ArrowDownToLine size={18} />{phase === "expired" ? "Link expired" : phase === "complete" ? "File ready" : phase === "connecting" ? "Connecting…" : "Connect & download"}<span>↗</span></button>
        {transferFile && <div className="file-row"><FileUp size={18} /><div className="file-meta"><strong>{transferFile.name}</strong><span>{fmt(transferFile.size)}</span></div>{transferFile.blob && <button className="save-button" onClick={saveReceived}><ArrowDownToLine size={15} /> Save</button>}</div>}
        {error && <div className="error-line"><X size={15} />{error}</div>}
      </section> : <section className="download-card">
        <div className="card-heading"><div><span className="section-kicker">01 / CREATE A SHARE</span><h2>Choose a file to share</h2></div><span className="local-pill"><ShieldCheck size={13} /> LOCAL FILE</span></div>
        <div className="drop-zone">
          <input id="share-file" type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label htmlFor="share-file" className="drop-content"><span className="upload-icon"><FileUp size={23} /></span><strong>{file ? file.name : "Choose a file from your device"}</strong><span>{file ? fmt(file.size) : "Tap to browse · File is not uploaded to a server"}</span></label>
        </div>
        <div style={{ marginTop: 20 }}><span className="section-kicker">LINK EXPIRY</span>
          <div style={{ display: "flex", gap: 9, marginTop: 10, flexWrap: "wrap" }}>
            {["1","7","30","custom"].map(v => <button key={v} className={expiry === v ? "secondary-button" : "stop-button"} onClick={() => setExpiry(v)}>{v === "custom" ? "Custom" : v + " days"}</button>)}
          </div>
          {expiry === "custom" && <input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)} style={{ marginTop: 12, width: "100%", padding: 12, background: "#080e18", color: "#eef3ff", border: "1px solid #344454", borderRadius: 9 }} />}
        </div>
        <button className="primary-button" onClick={createLink} disabled={!file || phase === "connecting"}><Link2 size={18} /> Create private share link<span>↗</span></button>
        {shareUrl && <div className="file-list"><div className="file-list-title">YOUR PRIVATE LINK <span>SECRET IN URL FRAGMENT</span></div><div className="magnet-field"><input readOnly value={shareUrl} aria-label="Private share URL" /><button className="clear-input" onClick={copyLink}><Copy size={17} /></button></div><div className="microcopy">Expires {fmt(expiryAt)} · Keep this tab open for direct transfers.</div></div>}
        {error && <div className="error-line"><X size={15} />{error}</div>}
      </section>}
      {(phase === "waiting" || phase === "connecting" || phase === "transferring" || phase === "complete" || phase === "error") && <section className="transfer-card">
        <div className="transfer-top"><div><span className="section-kicker">02 / LIVE PEER SESSION</span><h2>{phase === "waiting" ? "Waiting for a recipient" : phase === "complete" ? "Transfer complete" : "Browser-to-browser transfer"}</h2><span className="hash-label">{status || "WebRTC data channel"}</span></div><span className={"phase-pill " + phase}>{phase.toUpperCase()}</span></div>
        <div className="progress-meta"><strong>{percent.toFixed(1)}%</strong><span>{fmt(progress)} <i>/</i> {fmt(total)}</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: percent + "%" }} /></div>
        <div className="stats-grid"><div className="stat"><Upload size={16} /><span>TRANSFERRED</span><strong>{fmt(progress)}</strong></div><div className="stat"><Wifi size={16} /><span>TRANSPORT</span><strong>WebRTC</strong></div><div className="stat"><Activity size={16} /><span>MODE</span><strong>Direct P2P</strong></div><div className="stat"><ShieldCheck size={16} /><span>FILE STORAGE</span><strong>None</strong></div></div>
        <div className="transfer-actions"><span className="seeding-note"><Activity size={14} /> Sender must remain online · no cloud file storage</span><button className="stop-button" onClick={stop}>Stop session</button></div>
      </section>}
      <section className="how-section"><div className="section-kicker">SIMPLE. PRIVATE. PEER POWERED.</div><div className="feature-grid">
        <div className="feature"><span><Link2 size={18} /></span><strong>Private share links</strong><p>Random share IDs and a secret key kept in the URL fragment.</p></div>
        <div className="feature"><span><Radio size={18} /></span><strong>Direct browser transfer</strong><p>WebRTC data channels carry file bytes between devices.</p></div>
        <div className="feature"><span><CloudOff size={18} /></span><strong>No cloud file storage</strong><p>Only signaling messages pass through the coordination service.</p></div>
      </div></section>
      <div className="compat-note"><CloudOff size={16} /><p><strong>Know the current limits.</strong> The sender must keep this browser tab open and online. This first transport supports direct sender-to-receiver sessions and multiple receivers connecting to the sender; receiver-assisted swarm seeding, sender-offline downloads, resumable transfers, and large-file streaming are not yet implemented. STUN-only WebRTC may fail on restrictive networks; TURN can improve connectivity but may cost money.</p></div>
    </main>
    <footer className="footer"><span>TORRENTWIDE <i>·</i> BROWSER P2P SHARING</span><span>NO CLOUD FILE STORAGE <i>·</i> WEBRTC</span></footer>
  </div>;
}
