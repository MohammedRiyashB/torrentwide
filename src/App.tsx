import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, Check, ChevronDown, CircleHelp, CloudOff, Download, FileArchive, FileUp, Gauge, Globe2, Link2, LoaderCircle, Magnet, Pause, Play, Radio, ShieldCheck, Sparkles, Trash2, Upload, Wifi, X } from 'lucide-react';
import WebTorrent from 'webtorrent';
import FSAChunkStore from 'fs-access-chunk-store';

type TorrentLike = {
  name: string; infoHash: string; progress: number; downloadSpeed: number; uploadSpeed: number;
  numPeers: number; timeRemaining: number; length: number; downloaded: number; done: boolean;
  files: Array<{name:string; path:string; length:number; progress:number; stream:()=>ReadableStream<Uint8Array>}>;
  on:(event:string, cb:()=>void)=>void; destroy:(cb?:()=>void)=>void; pause?:()=>void; resume?:()=>void;
};
type ClientLike = { add:(id:string|Uint8Array, opts:any, cb:(torrent:TorrentLike)=>void)=>TorrentLike; destroy:(cb?:()=>void)=>void; torrents:TorrentLike[] };
type SavePickerWindow = Window & { showSaveFilePicker?: (opts?:any)=>Promise<{createWritable:()=>Promise<WritableStream>}> };

const formatBytes = (n:number) => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units=['B','KB','MB','GB','TB']; const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),4);
  return (n/Math.pow(1024,i)).toFixed(i===0?0:2)+' '+units[i];
};
const formatTime = (seconds:number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return Math.ceil(seconds)+'s';
  if (seconds < 3600) return Math.floor(seconds/60)+'m '+Math.floor(seconds%60)+'s';
  return Math.floor(seconds/3600)+'h '+Math.floor((seconds%3600)/60)+'m';
};
const withWebTrackers = (magnet:string) => {
  const trackers=['wss://tracker.openwebtorrent.com','wss://tracker.btorrent.xyz','wss://tracker.webtorrent.dev'];
  let result=magnet.trim();
  for (const tracker of trackers) if (!result.includes(encodeURIComponent(tracker)) && !result.includes(tracker)) result += (result.includes('?')?'&':'?')+'tr='+encodeURIComponent(tracker);
  return result;
};

