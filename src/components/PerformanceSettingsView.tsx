import React, { useState } from 'react';
import { Sliders, Zap, CheckCircle2, Shield, Gauge, Cpu, Check } from 'lucide-react';
import { PerformanceSettings, PerformanceProfileType } from '../lib/types';

interface PerformanceSettingsViewProps {
  settings: PerformanceSettings;
  onSaveSettings: (updated: Partial<PerformanceSettings>) => Promise<void>;
}

export const PerformanceSettingsView: React.FC<PerformanceSettingsViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [profile, setProfile] = useState<PerformanceProfileType>(settings.profile);
  const [maxActive, setMaxActive] = useState(settings.maxActiveDownloads);
  const [maxGlobalConn, setMaxGlobalConn] = useState(settings.maxGlobalConnections);
  const [maxPerTorrentConn, setMaxPerTorrentConn] = useState(settings.maxConnectionsPerTorrent);
  const [downloadLimitKB, setDownloadLimitKB] = useState(Math.round(settings.downloadSpeedLimit / 1024));
  const [uploadLimitKB, setUploadLimitKB] = useState(Math.round(settings.uploadSpeedLimit / 1024));
  const [cacheSizeMB, setCacheSizeMB] = useState(settings.diskCacheSizeMB);
  const [dht, setDht] = useState(settings.enableDht);
  const [pex, setPex] = useState(settings.enablePex);
  const [lsd, setLsd] = useState(settings.enableLsd);
  const [seedingRatio, setSeedingRatio] = useState(settings.seedingRatioLimit);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleProfileSelect = (newProfile: PerformanceProfileType) => {
    setProfile(newProfile);
    if (newProfile === 'eco') {
      setMaxActive(2);
      setMaxGlobalConn(60);
      setMaxPerTorrentConn(20);
      setCacheSizeMB(4);
    } else if (newProfile === 'balanced') {
      setMaxActive(5);
      setMaxGlobalConn(200);
      setMaxPerTorrentConn(50);
      setCacheSizeMB(16);
    } else if (newProfile === 'max_performance') {
      setMaxActive(10);
      setMaxGlobalConn(500);
      setMaxPerTorrentConn(150);
      setCacheSizeMB(64);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await onSaveSettings({
        profile,
        maxActiveDownloads: maxActive,
        maxGlobalConnections: maxGlobalConn,
        maxConnectionsPerTorrent: maxPerTorrentConn,
        downloadSpeedLimit: downloadLimitKB * 1024,
        uploadSpeedLimit: uploadLimitKB * 1024,
        diskCacheSizeMB: cacheSizeMB,
        enableDht: dht,
        enablePex: pex,
        enableLsd: lsd,
        seedingRatioLimit: seedingRatio,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <span>Performance Optimization Engine</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Tune connection multiplexing, disk write buffers, and network governors
        </p>
      </div>

      {/* Profiles Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Eco Mode */}
        <button
          type="button"
          onClick={() => handleProfileSelect('eco')}
          className={`text-left p-5 rounded-2xl border transition-all ${
            profile === 'eco'
              ? 'bg-emerald-950/20 border-emerald-500 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-extrabold text-sm text-emerald-400 uppercase tracking-wider">ECO MODE</span>
            {profile === 'eco' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </div>
          <p className="text-xs text-slate-300 mb-3">
            Low CPU and RAM footprint. Ideal for shared VPS or low-spec hardware.
          </p>
          <div className="text-[11px] font-mono text-slate-400 space-y-1">
            <div>• Max 2 active downloads</div>
            <div>• 20 connections / torrent</div>
            <div>• 4MB disk cache</div>
          </div>
        </button>

        {/* Balanced Mode */}
        <button
          type="button"
          onClick={() => handleProfileSelect('balanced')}
          className={`text-left p-5 rounded-2xl border transition-all ${
            profile === 'balanced'
              ? 'bg-cyan-950/20 border-cyan-500 shadow-lg shadow-cyan-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-extrabold text-sm text-cyan-400 uppercase tracking-wider">BALANCED MODE</span>
            {profile === 'balanced' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
          </div>
          <p className="text-xs text-slate-300 mb-3">
            Optimized balance of throughput, system memory, and network stability.
          </p>
          <div className="text-[11px] font-mono text-slate-400 space-y-1">
            <div>• Max 5 active downloads</div>
            <div>• 50 connections / torrent</div>
            <div>• 16MB disk write buffer</div>
          </div>
        </button>

        {/* Max Performance Mode */}
        <button
          type="button"
          onClick={() => handleProfileSelect('max_performance')}
          className={`text-left p-5 rounded-2xl border transition-all ${
            profile === 'max_performance'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-lg shadow-indigo-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-extrabold text-sm text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              MAX PERFORMANCE
            </span>
            {profile === 'max_performance' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
          </div>
          <p className="text-xs text-slate-300 mb-3">
            High-throughput peer discovery and aggressive disk caching.
          </p>
          <div className="text-[11px] font-mono text-slate-400 space-y-1">
            <div>• Max 10 active downloads</div>
            <div>• 150 connections / torrent</div>
            <div>• 64MB NVMe disk cache</div>
          </div>
        </button>
      </div>

      {/* Manual Fine-Tuning */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-slate-800">
          Engine Limits & Network Parameters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Max Active Simultaneous Downloads: <span className="font-mono text-indigo-400 font-bold">{maxActive}</span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={maxActive}
              onChange={e => setMaxActive(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Disk Write Cache Buffer (MB): <span className="font-mono text-cyan-400 font-bold">{cacheSizeMB} MB</span>
            </label>
            <input
              type="range"
              min={2}
              max={128}
              step={2}
              value={cacheSizeMB}
              onChange={e => setCacheSizeMB(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Max Global Connections: <span className="font-mono text-slate-200">{maxGlobalConn}</span>
            </label>
            <input
              type="number"
              min={10}
              max={1500}
              value={maxGlobalConn}
              onChange={e => setMaxGlobalConn(parseInt(e.target.value, 10) || 50)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Max Connections Per Torrent: <span className="font-mono text-slate-200">{maxPerTorrentConn}</span>
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={maxPerTorrentConn}
              onChange={e => setMaxPerTorrentConn(parseInt(e.target.value, 10) || 20)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Global Download Speed Limit (KB/s, 0 for unlimited)
            </label>
            <input
              type="number"
              min={0}
              value={downloadLimitKB}
              onChange={e => setDownloadLimitKB(parseInt(e.target.value, 10) || 0)}
              placeholder="0 (Unlimited)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Global Upload Speed Limit (KB/s, 0 for unlimited)
            </label>
            <input
              type="number"
              min={0}
              value={uploadLimitKB}
              onChange={e => setUploadLimitKB(parseInt(e.target.value, 10) || 0)}
              placeholder="0 (Unlimited)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Peer Discovery Toggles */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Permitted Peer Discovery Protocols
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={dht}
                onChange={e => setDht(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
              <div>
                <div className="font-semibold text-white">Distributed Hash Table (DHT)</div>
                <div className="text-[10px] text-slate-500">Trackerless peer lookup</div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={pex}
                onChange={e => setPex(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
              <div>
                <div className="font-semibold text-white">Peer Exchange (PeX)</div>
                <div className="text-[10px] text-slate-500">Discover peers from peers</div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={lsd}
                onChange={e => setLsd(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
              <div>
                <div className="font-semibold text-white">Local Peer Discovery (LSD)</div>
                <div className="text-[10px] text-slate-500">LAN multicast discovery</div>
              </div>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          {success ? (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Settings updated successfully
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-mono">
              Engine updates apply immediately in real-time
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply & Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
