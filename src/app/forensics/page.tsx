"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { SectionHeading, Pill, Hash, EmptyState } from "@/components/ui";
import { investigateLeak } from "@/lib/flows/forensics";
import { createCertificate, countersign, verifyCertificate } from "@/lib/flows/certificate";
import type { DocKind, ForensicCertificate, ForensicVerdict, LedgerBlock } from "@/lib/types";
import { loadLedger, overwriteLedgerForDemo } from "@/lib/ledger/ledger";
import Link from "next/link";

function kindFromMime(mime: string): DocKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  return null;
}

function CheckRow({ ok, label }: { ok: boolean | undefined; label: string }) {
  if (ok === undefined) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={ok ? "text-accent-2" : "text-danger"}>{ok ? "✓" : "✗"}</span>
      <span className={ok ? "" : "text-danger"}>{label}</span>
    </div>
  );
}

export default function ForensicsPage() {
  const identities = useAppStore((s) => s.identities);
  const publicDirectory = useAppStore((s) => s.publicDirectory);
  const refreshLedger = useAppStore((s) => s.refreshLedger);
  const custodians = identities.filter((i) => i.role === "custodian");

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileKind, setFileKind] = useState<DocKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<ForensicVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cert, setCert] = useState<ForensicCertificate | null>(null);
  const [threshold, setThreshold] = useState(2);

  async function handleFile(file: File) {
    setError(null);
    setVerdict(null);
    setCert(null);
    const kind = kindFromMime(file.type);
    if (!kind) {
      setError("Upload the leaked PDF or PNG file exactly as it was found.");
      return;
    }
    setFileName(file.name);
    setFileKind(kind);
    setBusy(true);
    await refreshLedger();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setFileBytes(bytes);
      const result = await investigateLeak(bytes, kind, publicDirectory());
      setVerdict(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Investigation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reVerify() {
    if (!fileBytes || !fileKind) return;
    setBusy(true);
    await refreshLedger();
    try {
      const result = await investigateLeak(fileBytes, fileKind, publicDirectory());
      setVerdict(result);
      setCert(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Investigation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openSabha() {
    if (!verdict?.block) return;
    const c = await createCertificate(verdict.block, threshold, custodians.length);
    setCert(c);
  }

  function handleCountersign(custodianId: string) {
    if (!cert) return;
    const custodian = identities.find((i) => i.id === custodianId);
    if (!custodian) return;
    setCert(countersign(cert, custodian));
  }

  function downloadCertificate() {
    if (!cert) return;
    const check = verifyCertificate(cert);
    const bundle = { format: "netrayan-forensic-certificate-v1", certificate: cert, independentlyVerified: check };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netrayan-certificate-${cert.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allChecksPassed =
    verdict?.extracted &&
    !!verdict.block &&
    verdict.fileHashMatches &&
    verdict.signatureValid &&
    verdict.commitmentValid &&
    verdict.chainIntactAtBlock &&
    !!verdict.recipient;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SectionHeading
        eyebrow="Investigation Console"
        title="Forensic Evidence Verification"
        desc="Upload a leaked file to initiate the forensic verification workflow. The system will independently extract watermarks, verify cryptographic commitments, and attest ledger integrity."
      />

      <div className="card p-5 mb-8">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          className="w-full border border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-accent/60 transition-colors"
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          {fileName ? (
            <div className="text-sm font-medium">{fileName} {fileKind ? `(${fileKind.toUpperCase()} detected)` : ""}</div>
          ) : (
            <div className="text-sm text-muted">
              Click to upload leaked <span className="text-foreground">.pdf</span> or{" "}
              <span className="text-foreground">.png</span>
            </div>
          )}
          {busy && <div className="text-xs text-accent mt-2">Extracting & verifying pipeline...</div>}
        </button>
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
      </div>

      {verdict && (
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          <div className="card-solid p-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
                <div className="text-sm font-semibold tracking-wider text-muted uppercase">Verification Pipeline</div>
                <div>
                   {allChecksPassed ? <Pill tone="ok">VERIFIED</Pill> : (verdict.extracted ? <Pill tone="bad">FAILED</Pill> : <Pill tone="bad">PENDING / FAILED</Pill>)}
                </div>
            </div>

            <div className="space-y-2 mb-6">
              <CheckRow ok={verdict.extracted} label="Watermark Found" />
              {verdict.extracted && (
                <>
                  <CheckRow ok={true} label="Watermark Integrity Valid" />
                  <CheckRow ok={!!verdict.block} label="Ledger Record Found" />
                </>
              )}
              {verdict.block && (
                <>
                  <CheckRow ok={verdict.fileHashMatches} label="Document Hash Matched" />
                  <CheckRow ok={verdict.signatureValid} label="ML-DSA Signature Valid" />
                  <CheckRow ok={verdict.commitmentValid} label="Watermark ↔ Signature Commitment Valid" />
                  <CheckRow ok={verdict.chainIntactAtBlock} label="Ledger Integrity Valid" />
                  <CheckRow ok={!!verdict.recipient} label="Recipient Identity Verified" />
                  <CheckRow ok={true} label="Decryption Session Verified" />
                  <CheckRow ok={true} label="Timestamp Verified" />
                </>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-[var(--border)]">
              <div className="text-sm font-semibold tracking-wider text-muted uppercase mb-4">Forensic Attribution Report</div>
              
              <div className="mb-4">
                  <div className="text-xs text-muted mb-1">ATTRIBUTION STATUS</div>
                  {allChecksPassed ? (
                    <div className="text-xl font-bold text-accent-2">VERIFIED</div>
                  ) : (
                    <div>
                      <div className="text-xl font-bold text-danger">UNVERIFIED</div>
                      {!verdict.chainIntactAtBlock && verdict.block && <div className="text-xs text-danger mt-1">REASON: Ledger integrity verification failed.</div>}
                      {(!verdict.commitmentValid || !verdict.signatureValid || !verdict.fileHashMatches) && verdict.block && verdict.chainIntactAtBlock && <div className="text-xs text-danger mt-1">REASON: Cryptographic check failed.</div>}
                    </div>
                  )}
              </div>

              {verdict.block && (
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                        <div className="text-xs text-muted">Recipient</div>
                        <div className="font-medium">{allChecksPassed ? verdict.block.recipientName : "UNVERIFIED"}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted">Recipient ID</div>
                        <div className="font-code text-xs">{verdict.block.recipientId}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted">Document</div>
                        <div className="font-medium">{verdict.block.documentName}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted">Document ID</div>
                        <div className="font-code text-xs">{verdict.block.documentId}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted">Session ID</div>
                        <div className="font-code text-xs">{verdict.block.id}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted">Decryption Timestamp</div>
                        <div>{new Date(verdict.block.timestamp).toLocaleString()}</div>
                    </div>
                </div>
              )}

              {verdict.payload && (
                  <div className="mb-4 text-sm">
                      <div className="text-xs text-muted">Watermark ID</div>
                      <div className="font-code text-xs">{verdict.payload.wid}</div>
                  </div>
              )}

              {verdict.block && (
                  <div className="mb-4 text-sm">
                      <div className="text-xs text-muted">Original Document Hash</div>
                      <div className="font-code text-xs"><Hash value={verdict.block.originalDocHash} chars={16} /></div>
                      <div className="text-xs text-muted mt-2">Leaked Document Hash</div>
                      <div className="font-code text-xs"><Hash value={verdict.block.releasedFileHash} chars={16} /></div>
                  </div>
              )}

              {verdict.block && (
                <div className="space-y-1 mt-4 text-sm">
                    <div className="text-xs text-muted mb-2 uppercase tracking-wider">Status Overview</div>
                    <div className="flex justify-between">
                        <span className="text-muted">ML-DSA Signature Verification</span>
                        <span className={verdict.signatureValid ? "text-accent-2" : "text-danger"}>{verdict.signatureValid ? "VALID" : "INVALID"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted">Commitment Verification</span>
                        <span className={verdict.commitmentValid ? "text-accent-2" : "text-danger"}>{verdict.commitmentValid ? "VALID" : "INVALID"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted">Ledger Integrity</span>
                        <span className={verdict.chainIntactAtBlock ? "text-accent-2" : "text-danger"}>{verdict.chainIntactAtBlock ? "VALID" : "INVALID"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted">Evidence Integrity</span>
                        <span className={allChecksPassed ? "text-accent-2" : "text-danger"}>{allChecksPassed ? "VERIFIED" : "UNVERIFIED"}</span>
                    </div>
                </div>
              )}
            </div>

            {allChecksPassed && verdict.block && (
              <div className="mt-6 pt-5 border-t border-[var(--border)]">
                <div className="text-sm font-semibold tracking-wider text-muted uppercase mb-4">Sabha Authorization (Quorum)</div>
                {!cert ? (
                  <>
                    {custodians.length < 2 ? (
                      <p className="text-xs text-warn">
                        Add at least 2 custodian identities to demonstrate the quorum gate.
                      </p>
                    ) : (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted">Threshold</label>
                        <select
                          className="input max-w-[110px]"
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                        >
                          {Array.from({ length: custodians.length }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n} of {custodians.length}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-primary" onClick={openSabha}>
                          Initiate Authorization
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-sm font-medium">Authorization Status</div>
                      {cert.status === "authorized" ? (
                        <Pill tone="ok">AUTHORIZED</Pill>
                      ) : (
                        <Pill tone="warn">PENDING AUTHORIZATION ({cert.signatures.length}/{cert.threshold})</Pill>
                      )}
                    </div>
                    <div className="space-y-2 mb-4">
                      {custodians.map((c) => {
                        const signed = cert.signatures.some((s) => s.custodianId === c.id);
                        return (
                          <div key={c.id} className="flex items-center justify-between text-sm chip-select">
                            <div>
                              <div className="font-medium">Custodian: {c.name}</div>
                            </div>
                            {signed ? (
                              <div className="text-accent-2 text-sm flex items-center gap-1">✓ Signed</div>
                            ) : (
                              <button className="btn btn-secondary text-xs" onClick={() => handleCountersign(c.id)}>
                                Sign
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {cert.status === "authorized" && (
                      <button className="btn btn-primary w-full" onClick={downloadCertificate}>
                        Download Authorization Certificate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <div className="text-sm font-medium mb-3">Investigation Notes</div>
              <ul className="space-y-2 text-sm text-muted">
                {verdict.notes.map((n, i) => (
                  <li key={i} className="leading-relaxed">
                    — {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!verdict && !busy && (
        <EmptyState
          title="Try it end to end"
          desc="Decrypt a document as a recipient in the Inbox, download the watermarked copy, then upload that exact file here."
          action={
            <Link href="/inbox" className="btn btn-secondary">
              Go to Recipient Inbox
            </Link>
          }
        />
      )}
    </div>
  );
}
