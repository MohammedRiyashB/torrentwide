import fs from 'node:fs';
import path from 'node:path';
import { TorrentItem, PerformanceSettings, DownloadToken, AuditLogItem, HistoryItem } from '../src/lib/types';

interface DatabaseSchema {
  torrents: TorrentItem[];
  tokens: DownloadToken[];
  history: HistoryItem[];
  auditLogs: AuditLogItem[];
  settings: PerformanceSettings;
}

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const DB_FILE_PATH = path.join(STORAGE_ROOT, 'db.json');

const DEFAULT_SETTINGS: PerformanceSettings = {
  profile: 'balanced',
  maxActiveDownloads: 5,
  maxGlobalConnections: 200,
  maxConnectionsPerTorrent: 50,
  downloadSpeedLimit: 0, // 0 = unlimited
  uploadSpeedLimit: 1048576, // 1 MB/s
  diskCacheSizeMB: 16,
  connectionTimeoutSec: 30,
  peerTimeoutSec: 60,
  seedingRatioLimit: 1.5,
  enableDht: true,
  enablePex: true,
  enableLsd: true,
  downloadDir: path.join(STORAGE_ROOT, 'incomplete'),
  completedDir: path.join(STORAGE_ROOT, 'completed'),
  tempDir: path.join(STORAGE_ROOT, 'temp'),
};

export class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDirectories();
    this.data = this.load();
  }

  private ensureDirectories() {
    if (!fs.existsSync(STORAGE_ROOT)) {
      fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
    const dirs = [
      path.join(STORAGE_ROOT, 'incomplete'),
      path.join(STORAGE_ROOT, 'completed'),
      path.join(STORAGE_ROOT, 'temp'),
      path.join(STORAGE_ROOT, 'tokens'),
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          torrents: Array.isArray(parsed.torrents) ? parsed.torrents : [],
          tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
          history: Array.isArray(parsed.history) ? parsed.history : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      }
    } catch (err) {
      console.error('Failed to parse db.json, initializing fresh state:', err);
    }

    const initial: DatabaseSchema = {
      torrents: [],
      tokens: [],
      history: [],
      auditLogs: [],
      settings: DEFAULT_SETTINGS,
    };
    this.saveImmediate(initial);
    return initial;
  }

  private saveImmediate(dataToSave: DatabaseSchema) {
    try {
      const tempPath = `${DB_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_FILE_PATH);
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  public save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate(this.data);
      this.saveTimeout = null;
    }, 250);
  }

  // Torrents
  public getTorrents(): TorrentItem[] {
    return this.data.torrents;
  }

  public getTorrent(id: string): TorrentItem | undefined {
    return this.data.torrents.find(t => t.id === id || t.infoHash.toLowerCase() === id.toLowerCase());
  }

  public addTorrent(torrent: TorrentItem): void {
    this.data.torrents.unshift(torrent);
    this.save();
    this.logAudit('torrent_added', `Added torrent "${torrent.name}" (${torrent.infoHash.slice(0, 10)})`, 'info');
  }

  public updateTorrent(id: string, updates: Partial<TorrentItem>): TorrentItem | undefined {
    const idx = this.data.torrents.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.data.torrents[idx] = { ...this.data.torrents[idx], ...updates };
      this.save();
      return this.data.torrents[idx];
    }
    return undefined;
  }

  public removeTorrent(id: string): TorrentItem | undefined {
    const idx = this.data.torrents.findIndex(t => t.id === id);
    if (idx !== -1) {
      const removed = this.data.torrents.splice(idx, 1)[0];
      this.save();
      this.logAudit('torrent_removed', `Removed torrent "${removed.name}"`, 'warning');
      return removed;
    }
    return undefined;
  }

  // Tokens
  public getTokens(): DownloadToken[] {
    return this.data.tokens;
  }

  public getToken(tokenStr: string): DownloadToken | undefined {
    return this.data.tokens.find(t => t.token === tokenStr);
  }

  public addToken(token: DownloadToken): void {
    this.data.tokens.unshift(token);
    this.save();
    this.logAudit('token_issued', `Issued mobile download token for "${token.fileName}"`, 'info');
  }

  public updateToken(tokenStr: string, updates: Partial<DownloadToken>): void {
    const idx = this.data.tokens.findIndex(t => t.token === tokenStr);
    if (idx !== -1) {
      this.data.tokens[idx] = { ...this.data.tokens[idx], ...updates };
      this.save();
    }
  }

  public revokeToken(tokenStr: string): boolean {
    const token = this.getToken(tokenStr);
    if (token) {
      token.revoked = true;
      this.save();
      this.logAudit('token_revoked', `Revoked token for "${token.fileName}"`, 'warning');
      return true;
    }
    return false;
  }

  // Settings
  public getSettings(): PerformanceSettings {
    return this.data.settings;
  }

  public updateSettings(newSettings: Partial<PerformanceSettings>): PerformanceSettings {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    this.logAudit('settings_updated', `Performance profile set to ${this.data.settings.profile}`, 'info');
    return this.data.settings;
  }

  // History
  public getHistory(): HistoryItem[] {
    return this.data.history;
  }

  public addHistory(item: HistoryItem): void {
    this.data.history.unshift(item);
    if (this.data.history.length > 500) {
      this.data.history = this.data.history.slice(0, 500);
    }
    this.save();
  }

  // Audit Logs
  public getAuditLogs(): AuditLogItem[] {
    return this.data.auditLogs;
  }

  public logAudit(action: string, details: string, severity: AuditLogItem['severity'] = 'info', ip = '127.0.0.1') {
    const log: AuditLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      action,
      details,
      ip,
      severity,
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 300) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 300);
    }
    this.save();
  }
}

export const db = new Database();
