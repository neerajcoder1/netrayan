// Sender-side flow: build a per-recipient distribution envelope.
//   AES-256-GCM(document, key)  where  key = HKDF( ML-KEM-768 shared secret )
// The recipient's ML-KEM ciphertext is what lets *only* them recover that key.

import type { DocumentRecord, Distribution, Identity } from "../types";
import { kemEncapsulate } from "../crypto/pqc";
import { aesEncrypt, randomSaltB64 } from "../crypto/symmetric";
import { base64ToBytes, shortId } from "../util/encoding";

export async function createDistribution(
  doc: DocumentRecord,
  sender: Identity,
  recipient: Identity,
): Promise<Distribution> {
  const plaintext = base64ToBytes(doc.originalBytesB64);
  const { cipherTextB64, sharedSecret } = kemEncapsulate(recipient.kem.publicKey);
  const hkdfSaltB64 = randomSaltB64();
  const { ivB64, cipherB64 } = await aesEncrypt(plaintext, sharedSecret, hkdfSaltB64);
  sharedSecret.fill(0);

  return {
    id: shortId("DIST", 5),
    documentId: doc.id,
    documentName: doc.name,
    documentKind: doc.kind,
    senderId: sender.id,
    recipientId: recipient.id,
    recipientName: recipient.name,
    createdAt: Date.now(),
    kemCipherTextB64: cipherTextB64,
    aesIvB64: ivB64,
    aesCipherB64: cipherB64,
    hkdfSaltB64,
    status: "pending",
  };
}
