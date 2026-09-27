"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { SectionHeading, Pill, EmptyState, Hash } from "@/components/ui";
import { performDecryption, type DecryptResult } from "@/lib/flows/decrypt";
import Link from "next/link";

export default function InboxPage() {
  const identities = useAppStore((s) => s.identities);
  const documents = useAppStore((s) => s.documents);
  const distributions = useAppStore((s) => s.distributions);
  const markDecrypted = useAppStore((s) => s.markDecrypted);
  const refreshLedger = useAppStore((s) => s.refreshLedger);

  const recipients = identities.filter((i) => i.role === "recipient");
  const [recipientId, setRecipientId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, DecryptResult & { downloadUrl: string; fileName: string }>>({});

  const effectiveRecipientId = recipientId || recipients[0]?.id || "";
  const mine = distributions.filter((d) => d.recipientId === effectiveRecipientId);
  const recipient = identities.find((i) => i.id === effectiveRecipientId);

  async function handleDecrypt(distId: string) {
    setError(null);
    setBusyId(distId);
    try {
      const dist = distributions.find((d) => d.id === distId)!;
      const doc = documents.find((d) => d.id === dist.documentId)!;
      const rec = identities.find((i) => i.id === dist.recipientId)!;
      const result = await performDecryption(dist, rec, doc);
      markDecrypted(dist.id, result.block.id);
      await refreshLedger();
      const mime = doc.kind === "pdf" ? "application/pdf" : "image/png";
      const blob = new Blob([result.fileBytes as BlobPart], { type: mime });
      const url = URL.createObjectURL(blob);
      const ext = doc.kind === "pdf" ? "pdf" : "png";
      const fileName = doc.name.replace(/\.[^.]+$/, "") + `.${rec.id}.${ext}`;
      setResults((prev) => ({ ...prev, [distId]: { ...result, downloadUrl: url, fileName } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (recipients.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <SectionHeading eyebrow="Step 3" title="Recipient inbox" />
        <EmptyState
          title="No recipient identities yet"
          desc="Create at least one recipient on the Identities page."
          action={
            <Link href="/identities" className="btn btn-primary">
              Go to Identities
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SectionHeading
        eyebrow="Step 3"
        title="Recipient inbox"
        desc="Decrypting here does four real things at once: ML-KEM decapsulation + AES-GCM decryption, ML-DSA signing of the decryption record, commitment-bound watermark embedding, and a ledger commit."
      />

      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm text-muted">Viewing inbox as</label>
        <select className="input max-w-xs" value={effectiveRecipientId} onChange={(e) => setRecipientId(e.target.value)}>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.id})
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {mine.length === 0 ? (
        <EmptyState
          title={`Nothing addressed to ${recipient?.name ?? "this recipient"}`}
          desc="Distribute a document to them from the Sender Console first."
          action={
            <Link href="/distribute" className="btn btn-primary">
              Go to Sender Console
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {[...mine]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((d) => {
              const res = results[d.id];
              return (
                <div key={d.id} className="card p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-sm">{d.documentName}</div>
                      <div className="text-xs text-muted">
                        from sender {d.senderId} · received {new Date(d.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {d.status === "pending" ? (
                      <button className="btn btn-primary" disabled={busyId === d.id} onClick={() => handleDecrypt(d.id)}>
                        {busyId === d.id ? "Decrypting…" : "Decrypt this copy"}
                      </button>
                    ) : (
                      <Pill tone="ok">Decrypted</Pill>
                    )}
                  </div>

                  {res && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)] grid sm:grid-cols-2 gap-4">
                      <div className="text-xs space-y-1.5">
                        <div className="flex gap-2">
                          <span className="w-28 text-muted shrink-0">Ledger block</span>
                          <span>
                            #{res.block.index} <Hash value={res.block.hash} chars={6} />
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-28 text-muted shrink-0">Watermark id</span>
                          <Hash value={res.payload.wid} chars={8} />
                        </div>
                        <div className="flex gap-2">
                          <span className="w-28 text-muted shrink-0">Signature</span>
                          <Hash value={res.block.signature} chars={8} />
                        </div>
                        <div className="flex gap-2">
                          <span className="w-28 text-muted shrink-0">Signed with</span>
                          <span>{res.block.algoSig}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-start justify-center gap-2">
                        <a href={res.downloadUrl} download={res.fileName} className="btn btn-secondary">
                          Download watermarked copy
                        </a>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Visually identical to the original. Try this: download it, then upload
                          it on the Forensics page as if it had leaked.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
