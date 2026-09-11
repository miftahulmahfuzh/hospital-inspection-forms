import Image from "next/image";
import Link from "next/link";

import logoK3 from "@/assets/logo-k3.png";
import logoKabupaten from "@/assets/logo-lima-puluh-kota.png";

// Both institutional marks sit left of the wordmark: kabupaten arms first, then
// the K3 gear — institution, then subject matter. `preload` (not `priority`,
// which Next 16 deprecates) keeps the brand chrome out of the lazy-load path;
// alt="" because the wordmark next to them carries the meaning.
export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center gap-2">
            <Image src={logoKabupaten} alt="" className="h-7 w-auto" preload />
            <Image src={logoK3} alt="" className="h-7 w-auto" preload />
          </span>
          <span className="flex items-baseline gap-2.5">
            {/* .wordmark (unlayered, after .signage in globals.css) wins the
                cascade over .signage's uppercase — "InsMobile", never
                "INSMOBILE". */}
            <span className="signage wordmark text-lg text-ink">InsMobile</span>
            <span className="eyebrow hidden sm:inline">
              Inspeksi K3RS · RSUD dr. Achmad Darwis
            </span>
          </span>
        </Link>
        {right}
      </div>
    </header>
  );
}
