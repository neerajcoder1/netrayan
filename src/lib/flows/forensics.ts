// Forensics flow: given a leaked file, extract the watermark, look it up against the
// ledger, and independently re-verify every cryptographic claim — never trust anything
// read out of the leaked file itself except as a lookup key.

import type { ForensicVerdict, PublicIdentity, DocKind } from "../types";
import { extractImageWatermark } from "../watermark/image";
import { extractPdfWatermark } from "../watermark/pdf";
import { sha256Hex } from "../crypto/hash";
import { dsaVerify } from "../crypto/pqc";
import { loadLedger, verifyChain } from "../ledger/ledger";
import { utf8ToBytes } from "../util/encoding";
import { canonicalRecordString } from "./decrypt";

export async function investigateLeak(
  leakedBytes: Uint8Array,
  kind: DocKind,
  identityDirectory: PublicIdentity[],
): Promise<ForensicVerdict> {
  const notes: string[] = [];
  const payload = kind === "pdf" ? await extractPdfWatermark(leakedBytes) : await extractImageWatermark(leakedBytes);

  if (!payload) {
    return {
      extracted: false,
      fileHashMatches: false,
      signatureValid: false,
      commitmentValid: false,
      chainIntactAtBlock: false,
      notes: [
        "No embedded Netrayan watermark could be recovered from this file. Either it was never distributed through Netrayan, or it was recompressed/flattened by another tool in a way that destroyed the carrier — see Limitations.",
      ],
    };
  }

  const blocks = await loadLedger();
  const block = blocks.find((b) => b.id === payload.sid && b.watermarkId === payload.wid);
  if (!block) {
    notes.push(
      "A watermark payload was recovered, but no matching entry exists in this ledger. If this file came from a different Netrayan deployment, import that deployment's ledger export first.",
    );
    return {
      extracted: true,
      payload,
      fileHashMatches: false,
      signatureValid: false,
      commitmentValid: false,
      chainIntactAtBlock: false,
      notes,
    };
  }

  const fileHash = await sha256Hex(leakedBytes);
  const fileHashMatches = fileHash === block.releasedFileHash;
  if (!fileHashMatches) {
    notes.push(
      "This file's hash does not byte-match the ledger's recorded release hash — it may have been edited since decryption. The watermark still traces to the original recipient.",
    );
  }

  const canonical = canonicalRecordString({
    sid: block.id,
    did: block.documentId,
    rid: block.recipientId,
    docHash: block.originalDocHash,
    ts: block.timestamp,
  });
  const signatureValid = dsaVerify(block.signature, utf8ToBytes(canonical), block.signerDsaPublicKey);
  if (!signatureValid) notes.push("The ML-DSA signature failed to verify against the recorded public key.");

  const widCheck = (await sha256Hex(utf8ToBytes(block.signature))).slice(0, 32);
  const commitmentValid = widCheck === block.watermarkId;
  if (!commitmentValid) {
    notes.push("Commitment check failed — the watermark id does not hash-match the recorded signature.");
  }

  const chainResult = await verifyChain(blocks);
  const chainIntactAtBlock = chainResult.brokenAtIndex === null || chainResult.brokenAtIndex > block.index;
  if (!chainIntactAtBlock) {
    notes.push(
      `Ledger integrity check FAILED at or before block #${block.index} — the audit trail has been tampered with upstream of this record.`,
    );
  }

  const recipient = identityDirectory.find((p) => p.id === block.recipientId);

  if (fileHashMatches && signatureValid && commitmentValid && chainIntactAtBlock) {
    notes.push(
      "All checks passed: this exact copy is cryptographically traced to a single recipient, with a non-repudiable signature bound to the invisible watermark.",
    );
  }

  return {
    extracted: true,
    payload,
    block,
    fileHashMatches,
    signatureValid,
    commitmentValid,
    chainIntactAtBlock,
    recipient,
    notes,
  };
}
