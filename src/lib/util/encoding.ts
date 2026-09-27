// Byte <-> text encoding helpers. Browser-only (btoa/atob), which is fine: every
// module that imports this is used from client components.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : "0" + hex;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return arr;
}

export function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function bytesToUtf8(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

/** Short, human-scannable IDs — not cryptographic identifiers themselves, just labels. */
export function shortId(prefix: string, byteLen = 4): string {
  const arr = new Uint8Array(byteLen);
  crypto.getRandomValues(arr);
  return `${prefix}-${bytesToHex(arr).toUpperCase()}`;
}

export function fingerprint(b64: string, len = 10): string {
  // Display-only fingerprint (not a hash truncation of secret material logic —
  // callers pass public keys / hex hashes only).
  return b64.replace(/[^A-Za-z0-9]/g, "").slice(0, len).toUpperCase();
}
