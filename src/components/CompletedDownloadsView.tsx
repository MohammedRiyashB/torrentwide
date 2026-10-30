import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
  HardDrive,
  Copy,
  Check,
  Archive,
  Trash2
} from 'lucide-react';
import { StorageFile } from '../lib/types';
import { formatBytes, formatDate } from '../lib/formatters';

interface CompletedDownloadsViewProps {
  files: StorageFile[];
  onDownloadToPhone: (file: StorageFile) => void;
  onDirectDownload: (file: StorageFile) => void;
  onCalculateSha256: (file: StorageFile) => Promise<string>;
  onDeleteFile: (file: StorageFile) => void;
}

export const CompletedDownloadsView: React.FC<CompletedDownloadsViewProps> = ({
  files,
  onDownloadToPhone,
  onDirectDownload,
  onCalculateSha256,
  onDeleteFile,
}) => {
  const [computingShaFileId, setComputingShaFileId] = useState<string | null>(null);
  const [shaHashes, setShaHashes] = useState<Record<string, string>>({});
  const [copiedShaId, setCopiedShaId] = useState<string | null>(null);

  const handleComputeSha = async (file: StorageFile) => {
    setComputingShaFileId(file.id);
    try {
      const hash = await onCalculateSha256(file);
      setShaHashes(prev => ({ ...prev, [file.id]: hash }));
    } catch (err) {
      console.error(err);
    } finally {
      setComputingShaFileId(null);
    }
  };

  const handleCopySha = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedShaId(id);
    setTimeout(() => setCopiedShaId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Completed Cloud Files</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {files.length} ready
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Files stored persistently in NVMe cloud storage ready for high-speed Android Chrome transfer
          </p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
          <HardDrive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No completed files yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Start a torrent download from the Dashboard or Add Torrent tab to download payload files here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {files.map(file => {
            const currentSha = shaHashes[file.id];
            const isComputing = computingShaFileId === file.id;

            return (
              <div
                key={file.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-1">
                      <div className="font-bold text-base text-white truncate max-w-sm sm:max-w-md" title={file.name}>
                        {file.name}
                      </div>
                      {file.torrentName && (
                        <div className="text-[11px] text-indigo-400 font-medium">
                          From Torrent: {file.torrentName}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> STORED
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400 mt-2">
                    <span>Size: <strong className="text-emerald-400">{formatBytes(file.size)}</strong></span>
                    <span>Format: <strong className="text-slate-300">{file.extension || 'BIN'}</strong></span>
                    <span>Date: {formatDate(file.modifiedAt)}</span>
                  </div>

                  {/* Cryptographic SHA-256 Checksum */}
                  <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-mono">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        SHA-256 Integrity Checksum
                      </span>
                      {currentSha ? (
                        <button
                          onClick={() => handleCopySha(currentSha, file.id)}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                        >
                          {copiedShaId === file.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedShaId === file.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComputeSha(file)}
                          disabled={isComputing}
                          className="text-indigo-400 hover:text-indigo-300 underline font-semibold disabled:opacity-50"
                        >
                          {isComputing ? 'Hashing...' : 'Calculate Hash'}
                        </button>
                      )}
                    </div>
                    <div className="text-slate-300 truncate select-all">
                      {currentSha || 'Click "Calculate Hash" to verify file integrity'}
                    </div>
                  </div>
                </div>

                {/* Primary Action Toolbar */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDirectDownload(file)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 justify-center"
                      title="Direct HTTP Stream to Browser"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Browser Save</span>
                    </button>
                    <button
                      onClick={() => onDeleteFile(file)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700"
                      title="Delete Stored File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dedicated DOWNLOAD TO PHONE Button */}
                  <button
                    onClick={() => onDownloadToPhone(file)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-100" />
                    <span>DOWNLOAD TO PHONE</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
