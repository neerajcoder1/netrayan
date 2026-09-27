// Watermark payload wire format, shared by the image (LSB) and PDF (invisible text layer)
// carriers. Wire layout:  [4-byte big-endian length][JSON body][4-byte SHA-256 checksum]
// The checksum lets an extractor tell "no watermark" apart from "corrupted watermark".

import type { WatermarkPayload } from "../types";
import { utf8ToBytes, bytesToUtf8 } from "../util/encoding";
import { sha256Bytes } from "../crypto/hash";

export async function encodePayloadBytes(payload: WatermarkPayload): Promise<Uint8Array> {
  const body = utf8ToBytes(JSON.stringify(payload));
  const checksum = (await sha256Bytes(body)).slice(0, 4);
  const out = new Uint8Array(4 + body.length + 4);
  new DataView(out.buffer).setUint32(0, body.length, false);
  out.set(body, 4);
  out.set(checksum, 4 + body.length);
  return out;
}

export async function decodePayloadBytes(bytes: Uint8Array): Promise<WatermarkPayload | null> {
  if (bytes.length < 8) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(0, false);
  if (len <= 0 || len > 4096 || 4 + len + 4 > bytes.length) return null;
  const body = bytes.slice(4, 4 + len);
  const checksum = bytes.slice(4 + len, 4 + len + 4);
  const expected = (await sha256Bytes(body)).slice(0, 4);
  for (let i = 0; i < 4; i++) if (checksum[i] !== expected[i]) return null;
  try {
    const obj = JSON.parse(bytesToUtf8(body));
    if (obj && obj.v === 1 && obj.wid && obj.sid && obj.did && obj.rid) {
      return obj as WatermarkPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- bit-level helpers, used by the LSB image carrier ----

export function bytesToBits(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 0; b < 8; b++) {
      bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
    }
  }
  return bits;
}

export function bitsToBytes(bits: Uint8Array): Uint8Array {
  const byteLen = Math.floor(bits.length / 8);
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
    out[i] = v;
  }
  return out;
}

export function bitsToUint32(bits32: Uint8Array): number {
  let v = 0;
  for (let i = 0; i < 32; i++) v = (v * 2 + bits32[i]) >>> 0;
  return v;
}

export async function payloadToBits(payload: WatermarkPayload): Promise<Uint8Array> {
  return bytesToBits(await encodePayloadBytes(payload));
}
