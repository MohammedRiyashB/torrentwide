import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  HardDrive,
  Cpu,
  Layers,
  Smartphone,
  Play,
  Pause,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Users
} from 'lucide-react';
import { SystemStats, TorrentItem, StorageFile } from '../lib/types';
import { formatBytes, formatSpeed, formatEta } from '../lib/formatters';

interface DashboardViewProps {
  stats: SystemStats | null;
  torrents: TorrentItem[];
  files: StorageFile[];
  onAddTorrentClick: () => void;
  onAddPreset: (presetId: string) => void;
  onPauseTorrent: (id: string) => void;
  onResumeTorrent: (id: string) => void;
  onDeleteTorrent: (id: string) => void;
  onDownloadToPhone: (file: StorageFile) => void;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  torrents,
  files,
  onAddTorrentClick,
  onAddPreset,
  onPauseTorrent,
  onResumeTorrent,
  onDeleteTorrent,
  onDownloadToPhone,
  onNavigateToTab,
}) => {
  const activeTorrents = torrents.filter(t => t.status === 'downloading' || t.status === 'queued' || t.status === 'metadata_fetching');
  const completedTorrents = torrents.filter(t => t.status === 'completed' || t.status === 'seeding');

  return (
    <div className="space-y-6">
      {/* Executive Metrics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Download Throughput */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 lg:p-5 relative overflow-hidden shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Download Speed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </div>
          </div>
          <div className="font-mono text-xl lg:text-3xl font-extrabold text-white tracking-tight">
            {formatSpeed(stats?.globalDownloadSpeed || 0)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{stats?.activeCount || 0} active</span>
            <span>• Total {formatBytes(stats?.totalDownloadedBytes || 0)}</span>
          </div>
        </div>

        {/* Upload Throughput */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 lg:p-5 relative overflow-hidden shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Speed</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ArrowUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl lg:text-3xl font-extrabold text-white tracking-tight">
            {formatSpeed(stats?.globalUploadSpeed || 0)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <span className="text-indigo-400 font-semibold">{stats?.completedCount || 0} seeding</span>
            <span>• Total {formatBytes(stats?.totalUploadedBytes || 0)}</span>
          </div>
        </div>

        {/* Cloud NVMe Storage */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 lg:p-5 relative overflow-hidden shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cloud Storage</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl lg:text-3xl font-extrabold text-white tracking-tight">
            {formatBytes(stats?.diskUsedBytes || 0)}
          </div>
          <div className="mt-2.5">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, stats?.diskUsagePercent || 2)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>{formatBytes(stats?.diskFreeBytes || 0)} free</span>
              <span>{stats?.diskUsagePercent || 1}% of 500GB</span>
            </div>
          </div>
        </div>

        {/* Engine Host Metrics */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 lg:p-5 relative overflow-hidden shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Load</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 font-mono text-xl lg:text-3xl font-extrabold text-white tracking-tight">
            <span>{stats?.cpuUsagePercent || 4}%</span>
            <span className="text-xs font-normal text-slate-400 font-sans">CPU</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <span>RAM: <strong className="text-slate-200">{formatBytes(stats?.memoryUsedBytes || 0)}</strong></span>
            <span>• {stats?.memoryUsagePercent || 12}%</span>
          </div>
        </div>
      </div>

      {/* 1-Click Authorized Legal Torrent Presets */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              1-Click Instant P2P Download Presets
            </h3>
            <p className="text-xs text-slate-400">
              Authorized open-source Linux distributions & creative commons test payloads ready to run immediately
            </p>
          </div>
          <button
            onClick={onAddTorrentClick}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all self-stretch sm:self-auto justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Custom Torrent</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 'ubuntu', name: 'Ubuntu 24.04 Desktop', size: '5.1 GB', tag: 'Linux OS' },
            { id: 'debian', name: 'Debian 12 Netinst', size: '650 MB', tag: 'Minimal OS' },
            { id: 'alpine', name: 'Alpine Linux 3.20', size: '215 MB', tag: 'Super Fast' },
            { id: 'sintel', name: 'Blender Sintel 4K', size: '1.45 GB', tag: 'Creative Commons' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => onAddPreset(p.id)}
              className="group text-left bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3.5 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {p.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                  {p.tag}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                <span className="font-mono text-emerald-400 font-semibold">{p.size}</span>
                <span className="text-[11px] text-cyan-400 font-medium group-hover:translate-x-0.5 transition-transform">
                  Download Now &rarr;
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Downloads List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>Active Cloud Downloads</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {activeTorrents.length}
            </span>
          </h3>
          {activeTorrents.length > 0 && (
            <button
              onClick={() => onNavigateToTab('active')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              View Full Details &rarr;
            </button>
          )}
        </div>

        {activeTorrents.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
            <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm font-bold text-slate-300">No Active Downloads in Queue</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload a .torrent file, paste a magnet link, or launch one of the 1-click presets above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTorrents.map(torrent => (
              <div
                key={torrent.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 lg:p-5 shadow-lg shadow-black/10"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {torrent.status}
                      </span>
                      <span className="font-bold text-sm lg:text-base text-white truncate">
                        {torrent.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400">
                      <span>Size: <strong className="text-slate-200">{formatBytes(torrent.totalSize)}</strong></span>
                      <span>Downloaded: <strong className="text-emerald-400">{formatBytes(torrent.downloadedSize)}</strong></span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Peers: {torrent.connectedPeers} ({torrent.seeders} seeds)</span>
                      </span>
                    </div>
                  </div>

                  {/* Quick Controls */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {torrent.status === 'downloading' ? (
                      <button
                        onClick={() => onPauseTorrent(torrent.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                        title="Pause Download"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onResumeTorrent(torrent.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700"
                        title="Resume Download"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteTorrent(torrent.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700"
                      title="Cancel & Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">{torrent.progress}%</span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-semibold">{formatSpeed(torrent.downloadSpeed)}</span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        ETA: {formatEta(torrent.eta)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(1, torrent.progress)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Downloads & Direct Phone Transfer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>Completed Cloud Files</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {files.length}
            </span>
          </h3>
          {files.length > 0 && (
            <button
              onClick={() => onNavigateToTab('completed')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              View All Files &rarr;
            </button>
          )}
        </div>

        {files.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
            No completed files stored yet. Once a download finishes, it will appear here ready for direct mobile delivery.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.slice(0, 4).map(file => (
              <div
                key={file.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-bold text-sm text-white truncate" title={file.name}>
                      {file.name}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Size: <strong className="text-slate-200">{formatBytes(file.size)}</strong> • {file.mimeType}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Ready for Android Chrome
                  </span>
                  <button
                    onClick={() => onDownloadToPhone(file)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>DOWNLOAD TO PHONE</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
