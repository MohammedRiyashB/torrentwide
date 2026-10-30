import React, { useState, useEffect, useCallback } from 'react';
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
import { DownloadToPhoneModal } from './components/DownloadToPhoneModal';
import {
  SystemStats,
  TorrentItem,
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
  const [phoneModalFile, setPhoneModalFile] = useState<StorageFile | null>(null);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  // Fetch initial data
  const refreshStorageFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tokens');
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
      const res = await fetch('/api/audit-logs');
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
      const res = await fetch('/api/history');
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
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Connect to SSE live telemetry stream
  useEffect(() => {
    refreshStorageFiles();
    refreshTokens();
    refreshAuditLogs();
    refreshHistory();
    refreshSettings();

    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.system) setSystemStats(payload.system);
        if (payload.torrents) setTorrents(payload.torrents);
      } catch (err) {
        console.error('SSE JSON error:', err);
      }
    };

    eventSource.onerror = () => {
      // fallback to polling if SSE drops
    };

    // Periodic storage file refresh every 4 seconds
    const interval = setInterval(() => {
      refreshStorageFiles();
    }, 4000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [refreshStorageFiles, refreshTokens, refreshAuditLogs, refreshHistory, refreshSettings]);

  // Actions
  const handleAddFile = async (file: File, isSequential: boolean) => {
    const formData = new FormData();
    formData.append('torrentFile', file);
    formData.append('isSequential', String(isSequential));

    const res = await fetch('/api/torrents/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload torrent');
    }
    refreshAuditLogs();
  };

  const handleAddMagnet = async (magnetUri: string, name?: string, isSequential?: boolean) => {
    const res = await fetch('/api/torrents/magnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnetUri, name, isSequential }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add magnet link');
    }
    refreshAuditLogs();
  };

  const handleAddPreset = async (presetId: string) => {
    const res = await fetch('/api/torrents/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to launch preset download');
    }
    refreshAuditLogs();
  };

  const handlePauseTorrent = async (id: string) => {
    await fetch(`/api/torrents/${encodeURIComponent(id)}/pause`, { method: 'POST' });
    refreshAuditLogs();
  };

  const handleResumeTorrent = async (id: string) => {
    await fetch(`/api/torrents/${encodeURIComponent(id)}/resume`, { method: 'POST' });
    refreshAuditLogs();
  };

  const handleRecheckTorrent = async (id: string) => {
    await fetch(`/api/torrents/${encodeURIComponent(id)}/recheck`, { method: 'POST' });
    refreshAuditLogs();
  };

  const handleReannounceTorrent = async (id: string) => {
    await fetch(`/api/torrents/${encodeURIComponent(id)}/reannounce`, { method: 'POST' });
    refreshAuditLogs();
  };

  const handleDeleteTorrent = async (id: string, deleteFiles = false) => {
    if (!confirm('Are you sure you want to remove this torrent from active downloads?')) return;
    await fetch(`/api/torrents/${encodeURIComponent(id)}?deleteFiles=${deleteFiles}`, { method: 'DELETE' });
    refreshAuditLogs();
    refreshStorageFiles();
  };

  const handleSelectFiles = async (id: string, fileIds: string[]) => {
    await fetch(`/api/torrents/${encodeURIComponent(id)}/select-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    });
  };

  const handleOpenPhoneDownload = (file: StorageFile) => {
    setPhoneModalFile(file);
    setIsPhoneModalOpen(true);
  };

  const handleDirectDownload = (file: StorageFile) => {
    window.location.href = `/api/files/${encodeURIComponent(file.id)}/download`;
  };

  const handleCalculateSha256 = async (file: StorageFile): Promise<string> => {
    const res = await fetch(`/api/files/${encodeURIComponent(file.id)}/sha256`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to compute hash');
    const data = await res.json();
    return data.sha256;
  };

  const handleDeleteFile = async (file: StorageFile) => {
    if (!confirm(`Are you sure you want to permanently delete "${file.name}" from cloud storage?`)) return;
    const res = await fetch(`/api/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete file');
    refreshStorageFiles();
    refreshAuditLogs();
  };

  const handleRenameFile = async (file: StorageFile, newName: string) => {
    const res = await fetch(`/api/files/${encodeURIComponent(file.id)}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to rename file');
    }
    refreshStorageFiles();
    refreshAuditLogs();
  };

  const handleCreateZip = async (file: StorageFile) => {
    const res = await fetch(`/api/files/${encodeURIComponent(file.id)}/zip`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create archive');
    refreshStorageFiles();
    refreshAuditLogs();
  };

  const handleRevokeToken = async (tokenStr: string) => {
    await fetch(`/api/tokens/${encodeURIComponent(tokenStr)}/revoke`, { method: 'POST' });
    refreshTokens();
    refreshAuditLogs();
  };

  const handleSaveSettings = async (updated: Partial<PerformanceSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const data = await res.json();
    setSettings(data);
    refreshAuditLogs();
  };

  const handleProfileChange = async (newProfile: PerformanceProfileType) => {
    await handleSaveSettings({ profile: newProfile });
  };

  const activeCount = torrents.filter(t => t.status !== 'completed').length;
  const completedCount = files.length;

  return (
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
            onDownloadToPhone={handleOpenPhoneDownload}
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
          />
        )}

        {currentTab === 'completed' && (
          <CompletedDownloadsView
            files={files}
            onDownloadToPhone={handleOpenPhoneDownload}
            onDirectDownload={handleDirectDownload}
            onCalculateSha256={handleCalculateSha256}
            onDeleteFile={handleDeleteFile}
          />
        )}

        {currentTab === 'files' && (
          <FileManagerView
            files={files}
            onDownloadToPhone={handleOpenPhoneDownload}
            onDirectDownload={handleDirectDownload}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onCreateZip={handleCreateZip}
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

      {/* Download to Phone Modal */}
      <DownloadToPhoneModal
        file={phoneModalFile}
        isOpen={isPhoneModalOpen}
        onClose={() => {
          setIsPhoneModalOpen(false);
          setPhoneModalFile(null);
        }}
      />
    </div>
  );
}
