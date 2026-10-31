const ID_BYTES = 16;
const SECRET_BYTES = 32;
export const DEFAULT_CHUNK_SIZE = 256 * 1024;
export const MAX_CHUNK_SIZE = 1024 * 1024;
export const EXPIRY_OPTIONS = Object.freeze([1, 7, 30]);

function randomToken(bytes) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, (v) => v.toString(16).padStart(2, "0")).join("");
}
export async function createShareCredentials(expiresAt) {
  const secret = randomToken(SECRET_BYTES);
  const raw = Uint8Array.from(secret.match(/.{2}/g), (pair) => parseInt(pair, 16));
  const digest = await crypto.subtle.digest("SHA-256", raw);
  const id = Array.from(new Uint8Array(digest).slice(0, ID_BYTES), (v) => v.toString(16).padStart(2, "0")).join("");
  return { id, secret };
}
export async function verifyShareCredentials(id, secret, expiresAt) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) return false;
  const raw = Uint8Array.from(secret.match(/.{2}/g), (pair) => parseInt(pair, 16));
  const digest = await crypto.subtle.digest("SHA-256", raw);
  const expected = Array.from(new Uint8Array(digest).slice(0, ID_BYTES), (v) => v.toString(16).padStart(2, "0")).join("");
  return expected === id.toLowerCase();
}
export function buildShareUrl(baseUrl, id, secret, expiresAt) {
  const url = new URL(baseUrl);
  url.searchParams.set("share", id);
  url.searchParams.set("exp", String(expiresAt));
  url.hash = new URLSearchParams({ key: secret }).toString();
  return url.toString();
}
export function parseShareLocation(locationLike) {
  const url = new URL(locationLike.href);
  const id = url.searchParams.get("share") || "";
  const expiresAt = Number(url.searchParams.get("exp"));
  const secret = new URLSearchParams(url.hash.slice(1)).get("key") || "";
  if (!/^[a-f0-9]{32}$/i.test(id) || !/^[a-f0-9]{64}$/i.test(secret) || !Number.isFinite(expiresAt)) return null;
  return { id: id.toLowerCase(), secret: secret.toLowerCase(), expiresAt };
}
export function getExpiryTimestamp(days, now = Date.now()) {
  if (days !== "custom" && !EXPIRY_OPTIONS.includes(Number(days))) throw new Error("Choose 1, 7, 30 days or a custom expiry.");
  const value = days === "custom" ? 30 : Number(days);
  return now + value * 24 * 60 * 60 * 1000;
}
export async function deriveShareKey(secret) {
  const raw = Uint8Array.from(secret.match(/.{2}/g) || [], (pair) => parseInt(pair, 16));
  if (raw.length !== SECRET_BYTES) throw new Error("Invalid private share key.");
  const material = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("torrentwide-share-v1:" + expiresAt), info: new TextEncoder().encode("file-transfer") },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
export async function encryptManifest(manifest, secret) {
  const key = await deriveShareKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(manifest));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
}
export async function decryptManifest(payload, secret) {
  const key = await deriveShareKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(payload.iv) }, key, new Uint8Array(payload.data));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
export async function sha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
}
export async function createChunkManifest(file, chunkSize = DEFAULT_CHUNK_SIZE) {
  if (!(file instanceof Blob)) throw new TypeError("A browser File is required.");
  const chunks = [];
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    chunks.push({ index: chunks.length, size: Math.min(chunkSize, file.size - offset), hash: await sha256(await file.slice(offset, offset + chunkSize).arrayBuffer()) });
  }
  return { name: file.name || "shared-file", size: file.size, type: file.type || "application/octet-stream", chunkSize, chunks, hash: await sha256(await file.arrayBuffer()) };
}
export function isExpired(expiresAt, now = Date.now()) {
  return !Number.isFinite(Number(expiresAt)) || Number(expiresAt) <= now;
}
