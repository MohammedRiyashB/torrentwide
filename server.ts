import express, { Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './server/db';
import { torrentEngine } from './server/torrentEngine';
import { getSystemStats } from './server/systemMonitor';
import { tokenManager } from './server/tokenManager';
import { streamFileDownload, handleTokenDownload } from './server/httpDownloadServer';
import { listStorageFiles, calculateFileSha256, deleteStorageFile, renameStorageFile, createZipArchive } from './server/fileManager';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer in-memory storage for .torrent uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max torrent file
});

// Seed sample completed & active torrents if database is brand new so the user gets immediate value
const existingTorrents = db.getTorrents();
if (existingTorrents.length === 0) {
  // Add a sample completed distribution ready for instant Phone Download test
  const storageRoot = path.resolve(process.cwd(), 'storage');
  const compDir = path.join(storageRoot, 'completed', 'Ubuntu-24.04-Server-LTS');
  if (!fs.existsSync(compDir)) {
    fs.mkdirSync(compDir, { recursive: true });
  }
  const isoFile = path.join(compDir, 'ubuntu-24.04-live-server-amd64.iso');
  if (!fs.existsSync(isoFile)) {
    const dummyPayload = Buffer.alloc(1024 * 512); // 512KB sample payload
    dummyPayload.write('ULTRA_DOWNLOAD_HUB_AUTHORIZED_DISTRIBUTION::Ubuntu 24.04 LTS Live Server AMD64\n');
    for (let i = 80; i < dummyPayload.length; i += 4) {
      dummyPayload.writeUInt32BE(0x55425530 + (i % 256), i);
    }
    fs.writeFileSync(isoFile, dummyPayload);
  }

  db.addTorrent({
    id: 'tor_ubuntu_preset',
    name: 'Ubuntu 24.04 Server LTS',
    infoHash: 'd6b63d6f7c320297058df8a71997d8b5c9efdb08',
    totalSize: 2147483648, // 2.0 GB
    downloadedSize: 2147483648,
    uploadedSize: 524288000,
    progress: 100,
    downloadSpeed: 0,
    uploadSpeed: 125000,
    eta: 0,
    status: 'completed',
    pieceCount: 8192,
    pieceLength: 262144,
    piecesDownloaded: 8192,
    connectedPeers: 42,
    seeders: 38,
    leechers: 4,
    trackers: [
      'https://torrent.ubuntu.com/announce',
      'udp://tracker.opentrackr.org:1337/announce',
    ],
    files: [
      {
        id: 'f_0',
        name: 'ubuntu-24.04-live-server-amd64.iso',
        path: 'ubuntu-24.04-live-server-amd64.iso',
        size: 2147483648,
        progress: 100,
        selected: true,
        priority: 'high',
      },
    ],
    addedAt: Date.now() - 3600000,
    completedAt: Date.now() - 1800000,
    savePath: compDir,
    isSequential: true,
    ratio: 0.24,
    source: 'preset',
  });
}

// ---------------- REST API ROUTES ----------------

// System Stats
app.get('/api/system/stats', (req: Request, res: Response) => {
  res.json(getSystemStats());
});

// List Torrents
app.get('/api/torrents', (req: Request, res: Response) => {
  const statusFilter = req.query.status as string;
  let torrents = db.getTorrents();
  if (statusFilter && statusFilter !== 'all') {
    torrents = torrents.filter(t => t.status === statusFilter);
  }
  res.json(torrents);
});

// Single Torrent Detail
app.get('/api/torrents/:id', (req: Request, res: Response) => {
  const torrent = db.getTorrent(req.params.id);
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  res.json(torrent);
});

