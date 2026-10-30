import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { StorageFile } from '../src/lib/types';
import { isPathSafe, sanitizeFilename } from '../src/lib/security';
import { getMimeType } from './httpDownloadServer';
import { db } from './db';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const COMPLETED_ROOT = path.join(STORAGE_ROOT, 'completed');

export function listStorageFiles(): StorageFile[] {
  if (!fs.existsSync(COMPLETED_ROOT)) {
    fs.mkdirSync(COMPLETED_ROOT, { recursive: true });
    return [];
  }

  const results: StorageFile[] = [];

  function scan(dir: string, relBase = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relBase, entry.name);

      if (entry.isDirectory()) {
        scan(fullPath, relPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        const ext = path.extname(entry.name);
        const topFolder = relPath.split(path.sep)[0];

        results.push({
          id: `file_${Buffer.from(relPath).toString('base64url')}`,
          name: entry.name,
          relativePath: relPath,
          absolutePath: fullPath,
          size: stat.size,
          mimeType: getMimeType(entry.name),
          modifiedAt: stat.mtimeMs,
          torrentName: topFolder !== entry.name ? topFolder : undefined,
          isDirectory: false,
          extension: ext,
        });
      }
    }
  }

  try {
    scan(COMPLETED_ROOT);
  } catch (err) {
    console.error('Error scanning completed storage:', err);
  }

  return results.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export async function calculateFileSha256(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

export function deleteStorageFile(fileId: string): boolean {
  const files = listStorageFiles();
  const file = files.find(f => f.id === fileId);
  if (!file) {
    throw new Error('File not found in storage');
  }

  if (!isPathSafe(COMPLETED_ROOT, file.absolutePath)) {
    throw new Error('Path traversal detected');
  }

  fs.unlinkSync(file.absolutePath);
  db.logAudit('file_deleted', `Deleted file "${file.name}" from storage`, 'warning');
  return true;
}

export function renameStorageFile(fileId: string, newName: string): StorageFile {
  const files = listStorageFiles();
  const file = files.find(f => f.id === fileId);
  if (!file) {
    throw new Error('File not found');
  }

  const safeName = sanitizeFilename(newName);
  const targetDir = path.dirname(file.absolutePath);
  const newPath = path.join(targetDir, safeName);

  if (fs.existsSync(newPath)) {
    throw new Error('A file with this name already exists in this folder');
  }

  fs.renameSync(file.absolutePath, newPath);
  db.logAudit('file_renamed', `Renamed "${file.name}" to "${safeName}"`, 'info');

  const stat = fs.statSync(newPath);
  const relPath = path.relative(COMPLETED_ROOT, newPath);

  return {
    id: `file_${Buffer.from(relPath).toString('base64url')}`,
    name: safeName,
    relativePath: relPath,
    absolutePath: newPath,
    size: stat.size,
    mimeType: getMimeType(safeName),
    modifiedAt: stat.mtimeMs,
    isDirectory: false,
    extension: path.extname(safeName),
  };
}

/**
 * Creates a tar.gz / zip archive of a directory
 */
export async function createZipArchive(targetDirectoryOrFile: string, archiveName: string): Promise<string> {
  const safeArchiveName = sanitizeFilename(archiveName.endsWith('.tar.gz') ? archiveName : `${archiveName}.tar.gz`);
  const archivePath = path.join(COMPLETED_ROOT, safeArchiveName);

  // Simple pure streaming archive creation using tar format + zlib gzip
  return new Promise((resolve, reject) => {
    try {
      const output = fs.createWriteStream(archivePath);
      const gzip = zlib.createGzip();
      gzip.pipe(output);

      // Pack files in folder
      const filesToPack: string[] = [];
      if (fs.statSync(targetDirectoryOrFile).isDirectory()) {
        const scan = (d: string) => {
          for (const item of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, item.name);
            if (item.isDirectory()) scan(p);
            else filesToPack.push(p);
          }
        };
        scan(targetDirectoryOrFile);
      } else {
        filesToPack.push(targetDirectoryOrFile);
      }

      for (const f of filesToPack) {
        const rel = path.relative(path.dirname(targetDirectoryOrFile), f);
        const header = Buffer.alloc(512);
        header.write(rel, 0, 100);
        const content = fs.readFileSync(f);
        gzip.write(header);
        gzip.write(content);
        const padding = 512 - (content.length % 512);
        if (padding > 0 && padding < 512) {
          gzip.write(Buffer.alloc(padding));
        }
      }

      gzip.end();
      output.on('finish', () => resolve(archivePath));
      output.on('error', err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}
