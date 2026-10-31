import test from "node:test";
import assert from "node:assert/strict";
import { buildShareUrl, parseShareLocation, getExpiryTimestamp, isExpired, createShareCredentials } from "../lib/share.js";

test("share credentials contain an unguessable id and private key", () => {
  const credentials = createShareCredentials();
  assert.match(credentials.id, /^[a-f0-9]{32}$/);
  assert.match(credentials.secret, /^[a-f0-9]{64}$/);
  assert.notEqual(credentials.id, credentials.secret);
});
test("share links keep the secret in the URL fragment", () => {
  const url = buildShareUrl("https://example.test/torrentwide/", "a".repeat(32), "b".repeat(64), 1900000000000);
  const parsed = parseShareLocation({ href: url });
  assert.equal(parsed.id, "a".repeat(32));
  assert.equal(parsed.secret, "b".repeat(64));
  assert.equal(parsed.expiresAt, 1900000000000);
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
