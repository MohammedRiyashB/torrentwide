import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { SystemStats } from '../src/lib/types';
import { db } from './db';

let lastCpuInfo = os.cpus();
let lastCpuTime = Date.now();
let lastCpuUsage = 4.5; // default baseline

function calculateCpuPercent(): number {
  const currentCpus = os.cpus();
  const currentTime = Date.now();
  const timeDelta = currentTime - lastCpuTime;

  if (timeDelta < 500) {
    return lastCpuUsage;
  }

  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = lastCpuInfo[i]?.times || { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const curr = currentCpus[i].times;

    const idle = curr.idle - prev.idle;
    const total = (curr.user - prev.user) + (curr.nice - prev.nice) + (curr.sys - prev.sys) + (curr.irq - prev.irq) + idle;

    totalIdle += idle;
    totalTick += total;
  }

  lastCpuInfo = currentCpus;
  lastCpuTime = currentTime;

  if (totalTick <= 0) return lastCpuUsage;
  const usage = 100 - Math.round((100 * totalIdle) / totalTick);
  lastCpuUsage = Math.max(1, Math.min(99, usage));
  return lastCpuUsage;
}

export function getSystemStats(): SystemStats {
  const torrents = db.getTorrents();
  
  let globalDownloadSpeed = 0;
  let globalUploadSpeed = 0;
  let totalDownloadedBytes = 0;
  let totalUploadedBytes = 0;
  let activeCount = 0;
  let completedCount = 0;
  let pausedCount = 0;
  let errorCount = 0;

  for (const t of torrents) {
    if (t.status === 'downloading' || t.status === 'metadata_fetching') {
      activeCount++;
      globalDownloadSpeed += t.downloadSpeed || 0;
      globalUploadSpeed += t.uploadSpeed || 0;
    } else if (t.status === 'completed' || t.status === 'seeding') {
      completedCount++;
      if (t.status === 'seeding') {
        globalUploadSpeed += t.uploadSpeed || 0;
      }
    } else if (t.status === 'paused') {
      pausedCount++;
    } else if (t.status === 'error') {
      errorCount++;
    }

    totalDownloadedBytes += t.downloadedSize || 0;
    totalUploadedBytes += t.uploadedSize || 0;
  }

  const memoryTotalBytes = os.totalmem();
  const memoryFreeBytes = os.freemem();
  const memoryUsedBytes = memoryTotalBytes - memoryFreeBytes;
  const memoryUsagePercent = Math.round((memoryUsedBytes / memoryTotalBytes) * 100);

  // Storage directory stats
  const storageRoot = path.resolve(process.cwd(), 'storage');
  let diskUsedBytes = 0;
  try {
    const calcDirSize = (dirPath: string): number => {
      let size = 0;
      if (!fs.existsSync(dirPath)) return 0;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            size += calcDirSize(full);
          } else if (entry.isFile()) {
            size += fs.statSync(full).size;
          }
        } catch {
          // ignore transient locks
        }
      }
      return size;
    };
    diskUsedBytes = calcDirSize(storageRoot);
  } catch {
    diskUsedBytes = 1048576 * 50; // default 50MB
  }

  // Virtual quota 500 GB for VPS cloud storage representation
  const diskTotalBytes = 500 * 1024 * 1024 * 1024;
  const diskFreeBytes = Math.max(0, diskTotalBytes - diskUsedBytes);
  const diskUsagePercent = Math.max(1, Math.min(100, Math.round((diskUsedBytes / diskTotalBytes) * 100)));

  return {
    cpuUsagePercent: calculateCpuPercent(),
    memoryUsedBytes,
    memoryTotalBytes,
    memoryUsagePercent,
    diskUsedBytes,
    diskTotalBytes,
    diskFreeBytes,
    diskUsagePercent,
    globalDownloadSpeed,
    globalUploadSpeed,
    totalDownloadedBytes,
    totalUploadedBytes,
    activeCount,
    completedCount,
    pausedCount,
    errorCount,
    totalTorrents: torrents.length,
    uptimeSeconds: Math.floor(process.uptime()),
    engineMode: 'integrated_node',
  };
}
