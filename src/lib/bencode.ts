import crypto from 'node:crypto';

export type BencodeValue =
  | string
  | number
  | Buffer
  | BencodeValue[]
  | { [key: string]: BencodeValue };

export interface TorrentMetadata {
  name: string;
  infoHash: string;
  totalSize: number;
  pieceLength: number;
  pieceCount: number;
  piecesHashes: string[]; // hex list of 20-byte sha1
  files: {
    id: string;
    path: string;
    name: string;
    size: number;
    offset: number;
  }[];
  trackers: string[];
  comment?: string;
  createdBy?: string;
  creationDate?: number;
  isPrivate?: boolean;
}

export class BencodeDecoder {
  private buffer: Buffer;
  private offset = 0;

  constructor(data: Buffer | Uint8Array) {
    this.buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  }

  public decode(): BencodeValue {
    if (this.offset >= this.buffer.length) {
      throw new Error('Unexpected end of bencoded buffer');
    }
    const byte = this.buffer[this.offset];

    if (byte === 0x69) {
      // 'i' -> integer
      return this.decodeInteger();
    } else if (byte === 0x6c) {
      // 'l' -> list
      return this.decodeList();
    } else if (byte === 0x64) {
      // 'd' -> dictionary
      return this.decodeDictionary();
    } else if (byte >= 0x30 && byte <= 0x39) {
      // '0'..'9' -> byte string
      return this.decodeString();
    } else {
      throw new Error(`Invalid bencode token at offset ${this.offset}: 0x${byte.toString(16)}`);
    }
  }

  private decodeInteger(): number {
    this.offset++; // skip 'i'
    const start = this.offset;
    while (this.offset < this.buffer.length && this.buffer[this.offset] !== 0x65) {
      this.offset++;
    }
    if (this.offset >= this.buffer.length) {
      throw new Error('Unterminated bencode integer');
    }
    const str = this.buffer.toString('utf8', start, this.offset);
    this.offset++; // skip 'e'
    const num = parseInt(str, 10);
    if (isNaN(num)) {
      throw new Error(`Invalid integer representation: "${str}"`);
    }
    return num;
  }

  private decodeString(): Buffer {
    const colonIndex = this.buffer.indexOf(0x3a, this.offset); // ':'
    if (colonIndex === -1) {
      throw new Error('Missing colon in bencode string length prefix');
    }
    const lengthStr = this.buffer.toString('utf8', this.offset, colonIndex);
    const length = parseInt(lengthStr, 10);
    if (isNaN(length) || length < 0) {
      throw new Error(`Invalid bencode string length: ${lengthStr}`);
    }
    this.offset = colonIndex + 1;
    if (this.offset + length > this.buffer.length) {
      throw new Error(`String length ${length} exceeds remaining buffer`);
    }
    const result = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  private decodeList(): BencodeValue[] {
    this.offset++; // skip 'l'
    const list: BencodeValue[] = [];
    while (this.offset < this.buffer.length && this.buffer[this.offset] !== 0x65) {
      list.push(this.decode());
    }
    if (this.offset >= this.buffer.length) {
      throw new Error('Unterminated bencode list');
    }
    this.offset++; // skip 'e'
    return list;
  }

  private decodeDictionary(): { [key: string]: BencodeValue } {
    this.offset++; // skip 'd'
    const dict: { [key: string]: BencodeValue } = {};
    while (this.offset < this.buffer.length && this.buffer[this.offset] !== 0x65) {
      const keyBuffer = this.decodeString();
      const key = keyBuffer.toString('utf8');
      const value = this.decode();
      dict[key] = value;
    }
    if (this.offset >= this.buffer.length) {
      throw new Error('Unterminated bencode dictionary');
    }
    this.offset++; // skip 'e'
    return dict;
  }
}

/**
 * Finds the raw byte bounds of the "info" dictionary in a .torrent file to calculate the true SHA-1 hash.
 */
export function extractInfoHash(torrentBuffer: Buffer): { infoHash: string; infoBuffer: Buffer } {
  // Search for the key '4:info'
  const target = Buffer.from('4:info');
  const index = torrentBuffer.indexOf(target);
  if (index === -1) {
    throw new Error('Could not find 4:info dictionary in torrent buffer');
  }

  const infoStart = index + target.length;
  if (torrentBuffer[infoStart] !== 0x64) {
    throw new Error('Value of 4:info is not a dictionary (missing "d")');
  }

  // Parse this dictionary to find its exact end offset
  const decoder = new BencodeDecoder(torrentBuffer);
  // Hack to advance decoder to infoStart
  (decoder as unknown as { offset: number }).offset = infoStart;
  decoder.decode();
  const infoEnd = (decoder as unknown as { offset: number }).offset;

  const infoBuffer = torrentBuffer.subarray(infoStart, infoEnd);
  const infoHash = crypto.createHash('sha1').update(infoBuffer).digest('hex');
  return { infoHash, infoBuffer };
}

/**
 * Parses a .torrent buffer into structured metadata
 */
export function parseTorrentBuffer(buffer: Buffer): TorrentMetadata {
  const decoder = new BencodeDecoder(buffer);
  const root = decoder.decode() as Record<string, BencodeValue>;
  if (!root || typeof root !== 'object') {
    throw new Error('Invalid .torrent: Root is not a dictionary');
  }

  const { infoHash } = extractInfoHash(buffer);

  const info = root['info'] as Record<string, BencodeValue>;
  if (!info || typeof info !== 'object') {
    throw new Error('Invalid .torrent: Missing info dictionary');
  }

  const nameBuffer = info['name'] as Buffer;
  const name = nameBuffer ? nameBuffer.toString('utf8') : 'Unnamed-Torrent';

  const pieceLength = (info['piece length'] as number) || 262144; // default 256KB
  const piecesBuffer = info['pieces'] as Buffer;
  const piecesHashes: string[] = [];

  if (piecesBuffer && Buffer.isBuffer(piecesBuffer)) {
    for (let i = 0; i < piecesBuffer.length; i += 20) {
      piecesHashes.push(piecesBuffer.subarray(i, i + 20).toString('hex'));
    }
  }

  const files: TorrentMetadata['files'] = [];
  let totalSize = 0;

  if (info['files'] && Array.isArray(info['files'])) {
    // Multi-file torrent
    let currentOffset = 0;
    const fileEntries = info['files'] as Record<string, BencodeValue>[];
    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      const length = (entry['length'] as number) || 0;
      const pathList = (entry['path'] as Buffer[]) || [];
      const relPath = pathList.map(p => (Buffer.isBuffer(p) ? p.toString('utf8') : String(p))).join('/');
      const fileName = relPath.split('/').pop() || `file_${i}`;

      files.push({
        id: `f_${i}`,
        path: relPath,
        name: fileName,
        size: length,
        offset: currentOffset,
      });

      currentOffset += length;
      totalSize += length;
    }
  } else {
    // Single-file torrent
    const length = (info['length'] as number) || 0;
    totalSize = length;
    files.push({
      id: 'f_0',
      path: name,
      name: name,
      size: length,
      offset: 0,
    });
  }

