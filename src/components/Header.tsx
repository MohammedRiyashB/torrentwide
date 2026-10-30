import React from 'react';
import { 
  Zap, 
  ArrowDown, 
  ArrowUp, 
  Layers, 
  Activity, 
  ShieldCheck, 
  Menu, 
  X,
  Gauge
} from 'lucide-react';
import { SystemStats, PerformanceProfileType } from '../lib/types';
import { formatSpeed } from '../lib/formatters';

interface HeaderProps {
  stats: SystemStats | null;
  currentProfile: PerformanceProfileType;
  onProfileChange: (profile: PerformanceProfileType) => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  currentProfile,
  onProfileChange,
  mobileMenuOpen,
  onToggleMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400/30" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base lg:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                ULTRA DOWNLOAD HUB
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO P2P
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block font-medium">
              Cloud Torrent Engine & Android Chrome Fast Delivery
            </p>
          </div>
        </div>

        {/* Global Live Throughput & Profile Controls */}
        <div className="hidden md:flex items-center gap-4">
          {/* Performance Mode Quick Switcher */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-1 text-xs shadow-inner">
            <button
              onClick={() => onProfileChange('eco')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                currentProfile === 'eco'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Low resource consumption, 15 conn/torrent"
            >
              Eco
            </button>
            <button
              onClick={() => onProfileChange('balanced')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                currentProfile === 'balanced'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Balanced CPU, RAM, and network usage"
            >
              Balanced
            </button>
            <button
              onClick={() => onProfileChange('max_performance')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                currentProfile === 'max_performance'
                  ? 'bg-gradient-to-r from-indigo-500/25 to-purple-500/25 text-indigo-200 border border-indigo-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Maximum permitted network bandwidth and high-throughput cache"
            >
              ⚡ Max Perf
            </button>
          </div>

          {/* Live Speed Badges */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-1.5 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold" title="Global Download Speed">
              <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
              <span>{formatSpeed(stats?.globalDownloadSpeed || 0)}</span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold" title="Global Upload Speed">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{formatSpeed(stats?.globalUploadSpeed || 0)}</span>
            </div>
          </div>

          {/* Engine Status Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <span className="hidden lg:inline">ENGINE ACTIVE</span>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-[11px] text-emerald-400 font-semibold">
            <ArrowDown className="w-3 h-3" />
            <span>{formatSpeed(stats?.globalDownloadSpeed || 0)}</span>
          </div>
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
