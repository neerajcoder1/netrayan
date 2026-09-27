"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Identity,
  PublicIdentity,
  DocumentRecord,
  Distribution,
  LedgerBlock,
  ForensicCertificate,
} from "../types";
import { generateKemKeyPair, generateDsaKeyPair } from "../crypto/pqc";
import { shortId } from "../util/encoding";
import { loadLedger } from "../ledger/ledger";

interface AppState {
  identities: Identity[];
  documents: DocumentRecord[];
  distributions: Distribution[];
  certificates: ForensicCertificate[];
  ledger: LedgerBlock[];
  ledgerLoaded: boolean;

  addIdentity: (name: string, role: Identity["role"], org?: string) => Identity;
  removeIdentity: (id: string) => void;
  addDocument: (doc: Omit<DocumentRecord, "id" | "createdAt">) => DocumentRecord;
  addDistribution: (dist: Distribution) => void;
  markDecrypted: (distId: string, ledgerBlockId: string) => void;
  addCertificate: (cert: ForensicCertificate) => void;
  updateCertificate: (cert: ForensicCertificate) => void;
  refreshLedger: () => Promise<void>;
  publicDirectory: () => PublicIdentity[];
  resetAll: () => void;
  seedDemoScenario: () => { senderId: string; recipientIds: string[]; custodianIds: string[] };
}

const emptyState = {
  identities: [] as Identity[],
  documents: [] as DocumentRecord[],
  distributions: [] as Distribution[],
  certificates: [] as ForensicCertificate[],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyState,
      ledger: [],
      ledgerLoaded: false,

      addIdentity: (name, role, org) => {
        const identity: Identity = {
          id: shortId(role === "sender" ? "S" : role === "recipient" ? "R" : "C", 3),
          name,
          org,
          role,
          createdAt: Date.now(),
          kem: generateKemKeyPair(),
          dsa: generateDsaKeyPair(),
        };
        set((s) => ({ identities: [...s.identities, identity] }));
        return identity;
      },

      removeIdentity: (id) => set((s) => ({ identities: s.identities.filter((i) => i.id !== id) })),

      addDocument: (doc) => {
        const record: DocumentRecord = { ...doc, id: shortId("DOC", 4), createdAt: Date.now() };
        set((s) => ({ documents: [...s.documents, record] }));
        return record;
      },

      addDistribution: (dist) => set((s) => ({ distributions: [...s.distributions, dist] })),

      markDecrypted: (distId, ledgerBlockId) =>
        set((s) => ({
          distributions: s.distributions.map((d) =>
            d.id === distId ? { ...d, status: "decrypted", decryptedAt: Date.now(), ledgerBlockId } : d,
          ),
        })),

      addCertificate: (cert) => set((s) => ({ certificates: [...s.certificates, cert] })),
      updateCertificate: (cert) =>
        set((s) => ({ certificates: s.certificates.map((c) => (c.id === cert.id ? cert : c)) })),

      refreshLedger: async () => {
        const blocks = await loadLedger();
        set({ ledger: blocks, ledgerLoaded: true });
      },

      publicDirectory: () =>
        get().identities.map((i) => ({
          id: i.id,
          name: i.name,
          org: i.org,
          role: i.role,
          kemPublicKey: i.kem.publicKey,
          dsaPublicKey: i.dsa.publicKey,
        })),

      resetAll: () => set({ ...emptyState, ledger: [], ledgerLoaded: false }),

      seedDemoScenario: () => {
        const s = get();
        const sender = s.addIdentity("Directorate Registry Office", "sender", "Ministry Secretariat");
        const r1 = s.addIdentity("A. Krishnan", "recipient", "Field Office — North");
        const r2 = s.addIdentity("P. Fernandes", "recipient", "Field Office — East");
        const r3 = s.addIdentity("S. Bhatt", "recipient", "Field Office — West");
        const c1 = s.addIdentity("Chief Security Officer", "custodian", "Internal Audit");
        const c2 = s.addIdentity("Data Protection Officer", "custodian", "Legal & Compliance");
        const c3 = s.addIdentity("External Ombudsperson", "custodian", "Independent Oversight");
        return {
          senderId: sender.id,
          recipientIds: [r1.id, r2.id, r3.id],
          custodianIds: [c1.id, c2.id, c3.id],
        };
      },
    }),
    {
      name: "netrayan-app-state-v1",
      partialize: (s) => ({
        identities: s.identities,
        documents: s.documents,
        distributions: s.distributions,
        certificates: s.certificates,
      }),
    },
  ),
);
