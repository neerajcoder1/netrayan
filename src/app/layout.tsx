import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { Providers } from "./providers";
import CyberWelcome from "@/components/CyberWelcome";

export const metadata: Metadata = {
  title: "Netrayan — Post-Quantum Forensic Watermarking",
  description:
    "Netrayan: per-recipient invisible forensic watermarking, post-quantum signed decryption records, and a tamper-evident offline ledger — leak attribution for broadcast-encrypted documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col transition-colors duration-200">
        <Providers>
          <CyberWelcome />
          <NavBar />
          <main className="flex-1 w-full">{children}</main>
          <footer className="border-t border-[var(--border)] px-6 py-6 text-xs text-muted">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <span>Netrayan — SIH26237 prototype. Demonstration build; not for production use.</span>
              <span className="font-code opacity-60">ML-KEM-768 · ML-DSA-65 · SHA-256 hash chain</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
