// Hash-chained, append-only ledger — the "offline DLT" layer. Each block's hash commits
// to every field of the block plus the previous block's hash, so altering any field of
// any historical block, or deleting one, is detectable by any party who recomputes the
// chain — no special server or privileged process required to catch it.
//
// Persisted in IndexedDB (this browser tab acting as one local ledger node). Export/Import
// as JSON simulate the real deployment's air-gapped node-to-node sync over removable media.

import { get, set } from "idb-keyval";
import { sha256Hex } from "../crypto/hash";
import type { LedgerBlock } from "../types";
import { utf8ToBytes } from "../util/encoding";

const LEDGER_KEY = "netrayan-ledger-v1";
export const GENESIS_PREV = "0".repeat(64);

export async function loadLedger(): Promise<LedgerBlock[]> {
  const data = await get<LedgerBlock[]>(LEDGER_KEY);
  return data ?? [];
}

export async function saveLedgerRaw(blocks: LedgerBlock[]): Promise<void> {
  await set(LEDGER_KEY, blocks);
}

function canonicalBlockString(b: Omit<LedgerBlock, "hash">): string {
  // Explicit field order — never rely on JSON.stringify key order for anything hashed.
  return [
    b.index,
    b.id,
    b.timestamp,
    b.documentId,
    b.documentName,
    b.documentKind,
    b.senderId,
    b.recipientId,
    b.recipientName,
    b.watermarkId,
    b.originalDocHash,
    b.releasedFileHash,
    b.signature,
    b.signerDsaPublicKey,
    b.algoKem,
    b.algoSig,
    b.prevHash,
  ].join("|");
}

export async function computeBlockHash(b: Omit<LedgerBlock, "hash">): Promise<string> {
  return sha256Hex(utf8ToBytes(canonicalBlockString(b)));
}

export async function appendBlock(
  partial: Omit<LedgerBlock, "index" | "prevHash" | "hash">,
): Promise<LedgerBlock> {
  const blocks = await loadLedger();
  const prevHash = blocks.length ? blocks[blocks.length - 1].hash : GENESIS_PREV;
  const index = blocks.length;
  const withoutHash: Omit<LedgerBlock, "hash"> = { ...partial, index, prevHash };
  const hash = await computeBlockHash(withoutHash);
  const block: LedgerBlock = { ...withoutHash, hash };
  blocks.push(block);
  await saveLedgerRaw(blocks);
  return block;
}

export interface ChainVerifyDetail {
  index: number;
  hashOk: boolean; // recomputing this block's own hash from its fields matches the stored hash
  linkOk: boolean; // this block's prevHash matches the previous block's stored hash
}

export interface ChainVerifyResult {
  valid: boolean;
  brokenAtIndex: number | null;
  details: ChainVerifyDetail[];
}

export async function verifyChain(blocks: LedgerBlock[]): Promise<ChainVerifyResult> {
  const details: ChainVerifyDetail[] = [];
  let brokenAtIndex: number | null = null;
  let prevHash = GENESIS_PREV;
  for (const b of blocks) {
    const { hash, ...rest } = b;
    const recomputed = await computeBlockHash(rest);
    const hashOk = recomputed === hash;
    const linkOk = rest.prevHash === prevHash;
    if ((!hashOk || !linkOk) && brokenAtIndex === null) brokenAtIndex = b.index;
    details.push({ index: b.index, hashOk, linkOk });
    prevHash = hash;
  }
  return { valid: brokenAtIndex === null, brokenAtIndex, details };
}

/** Used only by the tamper-evidence demo, to write back a deliberately-edited chain. */
export async function overwriteLedgerForDemo(blocks: LedgerBlock[]): Promise<void> {
  await saveLedgerRaw(blocks);
}

export async function clearLedger(): Promise<void> {
  await saveLedgerRaw([]);
}

export function exportLedgerJson(blocks: LedgerBlock[]): string {
  return JSON.stringify({ format: "netrayan-ledger-export-v1", exportedAt: Date.now(), blocks }, null, 2);
}

export function parseLedgerJson(text: string): LedgerBlock[] {
  const obj = JSON.parse(text);
  if (!obj || !Array.isArray(obj.blocks)) throw new Error("Not a Netrayan ledger export file.");
  return obj.blocks as LedgerBlock[];
}