  // Extract trackers
  const trackers: string[] = [];
  if (root['announce']) {
    const ann = root['announce'];
    trackers.push(Buffer.isBuffer(ann) ? ann.toString('utf8') : String(ann));
  }
  if (root['announce-list'] && Array.isArray(root['announce-list'])) {
    const list = root['announce-list'] as BencodeValue[][];
    for (const tier of list) {
      if (Array.isArray(tier)) {
        for (const tr of tier) {
          const trackerStr = Buffer.isBuffer(tr) ? tr.toString('utf8') : String(tr);
          if (trackerStr && !trackers.includes(trackerStr)) {
            trackers.push(trackerStr);
          }
        }
      }
    }
  }

  const commentBuffer = root['comment'] as Buffer;
  const createdByBuffer = root['created by'] as Buffer;
  const creationDate = root['creation date'] as number;

  return {
    name,
    infoHash: infoHash.toLowerCase(),
    totalSize,
    pieceLength,
    pieceCount: piecesHashes.length,
    piecesHashes,
    files,
    trackers,
    comment: commentBuffer ? commentBuffer.toString('utf8') : undefined,
    createdBy: createdByBuffer ? createdByBuffer.toString('utf8') : undefined,
    creationDate: creationDate ? creationDate * 1000 : undefined,
    isPrivate: (info['private'] as number) === 1,
  };
}

/**
 * Encodes basic JS objects into Bencode buffer
 */
export function bencodeEncode(value: unknown): Buffer {
  if (typeof value === 'number') {
    return Buffer.from(`i${Math.floor(value)}e`);
  }
  if (typeof value === 'string') {
    const buf = Buffer.from(value, 'utf8');
    return Buffer.concat([Buffer.from(`${buf.length}:`), buf]);
  }
  if (Buffer.isBuffer(value)) {
    return Buffer.concat([Buffer.from(`${value.length}:`), value]);
  }
  if (Array.isArray(value)) {
    const parts: Uint8Array[] = [Buffer.from('l')];
    for (const item of value) {
      parts.push(bencodeEncode(item));
    }
    parts.push(Buffer.from('e'));
    return Buffer.concat(parts);
  }
  if (typeof value === 'object' && value !== null) {
    const parts: Uint8Array[] = [Buffer.from('d')];
    // Keys in bencoded dictionaries must be sorted by raw bytes
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      parts.push(bencodeEncode(k));
      parts.push(bencodeEncode((value as Record<string, unknown>)[k]));
    }
    parts.push(Buffer.from('e'));
    return Buffer.concat(parts);
  }
  throw new Error(`Unsupported bencode type: ${typeof value}`);
}
