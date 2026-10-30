import { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, Check, CircleHelp, CloudOff, Download, FileArchive,
  FileUp, Gauge, Globe2, Magnet, Radio, ShieldCheck, Sparkles, Trash2, Upload,
  Wifi, X, AlertTriangle, LoaderCircle
} from 'lucide-react';
import { isPrivateTorrent, prepareMagnetUri, WEBRTC_TRACKERS } from './lib/webrtc.js';

type Phase = 'idle' | 'loading' | 'connecting' | 'downloading' | 'complete' | 'error';
type TorrentFile = {
  name: string;
  path: string;
  length: number;
  progress: number;
  stream: () => ReadableStream<Uint8Array>;
};
type TorrentLike = {
  name: string;
  infoHash: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  timeRemaining: number;
  length: number;
  downloaded: number;
  done: boolean;
  files: TorrentFile[];
  on: (event: string, cb: (...args: any[]) => void) => void;
  destroy: (opts?: any, cb?: () => void) => void;
};
type ClientLike = {
  add: (id: string | Uint8Array, opts: any, cb: (torrent: TorrentLike) => void) => TorrentLike;
  on: (event: string, cb: (...args: any[]) => void) => void;
  destroy: (cb?: () => void) => void;
  torrents: TorrentLike[];
};
type WebTorrentModule = { default: (new (opts?: any) => ClientLike) & { WEBRTC_SUPPORT?: boolean } };
type StoreModule = { default: (chunkLength: number, options?: any) => any };
type SavePickerWindow = Window & {
  showSaveFilePicker?: (opts?: any) => Promise<{ createWritable: () => Promise<WritableStream> }>;
};

const formatBytes = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return Math.ceil(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.floor(seconds % 60) + 's';
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
};

const destroyTorrentSafely = (torrent: TorrentLike) => new Promise<void>((resolve) => {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    resolve();
  };
  try {
    const result = torrent.destroy({ destroyStore: false }, finish) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(finish, finish);
    }
    window.setTimeout(finish, 2500);
  } catch {
    finish();
  }
});

