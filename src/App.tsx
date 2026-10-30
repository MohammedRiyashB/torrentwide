import React, { useState, useEffect, useCallback } from 'react';
import { AuthGate } from './components/AuthGate';
import { apiFetch, downloadTorrentFile, getAccessToken, getTorrentWebSocketUrl, readApiError } from './lib/api';
import { Header } from './components/Header';
import { Navigation, TabKey } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { AddTorrentView } from './components/AddTorrentView';
import { ActiveDownloadsView } from './components/ActiveDownloadsView';
import { CompletedDownloadsView } from './components/CompletedDownloadsView';
import { FileManagerView } from './components/FileManagerView';
import { DownloadHistoryView } from './components/DownloadHistoryView';
import { PerformanceSettingsView } from './components/PerformanceSettingsView';
import { StorageSettingsView } from './components/StorageSettingsView';
import { SecurityAuditView } from './components/SecurityAuditView';
import { SystemInfoView } from './components/SystemInfoView';
import {
  SystemStats,
  TorrentItem,
  TorrentFileItem,
  StorageFile,
  DownloadToken,
  AuditLogItem,
  HistoryItem,
  PerformanceSettings,
  PerformanceProfileType
} from './lib/types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Real-Time State
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [torrents, setTorrents] = useState<TorrentItem[]>([]);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [tokens, setTokens] = useState<DownloadToken[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<PerformanceSettings>({
    profile: 'balanced',
    maxActiveDownloads: 5,
    maxGlobalConnections: 200,
    maxConnectionsPerTorrent: 50,
    downloadSpeedLimit: 0,
    uploadSpeedLimit: 1048576,
    diskCacheSizeMB: 16,
    connectionTimeoutSec: 30,
    peerTimeoutSec: 60,
    seedingRatioLimit: 1.5,
    enableDht: true,
    enablePex: true,
    enableLsd: true,
    downloadDir: '/storage/incomplete',
    completedDir: '/storage/completed',
    tempDir: '/storage/temp',
  });

  // Modal State

  // Fetch initial data
  const refreshStorageFiles = useCallback(async () => {
    try {
      const torrentResponse = await apiFetch('/api/torrents');
      if (!torrentResponse.ok) return;
      const ownedTorrents: TorrentItem[] = await torrentResponse.json();
      const fileGroups = await Promise.all(ownedTorrents.map(async torrent => {
        const response = await apiFetch(`/api/torrents/${encodeURIComponent(torrent.id)}/files`);
        if (!response.ok) return [];
        const torrentFiles: Array<{ index: number; name: string; size: number; progress: number }> = await response.json();
        return torrentFiles.filter(file => file.progress >= 100).map(file => {
          const extension = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase() : 'BIN';
          return {
            id: `${torrent.id}:${file.index}`,
            name: file.name.split('/').pop() || file.name,
            relativePath: file.name,
            absolutePath: '',
            size: file.size,
            mimeType: 'application/octet-stream',
            modifiedAt: torrent.addedAt || 0,
            torrentId: torrent.id,
            torrentFileIndex: file.index,
            torrentName: torrent.name,
            isDirectory: false,
            extension,
          } satisfies StorageFile;
        });
      }));
      setFiles(fileGroups.flat());
    } catch {
      // Preserve the last known file list during temporary API failures.
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tokens');
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await apiFetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Prefer authenticated WebSocket updates; fall back to slower polling if unavailable.
  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | undefined;
    let socket: WebSocket | undefined;
    const refreshTorrents = async () => {
      try {
        const response = await apiFetch('/api/torrents');
        if (response.status === 401) return;
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setTorrents(data);
      } catch {
        // Preserve the last known torrent state during temporary network errors.
      }
    };

    const token = getAccessToken();
    if (token) {
      socket = new WebSocket(getTorrentWebSocketUrl());
      socket.onopen = () => {
        socket?.send(JSON.stringify({ token }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!cancelled && message.type === 'torrent_update' && Array.isArray(message.torrents)) {
            setTorrents(message.torrents);
          }
        } catch {
          // Ignore malformed telemetry messages.
        }
      };
      socket.onclose = () => {
        if (!cancelled) {
          refreshTorrents();
          fallbackTimer = window.setInterval(refreshTorrents, 5000);
        }
      };
      socket.onerror = () => socket?.close();
    } else {
      refreshTorrents();
      fallbackTimer = window.setInterval(refreshTorrents, 5000);
    }

    refreshStorageFiles();
    const fileRefreshTimer = window.setInterval(refreshStorageFiles, 15000);

    return () => {
      window.clearInterval(fileRefreshTimer);
      cancelled = true;
      if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
      socket?.close();
    };
  }, [refreshStorageFiles, refreshTokens, refreshAuditLogs, refreshHistory, refreshSettings]);

  // Actions
  const handleAddFile = async (file: File, isSequential: boolean) => {
    const formData = new FormData();
    formData.append('torrentFile', file);
    formData.append('isSequential', String(isSequential));

    const res = await apiFetch('/api/torrents/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload torrent');
    }
  };

  const handleAddMagnet = async (magnetUri: string, name?: string, isSequential?: boolean) => {
    const res = await apiFetch('/api/torrents/magnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnetUri, name, isSequential }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add magnet link');
    }
  };

  const handleAddPreset = async (presetId: string) => {
    const res = await apiFetch('/api/torrents/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to launch preset download');
    }
  };

  const handlePauseTorrent = async (id: string) => {
    await apiFetch(`/api/torrents/${encodeURIComponent(id)}/pause`, { method: 'POST' });
  };

  const handleResumeTorrent = async (id: string) => {
    await apiFetch(`/api/torrents/${encodeURIComponent(id)}/resume`, { method: 'POST' });
  };

  const handleRecheckTorrent = async (id: string) => {
    await apiFetch(`/api/torrents/${encodeURIComponent(id)}/recheck`, { method: 'POST' });
  };

  const handleReannounceTorrent = async (id: string) => {
    await apiFetch(`/api/torrents/${encodeURIComponent(id)}/reannounce`, { method: 'POST' });
  };

  const handleDeleteTorrent = async (id: string, deleteFiles = false) => {
    if (!confirm('Are you sure you want to remove this torrent from active downloads?')) return;
    await apiFetch(`/api/torrents/${encodeURIComponent(id)}?deleteFiles=${deleteFiles}`, { method: 'DELETE' });
    refreshStorageFiles();
  };

  const handleFetchTorrentFiles = async (id: string): Promise<TorrentFileItem[]> => {
    const res = await apiFetch(`/api/torrents/${encodeURIComponent(id)}/files`);
    if (!res.ok) throw new Error(await readApiError(res));
    const data = await res.json();
    return data.map((file: { index: number; name: string; size: number; progress: number; priority: number }) => ({
      id: String(file.index),
      name: file.name,
      path: file.name,
      size: file.size,
      progress: file.progress,
      selected: file.priority > 0,
      priority: file.priority > 0 ? 'normal' : 'low',
    }));
  };

  const handleSelectFiles = async (id: string, fileIds: string[]) => {
    const res = await apiFetch(`/api/torrents/${encodeURIComponent(id)}/select-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: fileIds.map(Number).filter(Number.isInteger) }),
    });
    if (!res.ok) throw new Error(await readApiError(res));
  };

  const handleDirectDownload = async (file: StorageFile) => {
    if (!file.torrentId || file.torrentFileIndex === undefined) {
      throw new Error('This file is not linked to an owned torrent');
    }
    const blob = await downloadTorrentFile(file.torrentId, file.torrentFileIndex);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const activeCount = torrents.filter(t => t.status !== 'completed').length;
  const completedCount = files.length;

  return (
    <AuthGate>
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        stats={systemStats}
        currentProfile={settings.profile}
        onProfileChange={handleProfileChange}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Navigation Bar */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeCount={activeCount}
        completedCount={completedCount}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            stats={systemStats}
            torrents={torrents}
            files={files}
            onAddTorrentClick={() => setCurrentTab('add')}
            onAddPreset={handleAddPreset}
            onPauseTorrent={handlePauseTorrent}
            onResumeTorrent={handleResumeTorrent}
            onDeleteTorrent={id => handleDeleteTorrent(id, false)}
            onDownloadToPhone={handleDirectDownload}
            onNavigateToTab={setCurrentTab}
          />
        )}

        {currentTab === 'add' && (
          <AddTorrentView
            onAddFile={handleAddFile}
            onAddMagnet={handleAddMagnet}
            onAddPreset={handleAddPreset}
            onTorrentAddedSuccess={() => setCurrentTab('active')}
          />
        )}

        {currentTab === 'active' && (
          <ActiveDownloadsView
            torrents={torrents}
            onPause={handlePauseTorrent}
            onResume={handleResumeTorrent}
            onRecheck={handleRecheckTorrent}
            onReannounce={handleReannounceTorrent}
            onDelete={handleDeleteTorrent}
            onSelectFiles={handleSelectFiles}
            onFetchFiles={handleFetchTorrentFiles}
          />
        )}

        {currentTab === 'completed' && (
          <CompletedDownloadsView
            files={files}
            onDownloadToPhone={handleDirectDownload}
          />
        )}

        {currentTab === 'files' && (
          <FileManagerView
            files={files}
            onDownloadToPhone={handleDirectDownload}
          />
        )}

        {currentTab === 'history' && (
          <DownloadHistoryView history={history} />
        )}

        {currentTab === 'performance' && (
          <PerformanceSettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {currentTab === 'storage' && (
          <StorageSettingsView
            stats={systemStats}
            settings={settings}
          />
        )}

        {currentTab === 'security' && (
          <SecurityAuditView
            tokens={tokens}
            auditLogs={auditLogs}
            onRevokeToken={handleRevokeToken}
          />
        )}

        {currentTab === 'system' && (
          <SystemInfoView stats={systemStats} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ULTRA DOWNLOAD HUB • PRODUCTION CLOUD TORRENT PLATFORM</span>
          <span className="text-slate-400">HTTP 206 Partial Content Stream • Android Chrome Direct</span>
        </div>
      </footer>


    </div>
    </AuthGate>
  );
}
