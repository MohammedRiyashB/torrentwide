import test from "node:test";
import assert from "node:assert/strict";
import { buildShareUrl, parseShareLocation, getExpiryTimestamp, isExpired, createShareCredentials, verifyShareCredentials } from "../lib/share.js";

test("share credentials bind a random secret to its expiry", async () => {
  const expiresAt = 1800000000000;
  const credentials = await createShareCredentials(expiresAt);
  assert.match(credentials.id, /^[a-f0-9]{32}$/);
  assert.match(credentials.secret, /^[a-f0-9]{64}$/);
  assert.equal(await verifyShareCredentials(credentials.id, credentials.secret, expiresAt), true);
  assert.equal(await verifyShareCredentials(credentials.id, "f".repeat(64), expiresAt), false);
  assert.equal(await verifyShareCredentials(credentials.id, credentials.secret, expiresAt + 1), false);
});
test("share links keep the secret in the URL fragment", async () => {
  const expiresAt = 1900000000000;
  const credentials = await createShareCredentials(expiresAt);
  const url = buildShareUrl("https://example.test/torrentwide/", credentials.id, credentials.secret, expiresAt);
  const parsed = parseShareLocation({ href: url });
  assert.equal(parsed.id, credentials.id);
  assert.equal(parsed.secret, credentials.secret);
  assert.equal(parsed.expiresAt, expiresAt);
  assert.equal(new URL(url).searchParams.has("key"), false);
});
test("invalid share links are rejected", () => {
  assert.equal(parseShareLocation({ href: "https://example.test/?share=bad&exp=1#key=x" }), null);
});
test("expiry options calculate exact day windows", () => {
  const now = 1700000000000;
  assert.equal(getExpiryTimestamp(1, now), now + 86400000);
  assert.equal(getExpiryTimestamp(7, now), now + 7 * 86400000);
  assert.equal(getExpiryTimestamp(30, now), now + 30 * 86400000);
  assert.throws(() => getExpiryTimestamp(2, now), /Choose/);
});
test("expired and live links are distinguished", () => {
  assert.equal(isExpired(1000, 1000), true);
  assert.equal(isExpired(1001, 1000), false);
  assert.equal(isExpired(NaN, 1000), true);
});
