import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-20">
        <p className="eyebrow">404</p>
        <h1 className="signage mt-2 text-4xl">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Tautan mungkin salah ketik atau formulir sudah dipindahkan.
        </p>
        <Link href="/" className="btn btn-primary mt-7">
          Kembali ke daftar formulir
        </Link>
      </main>
    </div>
  );
}
