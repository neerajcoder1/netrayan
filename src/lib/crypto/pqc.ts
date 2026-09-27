// Real NIST-standardized post-quantum primitives, running entirely client-side.
//   Key exchange:      ML-KEM-768  (FIPS 203, formerly CRYSTALS-Kyber)
//   Digital signature:  ML-DSA-65  (FIPS 204, formerly CRYSTALS-Dilithium)
// No cloud KMS, no server round-trip: keys never leave the browser tab that generated them.

import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { bytesToBase64, base64ToBytes } from "../util/encoding";
import type { KeyPairB64 } from "../types";

export const ALGO_KEM = "ML-KEM-768 (FIPS 203)";
export const ALGO_SIG = "ML-DSA-65 (FIPS 204)";

export function generateKemKeyPair(): KeyPairB64 {
  const seed = crypto.getRandomValues(new Uint8Array(ml_kem768.lengths.seed!));
  const { publicKey, secretKey } = ml_kem768.keygen(seed);
  return { publicKey: bytesToBase64(publicKey), secretKey: bytesToBase64(secretKey) };
}

export function generateDsaKeyPair(): KeyPairB64 {
  const seed = crypto.getRandomValues(new Uint8Array(ml_dsa65.lengths.seed!));
  const { publicKey, secretKey } = ml_dsa65.keygen(seed);
  return { publicKey: bytesToBase64(publicKey), secretKey: bytesToBase64(secretKey) };
}

/** Sender side: encapsulate a fresh shared secret against the recipient's ML-KEM public key. */
export function kemEncapsulate(recipientKemPublicKeyB64: string): {
  cipherTextB64: string;
  sharedSecret: Uint8Array;
} {
  const pk = base64ToBytes(recipientKemPublicKeyB64);
  const msg = crypto.getRandomValues(new Uint8Array(ml_kem768.lengths.msgRand!));
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(pk, msg);
  return { cipherTextB64: bytesToBase64(cipherText), sharedSecret };
}

/** Recipient side: recover the same shared secret from the encapsulation using their secret key. */
export function kemDecapsulate(cipherTextB64: string, recipientKemSecretKeyB64: string): Uint8Array {
  const ct = base64ToBytes(cipherTextB64);
  const sk = base64ToBytes(recipientKemSecretKeyB64);
  return ml_kem768.decapsulate(ct, sk);
}

/** Recipient signs a decryption record with their own ML-DSA secret key — non-repudiation. */
export function dsaSign(message: Uint8Array, secretKeyB64: string): string {
  const sk = base64ToBytes(secretKeyB64);
  const sig = ml_dsa65.sign(message, sk);
  return bytesToBase64(sig);
}

export function dsaVerify(sigB64: string, message: Uint8Array, publicKeyB64: string): boolean {
  try {
    const sig = base64ToBytes(sigB64);
    const pk = base64ToBytes(publicKeyB64);
    return ml_dsa65.verify(sig, message, pk);
  } catch {
    return false;
  }
}
