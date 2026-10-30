import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateTorrent, prepareMagnetUri, WEBRTC_TRACKERS } from '../lib/webrtc.js';

const bytes = (value) => new TextEncoder().encode(value);

test('public .torrent metadata is identified as public', () => {
  const publicTorrent = bytes('d4:infod4:name1:xee');
  assert.equal(isPrivateTorrent(publicTorrent), false);
});

test('private .torrent metadata is identified and protected', () => {
  const privateTorrent = bytes('d4:infod7:privatei1e4:name1:xee');
  assert.equal(isPrivateTorrent(privateTorrent), true);
});

test('malformed torrent metadata fails closed as private', () => {
  assert.equal(isPrivateTorrent(bytes('not-bencode')), true);
});

test('magnet URI is validated and receives the WebRTC trackers when enabled', () => {
  const hash = '0123456789abcdef0123456789abcdef01234567';
  const result = new URL(prepareMagnetUri('magnet:?xt=urn:btih:' + hash));
  assert.equal(result.protocol, 'magnet:');
  assert.equal(result.searchParams.get('xt'), 'urn:btih:' + hash);
  for (const tracker of WEBRTC_TRACKERS) {
    assert.ok(result.searchParams.getAll('tr').includes(tracker));
  }
});

test('magnet tracker injection can be disabled for private sources', () => {
  const hash = '0123456789abcdef0123456789abcdef01234567';
  const result = new URL(prepareMagnetUri('magnet:?xt=urn:btih:' + hash, false));
  assert.deepEqual(result.searchParams.getAll('tr'), []);
});

test('invalid magnet sources are rejected', () => {
  assert.throws(() => prepareMagnetUri('https://example.com/file.torrent'), /magnet/i);
  assert.throws(() => prepareMagnetUri('magnet:?dn=missing-hash'), /info hash/i);
});

test('invalid private flag encodings fail closed as private', () => {
  assert.equal(isPrivateTorrent(bytes('d4:infod7:private1:14:name1:xee')), true);
  assert.equal(isPrivateTorrent(bytes('d4:infod7:privatei2e4:name1:xee')), true);
});

test('opt-out removes Torrentwide public trackers but preserves source trackers', () => {
  const hash = '0123456789abcdef0123456789abcdef01234567';
  const magnet = 'magnet:?xt=urn:btih:' + hash +
    '&tr=' + encodeURIComponent(WEBRTC_TRACKERS[0]) +
    '&tr=' + encodeURIComponent('udp://private-tracker.example:6969/announce');
  const result = new URL(prepareMagnetUri(magnet, false));
  assert.deepEqual(result.searchParams.getAll('tr'), ['udp://private-tracker.example:6969/announce']);
});

test('non-dictionary info fields fail closed as private', () => {
  assert.equal(isPrivateTorrent(bytes('d4:info1:xe')), true);
});
