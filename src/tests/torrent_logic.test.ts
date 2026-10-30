import test from 'node:test';
import assert from 'node:assert/strict';
import { BencodeDecoder, bencodeEncode } from '../lib/bencode';
import { parseMagnetURI, isValidMagnetURI, buildMagnetURI } from '../lib/magnet';
import { parseRangeHeader } from '../lib/httpRange';
import { formatBytes, formatSpeed, formatEta } from '../lib/formatters';
import { sanitizeFilename, isPathSafe, isSafeExternalUrl, generateSignedToken, verifySignedToken } from '../lib/security';

test('Bencode encoder and decoder round-trip values', () => {
  // Test integer
  const numBuf = bencodeEncode(12345);
  const numDecoded = new BencodeDecoder(numBuf).decode();
  assert.equal(numDecoded, 12345);

  // Test string
  const strBuf = bencodeEncode('ultra-torrent');
  const strDecoded = new BencodeDecoder(strBuf).decode();
  assert.equal(Buffer.isBuffer(strDecoded) ? strDecoded.toString('utf8') : strDecoded, 'ultra-torrent');

  // Test list
  const listBuf = bencodeEncode([1, 2, 'three']);
  const listDecoded = new BencodeDecoder(listBuf).decode() as unknown[];
  assert.equal(listDecoded.length, 3);
  assert.equal(listDecoded[0], 1);

  // Test dictionary
  const dictBuf = bencodeEncode({ name: 'ubuntu.iso', size: 1048576 });
  const dictDecoded = new BencodeDecoder(dictBuf).decode() as Record<string, unknown>;
  const nameVal = Buffer.isBuffer(dictDecoded['name']) ? dictDecoded['name'].toString('utf8') : dictDecoded['name'];
  assert.equal(nameVal, 'ubuntu.iso');
  assert.equal(dictDecoded['size'], 1048576);
});

test('Magnet URI parser correctly extracts infoHash, name and trackers', () => {
  const magnet = 'magnet:?xt=urn:btih:d6b63d6f7c320297058df8a71997d8b5c9efdb08&dn=Ubuntu+24.04&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce';
  
  assert.equal(isValidMagnetURI(magnet), true);
  assert.equal(isValidMagnetURI('not-a-magnet'), false);

  const parsed = parseMagnetURI(magnet);
  assert.equal(parsed.infoHash, 'd6b63d6f7c320297058df8a71997d8b5c9efdb08');
  assert.equal(parsed.name, 'Ubuntu 24.04');
  assert.equal(parsed.trackers.length, 2);
  assert.equal(parsed.trackers[0], 'https://torrent.ubuntu.com/announce');

  const rebuilt = buildMagnetURI(parsed.infoHash, parsed.name);
  assert.match(rebuilt, /xt=urn%3Abtih%3Ad6b63d6f7c320297058df8a71997d8b5c9efdb08/);
});

test('HTTP Range header parser handles 200, 206 partial slices, and 416 bounds', () => {
  const totalSize = 10000;

  // No range header -> 200 full content
  const full = parseRangeHeader(undefined, totalSize);
  assert.equal(full.status, 200);
  assert.equal(full.start, 0);
  assert.equal(full.end, 9999);
  assert.equal(full.chunkLength, 10000);

  // Partial range "bytes=0-499" -> 206
  const partial1 = parseRangeHeader('bytes=0-499', totalSize);
  assert.equal(partial1.status, 206);
  assert.equal(partial1.start, 0);
  assert.equal(partial1.end, 499);
  assert.equal(partial1.chunkLength, 500);
  assert.equal(partial1.contentRangeHeader, 'bytes 0-499/10000');

  // Open-ended range "bytes=5000-" -> 206
  const partial2 = parseRangeHeader('bytes=5000-', totalSize);
  assert.equal(partial2.status, 206);
  assert.equal(partial2.start, 5000);
  assert.equal(partial2.end, 9999);
  assert.equal(partial2.chunkLength, 5000);

  // Suffix range "bytes=-500" -> last 500 bytes
  const suffix = parseRangeHeader('bytes=-500', totalSize);
  assert.equal(suffix.status, 206);
  assert.equal(suffix.start, 9500);
  assert.equal(suffix.end, 9999);
  assert.equal(suffix.chunkLength, 500);

  // Out of bounds -> 416
  const invalid = parseRangeHeader('bytes=20000-25000', totalSize);
  assert.equal(invalid.status, 416);
});

test('Formatters format bytes, speeds, and ETA accurately', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576 * 2.5, 1), '2.5 MB');
  assert.equal(formatBytes(1073741824 * 4.2, 1), '4.2 GB');

  assert.equal(formatSpeed(1500000), '1.4 MB/s');
  assert.equal(formatSpeed(0), '0 KB/s');

  assert.equal(formatEta(45), '45s');
  assert.equal(formatEta(125), '2m 5s');
  assert.equal(formatEta(3665), '1h 1m');
  assert.equal(formatEta(0), '∞');
});

test('Security utilities enforce filename safety, path boundaries, and signed tokens', () => {
  // Filename sanitation
  assert.equal(sanitizeFilename('../../evil.sh'), 'evil.sh');
  assert.equal(sanitizeFilename('movie [2024] <1080p>.mkv'), 'movie [2024] _1080p_.mkv');

  // Path safety
  assert.equal(isPathSafe('/app/storage', 'completed/ubuntu.iso'), true);
  assert.equal(isPathSafe('/app/storage', '../../etc/passwd'), false);

  // SSRF protection
  assert.equal(isSafeExternalUrl('http://127.0.0.1:8080'), false);
  assert.equal(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isSafeExternalUrl('https://torrent.ubuntu.com/announce'), true);

  // Signed token issuance and verification
  const validToken = generateSignedToken({
    fileId: 'file_123',
    expiresAt: Date.now() + 60000,
  });
  const verified = verifySignedToken(validToken);
  assert.equal(verified.valid, true);
  assert.equal(verified.fileId, 'file_123');

  // Expired token
  const expiredToken = generateSignedToken({
    fileId: 'file_123',
    expiresAt: Date.now() - 1000,
  });
  const verifiedExpired = verifySignedToken(expiredToken);
  assert.equal(verifiedExpired.valid, false);
  assert.match(verifiedExpired.error || '', /expired/i);
});
