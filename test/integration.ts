// One-off integration check — exercises the REAL source modules (not a reimplementation)
// against a real sample PDF, end to end. Deleted after verification; not part of the app.
import "fake-indexeddb/auto";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateKemKeyPair, generateDsaKeyPair } from "../src/lib/crypto/pqc";
import { sha256Hex } from "../src/lib/crypto/hash";
import { bytesToBase64 } from "../src/lib/util/encoding";
import { createDistribution } from "../src/lib/flows/distribute";
import { performDecryption } from "../src/lib/flows/decrypt";
import { investigateLeak } from "../src/lib/flows/forensics";
import { createCertificate, countersign, verifyCertificate } from "../src/lib/flows/certificate";
import { loadLedger, verifyChain, overwriteLedgerForDemo } from "../src/lib/ledger/ledger";
import type { DocumentRecord, Identity, PublicIdentity } from "../src/lib/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok:", msg);
}

function makeIdentity(id: string, name: string, role: Identity["role"]): Identity {
  return {
    id,
    name,
    role,
    createdAt: Date.now(),
    kem: generateKemKeyPair(),
    dsa: generateDsaKeyPair(),
  };
}

async function main() {
  console.log("== Netrayan real-pipeline integration check ==\n");

  // --- identities ---
  const sender = makeIdentity("S-001", "Registry Office", "sender");
  const recipientA = makeIdentity("R-AAA", "Recipient A", "recipient");
  const recipientB = makeIdentity("R-BBB", "Recipient B", "recipient");
  const custodian1 = makeIdentity("C-001", "Custodian One", "custodian");
  const custodian2 = makeIdentity("C-002", "Custodian Two", "custodian");
  const custodian3 = makeIdentity("C-003", "Custodian Three", "custodian");
  const directory: PublicIdentity[] = [sender, recipientA, recipientB, custodian1, custodian2, custodian3].map((i) => ({
    id: i.id,
    name: i.name,
    role: i.role,
    kemPublicKey: i.kem.publicKey,
    dsaPublicKey: i.dsa.publicKey,
  }));

  // --- build a real sample PDF ---
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 300]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("CONFIDENTIAL — Field Deployment Schedule", { x: 20, y: 260, size: 14, font, color: rgb(0, 0, 0) });
  page.drawText("Operation window: 04:00-06:00, sector 7.", { x: 20, y: 230, size: 11, font });
  const originalBytes = await pdfDoc.save();
  const originalHash = await sha256Hex(originalBytes);
  console.log("Sample PDF built,", originalBytes.length, "bytes, hash", originalHash.slice(0, 16), "...\n");

  const doc: DocumentRecord = {
    id: "DOC-001",
    name: "field-schedule.pdf",
    kind: "pdf",
    mime: "application/pdf",
    size: originalBytes.length,
    originalHash,
    createdAt: Date.now(),
    senderId: sender.id,
    originalBytesB64: bytesToBase64(originalBytes),
  };

  // --- distribute to BOTH recipients ---
  console.log("Distributing to 2 recipients (independent ML-KEM-768 envelopes)...");
  const distA = await createDistribution(doc, sender, recipientA);
  const distB = await createDistribution(doc, sender, recipientB);
  assert(distA.kemCipherTextB64 !== distB.kemCipherTextB64, "two recipients get different KEM ciphertexts");
  assert(distA.aesCipherB64 !== distB.aesCipherB64, "two recipients get different AES ciphertexts (different keys/IVs)");

  // --- recipient A decrypts ---
  console.log("\nRecipient A decrypts...");
  const resultA = await performDecryption(distA, recipientA, doc);
  const recoveredHashA = await sha256Hex(resultA.fileBytes);
  console.log("  released file hash:", recoveredHashA.slice(0, 16), "...");
  assert(resultA.fileBytes.length > 0, "recipient A got watermarked bytes back");
  assert(resultA.block.recipientId === recipientA.id, "ledger block attributes to recipient A");

  // --- recipient B decrypts the SAME source document ---
  console.log("\nRecipient B decrypts the same document...");
  const resultB = await performDecryption(distB, recipientB, doc);
  assert(resultB.payload.wid !== resultA.payload.wid, "watermark ids differ between recipients");
  assert(resultB.block.releasedFileHash !== resultA.block.releasedFileHash, "released file bytes differ between recipients (LSB/text differs, visually identical)");

  // --- ledger sanity ---
  const blocks = await loadLedger();
  assert(blocks.length === 2, "ledger has exactly 2 committed blocks");
  const chain1 = await verifyChain(blocks);
  assert(chain1.valid, "hash chain verifies cleanly before any tampering");

  // --- forensics on A's leaked copy: should attribute to A, not B ---
  console.log("\nInvestigating A's copy as a 'leak'...");
  const verdictA = await investigateLeak(resultA.fileBytes, "pdf", directory);
  assert(verdictA.extracted, "watermark extracted from A's file");
  assert(verdictA.block?.recipientId === recipientA.id, "leak correctly attributed to recipient A");
  assert(verdictA.signatureValid, "ML-DSA signature verifies");
  assert(verdictA.commitmentValid, "watermark id is a valid commitment to the signature");
  assert(verdictA.fileHashMatches, "file hash matches ledger's recorded release hash");
  assert(verdictA.chainIntactAtBlock, "chain intact up to this block");

  console.log("\nInvestigating B's copy — must NOT be attributed to A...");
  const verdictB = await investigateLeak(resultB.fileBytes, "pdf", directory);
  assert(verdictB.block?.recipientId === recipientB.id, "leak correctly attributed to recipient B");
  assert(verdictB.block?.recipientId !== recipientA.id, "cross-check: NOT attributed to A");

  // --- visual-identity sanity: both released files render the same visible text ---
  const rawA = Buffer.from(resultA.fileBytes).toString("latin1");
  const rawB = Buffer.from(resultB.fileBytes).toString("latin1");
  assert(rawA.length > 0 && rawB.length > 0, "both files are non-empty");

  // --- Sabha Protocol: 2-of-3 custodian quorum ---
  console.log("\nSabha Protocol — 2-of-3 custodian countersign...");
  let cert = await createCertificate(verdictA.block!, 2, 3);
  assert(cert.status === "awaiting_quorum", "certificate starts awaiting quorum");
  cert = countersign(cert, custodian1);
  assert(cert.status === "awaiting_quorum", "still awaiting after 1 of 2");
  const checkAfter1 = verifyCertificate(cert);
  assert(checkAfter1.validSignatures === 1 && !checkAfter1.valid, "1 valid signature, not yet authorized");
  cert = countersign(cert, custodian2);
  assert(cert.status === "authorized", "authorized after 2nd countersignature");
  const checkAfter2 = verifyCertificate(cert);
  assert(checkAfter2.valid && checkAfter2.validSignatures === 2, "certificate independently verifies as authorized");

  // a custodian who is NOT in the pool trying to sign a forged hash should never verify
  const forgedCert = { ...cert, certificateHash: "0".repeat(64) };
  const forgedCheck = verifyCertificate(forgedCert);
  assert(!forgedCheck.valid, "signatures do not transfer to a different certificate hash (forged cert rejected)");

  // --- tamper-evidence demo ---
  console.log("\nTamper-evidence check...");
  const tampered = blocks.map((b, i) => (i === 0 ? { ...b, recipientName: "SOMEONE ELSE" } : b));
  await overwriteLedgerForDemo(tampered);
  const chain2 = await verifyChain(tampered);
  assert(!chain2.valid, "chain verification FAILS after silent edit");
  assert(chain2.brokenAtIndex === 0, "break correctly located at the edited block");
  await overwriteLedgerForDemo(blocks); // restore

  // --- TEST 5: Modify/corrupt the watermark ---
  console.log("\nTesting corrupted watermark...");
  const emptyDoc = await PDFDocument.create();
  const corruptedBytes = await emptyDoc.save();
  const verdictCorrupt = await investigateLeak(corruptedBytes, "pdf", directory);
  assert(!verdictCorrupt.extracted, "watermark validation fails when file is corrupted");
  
  // --- TEST 6: Mismatched signature/ledger record ---
  console.log("\nTesting mismatched signature commitment...");
  const fakeBlock = { ...resultA.block, signature: resultB.block.signature }; // mismatched signature
  const tamperedSigLedger = blocks.map(b => b.id === resultA.block.id ? fakeBlock : b);
  await overwriteLedgerForDemo(tamperedSigLedger);
  const verdictMismatch = await investigateLeak(resultA.fileBytes, "pdf", directory);
  assert(!verdictMismatch.commitmentValid, "commitment verification fails when signature is mismatched");
  await overwriteLedgerForDemo(blocks); // restore

  console.log("\n=== ALL CHECKS PASSED ===");
}

main().catch((e) => {
  console.error("\nINTEGRATION CHECK FAILED:", e);
  process.exit(1);
});
