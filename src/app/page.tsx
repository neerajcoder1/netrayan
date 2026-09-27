import Link from "next/link";
import Logo from "@/components/Logo";
import FlowAnimation from "@/components/FlowAnimation";

const STEPS = [
  {
    n: "01",
    title: "Encrypt once, per recipient",
    body: "The sender encrypts a document with AES-256-GCM under a key wrapped separately for every recipient via ML-KEM-768 (FIPS 203) key encapsulation — a real post-quantum key exchange, not a placeholder.",
  },
  {
    n: "02",
    title: "Watermark at the moment of decryption",
    body: "Each recipient's own decryption event generates a unique, invisible fingerprint — embedded in real PNG pixel data (LSB) or inside a real PDF's invisible text layer — so every visible copy is identical, every underlying copy is not.",
  },
  {
    n: "03",
    title: "Sign with their own key",
    body: "The recipient signs the decryption record with their own ML-DSA-65 (FIPS 204) private key. The watermark id is a hash of that signature — the mark and the proof are cryptographically the same object.",
  },
  {
    n: "04",
    title: "Commit to a tamper-evident ledger",
    body: "The signed record is appended to a local, SHA-256 hash-chained ledger. Editing any past entry — even by an administrator — breaks a verifiable chain, in full view, with no external blockchain and no cloud KMS.",
  },
  {
    n: "05",
    title: "Trace a leak back to one person",
    body: "Given only a leaked copy, Netrayan extracts the watermark, matches it in the ledger, and independently re-verifies the signature, the commitment, and the chain — producing cryptographic proof, not a log entry someone could dispute.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="flex items-center gap-2 mb-6">
            <span className="pill pill-neutral">Working prototype</span>
            <span className="pill pill-neutral">Runs fully client-side</span>
          </div>
          <div className="flex items-start gap-4 mb-5">
            <Logo size={44} />
            <div>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Netrayan</h1>
              <p className="text-muted text-sm mt-1">नेत्र + अयन — the eye&apos;s chronicle</p>
            </div>
          </div>
          <p className="text-lg sm:text-xl text-foreground/90 max-w-2xl leading-relaxed">
            When one sender encrypts a sensitive document for many recipients, a leak makes every
            recipient an equally plausible suspect. Netrayan gives every decrypted copy an
            invisible, recipient-specific fingerprint, cryptographically bound to a
            post-quantum-signed, tamper-evident record of who decrypted it and when —
            so a single leaked file can be traced back to exactly one person.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link href="/identities" className="btn btn-primary">
              Start the walkthrough →
            </Link>
            <Link href="#how" className="btn btn-secondary">
              How it works
            </Link>
            <Link href="/forensics" className="btn btn-ghost">
              Jump to leak tracing
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="text-accent text-xs font-semibold tracking-wider uppercase mb-2">The problem</div>
            <p className="text-sm text-muted leading-relaxed">
              Broadcast-encrypt, individually-decrypt distribution means every recipient can
              produce byte-identical plaintext. Server access logs are editable by an
              administrator. A static watermark applied before distribution is identical for
              everyone — it reproduces the very problem it claims to solve.
            </p>
          </div>
          <div className="card p-5">
            <div className="text-accent text-xs font-semibold tracking-wider uppercase mb-2">The approach</div>
            <p className="text-sm text-muted leading-relaxed">
              Move the fingerprint to the moment of decryption, generate it inside the
              recipient&apos;s own session, bind it to a signature only they could have produced, and
              record that signature somewhere no single party can quietly edit.
            </p>
          </div>
          <div className="card p-5">
            <div className="text-accent text-xs font-semibold tracking-wider uppercase mb-2">
              Two things beyond the brief
            </div>
            <p className="text-sm text-muted leading-relaxed">
              <strong className="text-foreground">Commitment-bound watermarking</strong> — the mark
              in the file is a hash of the real signature, not a paired-up random id. And the{" "}
              <strong className="text-foreground">Sabha Protocol</strong> — turning a match into a
              named accusation needs a quorum of independent custodians to countersign, so
              tracing power itself can&apos;t be abused by one compromised admin.
            </p>
          </div>
        </div>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 scroll-mt-20">
        <div className="mb-8">
          <div className="text-xs font-semibold tracking-[0.14em] text-accent uppercase mb-1.5">
            End-to-end flow
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How a leak gets traced</h2>
        </div>
        <div className="mb-8">
           <FlowAnimation />
        </div>
        <div className="grid gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5 flex gap-4 items-start">
              <div className="font-code text-accent/70 text-sm pt-0.5 shrink-0 w-8">{s.n}</div>
              <div>
                <div className="font-medium mb-1">{s.title}</div>
                <p className="text-sm text-muted leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="card-solid p-6 sm:p-8">
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-semibold tracking-[0.14em] text-accent uppercase mb-2">
                Deployment posture
              </div>
              <h3 className="text-xl font-semibold mb-3">Built for air-gapped rooms</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li>— No cloud KMS: all keys are generated and held locally.</li>
                <li>— No public blockchain: the ledger is a local hash chain, exported and
                  synced between nodes over removable media, like the environment it&apos;s meant for.</li>
                <li>— NIST post-quantum primitives throughout: ML-KEM-768 (FIPS 203) for key
                  exchange, ML-DSA-65 (FIPS 204) for signatures.</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-[0.14em] text-accent uppercase mb-2">
                What this build actually runs
              </div>
              <h3 className="text-xl font-semibold mb-3">Real crypto, honestly scoped</h3>
              <p className="text-sm text-muted leading-relaxed mb-3">
                This demo runs real ML-KEM/ML-DSA operations, real AES-256-GCM, a real
                LSB/invisible-text watermark carrier, and a real SHA-256 hash chain — entirely
                in your browser, so it can be reviewed and hosted as a static site. What it
                doesn&apos;t include is the production hardening a fielded deployment needs:
                hardware-backed key custody, multi-node ledger consensus, and
                compression/re-photography-resistant watermarking. See the README for the
                honest line between the two.
              </p>
              <Link href="/identities" className="btn btn-primary mt-1">
                Try it →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
