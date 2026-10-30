import React from 'react';
import { History, CheckCircle2, Clock, ArrowDown, HardDrive } from 'lucide-react';
import { HistoryItem } from '../lib/types';
import { formatBytes, formatSpeed, formatDuration, formatDate } from '../lib/formatters';

interface DownloadHistoryViewProps {
  history: HistoryItem[];
}

export const DownloadHistoryView: React.FC<DownloadHistoryViewProps> = ({ history }) => {
  const totalDownloaded = history.reduce((acc, h) => acc + h.totalSize, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>Download Session History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical audit records of completed P2P torrent downloads
          </p>
        </div>
        <div className="text-xs font-mono bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-slate-300">
          Lifetime Data Delivered: <strong className="text-emerald-400">{formatBytes(totalDownloaded)}</strong>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="py-3 px-4">Torrent Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Average Speed</th>
                <th className="py-3 px-4">Info Hash</th>
                <th className="py-3 px-4 text-right">Finished At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No completed download sessions recorded in history yet.
                  </td>
                </tr>
              ) : (
                history.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white max-w-xs truncate">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-semibold whitespace-nowrap">
                      {formatBytes(item.totalSize)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {formatDuration(item.downloadDurationSeconds)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-cyan-400 font-semibold whitespace-nowrap">
                      {formatSpeed(item.averageSpeed)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {item.infoHash.slice(0, 12)}...
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 whitespace-nowrap">
                      {formatDate(item.completedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
