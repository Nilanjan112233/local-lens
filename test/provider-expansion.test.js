import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildSearchPlan } from "../server/providers.js";
import { decryptFernet } from "../server/novelforge-provider.js";

function urlSafe(buffer) {
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_");
}

function createFernetToken(value, key) {
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const iv = Buffer.alloc(16, 7);
  const cipher = crypto.createCipheriv("aes-128-cbc", key.subarray(16), iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  const signed = Buffer.concat([
    Buffer.from([0x80]),
    timestamp,
    iv,
    ciphertext,
  ]);
  const signature = crypto
    .createHmac("sha256", key.subarray(0, 16))
    .update(signed)
    .digest();
  return urlSafe(Buffer.concat([signed, signature]));
}

test("standard all-business discovery expands to eight category searches", () => {
  const plan = buildSearchPlan("All businesses", "standard");
  assert.equal(plan.queries.length, 8);
  assert.equal(plan.pagesPerQuery, 1);
});

test("deep discovery uses twelve categories and two pages", () => {
  const plan = buildSearchPlan("All businesses", "deep");
  assert.equal(plan.queries.length, 12);
  assert.equal(plan.pagesPerQuery, 2);
});

test("decrypts a NovelForge-compatible Fernet credential", () => {
  const key = crypto.randomBytes(32);
  const token = createFernetToken("test-secret-key", key);
  assert.equal(decryptFernet(token, urlSafe(key)), "test-secret-key");
});
