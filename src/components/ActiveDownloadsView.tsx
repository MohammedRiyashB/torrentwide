import React, { useState } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Radio,
  Trash2,
  FileText,
  Clock,
  ArrowDown,
  ArrowUp,
  Users,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { TorrentItem } from '../lib/types';
import { formatBytes, formatSpeed, formatEta } from '../lib/formatters';

interface ActiveDownloadsViewProps {
  torrents: TorrentItem[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRecheck: (id: string) => void;
  onReannounce: (id: string) => void;
  onDelete: (id: string, deleteFiles: boolean) => void;
  onSelectFiles: (id: string, selectedFileIds: string[]) => void;
}

export const ActiveDownloadsView: React.FC<ActiveDownloadsViewProps> = ({
  torrents,
  onPause,
  onResume,
  onRecheck,
  onReannounce,
  onDelete,
  onSelectFiles,
}) => {
  const [expandedTorrentId, setExpandedTorrentId] = useState<string | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  const activeTorrents = torrents.filter(t => t.status !== 'completed');

  const handleCopyHash = (infoHash: string, id: string) => {
    navigator.clipboard.writeText(infoHash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const toggleFileSelect = (torrent: TorrentItem, fileId: string) => {
    const updatedIds = torrent.files
      .filter(f => (f.id === fileId ? !f.selected : f.selected))
      .map(f => f.id);
    onSelectFiles(torrent.id, updatedIds);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Active Cloud Downloads</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time peer swarms, chunk verification, and per-torrent bandwidth controls
          </p>
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          {activeTorrents.length} active sessions
        </div>
      </div>

      {activeTorrents.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No active downloads</h3>
          <p className="text-xs text-slate-500 mt-1">
            All torrents are either completed or none have been submitted yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTorrents.map(torrent => {
            const isExpanded = expandedTorrentId === torrent.id;

            return (
              <div
                key={torrent.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all"
              >
                {/* Header & Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          torrent.status === 'downloading'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : torrent.status === 'verifying'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : torrent.status === 'paused'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {torrent.status}
                      </span>
                      <h3 className="font-bold text-base text-white truncate max-w-xl">
                        {torrent.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400">
                      <span>Size: <strong className="text-slate-200">{formatBytes(torrent.totalSize)}</strong></span>
                      <span>Downloaded: <strong className="text-emerald-400">{formatBytes(torrent.downloadedSize)}</strong></span>
                      <button
                        onClick={() => handleCopyHash(torrent.infoHash, torrent.id)}
                        className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
                        title="Copy Info Hash"
                      >
                        {copiedHashId === torrent.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{torrent.infoHash.slice(0, 10)}...</span>
                      </button>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex items-center gap-2 self-start lg:self-center">
                    {torrent.status === 'downloading' ? (
                      <button
                        onClick={() => onPause(torrent.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 shadow-sm"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onResume(torrent.id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    )}

                    <button
                      onClick={() => onRecheck(torrent.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      title="Force Re-check Pieces (SHA-1)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onReannounce(torrent.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      title="Force Tracker Re-announce"
                    >
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    </button>

                    <button
                      onClick={() => onDelete(torrent.id, false)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700"
                      title="Cancel Download"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setExpandedTorrentId(isExpanded ? null : torrent.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700"
                    >
                      <span>Files ({torrent.files.length})</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Live Speeds & Swarm Telemetry */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">DOWNLOAD</div>
                      <div className="text-white font-bold">{formatSpeed(torrent.downloadSpeed)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">UPLOAD</div>
                      <div className="text-white font-bold">{formatSpeed(torrent.uploadSpeed)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">SWARM</div>
                      <div className="text-white font-bold">{torrent.connectedPeers} peers ({torrent.seeders} seeds)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">TIME REMAINING</div>
                      <div className="text-white font-bold">{formatEta(torrent.eta)}</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Piece health */}
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">{torrent.progress}% completed</span>
                    <span className="text-slate-400">
                      {torrent.piecesDownloaded} / {torrent.pieceCount} pieces verified
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(1, torrent.progress)}%` }}
                    />
                  </div>
                </div>

                {/* Piece Bitfield Representation */}
                <div className="mt-2">
                  <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>Piece Health Bitfield</span>
                    <span className="text-emerald-400 font-semibold">100% SHA-1 Hash Verified</span>
                  </div>
                  <div className="flex gap-0.5 h-2 w-full bg-slate-950 rounded overflow-hidden p-0.5 border border-slate-800/80">
                    {Array.from({ length: 40 }).map((_, i) => {
                      const ratio = (torrent.piecesDownloaded || 0) / (torrent.pieceCount || 100);
                      const isComplete = i / 40 < ratio;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-xs transition-colors duration-300 ${
                            isComplete ? 'bg-emerald-400' : 'bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Expanded File Selector */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Torrent Files & Download Priority
                    </div>
                    <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-56 overflow-y-auto">
                      {torrent.files.map(f => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between text-xs p-2 rounded hover:bg-slate-900 border border-transparent hover:border-slate-800"
                        >
                          <label className="flex items-center gap-2 cursor-pointer truncate max-w-md">
                            <input
                              type="checkbox"
                              checked={f.selected}
                              onChange={() => toggleFileSelect(torrent, f.id)}
                              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                            />
                            <span className={`truncate ${f.selected ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                              {f.name}
                            </span>
                          </label>

                          <div className="flex items-center gap-3 shrink-0 font-mono text-slate-400">
                            <span>{f.progress}%</span>
                            <span className="text-slate-200">{formatBytes(f.size)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
