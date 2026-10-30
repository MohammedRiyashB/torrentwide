import crypto from 'node:crypto';
import path from 'node:path';

const SECRET_KEY = process.env.APP_SECRET || 'ultra-download-hub-secure-secret-2026';

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'download_file';
  // Remove null bytes and control chars
  let clean = filename.replace(/[\x00-\x1f\x7f]/g, '');
  // Replace dangerous path navigation dots
  clean = clean.replace(/\.\.+/g, '_');
  // Remove dangerous path characters
  clean = clean.replace(/[/\\?%*:|"<>]/g, '_');
  // Strip leading dots or underscores to prevent hidden files
  clean = clean.replace(/^[\._]+/, '');
  // Limit length
  if (clean.length > 200) {
    clean = clean.substring(0, 200);
  }
  return clean.trim() || 'download_file';
}

/**
 * Validates that targetPath is securely inside rootDirectory, preventing path traversal
 */
export function isPathSafe(rootDirectory: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootDirectory);
  const resolvedTarget = path.resolve(rootDirectory, targetPath);
  return resolvedTarget.startsWith(resolvedRoot) && !resolvedTarget.includes('\0');
}

/**
 * SSRF guard: verifies if a URL is safe to connect to for trackers/seeds
 */
export function isSafeExternalUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:', 'udp:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost, loopback, link-local, private metadata
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname === '169.254.169.254' || // AWS/GCP metadata
      hostname.startsWith('169.254.') ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a signed, tamper-proof download token with expiration
 */
export function generateSignedToken(payload: { fileId: string; expiresAt: number; salt?: string }): string {
  const data = `${payload.fileId}:${payload.expiresAt}:${payload.salt || ''}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex').substring(0, 24);
  const raw = `${payload.fileId}.${payload.expiresAt}.${hmac}`;
  return Buffer.from(raw).toString('base64url');
}

/**
 * Verifies a signed download token
 */
export function verifySignedToken(tokenString: string): { valid: boolean; fileId?: string; expiresAt?: number; error?: string } {
  try {
    const raw = Buffer.from(tokenString, 'base64url').toString('utf8');
    const parts = raw.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure' };
    }
    const [fileId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt)) {
      return { valid: false, error: 'Invalid expiration timestamp' };
    }

    if (Date.now() > expiresAt) {
      return { valid: false, error: 'Token has expired' };
    }

    const data = `${fileId}:${expiresAt}:`;
    const expectedHmac = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex').substring(0, 24);

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
      return { valid: false, error: 'Signature verification failed' };
    }

    return { valid: true, fileId, expiresAt };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: msg };
  }
}
