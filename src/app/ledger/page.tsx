"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { SectionHeading, Pill, EmptyState, Hash } from "@/components/ui";
import {
  verifyChain,
  overwriteLedgerForDemo,
  exportLedgerJson,
  parseLedgerJson,
  type ChainVerifyResult,
} from "@/lib/ledger/ledger";
import { dsaVerify } from "@/lib/crypto/pqc";
import { canonicalRecordString } from "@/lib/flows/decrypt";
import { utf8ToBytes } from "@/lib/util/encoding";
import type { LedgerBlock } from "@/lib/types";
import Link from "next/link";

export default function LedgerPage() {
  const ledger = useAppStore((s) => s.ledger);
  const refreshLedger = useAppStore((s) => s.refreshLedger);
  const [chainResult, setChainResult] = useState<ChainVerifyResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [tamperTarget, setTamperTarget] = useState<LedgerBlock | null>(null);
  const [tamperValue, setTamperValue] = useState("");
  const [snapshot, setSnapshot] = useState<LedgerBlock[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    refreshLedger();
  }, [refreshLedger]);

  const runVerify = async () => {
    setChecking(true);
    const result = await verifyChain(ledger);
    setChainResult(result);
    setChecking(false);
  };

  useEffect(() => {
    // Re-verifying the chain is an async recomputation against freshly-loaded external
    // (IndexedDB) data, not derivable render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ledger.length) runVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.length]);

  const sigStatus = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const b of ledger) {
      const canonical = canonicalRecordString({
        sid: b.id,
        did: b.documentId,
        rid: b.recipientId,
        docHash: b.originalDocHash,
        ts: b.timestamp,
      });
      map.set(b.id, dsaVerify(b.signature, utf8ToBytes(canonical), b.signerDsaPublicKey));
    }
    return map;
  }, [ledger]);

  function openTamper(block: LedgerBlock) {
    setTamperTarget(block);
    setTamperValue(block.recipientName);
    if (!snapshot) setSnapshot(ledger.map((b) => ({ ...b })));
  }

  async function applyTamper() {
    if (!tamperTarget) return;
    const next = ledger.map((b) => (b.index === tamperTarget.index ? { ...b, recipientName: tamperValue } : b));
    await overwriteLedgerForDemo(next);
    await refreshLedger();
    setTamperTarget(null);
    await runVerify();
  }

  async function restoreSnapshot() {
    if (!snapshot) return;
    await overwriteLedgerForDemo(snapshot);
    await refreshLedger();
    setSnapshot(null);
    await runVerify();
  }

  function handleExport() {
    const json = exportLedgerJson(ledger);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netrayan-ledger-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const blocks = parseLedgerJson(text);
      if (!confirm(`Import ${blocks.length} block(s)? This replaces the current local ledger.`)) return;
      await overwriteLedgerForDemo(blocks);
      await refreshLedger();
      await runVerify();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not parse this file as a Netrayan ledger export.");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SectionHeading
        eyebrow="Immutable audit layer"
        title="Ledger explorer"
        desc="A local, SHA-256 hash-chained ledger — the offline stand-in for a permissioned DLT node. Every block commits to the previous block's hash; changing any field anywhere breaks every hash after it, visibly."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button className="btn btn-secondary" onClick={runVerify} disabled={checking}>
          {checking ? "Verifying…" : "Verify chain integrity"}
        </button>
        <button className="btn btn-secondary" onClick={handleExport} disabled={ledger.length === 0}>
          Export ledger (.json)
        </button>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          Import ledger (.json)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
        />
        {snapshot && (
          <button className="btn btn-ghost text-xs" onClick={restoreSnapshot}>
            Undo tamper demo (restore original chain)
          </button>
        )}
      </div>
      {importError && <p className="text-xs text-danger mb-4">{importError}</p>}

      {chainResult && (
        <div className={`card-solid p-4 mb-6 flex items-center gap-3 ${chainResult.valid ? "" : "border-danger/50"}`}>
          {chainResult.valid ? (
            <>
              <Pill tone="ok">Chain intact</Pill>
              <span className="text-sm text-muted">
                All {ledger.length} block{ledger.length === 1 ? "" : "s"} recompute to their stored hashes and link
                correctly to their predecessor.
              </span>
            </>
          ) : (
            <>
              <Pill tone="bad">Tamper detected</Pill>
              <span className="text-sm text-muted">
                Integrity check fails starting at block #{chainResult.brokenAtIndex} — every block from here forward
                is provably inconsistent with what was originally committed.
              </span>
            </>
          )}
        </div>
      )}

      {ledger.length === 0 ? (
        <EmptyState
          title="Ledger is empty"
          desc="Decrypt a distributed document from the Recipient Inbox to commit the first block."
          action={
            <Link href="/inbox" className="btn btn-primary">
              Go to Recipient Inbox
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {[...ledger].reverse().map((b) => {
            const detail = chainResult?.details.find((d) => d.index === b.index);
            const broken = detail && (!detail.hashOk || !detail.linkOk);
            const sigOk = sigStatus.get(b.id);
            return (
              <div key={b.id} className={`card p-4 ${broken ? "border-danger/60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-code text-xs text-muted">#{b.index}</span>
                    <span className="font-medium text-sm">{b.documentName}</span>
                    <span className="text-xs text-muted">→ {b.recipientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sigOk ? <Pill tone="ok">Signature valid</Pill> : <Pill tone="bad">Signature invalid</Pill>}
                    {broken && <Pill tone="bad">Chain broken here</Pill>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-[11px] text-muted">
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">Timestamp</span>
                    <span>{new Date(b.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">Watermark id</span>
                    <Hash value={b.watermarkId} chars={8} />
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">prevHash</span>
                    <Hash value={b.prevHash} chars={6} />
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">hash</span>
                    <Hash value={b.hash} chars={6} />
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">Algorithms</span>
                    <span>
                      {b.algoKem} · {b.algoSig}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">Signature</span>
                    <Hash value={b.signature} chars={6} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tamperTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="card-solid p-6 max-w-md w-full">
            <div className="font-medium mb-1">Tamper with block #{tamperTarget.index}</div>
            <p className="text-xs text-muted mb-4">
              This simulates a privileged administrator editing a historical record directly in
              storage — no signature, no re-hash. Change the recorded recipient name and save;
              the chain check will show exactly where this breaks.
            </p>
            <label className="text-xs text-muted block mb-1">Recipient name</label>
            <input className="input mb-4" value={tamperValue} onChange={(e) => setTamperValue(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setTamperTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-primary !bg-danger !border-danger !text-white" onClick={applyTamper}>
                Save tampered value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
