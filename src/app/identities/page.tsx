"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { SectionHeading, Hash, Pill } from "@/components/ui";
import type { Identity, Role } from "@/lib/types";
import { ALGO_KEM, ALGO_SIG } from "@/lib/crypto/pqc";

const ROLE_LABEL: Record<Role, string> = {
  sender: "Sender",
  recipient: "Recipient",
  custodian: "Custodian",
};

const ROLE_HINT: Record<Role, string> = {
  sender: "Encrypts and distributes documents.",
  recipient: "Decrypts their own copy; every decryption is watermarked and signed.",
  custodian: "Countersigns forensic certificates under the Sabha Protocol (k-of-n quorum).",
};

function IdentityCard({ identity, onRemove }: { identity: Identity; onRemove: () => void }) {
  return (
    <div className="card p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{identity.name}</div>
          {identity.org && <div className="text-xs text-muted">{identity.org}</div>}
        </div>
        <button onClick={onRemove} className="btn btn-ghost !p-1.5 text-xs" title="Remove identity">
          ✕
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Pill tone="neutral">{identity.id}</Pill>
      </div>
      <div className="text-[11px] text-muted space-y-1 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-16 shrink-0 opacity-70">KEM pk</span>
          <Hash value={identity.kem.publicKey} chars={8} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-16 shrink-0 opacity-70">DSA pk</span>
          <Hash value={identity.dsa.publicKey} chars={8} />
        </div>
      </div>
    </div>
  );
}

export default function IdentitiesPage() {
  const identities = useAppStore((s) => s.identities);
  const addIdentity = useAppStore((s) => s.addIdentity);
  const removeIdentity = useAppStore((s) => s.removeIdentity);
  const seedDemoScenario = useAppStore((s) => s.seedDemoScenario);
  const resetAll = useAppStore((s) => s.resetAll);

  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState<Role>("recipient");
  const [busy, setBusy] = useState(false);

  const bySender = identities.filter((i) => i.role === "sender");
  const byRecipient = identities.filter((i) => i.role === "recipient");
  const byCustodian = identities.filter((i) => i.role === "custodian");

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    // yield a frame so the button shows a busy state — real ML-KEM/ML-DSA keygen runs synchronously
    await new Promise((r) => setTimeout(r, 10));
    addIdentity(name.trim(), role, org.trim() || undefined);
    setName("");
    setOrg("");
    setBusy(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SectionHeading
        eyebrow="Step 1"
        title="Identities & keys"
        desc={`Every identity here really generates an ${ALGO_KEM} key-encapsulation pair and an ${ALGO_SIG} signing pair in your browser, right now — nothing is pre-baked.`}
      />

      {identities.length === 0 && (
        <div className="card-solid p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-medium mb-1">No identities yet</div>
            <p className="text-sm text-muted max-w-lg">
              Seed a realistic scenario — one sender, three recipients, three oversight
              custodians — or add identities one at a time below.
            </p>
          </div>
          <button className="btn btn-primary shrink-0" onClick={() => seedDemoScenario()}>
            Load demo scenario
          </button>
        </div>
      )}

      <div className="card p-5 mb-10">
        <div className="text-sm font-medium mb-3">Add an identity</div>
        <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-muted block mb-1">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. R. Iyer"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Organization (optional)</label>
            <input
              className="input"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="e.g. Field Office — South"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="sender">Sender</option>
              <option value="recipient">Recipient</option>
              <option value="custodian">Custodian</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={busy || !name.trim()}>
            {busy ? "Generating keys…" : "Generate keypair"}
          </button>
        </div>
        <p className="text-xs text-muted mt-2">{ROLE_HINT[role]}</p>
      </div>

      {(["sender", "recipient", "custodian"] as Role[]).map((r) => {
        const list = { sender: bySender, recipient: byRecipient, custodian: byCustodian }[r];
        return (
          <div key={r} className="mb-9">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold">{ROLE_LABEL[r]}s</h2>
              <span className="text-xs text-muted">({list.length})</span>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((i) => (
                  <IdentityCard key={i.id} identity={i} onRemove={() => removeIdentity(i.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {identities.length > 0 && (
        <div className="pt-6 border-t border-[var(--border)] flex justify-end">
          <button
            className="btn btn-ghost text-xs text-danger"
            onClick={() => {
              if (confirm("Reset identities, documents, distributions and certificates? The ledger is kept.")) {
                resetAll();
              }
            }}
          >
            Reset identities & documents
          </button>
        </div>
      )}
    </div>
  );
}