// Add Torrent via File Upload
app.post('/api/torrents/upload', upload.single('torrentFile'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No .torrent file provided in form-data (key: torrentFile)' });
    }

    const isSequential = req.body.isSequential === 'true' || req.body.isSequential === true;
    const torrent = await torrentEngine.addTorrent({
      source: 'file',
      torrentBuffer: req.file.buffer,
      isSequential,
    });

    res.status(201).json(torrent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// Add Torrent via Magnet URI
app.post('/api/torrents/magnet', async (req: Request, res: Response) => {
  try {
    const { magnetUri, name, isSequential } = req.body;
    if (!magnetUri) {
      return res.status(400).json({ error: 'Missing magnetUri parameter' });
    }

    const torrent = await torrentEngine.addTorrent({
      source: 'magnet',
      magnetUri,
      name,
      isSequential: Boolean(isSequential),
    });

    res.status(201).json(torrent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// Add Torrent from Authorized Presets (Ubuntu, Debian, Alpine, Sintel)
app.post('/api/torrents/preset', async (req: Request, res: Response) => {
  try {
    const { presetId } = req.body;
    const presets: Record<string, { name: string; magnet: string; size: number }> = {
      debian: {
        name: 'Debian 12 Bookworm Minimal Netinst',
        magnet: 'magnet:?xt=urn:btih:3fa8115664ba08a28f80459c3ad868a2bf68903c&dn=Debian+12+Netinst&tr=https%3A%2F%2Fcdimage.debian.org%2Ftracker&xl=650117120',
        size: 650117120,
      },
      alpine: {
        name: 'Alpine Linux 3.20 Standard x86_64',
        magnet: 'magnet:?xt=urn:btih:5a9325986872a91e1d087796d112d7c585c57b7f&dn=Alpine+Linux+Standard&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&xl=215000000',
        size: 215000000,
      },
      sintel: {
        name: 'Blender Foundation Sintel 4K Cinema Open Movie',
        magnet: 'magnet:?xt=urn:btih:08a80224f379edd29397d5f9ce343b45ae98387b&dn=Sintel+4K&tr=udp%3A%2F%2Fexplodie.org%3A6969%2Fannounce&xl=1450000000',
        size: 1450000000,
      },
      ubuntu: {
        name: 'Ubuntu 24.04 Desktop AMD64',
        magnet: 'magnet:?xt=urn:btih:e5832a8931e2d93e10d8a87265a88c52d8e4f5a3&dn=Ubuntu+24.04+Desktop&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce&xl=5120000000',
        size: 5120000000,
      },
    };

    const target = presets[presetId];
    if (!target) {
      return res.status(400).json({ error: `Unknown preset "${presetId}". Available: debian, alpine, sintel, ubuntu` });
    }

    const torrent = await torrentEngine.addTorrent({
      source: 'magnet',
      magnetUri: target.magnet,
      name: target.name,
      isSequential: true,
    });

    res.status(201).json(torrent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// Torrent Control actions
app.post('/api/torrents/:id/start', (req: Request, res: Response) => {
  try {
    const updated = torrentEngine.resumeTorrent(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/torrents/:id/pause', (req: Request, res: Response) => {
  try {
    const updated = torrentEngine.pauseTorrent(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/torrents/:id/resume', (req: Request, res: Response) => {
  try {
    const updated = torrentEngine.resumeTorrent(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/torrents/:id/recheck', (req: Request, res: Response) => {
  try {
    const updated = torrentEngine.recheckTorrent(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/torrents/:id/reannounce', (req: Request, res: Response) => {
  try {
    const updated = torrentEngine.reannounceTorrent(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete('/api/torrents/:id', (req: Request, res: Response) => {
  try {
    const deleteFiles = req.query.deleteFiles === 'true';
    torrentEngine.deleteTorrent(req.params.id, deleteFiles);
    res.json({ success: true, message: 'Torrent deleted' });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Select files
app.post('/api/torrents/:id/select-files', (req: Request, res: Response) => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds)) {
      return res.status(400).json({ error: 'fileIds must be an array of string IDs' });
    }
    const updated = torrentEngine.selectFiles(req.params.id, fileIds);
    res.json(updated);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Storage & Files
app.get('/api/files', (req: Request, res: Response) => {
  const files = listStorageFiles();
  res.json(files);
});

// Calculate genuine SHA-256
app.post('/api/files/:id/sha256', async (req: Request, res: Response) => {
  try {
    const files = listStorageFiles();
    const file = files.find(f => f.id === req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    const hash = await calculateFileSha256(file.absolutePath);
    res.json({ id: file.id, name: file.name, sha256: hash });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Rename file
app.put('/api/files/:id/rename', (req: Request, res: Response) => {
  try {
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'Missing newName' });
    const renamed = renameStorageFile(req.params.id, newName);
    res.json(renamed);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Delete file
app.delete('/api/files/:id', (req: Request, res: Response) => {
  try {
    deleteStorageFile(req.params.id);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Create ZIP archive
app.post('/api/files/:id/zip', async (req: Request, res: Response) => {
  try {
    const files = listStorageFiles();
    const file = files.find(f => f.id === req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'Target file not found' });
    }
    const archivePath = await createZipArchive(file.absolutePath, `${file.name}.zip`);
    res.json({ success: true, archivePath });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Generate Temporary Mobile Download Token
app.post('/api/files/:id/token', (req: Request, res: Response) => {
  try {
    const files = listStorageFiles();
    const file = files.find(f => f.id === req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { durationMinutes, singleUse } = req.body;
    const token = tokenManager.createToken({
      filePath: file.absolutePath,
      fileName: file.name,
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 60,
      singleUse: Boolean(singleUse),
    });

    res.json(token);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Direct Download by Token (Android Chrome Target Endpoint with HTTP 206 Range)
app.get('/api/download/:token', handleTokenDownload);

// Direct File Download by ID
app.get('/api/files/:id/download', (req: Request, res: Response) => {
  const files = listStorageFiles();
  const file = files.find(f => f.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  streamFileDownload(req, res, file.absolutePath, file.name);
});

// Tokens management
app.get('/api/tokens', (req: Request, res: Response) => {
  res.json(db.getTokens());
});

app.post('/api/tokens/:token/revoke', (req: Request, res: Response) => {
  const success = db.revokeToken(req.params.token);
  res.json({ success });
});

// Settings
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// History & Audit Logs
app.get('/api/history', (req: Request, res: Response) => {
  res.json(db.getHistory());
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});

// Server-Sent Events (SSE) for Real-Time Telemetry Feed
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendPayload = () => {
    const payload = {
      system: getSystemStats(),
      torrents: db.getTorrents(),
      timestamp: Date.now(),
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  sendPayload();
  const interval = setInterval(sendPayload, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// WebSocket Server for High-Frequency Dashboard Updates
const wss = new WebSocketServer({ server, path: '/ws/dashboard' });

wss.on('connection', (ws: WebSocket) => {
  const sendUpdate = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'TELEMETRY_UPDATE',
        system: getSystemStats(),
        torrents: db.getTorrents(),
        timestamp: Date.now(),
      }));
    }
  };

  sendUpdate();
  const wsInterval = setInterval(sendUpdate, 1000);

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    clearInterval(wsInterval);
  });
});

// Vite Integration: Mount Vite dev server middlewares in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production serve dist
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ultra Download Hub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Ultra Download Hub server:', err);
});
