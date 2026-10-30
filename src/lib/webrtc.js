export const WEBRTC_TRACKERS = Object.freeze([
  'wss://tracker.btorrent.xyz',
  'wss://tracker.fastcast.nz',
  'wss://tracker.openwebtorrent.com',
]);

const BTIH_HEX = /^[a-f0-9]{40}$/i;
const BTIH_BASE32 = /^[a-z2-7]{32}$/i;

export function prepareMagnetUri(input, addPublicTrackers = true) {
  const value = String(input ?? '').trim();
  if (!value) throw new Error('Paste a magnet link first.');

  let uri;
  try {
    uri = new URL(value);
  } catch {
    throw new Error('This is not a valid magnet URI.');
  }
  if (uri.protocol !== 'magnet:') {
    throw new Error('The source must start with magnet:?.');
  }

  const btih = uri.searchParams.getAll('xt')
    .map((item) => item.match(/^urn:btih:([a-z0-9]{32}|[a-f0-9]{40})$/i)?.[1])
    .find(Boolean);

  if (!btih || !(BTIH_HEX.test(btih) || BTIH_BASE32.test(btih))) {
    throw new Error('The magnet link has no valid BitTorrent v1 info hash (BTIH).');
  }

  const currentTrackers = new Set(
    uri.searchParams.getAll('tr').map((tracker) => tracker.trim().replace(/\/$/, '').toLowerCase())
  );
  if (addPublicTrackers) {
    for (const tracker of WEBRTC_TRACKERS) {
      if (!currentTrackers.has(tracker.toLowerCase())) {
        uri.searchParams.append('tr', tracker);
      }
    }
  }

  return uri.toString();
}

function readString(bytes, offset) {
  let colon = offset;
  while (colon < bytes.length && bytes[colon] !== 0x3a) colon += 1;
  if (colon >= bytes.length) throw new Error('Invalid bencode string length.');

  const digits = new TextDecoder().decode(bytes.subarray(offset, colon));
  if (!/^(0|[1-9][0-9]*)$/.test(digits)) throw new Error('Invalid bencode string length.');

  const length = Number(digits);
  const start = colon + 1;
  const end = start + length;
  if (!Number.isSafeInteger(length) || end > bytes.length) throw new Error('Truncated bencode string.');
  return { value: bytes.subarray(start, end), next: end };
}

function skipValue(bytes, offset, depth = 0) {
  if (depth > 100 || offset >= bytes.length) throw new Error('Invalid bencode structure.');
  const token = bytes[offset];

  if (token >= 0x30 && token <= 0x39) return readString(bytes, offset).next;
  if (token === 0x69) {
    const end = bytes.indexOf(0x65, offset + 1);
    if (end < 0) throw new Error('Unterminated bencode integer.');
    return end + 1;
  }
  if (token === 0x6c || token === 0x64) {
    let cursor = offset + 1;
    while (cursor < bytes.length && bytes[cursor] !== 0x65) {
      if (token === 0x64) cursor = readString(bytes, cursor).next;
      cursor = skipValue(bytes, cursor, depth + 1);
    }
    if (cursor >= bytes.length) throw new Error('Unterminated bencode collection.');
    return cursor + 1;
  }
  throw new Error('Unknown bencode token.');
}

function readPrivateFlag(bytes, infoStart) {
  if (bytes[infoStart] !== 0x64) return false;
  let cursor = infoStart + 1;
  while (cursor < bytes.length && bytes[cursor] !== 0x65) {
    const key = readString(bytes, cursor);
    cursor = key.next;
    const keyText = new TextDecoder().decode(key.value);
    if (keyText === 'private' && bytes[cursor] === 0x69) {
      const end = bytes.indexOf(0x65, cursor + 1);
      if (end < 0) throw new Error('Unterminated private flag.');
      return new TextDecoder().decode(bytes.subarray(cursor + 1, end)) === '1';
    }
    cursor = skipValue(bytes, cursor, 1);
  }
  return false;
}

/**
 * Detects the BitTorrent private flag before adding public WebRTC trackers.
 * On malformed input this fails closed, so a public tracker is not injected.
 */
export function isPrivateTorrent(bytesLike) {
  try {
    const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
    if (bytes[0] !== 0x64) return true;
    let cursor = 1;
    while (cursor < bytes.length && bytes[cursor] !== 0x65) {
      const key = readString(bytes, cursor);
      cursor = key.next;
      const keyText = new TextDecoder().decode(key.value);
      if (keyText === 'info') return readPrivateFlag(bytes, cursor);
      cursor = skipValue(bytes, cursor, 1);
    }
    return true;
  } catch {
    return true;
  }
}
