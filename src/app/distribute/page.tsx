"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { SectionHeading, Pill, EmptyState, Hash } from "@/components/ui";
import { sha256Hex } from "@/lib/crypto/hash";
import { bytesToBase64 } from "@/lib/util/encoding";
import { createDistribution } from "@/lib/flows/distribute";
import type { DocKind, DocumentRecord } from "@/lib/types";
import Link from "next/link";

function kindFromMime(mime: string): DocKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  return null;
}

export default function DistributePage() {
  const identities = useAppStore((s) => s.identities);
  const distributions = useAppStore((s) => s.distributions);
  const addDocument = useAppStore((s) => s.addDocument);
  const addDistribution = useAppStore((s) => s.addDistribution);

  const senders = identities.filter((i) => i.role === "sender");
  const recipients = identities.filter((i) => i.role === "recipient");

  const [senderId, setSenderId] = useState<string>("");
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [pendingFile, setPendingFile] = useState<{ name: string; kind: DocKind; bytes: Uint8Array } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveSender = senderId || senders[0]?.id || "";

  async function handleFile(file: File) {
    setError(null);
    const kind = kindFromMime(file.type);
    if (!kind) {
      setError("Netrayan's watermark carriers support PDF and PNG only. Please choose a .pdf or .png file.");
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    setPendingFile({ name: file.name, kind, bytes: buf });
  }

  function toggleRecipient(id: string) {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDistribute() {
    if (!pendingFile || !effectiveSender || selectedRecipients.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const sender = identities.find((i) => i.id === effectiveSender)!;
      const originalHash = await sha256Hex(pendingFile.bytes);
      const doc = addDocument({
        name: pendingFile.name,
        kind: pendingFile.kind,
        mime: pendingFile.kind === "pdf" ? "application/pdf" : "image/png",
        size: pendingFile.bytes.length,
        originalHash,
        senderId: sender.id,
        originalBytesB64: bytesToBase64(pendingFile.bytes),
      });
      for (const rid of selectedRecipients) {
        const recipient = identities.find((i) => i.id === rid)!;
        const dist = await createDistribution(doc, sender, recipient);
        addDistribution(dist);
      }
      setLastDoc(doc);
      setPendingFile(null);
      setSelectedRecipients(new Set());
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Distribution failed.");
    } finally {
      setBusy(false);
    }
  }

  if (senders.length === 0 || recipients.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <SectionHeading eyebrow="Step 2" title="Sender console" />
        <EmptyState
          title="You need at least one sender and one recipient identity"
          desc="Head to Identities to generate real ML-KEM / ML-DSA keypairs first."
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
        eyebrow="Step 2"
        title="Sender console"
        desc="Encrypt a document once per recipient. Each recipient's copy is wrapped under their own ML-KEM-768 public key — nobody else, including the sender afterwards, can decrypt another recipient's envelope."
      />

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
        <div className="card p-5">
          <div className="text-sm font-medium mb-3">1. Sending as</div>
          <select className="input mb-5" value={effectiveSender} onChange={(e) => setSenderId(e.target.value)}>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>

          <div className="text-sm font-medium mb-3">2. Document</div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            className="w-full border border-dashed border-[var(--border)] rounded-xl p-6 text-center hover:border-accent/60 transition-colors"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            {pendingFile ? (
              <div>
                <div className="font-medium text-sm">{pendingFile.name}</div>
                <div className="text-xs text-muted mt-1">
                  {(pendingFile.bytes.length / 1024).toFixed(1)} KB · {pendingFile.kind.toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted">
                Click to choose a <span className="text-foreground">.pdf</span> or{" "}
                <span className="text-foreground">.png</span> file
              </div>
            )}
          </button>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}

          <div className="text-sm font-medium mb-3 mt-6">3. Recipients</div>
          <div className="grid grid-cols-2 gap-2">
            {recipients.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRecipient(r.id)}
                className={`chip-select text-left ${selectedRecipients.has(r.id) ? "active" : ""}`}
              >
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted">{r.org || r.id}</div>
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary w-full mt-6"
            disabled={!pendingFile || selectedRecipients.size === 0 || busy}
            onClick={handleDistribute}
          >
            {busy
              ? "Encrypting per recipient…"
              : `Encrypt & distribute to ${selectedRecipients.size || ""} recipient${selectedRecipients.size === 1 ? "" : "s"}`}
          </button>
          <p className="text-[11px] text-muted mt-2 leading-relaxed">
            Under the hood: for each selected recipient, Netrayan runs a real ML-KEM-768
            encapsulation against their public key, derives an AES-256-GCM key via HKDF-SHA256,
            and encrypts the file. The watermark is not applied yet — it only exists once the
            recipient decrypts.
          </p>
        </div>

        <div>
          {lastDoc && (
            <div className="card-solid p-4 mb-4">
              <div className="text-xs text-accent font-semibold mb-1">Just distributed</div>
              <div className="text-sm">
                <span className="font-medium">{lastDoc.name}</span> — original hash{" "}
                <Hash value={lastDoc.originalHash} chars={6} />
              </div>
            </div>
          )}
          <div className="text-sm font-medium mb-3">Distribution log</div>
          {distributions.length === 0 ? (
            <EmptyState title="No distributions yet" desc="Encrypted envelopes you create will appear here." />
          ) : (
            <div className="space-y-2">
              {[...distributions]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((d) => (
                  <div key={d.id} className="card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.documentName}</div>
                      <div className="text-xs text-muted">
                        → {d.recipientName} · {new Date(d.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Pill tone={d.status === "decrypted" ? "ok" : "warn"}>
                      {d.status === "decrypted" ? "Decrypted" : "Pending"}
                    </Pill>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
