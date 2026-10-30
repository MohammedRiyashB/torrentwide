import { useEffect, useRef, useState } from 'react'
import WebTorrent from 'webtorrent'
import {
  Activity, ArrowDownToLine, Check, ChevronDown, CircleHelp, CloudOff,
  Download, File, FileUp, Gauge, HardDrive, Link2, Magnet, Pause, Play,
  Radio, RefreshCw, ShieldCheck, Sparkles, Trash2, Upload, Wifi, X,
  Zap, Copy, ExternalLink
} from 'lucide-react'

type TorrentFile = { name: string; length: number; createReadStream: () => any }
type TorrentLike = {
  name?: string; infoHash: string; progress: number; downloadSpeed: number;
  uploadSpeed: number; timeRemaining: number; numPeers: number; downloaded: number;
  length: number; files: TorrentFile[]; done: boolean;
  on: (event: string, cb: (...args: any[]) => void) => void;
}
type Row = { id: string; name: string; progress: number; down: number; up: number; peers: number; remaining: number; downloaded: number; total: number; status: string; torrent: TorrentLike }

const formatBytes = (n = 0) => {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4)
  return (n / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 1) + ' ' + units[i]
}
const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 31536000) return '—'
  if (seconds < 60) return Math.ceil(seconds) + 's'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.ceil(seconds % 60) + 's'
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm'
}
const shortHash = (hash: string) => hash ? hash.slice(0, 8).toUpperCase() + '…' + hash.slice(-6).toUpperCase() : '—'

