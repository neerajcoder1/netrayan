<div align="center">
  <img src="public/logo.svg" alt="Netrayan Logo" width="120" />
  <h1>Netrayan</h1>
  <p><strong>नेत्र + अयन — the eye's chronicle.</strong></p>
  <p><em>Cryptographic attribution and immutable decryption provenance for multi-recipient encrypted documents.</em></p>
</div>

> When one sender encrypts a document for many recipients, a leak makes every recipient an
> equally plausible suspect. Netrayan generates a unique, invisible fingerprint **at the
> moment of decryption**, cryptographically binds it to a post-quantum signature only that
> recipient could produce, and commits the signed record to a tamper-evident local ledger —
> so a single leaked file can be traced back to exactly one person.

This is a complete proof-of-concept build. It runs **real** cryptography and **real** watermarking —
not a mockup with fake progress bars — entirely client-side in the browser, which is what
lets it also deploy as a static site. See [What's real vs. what's scoped
out](#whats-real-vs-whats-scoped-out-for-a-demo) before treating any part of it as
production-ready.

---

## Two ideas beyond the brief

The problem statement asks for: a per-recipient invisible watermark, a signature binding
the decryption to the recipient's identity, and a tamper-evident ledger. Netrayan does all
of that, plus two things it doesn't ask for:

**1. Commitment-bound watermarking.** In a naive implementation, the invisible mark is a
random id, and a signature over that id is stored separately. Netrayan instead signs the
decryption record *first*, then derives the watermark id as `SHA-256(signature)[:32]`. The
mark embedded in the file **is** a fingerprint of the real signature — not a label paired
with it after the fact. Forging a plausible (watermark, ledger-entry) pair now requires
forging a valid ML-DSA signature, not just picking a convincing-looking id.

**2. The Sabha Protocol** (sabhā — council; from the Mahabharata's royal assembly; no
deity or real person's name). The ledger can always *prove* — on its own, cryptographically
— exactly who decrypted a document. Netrayan treats that as a separate question from
*acting* on it. Turning a match into a named, actionable accusation requires a quorum of
independent custodians (e.g. 2 of 3 — security, legal/DPO, an external ombudsperson), each
holding their own ML-DSA keypair, to individually countersign the certificate. This closes
the exact loophole the brief itself names — a single privileged administrator — one level
further: even *correctly*, nobody can unilaterally weaponize a match. See
`src/lib/flows/certificate.ts`.

---

## Try it

```bash
npm install
npm run dev      # http://localhost:3000
```

Walkthrough:

1. **Identities** — click *Load demo scenario* (1 sender, 3 recipients, 3 custodians — each
   really generates an ML-KEM-768 + ML-DSA-65 keypair), or add your own.
2. **Sender Console** — upload a `.pdf` or `.png`, pick recipients, encrypt & distribute.
3. **Recipient Inbox** — switch between recipients, decrypt their copy, download the
   watermarked file. Visually identical to the original.
4. **Ledger** — see the committed, hash-chained record. Try *Tamper (demo)* on a block, then
   *Verify chain integrity* — watch it fail from exactly that point forward.
5. **Forensics** — upload a watermarked file as if it had leaked. Netrayan attributes it to
   the correct recipient and shows every check it ran. If all checks pass, open a **Sabha
   Protocol** certificate and countersign it with 2+ custodians to authorize it.

`npm run verify` runs a standalone integration check against the real source modules (real
ML-KEM/ML-DSA, real PDF watermark embed/extract, real hash chain, real quorum signing) —
useful to show the pipeline isn't cosmetic.

---

## Forensic Investigation & Evidence Verification

The forensics console enables a structured investigation workflow given only a leaked document:

1. **Leaked document upload**: The investigator uploads the suspect file exactly as it was found.
2. **Watermark extraction**: The invisible embedded payload (wid, sid, rid) is extracted.
3. **Ledger lookup**: The system locates the exact decryption event in the hash-chained ledger.
4. **Document hash verification**: The leaked file is byte-compared to the recorded `releasedFileHash`.
5. **ML-DSA signature verification**: The recipient's non-repudiable signature is re-verified against their registered public key.
6. **Commitment-bound watermark verification**: The system proves `wid === SHA-256(signature)[:32]`. The watermark is inexorably bound to the signature.
7. **Ledger integrity verification**: The ledger is hashed backwards to verify the chain is unbroken up to the matching block.
8. **Sabha quorum authorization**: If cryptographic evidence is solid, it requires an independent quorum of custodians to countersign before attribution is considered authorized.
9. **Evidence report**: A detailed report clearly stating the attribution status (VERIFIED or UNVERIFIED) along with all cryptographic validation checks.

**Note on field deployment**: In this prototype, the ledger is a local hash-chain using IndexedDB to simulate a tamper-evident log. In a production field deployment, this must be replaced with a distributed multi-node permissioned ledger (like Hyperledger Fabric) to prevent the system administrator from easily rewriting the ledger history. The tamper-evidence demo illustrates how a broken hash chain will safely invalidate any forensic attribution.

---

## Architecture

Everything below runs **in the browser** — there is no backend, no API route, and no
external service call in this build. That's a deliberate reflection of the deployment
constraint (offline/air-gapped, no cloud KMS, no public blockchain), and it's also what
makes the whole thing deployable as a static site on Vercel.

```
src/lib/
  crypto/
    pqc.ts        ML-KEM-768 (FIPS 203) and ML-DSA-65 (FIPS 204) — @noble/post-quantum
    symmetric.ts  AES-256-GCM via WebCrypto, key derived by HKDF-SHA256 from the KEM secret
    hash.ts       SHA-256 via WebCrypto
  watermark/
    image.ts      LSB steganography in PNG pixel data (Canvas), seeded pixel diffusion
    pdf.ts         invisible (opacity-0) text layer in every page's content stream,
                    recovered by decompressing the raw PDF bytes — no dependency on the
                    file having been produced by this app
    payload.ts     shared wire format + checksum for both carriers
  ledger/
    ledger.ts      SHA-256 hash-chained, append-only log; IndexedDB-persisted;
                    export/import as JSON (the offline node-to-node sync mechanism)
  flows/
    distribute.ts  sender: per-recipient hybrid PQC envelope encryption
    decrypt.ts     recipient: decrypt, sign, derive commitment-bound watermark, embed, commit
    forensics.ts   leak investigation: extract, look up, independently re-verify everything
    certificate.ts Sabha Protocol: k-of-n custodian countersignature gate
  store/
    useAppStore.ts zustand store (identities/documents/distributions/certificates in
                    localStorage; the ledger itself lives in IndexedDB, on purpose — two
                    separate subsystems, matching the real design)
```

### End-to-end flow

1. **Encrypt.** Sender picks a recipient's public ML-KEM-768 key, runs a real
   encapsulation, derives an AES-256-GCM key via HKDF-SHA256 from the shared secret, and
   encrypts the file. A different envelope is built per recipient.
2. **Decrypt.** Recipient decapsulates with their own ML-KEM secret key, recovers the AES
   key, decrypts.
3. **Sign.** The recipient signs a canonical record — session id, document id, recipient
   id, original document hash, timestamp — with their own ML-DSA-65 secret key.
4. **Commit the watermark.** `wid = SHA-256(signature)[:32]`. This, not a random id, is what
   gets embedded.
5. **Watermark.** The `wid` (plus session/recipient/doc ids and a timestamp, checksummed) is
   embedded invisibly — LSB bits in PNG pixels, or an invisible text run on every PDF page.
6. **Ledger.** The signed record is appended as a new block, hash-chained to the previous
   block. Any later edit to any field of any block changes that block's recomputed hash,
   which breaks every hash after it — detectable by anyone, without a privileged process.
7. **Trace.** Given only a leaked file: extract the watermark → look up the ledger block →
   re-verify the ML-DSA signature against the *registered* public key (never trust a key
   claimed by the leaked file itself) → re-check the commitment (`wid == H(signature)`) →
   re-walk the chain to confirm nothing upstream was altered → report the recipient.
8. **Authorize.** A Sabha Protocol certificate over the finding needs a quorum of custodian
   countersignatures before it's "authorized."

---

## What's real vs. what's scoped out for a demo

| Layer | This build | A fielded deployment would add |
|---|---|---|
| Key exchange | Real ML-KEM-768 (FIPS 203), `@noble/post-quantum` | Same primitive; keys custodied in an HSM/TPM, not a browser tab |
| Signatures | Real ML-DSA-65 (FIPS 204) | Same; hardware-backed signing, key ceremonies for custodians |
| Content encryption | Real AES-256-GCM via WebCrypto | Same |
| Image watermark | Real LSB steganography, seeded pixel diffusion, PNG only (lossless) | Transform-domain (DCT/DWT) spread-spectrum watermarking, robust to re-compression, cropping and mild geometric distortion; JPEG support |
| PDF watermark | Real invisible content-stream text layer, redundant per page | Additional carriers (glyph micro-kerning, whitespace/word-spacing coding) for resilience against flattening/OCR re-typing |
| Ledger | Real SHA-256 hash chain, IndexedDB-persisted, JSON export/import | An actual permissioned multi-node DLT (e.g. Hyperledger Fabric) with real consensus across independently-operated nodes, not one browser's local store |
| Identity custody | All keypairs live in one browser's storage, for demo convenience — a sender can "see" a recipient's secret key in this build | Keys are generated and stay on the identity's own device/HSM; a sender only ever has recipients' *public* keys |
| Sabha Protocol | Real k-of-n ML-DSA countersignatures | Custodians on separate devices/sessions; policy engine tying quorum thresholds to document classification |

None of the above is hidden in the UI — the landing page and this README both say it
outright, because an honest demo is a more convincing one.

---

## Deploying

This is a plain Next.js App Router project with no server routes — every page in `next
build` prerenders as static content, so it deploys anywhere that serves static files, with
Vercel needing zero configuration:

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com), **New Project → Import** the repo.
3. Framework preset: **Next.js** (auto-detected). No environment variables, no build command
   overrides needed. Click **Deploy**.

Locally: `npm run build && npm run start`.

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · zustand ·
`@noble/post-quantum` (ML-KEM/ML-DSA/SLH-DSA, FIPS 203/204/205) · `@noble/hashes` · `pdf-lib`
· `idb-keyval`. No backend, no external API calls at runtime, no analytics.
