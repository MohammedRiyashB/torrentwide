export interface ParsedMagnet {
  infoHash: string;
  name: string;
  trackers: string[];
  exactLength?: number;
  selectIndices?: number[];
  originalUri: string;
}

/**
 * Converts 32-character Base32 string to 40-character Hex string
 */
function base32ToHex(base32: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const clean = base32.toUpperCase().replace(/=/g, '');
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex.substring(0, 40);
}

export function isValidMagnetURI(uri: string): boolean {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed.startsWith('magnet:?')) return false;
  return /xt=urn:btih:([a-zA-Z0-9]{32,40})/i.test(trimmed);
}

export function parseMagnetURI(uri: string): ParsedMagnet {
  const trimmed = uri.trim();
  if (!trimmed.startsWith('magnet:?')) {
    throw new Error('Invalid magnet URI: missing "magnet:?" prefix');
  }

  const queryString = trimmed.slice(8);
  const searchParams = new URLSearchParams(queryString);

  const xtValues = searchParams.getAll('xt');
  let infoHash = '';

  for (const xt of xtValues) {
    const match = xt.match(/urn:btih:([a-zA-Z0-9]{32,40})/i);
    if (match) {
      const rawHash = match[1];
      if (rawHash.length === 40) {
        infoHash = rawHash.toLowerCase();
      } else if (rawHash.length === 32) {
        infoHash = base32ToHex(rawHash).toLowerCase();
      }
      break;
    }
  }

  if (!infoHash) {
    throw new Error('Invalid magnet URI: No valid BTIH (BitTorrent Info Hash) found in xt parameter');
  }

  const name = searchParams.get('dn') || `Torrent-${infoHash.slice(0, 8)}`;
  const trackers = searchParams.getAll('tr').map(tr => decodeURIComponent(tr).trim()).filter(Boolean);
  
  const xl = searchParams.get('xl');
  const exactLength = xl ? parseInt(xl, 10) : undefined;

  const so = searchParams.get('so');
  let selectIndices: number[] | undefined;
  if (so) {
    selectIndices = so.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  }

  return {
    infoHash,
    name,
    trackers,
    exactLength,
    selectIndices,
    originalUri: trimmed,
  };
}

export function buildMagnetURI(infoHash: string, name?: string, trackers?: string[]): string {
  const params = new URLSearchParams();
  params.set('xt', `urn:btih:${infoHash.toLowerCase()}`);
  if (name) {
    params.set('dn', name);
  }
  if (trackers && trackers.length > 0) {
    for (const tr of trackers) {
      params.append('tr', tr);
    }
  }
  return `magnet:?${params.toString()}`;
}
