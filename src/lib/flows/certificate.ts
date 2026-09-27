// "Sabha Protocol" — a k-of-n multi-party authorization gate on the forensic accusation
// itself. The ledger can always prove, on its own, exactly who decrypted a document; this
// layer governs the separate act of turning that proof into a named, actionable
// accusation. A quorum of independent custodians, each with their own ML-DSA-65 keypair,
// must individually countersign the certificate hash before it is "authorized". No single
// custodian — including a compromised one — can act alone.

import type { ForensicCertificate, CustodianSignature, Identity, LedgerBlock } from "../types";
import { sha256Hex } from "../crypto/hash";
import { dsaSign, dsaVerify } from "../crypto/pqc";
import { utf8ToBytes, shortId } from "../util/encoding";

function certificateBodyString(block: LedgerBlock): string {
  return [
    "NETRAYAN-FORENSIC-CERTIFICATE-V1",
    block.id,
    block.documentId,
    block.documentName,
    block.recipientId,
    block.recipientName,
    block.watermarkId,
    block.originalDocHash,
    block.releasedFileHash,
    block.signature,
  ].join("|");
}

export async function createCertificate(
  block: LedgerBlock,
  threshold: number,
  custodianPool: number,
): Promise<ForensicCertificate> {
  const certificateHash = await sha256Hex(utf8ToBytes(certificateBodyString(block)));
  return {
    id: shortId("CERT", 5),
    createdAt: Date.now(),
    ledgerBlockId: block.id,
    documentName: block.documentName,
    recipientId: block.recipientId,
    recipientName: block.recipientName,
    certificateHash,
    threshold,
    custodianPool,
    signatures: [],
    status: "awaiting_quorum",
  };
}

export function countersign(cert: ForensicCertificate, custodian: Identity): ForensicCertificate {
  if (cert.signatures.some((s) => s.custodianId === custodian.id)) return cert;
  const sig = dsaSign(utf8ToBytes(cert.certificateHash), custodian.dsa.secretKey);
  const signatures: CustodianSignature[] = [
    ...cert.signatures,
    {
      custodianId: custodian.id,
      custodianName: custodian.name,
      dsaPublicKey: custodian.dsa.publicKey,
      signature: sig,
      signedAt: Date.now(),
    },
  ];
  const status: ForensicCertificate["status"] = signatures.length >= cert.threshold ? "authorized" : "awaiting_quorum";
  return { ...cert, signatures, status };
}

export function verifyCertificate(cert: ForensicCertificate): { valid: boolean; validSignatures: number } {
  let validSignatures = 0;
  for (const s of cert.signatures) {
    if (dsaVerify(s.signature, utf8ToBytes(cert.certificateHash), s.dsaPublicKey)) validSignatures++;
  }
  return { valid: validSignatures >= cert.threshold, validSignatures };
}
