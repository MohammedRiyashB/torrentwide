export interface TorrentFileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  progress: number;
  selected: boolean;
  priority: 'low' | 'normal' | 'high';
}

export type TorrentStatus = 
  | 'queued'
  | 'metadata_fetching'
  | 'downloading'
  | 'verifying'
  | 'paused'
  | 'completed'
  | 'seeding'
  | 'error';

export interface TorrentItem {
  id: string;
  name: string;
  infoHash: string;
  totalSize: number;
  downloadedSize: number;
  uploadedSize: number;
  progress: number; // 0 to 100
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  eta: number; // seconds
  status: TorrentStatus;
  errorMessage?: string;
  pieceCount: number;
  pieceLength: number;
  piecesDownloaded: number;
  piecesBitfield?: string; // hex or compact representation
  connectedPeers: number;
  seeders: number;
  leechers: number;
  trackers: string[];
  files: TorrentFileItem[];
  addedAt: number;
  completedAt?: number;
  savePath: string;
  isSequential: boolean;
  ratio: number;
  source: 'file' | 'magnet' | 'preset';
}

export type PerformanceProfileType = 'eco' | 'balanced' | 'max_performance';

export interface PerformanceSettings {
  profile: PerformanceProfileType;
  maxActiveDownloads: number;
  maxGlobalConnections: number;
  maxConnectionsPerTorrent: number;
  downloadSpeedLimit: number; // 0 for unlimited, in bytes/sec
  uploadSpeedLimit: number; // 0 for unlimited, in bytes/sec
  diskCacheSizeMB: number;
  connectionTimeoutSec: number;
  peerTimeoutSec: number;
  seedingRatioLimit: number;
  enableDht: boolean;
  enablePex: boolean;
  enableLsd: boolean;
  downloadDir: string;
  completedDir: string;
  tempDir: string;
}

export interface SystemStats {
  cpuUsagePercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  memoryUsagePercent: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskUsagePercent: number;
  globalDownloadSpeed: number;
  globalUploadSpeed: number;
  totalDownloadedBytes: number;
  totalUploadedBytes: number;
  activeCount: number;
  completedCount: number;
  pausedCount: number;
  errorCount: number;
  totalTorrents: number;
  uptimeSeconds: number;
  engineMode: 'integrated_node' | 'qbittorrent_vps';
}

export interface StorageFile {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  mimeType: string;
  modifiedAt: number;
  sha256?: string;
  torrentId?: string;
  torrentFileIndex?: number;
  torrentName?: string;
  isDirectory: boolean;
  extension: string;
}

export interface DownloadToken {
  token: string;
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  createdAt: number;
  expiresAt: number;
  ipRestriction?: string;
  singleUse: boolean;
  usedCount: number;
  maxUses: number;
  revoked: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  ip: string;
  severity: 'info' | 'warning' | 'security' | 'error';
}

export interface HistoryItem {
  id: string;
  torrentId: string;
  name: string;
  totalSize: number;
  downloadDurationSeconds: number;
  averageSpeed: number;
  completedAt: number;
  infoHash: string;
}
