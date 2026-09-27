// Netrayan — shared domain types.
// "Netrayan" = Netra (eye) + the -ayan chronicle-suffix (as in Ramayana).
// The invisible eye embedded in every decrypted copy that reveals the path it travelled.

export type Role = "sender" | "recipient" | "custodian";

export interface KeyPairB64 {
  publicKey: string; // base64
  secretKey: string; // base64
}

export interface Identity {
  id: string; // short human id, e.g. "R-7F3A2C11"
  name: string;
  org?: string;
  role: Role;
  createdAt: number;
  kem: { publicKey: string; secretKey: string }; // ML-KEM-768 (FIPS 203)
  dsa: { publicKey: string; secretKey: string }; // ML-DSA-65 (FIPS 204)
}

/** Public-only projection of an Identity — this is what a "directory" would hold. */
export interface PublicIdentity {
  id: string;
  name: string;
  org?: string;
  role: Role;
  kemPublicKey: string;
  dsaPublicKey: string;
}

export type DocKind = "pdf" | "png";

export interface DocumentRecord {
  id: string;
  name: string;
  kind: DocKind;
  mime: string;
  size: number;
  originalHash: string; // sha256 hex of the plaintext bytes as uploaded
  createdAt: number;
  senderId: string;
  /** The original plaintext bytes, base64. In a real deployment this would never
   * leave the sender's custody in the clear once distributed — kept here only so the
   * demo can show the encrypt step operating on a real file. */
  originalBytesB64: string;
}

export interface Distribution {
  id: string;
  documentId: string;
  documentName: string;
  documentKind: DocKind;
  senderId: string;
  recipientId: string;
  recipientName: string;
  createdAt: number;
  kemCipherTextB64: string; // ML-KEM encapsulation output, wraps the content key
  aesIvB64: string;
  aesCipherB64: string; // AES-256-GCM ciphertext of the document bytes
  hkdfSaltB64: string;
  status: "pending" | "decrypted";
  decryptedAt?: number;
  ledgerBlockId?: string;
}

export interface WatermarkPayload {
  v: 1;
  wid: string; // watermark id — unique per decryption event
  sid: string; // session id — matches the ledger block id
  did: string; // document id
  rid: string; // recipient id
  ts: number; // epoch ms
  h: string; // first 16 hex chars of the original document's sha256
}

export interface LedgerBlock {
  index: number;
  id: string; // == WatermarkPayload.sid
  timestamp: number;
  documentId: string;
  documentName: string;
  documentKind: DocKind;
  senderId: string;
  recipientId: string;
  recipientName: string;
  watermarkId: string;
  originalDocHash: string; // sha256 of plaintext original
  releasedFileHash: string; // sha256 of the exact watermarked bytes handed to the recipient
  signature: string; // base64 ML-DSA-65 signature over the canonical record
  signerDsaPublicKey: string; // base64 — recipient's registered public key, pinned at signing time
  algoKem: string;
  algoSig: string;
  prevHash: string;
  hash: string;
}

export interface ForensicVerdict {
  extracted: boolean;
  payload?: WatermarkPayload;
  block?: LedgerBlock;
  fileHashMatches: boolean;
  signatureValid: boolean;
  commitmentValid: boolean; // wid === H(signature) — the watermark is provably derived from THIS signature
  chainIntactAtBlock: boolean;
  recipient?: PublicIdentity;
  notes: string[];
}

/** One custodian's countersignature on a Forensic Attribution Certificate ("Sabha Protocol"). */
export interface CustodianSignature {
  custodianId: string;
  custodianName: string;
  dsaPublicKey: string; // pinned at signing time
  signature: string; // base64 ML-DSA-65 signature over the certificate's canonical hash
  signedAt: number;
}

export interface ForensicCertificate {
  id: string;
  createdAt: number;
  ledgerBlockId: string;
  documentName: string;
  recipientId: string;
  recipientName: string;
  certificateHash: string; // sha256 of the canonical certificate body — what custodians actually sign
  threshold: number; // k
  custodianPool: number; // n
  signatures: CustodianSignature[];
  status: "awaiting_quorum" | "authorized";
}