export default function App() {
  const clientRef = useRef<ClientLike | null>(null);
  const torrentRef = useRef<TorrentLike | null>(null);
  const attemptRef = useRef(0);

  const [magnet, setMagnet] = useState('');
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [torrent, setTorrent] = useState<TorrentLike | null>(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [peers, setPeers] = useState(0);
  const [remaining, setRemaining] = useState('—');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [swarmStatus, setSwarmStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [addPublicTrackers, setAddPublicTrackers] = useState(true);
  const [privateTorrent, setPrivateTorrent] = useState(false);

  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      const currentTorrent = torrentRef.current;
      torrentRef.current = null;
      if (currentTorrent) currentTorrent.destroy({ destroyStore: false });
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const activeTorrent = torrentRef.current;
      if (!activeTorrent) return;
      setProgress(activeTorrent.progress || 0);
      setSpeed(activeTorrent.downloadSpeed || 0);
      setUploadSpeed(activeTorrent.uploadSpeed || 0);
      setPeers(activeTorrent.numPeers || 0);
      setRemaining(activeTorrent.done
        ? 'Done'
        : formatTime(Number.isFinite(activeTorrent.timeRemaining) ? activeTorrent.timeRemaining / 1000 : 0));
      if (activeTorrent.done) setPhase('complete');
      else if ((activeTorrent.numPeers || 0) > 0) setPhase('downloading');
    }, 700);
    return () => window.clearInterval(timer);
  }, []);

  const start = async () => {
    const attempt = ++attemptRef.current;
    setError('');
    setMessage('');
    setSwarmStatus('');
    setPrivateTorrent(false);
    if (!torrentFile && !magnet.trim()) {
      setError('Choose a .torrent file or paste a magnet link first.');
      return;
    }
    if (!window.isSecureContext) {
      setPhase('error');
      setError('WebRTC requires HTTPS. Open the official HTTPS Torrentwide address.');
      return;
    }
    if (!('RTCPeerConnection' in window)) {
      setPhase('error');
      setError('This browser does not support WebRTC. Open Torrentwide in an up-to-date Chrome browser.');
      return;
    }

    setPhase('loading');
    setProgress(0);
    setSpeed(0);
    setUploadSpeed(0);
    setPeers(0);
    setRemaining('—');
    setTorrent(null);

    try {
      let source: string | Uint8Array;
      let isPrivate = false;
      let sourceName = '';

      if (torrentFile) {
        if (!torrentFile.name.toLowerCase().endsWith('.torrent')) {
          throw new Error('Select a valid .torrent file.');
        }
        if (torrentFile.size === 0 || torrentFile.size > 25 * 1024 * 1024) {
          throw new Error('The .torrent file must be between 1 byte and 25 MB.');
        }
        const bytes = new Uint8Array(await torrentFile.arrayBuffer());
        if (attempt !== attemptRef.current) return;
        isPrivate = isPrivateTorrent(bytes);
        source = bytes;
        sourceName = torrentFile.name;
      } else {
        source = prepareMagnetUri(magnet, addPublicTrackers);
        sourceName = 'Magnet link';
      }

      setPrivateTorrent(isPrivate);
      if (isPrivate) {
        setSwarmStatus('Private torrent detected. Public trackers are disabled to protect its privacy.');
      } else if (!torrentFile && addPublicTrackers) {
        setSwarmStatus('Public WebRTC trackers enabled. Trackers and connected peers can see your IP address and info hash.');
      }

      const storageManager = navigator.storage as StorageManager & {
        getDirectory?: () => Promise<FileSystemDirectoryHandle>;
      };
      if (typeof storageManager?.getDirectory !== 'function') {
        throw new Error('This browser does not provide Origin Private File System storage. Update Chrome or use a supported browser.');
      }

      // Load the browser torrent engine only after the user starts a session.
      const [{ default: WebTorrent }, { default: FSAChunkStore }] = await Promise.all([
        import('webtorrent') as Promise<WebTorrentModule>,
        import('fs-access-chunk-store') as Promise<StoreModule>,
      ]);
      if (attempt !== attemptRef.current) return;

      if (WebTorrent.WEBRTC_SUPPORT === false) {
        throw new Error('The installed WebTorrent engine reports that WebRTC is unavailable in this browser.');
      }

      if (torrentRef.current) {
        const previous = torrentRef.current;
        torrentRef.current = null;
        await destroyTorrentSafely(previous);
        if (attempt !== attemptRef.current) return;
      }

      if (!clientRef.current) {
        const client = new WebTorrent({
          maxConns: 40,
          tracker: true,
          dht: false,
          lsd: false,
          utPex: false,
          webSeeds: true,
          utp: false,
        });
        client.on('error', (clientError: unknown) => {
          if (attempt !== attemptRef.current) return;
          torrentRef.current = null;
          clientRef.current = null;
          setTorrent(null);
          setPhase('error');
          setError(clientError instanceof Error ? clientError.message : 'The WebTorrent client stopped unexpectedly.');
        });
        clientRef.current = client;
      }

      const extraAnnounce = torrentFile && !isPrivate ? [...WEBRTC_TRACKERS] : [];
      const client = clientRef.current;
      if (!client) throw new Error('The P2P client could not be initialized.');

      const activeTorrent = client.add(source, {
        announce: extraAnnounce,
        private: isPrivate,
        noPeersIntervalTime: 15,
        strategy: 'sequential',
        destroyStoreOnDestroy: false,
        storeCacheSlots: 8,
        store: (chunkLength: number, storeOptions: any) => FSAChunkStore(chunkLength, {
          length: storeOptions.length,
          name: storeOptions.name,
          rootDir: storeOptions.rootDir,
        }),
      }, (readyTorrent) => {
        if (attempt !== attemptRef.current) return;
        torrentRef.current = readyTorrent;
        setTorrent(readyTorrent);
        setSelectedFile(0);
        setPhase(readyTorrent.done ? 'complete' : (readyTorrent.numPeers > 0 ? 'downloading' : 'connecting'));
        setMessage('Torrent metadata received. Waiting for WebRTC peers and verified pieces.');
        readyTorrent.on('done', () => {
          if (attempt !== attemptRef.current) return;
          setPhase('complete');
          setRemaining('Done');
          setMessage('Download complete. Save each file to your device.');
        });
        readyTorrent.on('download', () => {
          if (attempt !== attemptRef.current) return;
          setPhase('downloading');
        });
        readyTorrent.on('wire', () => {
          if (attempt !== attemptRef.current) return;
          setPeers(readyTorrent.numPeers || 0);
          setPhase('downloading');
          setSwarmStatus('A WebRTC peer connected. Waiting for verified pieces.');
        });
        readyTorrent.on('noPeers', (announceType: string) => {
          if (attempt !== attemptRef.current) return;
          setSwarmStatus('No browser-compatible peers reported by ' + announceType + '. This swarm may only have TCP/UDP peers.');
        });
        readyTorrent.on('warning', (warning: unknown) => {
          if (attempt !== attemptRef.current) return;
          const warningText = warning instanceof Error ? warning.message : String(warning || 'Tracker warning');
          setSwarmStatus('Network warning: ' + warningText);
        });
        readyTorrent.on('error', (torrentError: unknown) => {
          if (attempt !== attemptRef.current) return;
          setPhase('error');
          setError(torrentError instanceof Error ? torrentError.message : 'The torrent encountered a fatal error.');
        });
      });

      torrentRef.current = activeTorrent;
      activeTorrent.on('noPeers', (announceType: string) => {
        if (attempt !== attemptRef.current) return;
        setSwarmStatus('No browser-compatible peers reported by ' + announceType + '. A TCP/UDP-only swarm cannot connect to a browser.');
      });
      activeTorrent.on('wire', () => {
        if (attempt !== attemptRef.current) return;
        setPeers(activeTorrent.numPeers || 0);
        setPhase('downloading');
      });
      activeTorrent.on('error', (torrentError: unknown) => {
        if (attempt !== attemptRef.current) return;
        setPhase('error');
        setError(torrentError instanceof Error ? torrentError.message : 'Could not start this torrent. Check the source file or magnet link.');
      });

      if (!torrentFile && addPublicTrackers) {
        setMessage('Connecting to the WebRTC trackers. Tracker discovery can take a short while; zero compatible peers may mean this swarm cannot connect to browsers.');
      } else {
        setMessage('Starting a direct browser-to-peer session.');
      }
      setPhase('connecting');
    } catch (startError) {
      if (attempt !== attemptRef.current) return;
      setPhase('error');
      setError(startError instanceof Error ? startError.message : 'Unable to start the P2P client.');
    }
  };

  const saveFile = async (fileIndex: number) => {
    const activeTorrent = torrentRef.current;
    if (!activeTorrent) return;
    const file = activeTorrent.files[fileIndex];
    if (!file) return;
    const picker = (window as SavePickerWindow).showSaveFilePicker;
    if (!picker) {
      setError('This browser does not support the file save picker. Use an up-to-date Chrome browser to save large files without loading them fully into memory.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSelectedFile(fileIndex);
      const handle = await picker({ suggestedName: file.name });
      const writable = await handle.createWritable();
      await file.stream().pipeTo(writable);
      setMessage('Saved ' + file.name + ' to the location you selected.');
    } catch (saveError) {
      if (saveError instanceof Error && saveError.name !== 'AbortError') {
        setError(saveError.message || 'Could not save this file.');
      }
    } finally {
      setSaving(false);
    }
  };

  const stop = () => {
    attemptRef.current += 1;
    const activeTorrent = torrentRef.current;
    torrentRef.current = null;
    if (activeTorrent) activeTorrent.destroy({ destroyStore: false });
    setTorrent(null);
    setPhase('idle');
    setProgress(0);
    setSpeed(0);
    setUploadSpeed(0);
    setPeers(0);
    setRemaining('—');
    setSwarmStatus('');
    setPrivateTorrent(false);
    setError('');
    setMessage('Session stopped. Locally stored pieces are retained for a later resume.');
  };

  const clearSource = () => {
    setTorrentFile(null);
    setMagnet('');
    setError('');
  };

  const percent = Math.min(100, Math.max(0, progress * 100));
  const active = phase === 'loading' || phase === 'connecting' || phase === 'downloading';
  const chosenFiles = torrent?.files ?? [];
  const totalSize = torrent?.length ?? 0;
  const phaseLabel = phase === 'loading' ? 'LOADING ENGINE'
    : phase === 'connecting' ? 'FINDING THE SWARM'
    : phase === 'downloading' ? 'DOWNLOADING'
    : phase === 'complete' ? 'COMPLETE'
    : phase === 'error' ? 'ERROR' : 'IDLE';

  return <div className="app-shell" onPointerDown={(e) => {
    const el = e.target as HTMLElement;
    if (el.closest('button,.drop-zone,input,a,label')) return;
    const ripple = document.createElement('i');
    ripple.className = 'click-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 850);
  }}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="grid-overlay" />
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark"><Globe2 size={21} /></span><span>torrent<span className="brand-accent">wide</span><small>PEER TO PEER • YOUR DEVICE</small></span></a>
      <div className="top-status"><span className="live-dot" /><span>DECENTRALIZED NETWORK</span></div>
      <button className="icon-button" onClick={() => setShowInfo(!showInfo)} aria-label="About Torrentwide"><CircleHelp size={19} /></button>
    </header>

    <main className="main-content" id="top">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> PRIVATE BY DESIGN. PEER POWERED.</div>
        <h1>Download at the<br /><span>speed of the swarm.</span></h1>
        <p className="hero-copy">Your browser connects directly to other peers. Files move from the network to your device — no Torrentwide cloud storage, no remote download server.</p>
      </section>

      {showInfo && <div className="info-panel"><ShieldCheck size={18} /><div><strong>How Torrentwide works</strong><p>The P2P client runs locally in your browser. Your device downloads and may upload pieces to other peers while the session is active. Trackers and peers can see your IP address as part of normal P2P networking. Stop the session to disconnect.</p></div><button className="tiny-close" onClick={() => setShowInfo(false)} aria-label="Close information"><X size={16} /></button></div>}

      <section className="download-card">
        <div className="card-heading"><div><span className="section-kicker">01 / ADD A TORRENT</span><h2>Bring your source</h2></div><span className="local-pill"><ShieldCheck size={13} /> LOCAL P2P</span></div>
        <div className={'drop-zone ' + (dragging ? 'is-dragging' : '')}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.torrent')) {
              setError('Only .torrent files are accepted here.');
              return;
            }
            setTorrentFile(file);
            setMagnet('');
            setError('');
          }}>
          <input id="torrent-file" type="file" accept=".torrent,application/x-bittorrent" hidden onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && !file.name.toLowerCase().endsWith('.torrent')) {
              setError('Only .torrent files are accepted here.');
              e.currentTarget.value = '';
              return;
            }
            setTorrentFile(file);
            setMagnet('');
            setError('');
          }} />
          <label htmlFor="torrent-file" className="drop-content"><span className="upload-icon"><FileUp size={23} /></span><strong>{torrentFile ? torrentFile.name : 'Drop a .torrent file here'}</strong><span>{torrentFile ? formatBytes(torrentFile.size) : 'or tap to browse your device'}</span></label>
          {(torrentFile || magnet) && <button className="source-clear" onClick={clearSource}><X size={13} /> Clear source</button>}
          <span className="drop-or">OR</span>
          <div className="magnet-field"><Magnet size={18} /><input value={magnet} onChange={(e) => { setMagnet(e.target.value); if (e.target.value) setTorrentFile(null); setError(''); }} placeholder="Paste magnet link (magnet:?xt=…)" aria-label="Magnet link" /></div>
        </div>
        {!torrentFile && <label className="privacy-option"><input type="checkbox" checked={addPublicTrackers} onChange={(e) => setAddPublicTrackers(e.target.checked)} /><span><strong>Add public WebRTC trackers for magnet links</strong><small>Keep enabled for public torrents. Turn off for private torrents; public trackers can see your IP and info hash.</small></span></label>}
        {torrentFile && <div className="privacy-option privacy-auto"><ShieldCheck size={17} /><span><strong>Private-torrent protection</strong><small>Torrentwide checks the .torrent private flag and will not add public trackers to a private torrent.</small></span></div>}
        <button className="primary-button" onClick={start} disabled={active || phase === 'complete'}><Radio size={18} />{phase === 'loading' ? 'Loading P2P engine…' : active ? 'Connecting to peers…' : phase === 'complete' ? 'Download complete' : 'Connect & download'}<span>↗</span></button>
        {error && <div className="error-line"><X size={15} />{error}</div>}
        {message && <div className="message-line">{message}</div>}
        <div className="microcopy"><LockIcon /> No account. No upload to a cloud server. HTTPS required for WebRTC.</div>
      </section>

      {(torrent || active || phase === 'error') && <section className="transfer-card">
        <div className="transfer-top"><div><span className="section-kicker">02 / LIVE TRANSFER</span><h2>{torrent?.name || (phase === 'loading' ? 'Loading the browser engine…' : 'Finding the swarm…')}</h2><span className="hash-label">{torrent?.infoHash || phaseLabel}</span></div><span className={'phase-pill ' + phase}>{phase === 'complete' ? <Check size={13} /> : phase === 'loading' ? <LoaderCircle size={13} /> : phase === 'error' ? <AlertTriangle size={13} /> : <span className="live-dot" />}{phaseLabel}</span></div>
        <div className="progress-meta"><strong>{percent.toFixed(1)}%</strong><span>{formatBytes(torrent?.downloaded || 0)} <i>/</i> {formatBytes(totalSize)}</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: percent + '%' }} /></div>
        <div className="stats-grid">
          <div className="stat"><Download size={16} /><span>DOWNLOAD</span><strong>{formatBytes(speed)}/s</strong></div>
          <div className="stat"><Upload size={16} /><span>UPLOAD</span><strong>{formatBytes(uploadSpeed)}/s</strong></div>
          <div className="stat"><Wifi size={16} /><span>WEBRTC PEERS</span><strong>{peers}</strong></div>
          <div className="stat"><Gauge size={16} /><span>TIME LEFT</span><strong>{remaining}</strong></div>
        </div>
        {swarmStatus && <div className="swarm-status"><Activity size={15} /><span>{swarmStatus}</span></div>}
        {privateTorrent && <div className="privacy-confirm"><ShieldCheck size={15} /> Private torrent detected — public WebRTC trackers are not added.</div>}
        {chosenFiles.length > 0 && <div className="file-list"><div className="file-list-title">FILES IN THIS TORRENT <span>{chosenFiles.length} ITEMS</span></div>{chosenFiles.map((file, i) => <div className="file-row" key={file.path + ':' + i}><FileArchive size={17} /><div className="file-meta"><strong>{file.name}</strong><span>{formatBytes(file.length)} · {Math.round(file.progress * 100)}%</span></div><button className="save-button" disabled={file.progress < 1 || saving} onClick={() => saveFile(i)}><ArrowDownToLine size={15} />{saving && selectedFile === i ? 'Saving' : 'Save'}</button></div>)}</div>}
        <div className="transfer-actions">{phase === 'complete' ? <button className="secondary-button" onClick={() => setMessage('Files are complete. Use Save beside each file to write it to your device.')}><Check size={16} /> Files ready</button> : <span className="seeding-note"><Activity size={14} /> P2P session active · uploads may occur</span>}<button className="stop-button" onClick={stop}><Trash2 size={15} /> Stop session</button></div>
      </section>}

      <section className="how-section"><div className="section-kicker">BUILT FOR YOUR DEVICE</div><div className="feature-grid"><div className="feature"><span><Magnet size={18} /></span><strong>Magnet + .torrent</strong><p>Start from a magnet URI or a local torrent file.</p></div><div className="feature"><span><Radio size={18} /></span><strong>Direct P2P</strong><p>Browser-to-peer WebRTC connections. No cloud relay.</p></div><div className="feature"><span><ArrowDownToLine size={18} /></span><strong>Save locally</strong><p>Choose where completed files are saved on your device.</p></div></div></section>

      <div className="compat-note"><CloudOff size={16} /><p><strong>Know the browser limitation.</strong> WebTorrent in browsers connects only to WebRTC-capable peers. Many traditional TCP/UDP-only torrent peers are unreachable from a browser, so some swarms will show zero peers. A healthy desktop/mobile BitTorrent swarm is not automatically a healthy browser swarm. Use content you have the right to download and share.</p></div>
    </main>
    <footer className="footer"><span>TORRENTWIDE <i>·</i> BROWSER P2P</span><span>NO CLOUD DOWNLOAD SERVER <i>·</i> WEBRTC</span></footer>
  </div>;
}

function LockIcon() {
  return <ShieldCheck size={13} />;
}
