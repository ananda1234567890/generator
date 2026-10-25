import Link from "next/link";
import { Engine } from "@/components/Engine";

const TABS = [
  { href: "/generate", label: "Generate" },
  { href: "/headshots", label: "Headshots" },
  { href: "/library", label: "Session" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Engine />
      <header className="border-b border-line">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
          <span className="mr-4 font-semibold">Generator</span>
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-panel hover:text-foreground">
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