export default function App() {
  const clientRef = useRef<ClientLike|null>(null);
  const torrentRef = useRef<TorrentLike|null>(null);
  const [magnet,setMagnet] = useState('');
  const [torrentFile,setTorrentFile] = useState<File|null>(null);
  const [dragging,setDragging] = useState(false);
  const [torrent,setTorrent] = useState<TorrentLike|null>(null);
  const [progress,setProgress] = useState(0);
  const [speed,setSpeed] = useState(0);
  const [uploadSpeed,setUploadSpeed] = useState(0);
  const [peers,setPeers] = useState(0);
  const [remaining,setRemaining] = useState('—');
  const [phase,setPhase] = useState<'idle'|'connecting'|'downloading'|'complete'|'error'>('idle');
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const [selectedFile,setSelectedFile] = useState(0);
  const [showInfo,setShowInfo] = useState(false);

  useEffect(() => {
    return () => { clientRef.current?.destroy(); };
  }, []);

  useEffect(() => {
    const timer=window.setInterval(()=>{
      const t=torrentRef.current;
      if(!t) return;
      setProgress(t.progress || 0); setSpeed(t.downloadSpeed || 0); setUploadSpeed(t.uploadSpeed || 0);
      setPeers(t.numPeers || 0); setRemaining(formatTime((t.timeRemaining || 0) / 1000));
      if(t.done) setPhase('complete');
    },700);
    return ()=>window.clearInterval(timer);
  },[]);

  const start = async () => {
    setError(''); setMessage('');
    if(!torrentFile && !magnet.trim()) { setError('Add a magnet link or choose a .torrent file first.'); return; }
    if(!('RTCPeerConnection' in window)) { setError('This browser does not support WebRTC P2P. Open Torrentwide in an up-to-date Chrome browser.'); return; }
    try {
      setPhase('connecting'); setProgress(0); setSpeed(0); setPeers(0);
      if(!clientRef.current) clientRef.current = new WebTorrent() as unknown as ClientLike;
      if(torrentRef.current) { torrentRef.current.destroy(); torrentRef.current=null; setTorrent(null); }
      const source = torrentFile ? new Uint8Array(await torrentFile.arrayBuffer()) : withWebTrackers(magnet);
      const t = clientRef.current.add(source as any, { announce: ['wss://tracker.openwebtorrent.com','wss://tracker.btorrent.xyz'], store: (chunkLength:number, storeOptions:any) => FSAChunkStore(chunkLength, { length: storeOptions.length, name: storeOptions.name, rootDir: storeOptions.rootDir }) }, (ready) => {
        torrentRef.current=ready; setTorrent(ready); setSelectedFile(0);
        setPhase(ready.done?'complete':'downloading');
        setMessage('Torrent metadata received. Connected to the WebRTC swarm.');
        ready.on('done',()=>{ setPhase('complete'); setMessage('Download complete. Save the file to your device.'); });
        ready.on('warning',()=>{});
        ready.on('error',()=>{ setPhase('error'); setError('The torrent encountered an error. Try another WebRTC-compatible source.'); });
      });
      torrentRef.current=t;
      t.on('error',()=>{ setPhase('error'); setError('Could not start this torrent. Check the magnet or .torrent file.'); });
    } catch(e) {
      setPhase('error'); setError(e instanceof Error?e.message:'Unable to start the P2P client.');
    }
  };

  const saveFile = async (fileIndex:number) => {
    const t=torrentRef.current; if(!t) return;
    const f=t.files[fileIndex]; if(!f) return;
    const picker=(window as SavePickerWindow).showSaveFilePicker;
    if(!picker) { setError('Your browser does not offer direct file saving here. Update Chrome or use the browser download option after completion.'); return; }
    try {
      setSaving(true); setError('');
      setSelectedFile(fileIndex);
      const handle=await picker({ suggestedName:f.name });
      const writable=await handle.createWritable();
      await f.stream().pipeTo(writable);
      setMessage('Saved '+f.name+' to your selected location.');
      setSaving(false);
    } catch(e) {
      setSaving(false);
      if(e instanceof Error && e.name==='AbortError') return;
      setError(e instanceof Error?e.message:'Could not save this file.');
    }
  };

  const stop = () => {
    const t=torrentRef.current;
    if(t) { t.destroy(); torrentRef.current=null; }
    setTorrent(null); setPhase('idle'); setProgress(0); setSpeed(0); setUploadSpeed(0); setPeers(0); setMessage('Torrent stopped and removed from this session.');
  };

  const percent=Math.min(100,Math.max(0,progress*100));
  const active=phase==='connecting'||phase==='downloading';
  const chosenFiles=torrent?.files ?? [];
  const totalSize=torrent?.length ?? 0;

  return <div className="app-shell" onPointerDown={(e)=>{const el=e.target as HTMLElement; if(el.closest('button,.drop-zone,input,a')) return; const r=document.createElement('i'); r.className='click-ripple'; r.style.left=e.clientX+'px'; r.style.top=e.clientY+'px'; document.body.appendChild(r); window.setTimeout(()=>r.remove(),850);}}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/><div className="grid-overlay"/>
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Globe2 size={21}/></span><span>torrent<span className="brand-accent">wide</span><small>PEER TO PEER • YOUR DEVICE</small></span></a>
      <div className="top-status"><span className="live-dot"/><span>DECENTRALIZED NETWORK</span></div>
      <button className="icon-button" onClick={()=>setShowInfo(!showInfo)} aria-label="About Torrentwide"><CircleHelp size={19}/></button>
    </header>

    <main className="main-content">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> PRIVATE BY DESIGN. PEER POWERED.</div>
        <h1>Download at the<br/><span>speed of the swarm.</span></h1>
        <p className="hero-copy">Your browser connects directly to other peers. Files move from the network to your device — no Torrentwide cloud storage, no remote download server.</p>
      </section>

      {showInfo && <div className="info-panel"><ShieldCheck size={18}/><div><strong>How Torrentwide works</strong><p>Torrentwide runs the P2P client in your browser. Your device downloads and may upload pieces to other peers while the torrent is active. Stop the torrent to end this session.</p></div><button className="tiny-close" onClick={()=>setShowInfo(false)}><X size={16}/></button></div>}

      <section className="download-card">
        <div className="card-heading"><div><span className="section-kicker">01 / ADD A TORRENT</span><h2>Bring your source</h2></div><span className="local-pill"><ShieldCheck size={13}/> LOCAL P2P</span></div>
        <div className={'drop-zone '+(dragging?'is-dragging':'')} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files?.[0];if(f){setTorrentFile(f);setMagnet('');}}}>
          <input id="torrent-file" type="file" accept=".torrent,application/x-bittorrent" hidden onChange={e=>{const f=e.target.files?.[0]??null;setTorrentFile(f);setMagnet('');}}/>
          <label htmlFor="torrent-file" className="drop-content"><span className="upload-icon"><FileUp size={23}/></span><strong>{torrentFile? torrentFile.name:'Drop a .torrent file here'}</strong><span>{torrentFile?formatBytes(torrentFile.size):'or tap to browse your device'}</span></label>
          <span className="drop-or">OR</span>
          <div className="magnet-field"><Magnet size={18}/><input value={magnet} onChange={e=>{setMagnet(e.target.value);if(e.target.value) setTorrentFile(null);}} placeholder="Paste magnet link (magnet:?xt=…)" aria-label="Magnet link"/>{magnet&&<button className="clear-input" onClick={()=>setMagnet('')}><X size={15}/></button>}</div>
        </div>
        <button className="primary-button" onClick={start} disabled={active||phase==='complete'}><Radio size={18}/>{active?'Connecting to peers…':phase==='complete'?'Torrent ready':'Connect & download'}<span>↗</span></button>
        {error&&<div className="error-line"><X size={15}/>{error}</div>}
        {message&&<div className="message-line">{message}</div>}
        <div className="microcopy"><LockIcon/> No account. No upload to a cloud server. HTTPS required for WebRTC.</div>
      </section>

      {(torrent||phase==='connecting')&&<section className="transfer-card">
        <div className="transfer-top"><div><span className="section-kicker">02 / LIVE TRANSFER</span><h2>{torrent?.name||'Finding the swarm…'}</h2><span className="hash-label">{torrent?.infoHash||'WAITING FOR METADATA'}</span></div><span className={'phase-pill '+phase}>{phase==='complete'?<Check size={13}/>:<span className="live-dot"/>}{phase==='complete'?'COMPLETE':phase==='connecting'?'CONNECTING':'DOWNLOADING'}</span></div>
        <div className="progress-meta"><strong>{percent.toFixed(1)}%</strong><span>{formatBytes(torrent?.downloaded||0)} <i>/</i> {formatBytes(totalSize)}</span></div>
        <div className="progress-track"><div className="progress-fill" style={{width:percent+'%'}}/></div>
        <div className="stats-grid">
          <div className="stat"><Download size={16}/><span>DOWNLOAD</span><strong>{formatBytes(speed)}/s</strong></div>
          <div className="stat"><Upload size={16}/><span>UPLOAD</span><strong>{formatBytes(uploadSpeed)}/s</strong></div>
          <div className="stat"><Wifi size={16}/><span>WEBRTC PEERS</span><strong>{peers}</strong></div>
          <div className="stat"><Gauge size={16}/><span>TIME LEFT</span><strong>{phase==='complete'?'Done':remaining}</strong></div>
        </div>
        {chosenFiles.length>0&&<div className="file-list"><div className="file-list-title">FILES IN THIS TORRENT <span>{chosenFiles.length} ITEMS</span></div>{chosenFiles.map((f,i)=><div className="file-row" key={f.path}><FileArchive size={17}/><div className="file-meta"><strong>{f.name}</strong><span>{formatBytes(f.length)} · {Math.round(f.progress*100)}%</span></div><button className="save-button" disabled={phase!=='complete'||saving} onClick={()=>saveFile(i)}><ArrowDownToLine size={15}/>{saving&&selectedFile===i?'Saving':'Save'}</button></div>)}</div>}
        <div className="transfer-actions">{phase==='complete'?<button className="secondary-button" onClick={()=>setMessage('Files are ready. Use Save beside each file to write it to your device.')}><Check size={16}/> Files ready</button>:<span className="seeding-note"><Activity size={14}/> P2P session active · uploads may occur</span>}<button className="stop-button" onClick={stop}><Trash2 size={15}/> Stop session</button></div>
      </section>}

      <section className="how-section"><div className="section-kicker">BUILT FOR YOUR DEVICE</div><div className="feature-grid"><div className="feature"><span><Magnet size={18}/></span><strong>Magnet + .torrent</strong><p>Start from a magnet URI or a local torrent file.</p></div><div className="feature"><span><Radio size={18}/></span><strong>Direct P2P</strong><p>Browser-to-peer WebRTC connections. No cloud relay.</p></div><div className="feature"><span><ArrowDownToLine size={18}/></span><strong>Save locally</strong><p>Choose where completed files are saved on your device.</p></div></div></section>

      <div className="compat-note"><CloudOff size={16}/><p><strong>Know the browser limitation.</strong> WebTorrent in browsers connects only to WebRTC-capable peers. Many traditional TCP/UDP-only torrent peers are unreachable from a browser, so some swarms will show zero peers. Use content you have the right to download and share.</p></div>
    </main>
    <footer className="footer"><span>TORRENTWIDE <i>·</i> BROWSER P2P</span><span>NO CLOUD DOWNLOAD SERVER <i>·</i> WEBRTC</span></footer>
  </div>;
}
function LockIcon(){return <ShieldCheck size={13}/>;}
