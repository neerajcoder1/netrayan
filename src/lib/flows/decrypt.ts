// Recipient-side flow: decrypt, then in the same session —
//   1. sign a decryption record with the recipient's own ML-DSA-65 secret key
//   2. derive a commitment-bound watermark id: wid = SHA-256(signature)[:32]
//      (the mark embedded in the file IS a fingerprint of the real signature —
//      not an arbitrary id paired with it after the fact)
//   3. embed that watermark invisibly into this recipient's copy
//   4. commit the signed record to the immutable ledger
// Every decrypted copy is visually identical; every one carries a different,
// non-repudiable, cryptographically self-consistent fingerprint.

import type { Distribution, Identity, DocumentRecord, WatermarkPayload, LedgerBlock } from "../types";
import { kemDecapsulate, dsaSign, ALGO_KEM, ALGO_SIG } from "../crypto/pqc";
import { aesDecrypt } from "../crypto/symmetric";
import { sha256Hex } from "../crypto/hash";
import { appendBlock } from "../ledger/ledger";
import { embedImageWatermark } from "../watermark/image";
import { embedPdfWatermark } from "../watermark/pdf";
import { shortId, utf8ToBytes } from "../util/encoding";

export interface DecryptResult {
  fileBytes: Uint8Array;
  block: LedgerBlock;
  payload: WatermarkPayload;
}

export function canonicalRecordString(fields: {
  sid: string;
  did: string;
  rid: string;
  docHash: string;
  ts: number;
}): string {
  return [fields.sid, fields.did, fields.rid, fields.docHash, fields.ts].join("|");
}

export async function performDecryption(
  dist: Distribution,
  recipient: Identity,
  doc: DocumentRecord,
): Promise<DecryptResult> {
  const sharedSecret = kemDecapsulate(dist.kemCipherTextB64, recipient.kem.secretKey);
  const plaintext = await aesDecrypt(dist.aesCipherB64, dist.aesIvB64, sharedSecret, dist.hkdfSaltB64);
  sharedSecret.fill(0);

  const sid = shortId("EVT", 6);
  const ts = Date.now();
  const canonical = canonicalRecordString({
    sid,
    did: doc.id,
    rid: recipient.id,
    docHash: doc.originalHash,
    ts,
  });
  const signature = dsaSign(utf8ToBytes(canonical), recipient.dsa.secretKey);

  const widFull = await sha256Hex(utf8ToBytes(signature));
  const wid = widFull.slice(0, 32);

  const payload: WatermarkPayload = {
    v: 1,
    wid,
    sid,
    did: doc.id,
    rid: recipient.id,
    ts,
    h: doc.originalHash.slice(0, 16),
  };

  const watermarked =
    doc.kind === "pdf"
      ? await embedPdfWatermark(plaintext, payload)
      : await embedImageWatermark(plaintext, payload);

  const releasedFileHash = await sha256Hex(watermarked);

  const block = await appendBlock({
    id: sid,
    timestamp: ts,
    documentId: doc.id,
    documentName: doc.name,
    documentKind: doc.kind,
    senderId: dist.senderId,
    recipientId: recipient.id,
    recipientName: recipient.name,
    watermarkId: wid,
    originalDocHash: doc.originalHash,
    releasedFileHash,
    signature,
    signerDsaPublicKey: recipient.dsa.publicKey,
    algoKem: ALGO_KEM,
    algoSig: ALGO_SIG,
  });

  return { fileBytes: watermarked, block, payload };
}
