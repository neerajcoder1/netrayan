// Symmetric envelope layer: the document itself is encrypted once with AES-256-GCM
// (via the browser's native WebCrypto — FIPS-approved, no polyfill), using a key
// derived (HKDF-SHA256) from the ML-KEM shared secret established per recipient.
// This is the standard hybrid-PQC pattern: KEM to agree a secret, AEAD to move bulk data.

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToBase64, base64ToBytes, utf8ToBytes } from "../util/encoding";

const HKDF_INFO = utf8ToBytes("netrayan/content-key/v1");

export async function deriveAesKey(sharedSecret: Uint8Array, saltB64: string): Promise<CryptoKey> {
  const salt = base64ToBytes(saltB64);
  const okm = hkdf(sha256, sharedSecret, salt, HKDF_INFO, 32);
  return crypto.subtle.importKey("raw", okm as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function randomSaltB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function aesEncrypt(
  plaintext: Uint8Array,
  sharedSecret: Uint8Array,
  saltB64: string,
): Promise<{ ivB64: string; cipherB64: string }> {
  const key = await deriveAesKey(sharedSecret, saltB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext as BufferSource);
  return { ivB64: bytesToBase64(iv), cipherB64: bytesToBase64(new Uint8Array(cipherBuf)) };
}

export async function aesDecrypt(
  cipherB64: string,
  ivB64: string,
  sharedSecret: Uint8Array,
  saltB64: string,
): Promise<Uint8Array> {
  const key = await deriveAesKey(sharedSecret, saltB64);
  const iv = base64ToBytes(ivB64);
  const cipher = base64ToBytes(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, cipher as BufferSource);
  return new Uint8Array(plainBuf);
}
