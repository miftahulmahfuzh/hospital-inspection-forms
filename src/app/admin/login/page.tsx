import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Masuk admin" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/admin");

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-5 py-16 sm:py-24">
        <p className="eyebrow">Area terbatas</p>
        <h1 className="signage mt-2 text-3xl">Masuk admin</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
          Rekap dan unduhan Excel hanya untuk pengurus K3RS.
        </p>
        <LoginForm />
      </main>
    </div>
  );
}
