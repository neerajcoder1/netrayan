"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/identities", label: "Identities" },
  { href: "/distribute", label: "Sender Console" },
  { href: "/inbox", label: "Recipient Inbox" },
  { href: "/ledger", label: "Ledger" },
  { href: "/forensics", label: "Forensics" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--background)]/80 border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo size={26} />
          <div className="flex flex-col justify-center h-full">
            <span className="font-semibold tracking-wide text-[17px]">Netrayan</span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-[var(--accent-soft)] text-accent" : "text-muted hover:text-foreground hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-3 pb-2 -mt-1">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                active ? "bg-[var(--accent-soft)] text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