export default function App() {
  const clientRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [magnet, setMagnet] = useState('')
  const [dragging, setDragging] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [activeId, setActiveId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('Ready for a peer-to-peer connection')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!clientRef.current && (WebTorrent as any).WEBRTC_SUPPORT) clientRef.current = new (WebTorrent as any)()
    return () => { clientRef.current?.destroy?.(() => {}) }
  }, [])

  const updateTorrent = (torrent: TorrentLike, status?: string) => {
    const row: Row = {
      id: torrent.infoHash, name: torrent.name || 'Fetching torrent metadata…',
      progress: torrent.progress || 0, down: torrent.downloadSpeed || 0, up: torrent.uploadSpeed || 0,
      peers: torrent.numPeers || 0, remaining: torrent.timeRemaining, downloaded: torrent.downloaded || 0,
      total: torrent.length || 0, status: status || (torrent.done ? 'Completed' : 'Downloading'), torrent
    }
    setRows(old => old.some(x => x.id === row.id) ? old.map(x => x.id === row.id ? row : x) : [row, ...old])
    setActiveId(row.id)
  }

  const addTorrent = async (source: string | Uint8Array) => {
    setError('')
    if (!(WebTorrent as any).WEBRTC_SUPPORT) {
      setError('WebRTC is not available in this browser. Open Torrentwide in an up-to-date Chrome browser over HTTPS.')
      return
    }
    if (!clientRef.current) clientRef.current = new (WebTorrent as any)()
    setBusy(true); setNotice('Connecting to WebRTC peers…')
    try {
      const torrent = await new Promise<TorrentLike>((resolve, reject) => {
        clientRef.current.add(source, (t: TorrentLike) => resolve(t), (err: Error) => reject(err))
      })
      updateTorrent(torrent, 'Finding peers')
      torrent.on('wire', () => updateTorrent(torrent, 'Connected'))
      torrent.on('download', () => updateTorrent(torrent))
      torrent.on('upload', () => updateTorrent(torrent))
      torrent.on('done', () => { updateTorrent(torrent, 'Completed'); setNotice('Torrent data is ready to save on this device.') })
      torrent.on('error', (err: Error) => setError(err.message || 'Torrent error'))
      setNotice('Torrent added. Waiting for WebRTC peers and pieces.')
      setMagnet('')
    } catch (e: any) {
      setError(e?.message || 'Could not add this torrent. Check the magnet link or torrent file.')
      setNotice('Connection could not be started')
    } finally { setBusy(false) }
  }

  const onTorrentFile = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.torrent')) { setError('Please choose a .torrent file.'); return }
    try { await addTorrent(new Uint8Array(await file.arrayBuffer())) }
    catch (e: any) { setError(e?.message || 'Could not read torrent file.') }
  }

  const saveFile = async (row: Row, file: TorrentFile) => {
    setError('')
    try {
      const picker = (window as any).showSaveFilePicker
      if (!picker) throw new Error('This browser does not support direct file saving. Use the latest Chrome on Android or desktop over HTTPS.')
      const handle = await picker({ suggestedName: file.name, create: true })
      const writable = await handle.createWritable()
      const reader = file.createReadStream()
      try {
        for await (const chunk of reader) await writable.write(chunk)
        await writable.close()
        setNotice('Saved ' + file.name + ' to your selected device folder.')
      } catch (e) {
        await writable.abort?.()
        throw e
      }
      updateTorrent(row.torrent, row.torrent.done ? 'Completed' : 'Seeding')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(e?.message || 'Could not save this file.')
    }
  }

  const removeTorrent = (row: Row) => {
    try { clientRef.current?.remove(row.id) } catch {}
    setRows(old => old.filter(x => x.id !== row.id))
    if (activeId === row.id) setActiveId('')
    setNotice('Torrent removed from this browser session.')
  }

  const pasteMagnet = async () => {
    try { setMagnet(await navigator.clipboard.readText()) }
    catch { setError('Clipboard access was blocked. Paste the magnet link into the field.') }
  }

  const active = rows.find(x => x.id === activeId) || rows[0]
  const peers = rows.reduce((n, r) => n + r.peers, 0)
  const totalDown = rows.reduce((n, r) => n + r.down, 0)
  const totalUp = rows.reduce((n, r) => n + r.up, 0)

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="grid-glow" />
      <header className="topbar">
        <a className="brand" href="#" aria-label="Torrentwide home">
          <span className="brand-mark"><Radio size={22} /></span>
          <span>torrent<span className="brand-accent">wide</span><small>THE WEB P2P CLIENT</small></span>
        </a>
        <div className="top-status"><span className="live-dot" /> BROWSER P2P <span className="status-divider" /> <span className="secure"><ShieldCheck size={14}/> LOCAL-FIRST</span></div>
        <a className="github-link" href="https://github.com/MohammedRiyashB/torrentwide" target="_blank" rel="noreferrer">GitHub <ExternalLink size={14}/></a>
      </header>

      <main className="main-wrap">
        <section className="hero">
          <div className="eyebrow"><Sparkles size={13}/> DIRECT PEER-TO-PEER TRANSFER</div>
          <h1>Files move.<br/><span>Servers don't.</span></h1>
          <p className="hero-copy">Download torrents directly in your browser. Your device connects to peers, receives the pieces, and saves files locally.</p>
          <div className="hero-chips"><span><CloudOff size={14}/> No cloud storage</span><span><Wifi size={14}/> WebRTC network</span><span><HardDrive size={14}/> Save to your device</span></div>
        </section>

        <section className="workspace">
          <div className="section-heading"><div><span className="section-kicker">01 / ADD A TORRENT</span><h2>Start a transfer</h2></div><span className="https-note"><ShieldCheck size={14}/> Secure browser session</span></div>
          <div className="dropzone" data-dragging={dragging}
            onDragOver={e => {e.preventDefault(); setDragging(true)}}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {e.preventDefault(); setDragging(false); void onTorrentFile(e.dataTransfer.files?.[0])}}
            onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".torrent,application/x-bittorrent" hidden onChange={e => {void onTorrentFile(e.target.files?.[0]); e.currentTarget.value = ''}} />
            <div className="drop-icon"><FileUp size={25}/></div>
            <strong>Drop your .torrent file here</strong>
            <span>or <button className="inline-action" type="button" onClick={e => {e.stopPropagation(); fileInputRef.current?.click()}}>browse files</button> from your device</span>
            <small>TORRENT METADATA STAYS IN YOUR BROWSER</small>
          </div>
          <div className="or-line"><span>OR USE A MAGNET LINK</span></div>
          <form className="magnet-form" onSubmit={e => {e.preventDefault(); if (magnet.trim().startsWith('magnet:?')) void addTorrent(magnet.trim()); else setError('Paste a valid magnet:? link to continue.')}}>
            <div className="magnet-input-wrap"><Magnet size={18}/><input aria-label="Magnet link" value={magnet} onChange={e => setMagnet(e.target.value)} placeholder="magnet:?xt=urn:btih:..." /><button type="button" className="paste-btn" onClick={pasteMagnet}><Copy size={15}/> Paste</button></div>
            <button className="connect-btn" disabled={busy || !magnet.trim()}>{busy ? <><RefreshCw className="spin" size={17}/> CONNECTING</> : <><Zap size={17}/> CONNECT TO PEERS</>}</button>
          </form>
          {error && <div className="error-banner"><CircleHelp size={16}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
          <p className="notice-line"><span className="notice-dot"/>{notice}</p>
        </section>

        <section className="metrics-grid">
          <div className="metric-card"><div className="metric-label"><Activity size={15}/> ACTIVE TORRENTS</div><strong>{rows.length.toString().padStart(2,'0')}</strong><small>In this browser session</small></div>
          <div className="metric-card"><div className="metric-label"><Wifi size={15}/> CONNECTED PEERS</div><strong>{peers.toString().padStart(2,'0')}</strong><small>WebRTC connections</small></div>
          <div className="metric-card"><div className="metric-label"><ArrowDownToLine size={15}/> DOWNLOAD SPEED</div><strong>{formatBytes(totalDown)}<em>/s</em></strong><small>Combined incoming data</small></div>
          <div className="metric-card"><div className="metric-label"><ArrowDownToLine className="upload-icon" size={15}/> UPLOAD SPEED</div><strong>{formatBytes(totalUp)}<em>/s</em></strong><small>Peer-to-peer sharing</small></div>
        </section>

        <section className="transfers">
          <div className="section-heading transfer-heading"><div><span className="section-kicker">02 / LIVE ACTIVITY</span><h2>Your transfers <span className="count-pill">{rows.length}</span></h2></div><span className="live-label"><span className="live-dot"/> LIVE</span></div>
          {!rows.length ? <div className="empty-state"><div className="empty-orbit"><Download size={25}/></div><strong>Nothing transferring yet</strong><span>Add a torrent above to discover peers and start receiving pieces.</span></div> :
            <div className="transfer-list">{rows.map(row => <article className={'transfer-card ' + (activeId === row.id ? 'selected' : '')} key={row.id} onClick={() => setActiveId(row.id)}>
              <div className="transfer-top"><div className="file-badge"><File size={19}/></div><div className="transfer-name"><strong>{row.name}</strong><small>{shortHash(row.id)} <span>•</span> {formatBytes(row.total)}</small></div><span className={'state-pill ' + (row.status === 'Completed' ? 'complete' : '')}>{row.status}</span><button className="icon-button remove-btn" title="Remove torrent" onClick={e => {e.stopPropagation(); removeTorrent(row)}}><Trash2 size={16}/></button></div>
              <div className="progress-track"><div className="progress-fill" style={{width: (row.progress * 100) + '%'}}/></div>
              <div className="transfer-stats"><strong>{(row.progress * 100).toFixed(1)}%</strong><span><ArrowDownToLine size={13}/> {formatBytes(row.down)}/s</span><span><Wifi size={13}/> {row.peers} peers</span><span><Gauge size={13}/> {formatTime(row.remaining)}</span></div>
              {activeId === row.id && row.torrent.files?.length > 0 && <div className="file-exports"><div className="files-heading">FILES IN THIS TORRENT <span>Save files directly to your device</span></div>{row.torrent.files.map((f, i) => <div className="export-row" key={i}><File size={15}/><span>{f.name}<small>{formatBytes(f.length)}</small></span><button className="save-btn" onClick={e => {e.stopPropagation(); void saveFile(row, f)}}><Download size={14}/> SAVE FILE</button></div>)}</div>}
            </article>)}</div>}
        </section>

        <section className="network-note"><div className="network-icon"><ShieldCheck size={19}/></div><div><strong>Your device is the download client</strong><p>Torrentwide does not receive or store your downloaded files. Data is exchanged directly between your browser and compatible peers. Downloads may also upload pieces to other peers while the torrent remains active.</p></div></section>
        <section className="compat-note"><div className="compat-title"><CircleHelp size={16}/> A quick note about browser P2P</div><p>Web browsers can connect only to WebRTC-capable BitTorrent peers—not the full TCP/UDP BitTorrent network. A magnet can have many seeders and still show zero compatible peers. Keep this tab open while downloading. Use only content you have the right to access.</p></section>
      </main>
      <footer className="footer"><span>TORRENTWIDE <b>•</b> BROWSER-NATIVE P2P</span><span>NO CLOUD SERVER · NO CLOUD STORAGE</span></footer>
    </div>
  )
}
