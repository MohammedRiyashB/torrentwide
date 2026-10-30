import React from 'react';
import { Download, HardDrive, CheckCircle2 } from 'lucide-react';
import { StorageFile } from '../lib/types';
import { formatBytes, formatDate } from '../lib/formatters';

interface CompletedDownloadsViewProps {
  files: StorageFile[];
  onDownloadToPhone: (file: StorageFile) => void;
}

export const CompletedDownloadsView: React.FC<CompletedDownloadsViewProps> = ({ files, onDownloadToPhone }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-extrabold text-white tracking-tight">Completed Torrent Files</h2>
      <p className="text-xs text-slate-400 mt-1">Completed files from torrents owned by your account</p>
    </div>
    {files.length === 0 ? (
      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
        <HardDrive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No completed files yet</h3>
        <p className="text-xs text-slate-500 mt-1">Completed torrent payloads will appear here.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {files.map(file => (
          <div key={file.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-base text-white break-all">{file.name}</div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> COMPLETE
                </span>
              </div>
              {file.torrentName && <div className="text-[11px] text-indigo-400 mt-1">From torrent: {file.torrentName}</div>}
              <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400 mt-3">
                <span>Size: <strong className="text-emerald-400">{formatBytes(file.size)}</strong></span>
                <span>Type: {file.extension}</span>
                <span>Added: {file.modifiedAt ? formatDate(file.modifiedAt) : '—'}</span>
              </div>
            </div>
            <button onClick={() => onDownloadToPhone(file)} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Save to device
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);
