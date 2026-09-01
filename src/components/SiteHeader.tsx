import Link from "next/link";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="signage text-lg text-ink">Inspeksi K3RS</span>
          <span className="eyebrow hidden sm:inline">RSUD dr. Achmad Darwis</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
