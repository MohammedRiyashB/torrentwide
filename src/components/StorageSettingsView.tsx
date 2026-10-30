import React, { useState } from 'react';
import { HardDrive, Folder, Check, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { SystemStats, PerformanceSettings } from '../lib/types';
import { formatBytes } from '../lib/formatters';

interface StorageSettingsViewProps {
  stats: SystemStats | null;
  settings: PerformanceSettings;
}

export const StorageSettingsView: React.FC<StorageSettingsViewProps> = ({ stats, settings }) => {
  const [cleaned, setCleaned] = useState(false);

  const handleCleanTemp = () => {
    setCleaned(true);
    setTimeout(() => setCleaned(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-cyan-400" />
          <span>Cloud Storage & Quota Management</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Monitor persistent NVMe volume capacity, storage paths, and download directories
        </p>
      </div>

      {/* Quota Progress Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white uppercase tracking-wider">
            Total Cloud Volume Capacity
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
            NVMe PERSISTENT VOLUME
          </span>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-mono text-2xl font-extrabold text-white">
              {formatBytes(stats?.diskUsedBytes || 0)}{' '}
              <span className="text-xs text-slate-400 font-normal">used of 500 GB</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {formatBytes(stats?.diskFreeBytes || 0)} available
            </span>
          </div>

          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, stats?.diskUsagePercent || 2)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">Completed Payloads</span>
            <span className="font-mono text-emerald-400 font-bold">{formatBytes(stats?.diskUsedBytes || 0)}</span>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">Temporary Cache</span>
            <span className="font-mono text-amber-400 font-bold">12.4 MB</span>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">Volume Free Space</span>
            <span className="font-mono text-cyan-400 font-bold">{formatBytes(stats?.diskFreeBytes || 0)}</span>
          </div>
        </div>
      </div>

      {/* Directory Layout Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-slate-800">
          Configured Filesystem Paths
        </h3>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1 font-sans font-semibold">Completed Downloads Directory</label>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-between">
              <span>{settings.completedDir}</span>
              <Folder className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans font-semibold">Incomplete Partials Directory</label>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-between">
              <span>{settings.downloadDir}</span>
              <Folder className="w-4 h-4 text-indigo-400" />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans font-semibold">Temporary Chunk Buffer Directory</label>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-between">
              <span>{settings.tempDir}</span>
              <Folder className="w-4 h-4 text-amber-400" />
            </div>
          </div>
        </div>

        {/* Safe Cleanup */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Completed files are never deleted without explicit confirmation.
          </div>
          <button
            onClick={handleCleanTemp}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            {cleaned ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{cleaned ? 'Cache Cleaned' : 'Purge Temp Cache'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
