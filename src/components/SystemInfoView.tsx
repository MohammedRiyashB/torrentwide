import React, { useState } from 'react';
import {
  Server,
  Cpu,
  Layers,
  Copy,
  Check,
  Smartphone,
  ShieldAlert,
  Terminal,
  FileCode,
  HardDrive
} from 'lucide-react';
import { SystemStats } from '../lib/types';
import { formatBytes, formatDuration } from '../lib/formatters';

interface SystemInfoViewProps {
  stats: SystemStats | null;
}

export const SystemInfoView: React.FC<SystemInfoViewProps> = ({ stats }) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'compose' | 'dockerfile' | 'vps' | 'nginx'>('compose');
  const [copiedCode, setCopiedCode] = useState(false);

  const composeCode = `# docker-compose.yml for Ultra Download Hub
version: '3.8'

services:
  ultra-hub:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - APP_SECRET=ultra_secure_secret_key
    volumes:
      - torrent_storage:/app/storage

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    restart: unless-stopped
    ports:
      - "6881:6881"
      - "6881:6881/udp"
    volumes:
      - torrent_storage:/downloads

volumes:
  torrent_storage:`;

  const vpsCode = `# Run on Ubuntu 22.04 / 24.04 VPS with root privileges:
curl -fsSL https://get.docker.com | sh
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 6881/tcp
ufw allow 6881/udp
ufw --force enable

git clone <your-repo> /opt/ultra-hub
cd /opt/ultra-hub
docker compose up -d --build`;

  const nginxCode = `# Nginx HTTP Range Streaming & WebSocket Proxy
location ~ ^/api/(download|files/.+/download) {
    proxy_pass http://localhost:3000;
    proxy_buffering off;
    proxy_set_header Range $http_range;
    proxy_set_header If-Range $http_if_range;
    proxy_read_timeout 3600s;
}

location /ws/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}`;

  const currentCode =
    activeCodeTab === 'compose'
      ? composeCode
      : activeCodeTab === 'vps'
      ? vpsCode
      : nginxCode;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-400" />
          <span>System Information & VPS Production Hub</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Diagnostics, P2P compliance rules, and Linux VPS automated deployment configurations
        </p>
      </div>

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Engine Mode
          </span>
          <div className="font-mono text-base font-bold text-emerald-400">
            INTEGRATED P2P
          </div>
          <div className="text-[10px] text-slate-500 mt-1">BitTorrent v1/v2 & WebAPI</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Node Server Uptime
          </span>
          <div className="font-mono text-base font-bold text-white">
            {formatDuration(stats?.uptimeSeconds || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Continuous zero-downtime loop</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Memory Utilization
          </span>
          <div className="font-mono text-base font-bold text-cyan-400">
            {formatBytes(stats?.memoryUsedBytes || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{stats?.memoryUsagePercent || 12}% of system RAM</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Disk Storage
          </span>
          <div className="font-mono text-base font-bold text-indigo-400">
            {formatBytes(stats?.diskUsedBytes || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{formatBytes(stats?.diskFreeBytes || 0)} available</div>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <strong className="text-amber-400 block font-bold">
            P2P Hosting Policy & Network Rules
          </strong>
          <p>
            BitTorrent traffic requires infrastructure that explicitly permits P2P traffic (such as Hetzner, OVH, BuyVM, Netcup, or dedicated Linux servers). Do not run BitTorrent/P2P traffic on Google Colab.
          </p>
        </div>
      </div>

      {/* Deployment Artifacts Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              Deployment Configuration Templates
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveCodeTab('compose')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeCodeTab === 'compose' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              docker-compose.yml
            </button>
            <button
              onClick={() => setActiveCodeTab('vps')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeCodeTab === 'vps' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Linux VPS Script
            </button>
            <button
              onClick={() => setActiveCodeTab('nginx')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeCodeTab === 'nginx' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              nginx.conf
            </button>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={handleCopyCode}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all z-10"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-72">
            {currentCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
