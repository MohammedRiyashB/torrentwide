import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { parseRangeHeader } from '../src/lib/httpRange';
import { isPathSafe } from '../src/lib/security';
import { tokenManager } from './tokenManager';

const MIME_TYPES: Record<string, string> = {
  '.iso': 'application/x-iso9660-image',
  '.img': 'application/octet-stream',
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.7z': 'application/x-7z-compressed',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.bin': 'application/octet-stream',
};

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Handles high-performance HTTP range streaming file downloads
 */
export function streamFileDownload(req: Request, res: Response, absolutePath: string, customFilename?: string) {
  const storageRoot = path.resolve(process.cwd(), 'storage');

  // Verify path safety
  if (!isPathSafe(storageRoot, absolutePath) && !fs.existsSync(absolutePath)) {
    return res.status(403).json({ error: 'Access denied: Path traversal detected or path outside storage root' });
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'File not found on cloud server storage' });
  }

  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'Cannot download a directory directly. Please use the ZIP archive feature.' });
  }

  const totalSize = stat.size;
  const filename = customFilename || path.basename(absolutePath);
  const mimeType = getMimeType(filename);
  const rangeHeader = req.headers.range;

  // Process Range request
  const range = parseRangeHeader(rangeHeader, totalSize);

  if (range.status === 416) {
    res.setHeader('Content-Range', range.contentRangeHeader || `bytes */${totalSize}`);
    return res.status(416).send('Requested Range Not Satisfiable');
  }

  // Base streaming headers optimized for Android Chrome and download managers
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'private, no-transform, no-cache');
  res.setHeader('Last-Modified', stat.mtime.toUTCString());
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (range.isRange && range.status === 206) {
    // Partial content response
    res.status(206);
    res.setHeader('Content-Range', range.contentRangeHeader!);
    res.setHeader('Content-Length', range.chunkLength);

    const stream = fs.createReadStream(absolutePath, {
      start: range.start,
      end: range.end,
      highWaterMark: 64 * 1024, // 64KB read chunks for smooth buffer flow
    });

    stream.on('error', err => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    req.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  } else {
    // Full 200 response
    res.status(200);
    res.setHeader('Content-Length', totalSize);

    const stream = fs.createReadStream(absolutePath, {
      highWaterMark: 64 * 1024,
    });

    stream.on('error', err => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    req.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  }
}

/**
 * Handles authenticated temporary token downloads for Android Chrome
 */
export function handleTokenDownload(req: Request, res: Response) {
  const tokenString = req.params.token;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const validation = tokenManager.validateAndConsumeToken(tokenString, clientIp);
  if (!validation.valid || !validation.token) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Download Link Expired</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
          <h2 style="color: #f43f5e;">Download Link Invalid or Expired</h2>
          <p>${validation.error || 'This temporary token is no longer valid. Please generate a new link in Ultra Download Hub.'}</p>
        </body>
      </html>
    `);
  }

  const token = validation.token;
  return streamFileDownload(req, res, token.filePath, token.fileName);
}
