import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MongoClient } from "mongodb";

let cachedProvider = null;

function decodeUrlSafeBase64(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
    "base64",
  );
}

export function decryptFernet(tokenValue, keyValue) {
  const key = decodeUrlSafeBase64(String(keyValue).trim());
  const token = decodeUrlSafeBase64(String(tokenValue).trim());
  if (key.length !== 32 || token.length < 73 || token[0] !== 0x80)
    throw new Error("Invalid encrypted provider credential.");

  const signed = token.subarray(0, -32);
  const suppliedSignature = token.subarray(-32);
  const expectedSignature = crypto
    .createHmac("sha256", key.subarray(0, 16))
    .update(signed)
    .digest();
  if (!crypto.timingSafeEqual(suppliedSignature, expectedSignature))
    throw new Error("NovelForge provider credential signature is invalid.");

  const iv = token.subarray(9, 25);
  const ciphertext = token.subarray(25, -32);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key.subarray(16), iv);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export async function loadNovelForgeGeminiProvider() {
  if (cachedProvider) return cachedProvider;
  const mongoUrl =
    process.env.NOVELFORGE_MONGODB_URL || "mongodb://127.0.0.1:27017";
  const databaseName = process.env.NOVELFORGE_DATABASE_NAME || "novelforge";
  const keyFile =
    process.env.NOVELFORGE_SETTINGS_KEY_FILE ||
    path.join(os.homedir(), ".novelforge", "settings.key");
  if (!fs.existsSync(keyFile))
    throw new Error("NovelForge settings encryption key was not found.");

  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    const document = await client
      .db(databaseName)
      .collection("app_settings")
      .findOne({ _id: "global_settings" });
    const config = document?.providers?.gemini;
    if (!config?.api_key_encrypted)
      throw new Error("NovelForge has no configured Gemini provider.");
    const apiKey = decryptFernet(
      config.api_key_encrypted,
      fs.readFileSync(keyFile, "utf8"),
    );
    cachedProvider = {
      apiKey,
      model: config.model || "gemini-3.1-flash-lite",
      source: "NovelForge encrypted provider store",
    };
    return cachedProvider;
  } finally {
    await client.close();
  }
}

export async function resolveGeminiProvider() {
  if (process.env.GEMINI_API_KEY) {
    return {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      source: "Local environment",
    };
  }
  return loadNovelForgeGeminiProvider();
}

export async function geminiProviderStatus() {
  try {
    const provider = await resolveGeminiProvider();
    return { configured: true, model: provider.model, source: provider.source };
  } catch (error) {
    return {
      configured: false,
      model: "gemini-3.1-flash-lite",
      source: null,
      error: error.message,
    };
  }
}
