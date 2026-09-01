import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "@/lib/auth";
import { FORMS, FORM_BY_SLUG } from "@/lib/forms";
import type { SubmissionRow } from "@/lib/db";
import {
  getRecent,
  getSummary,
  isOpenRange,
  parseRange,
  type FormSummary,
} from "@/lib/queries";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Rekap admin" };
export const dynamic = "force-dynamic";

// Timestamps come out of Postgres as UTC; staff read them in WIB.
const TZ = "Asia/Jakarta";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});

const stampFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const range = parseRange(one("from"), one("to"));
  const open = isOpenRange(range);

  let summary: FormSummary[] = [];
  let recent: SubmissionRow[] = [];
  let dbError: string | null = null;
  try {
    [summary, recent] = await Promise.all([getSummary(range), getRecent(range)]);
  } catch (err) {
    console.error("admin load failed", err);
    dbError =
      "Tidak dapat membaca basis data. Periksa DATABASE_URL pada konfigurasi server.";
  }

  const byslug = new Map(summary.map((s) => [s.form_slug, s]));
  const totalSubmissions = summary.reduce((n, s) => n + s.submissions, 0);
  const totalFindings = summary.reduce((n, s) => n + s.findings, 0);

  const exportQuery = open
    ? ""
    : `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  return (
    <div className="min-h-dvh">
      <SiteHeader
        right={
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="eyebrow hover:text-ink">
              Keluar
            </button>
          </form>
        }
      />

      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <p className="eyebrow">Rekap pemeriksaan</p>
        <h1 className="signage mt-2 text-3xl sm:text-4xl">
          {totalFindings > 0 ? (
            <>
              <span className="text-alarm">{totalFindings} temuan</span> menunggu
              tindak lanjut
            </>
          ) : totalSubmissions > 0 ? (
            <>Tidak ada temuan pada periode ini</>
          ) : (
            <>Belum ada pemeriksaan masuk</>
          )}
        </h1>
        <p className="mt-2.5 text-sm text-ink-soft">
          {totalSubmissions} pemeriksaan{" "}
          {open
            ? "sejak awal"
            : `pada ${dateFmt.format(new Date(`${range.from}T00:00:00Z`))} – ${dateFmt.format(new Date(`${range.to}T00:00:00Z`))}`}
          .
        </p>

        {dbError && (
          <p
            className="mt-6 border-l-4 border-alarm bg-alarm-wash px-4 py-3 text-sm"
            role="alert"
          >
            {dbError}
          </p>
        )}

        {/* Filter + export */}
        <section className="mt-8 border-y border-rule py-5">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <form method="get" className="flex flex-wrap items-end gap-x-3 gap-y-3">
              <div className="grid gap-1.5">
                <label htmlFor="from" className="eyebrow">
                  Dari tanggal
                </label>
                <input
                  id="from"
                  name="from"
                  type="date"
                  className="field w-44"
                  defaultValue={open ? "" : range.from}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="to" className="eyebrow">
                  Sampai tanggal
                </label>
                <input
                  id="to"
                  name="to"
                  type="date"
                  className="field w-44"
                  defaultValue={open ? "" : range.to}
                />
              </div>
              <button type="submit" className="btn btn-ghost">
                Terapkan
              </button>
            </form>

            <a
              href={`/api/admin/export${exportQuery}`}
              className="btn btn-primary ml-auto"
            >
              Unduh Excel
            </a>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Satu berkas .xlsx berisi tiga lembar, satu per formulir. Rentang
            tanggal di atas ikut diterapkan pada unduhan.
          </p>
        </section>

        {/* Per-form summary */}
        <section className="mt-10">
          <h2 className="eyebrow mb-1">Per formulir</h2>
          <ul>
            {FORMS.map((form) => {
              const s = byslug.get(form.slug);
              return (
                <li
                  key={form.slug}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 border-t border-rule py-4 sm:grid-cols-[1fr_7rem_7rem_11rem]"
                >
                  <span className="signage text-lg">{form.title}</span>
                  <span className="font-mono text-sm tabular-nums sm:text-right">
                    {s?.submissions ?? 0}
                    <span className="ml-1.5 text-xs text-ink-soft">isian</span>
                  </span>
                  <span
                    className={`col-start-1 font-mono text-sm tabular-nums sm:col-start-3 sm:text-right ${
                      (s?.findings ?? 0) > 0 ? "text-alarm" : "text-ink-soft"
                    }`}
                  >
                    {s?.findings ?? 0}
                    <span className="ml-1.5 text-xs">temuan</span>
                  </span>
                  <span className="font-mono text-xs text-ink-soft sm:text-right">
                    {s?.last_submission
                      ? stampFmt.format(new Date(s.last_submission))
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-rule" />
        </section>

        {/* Recent submissions */}
        <section className="mt-10">
          <h2 className="eyebrow mb-1">
            Pemeriksaan terakhir {recent.length > 0 && `(${recent.length})`}
          </h2>

          {recent.length === 0 ? (
            <p className="border-t border-rule py-8 text-sm text-ink-soft">
              {dbError
                ? "Data tidak dapat dimuat."
                : "Belum ada pemeriksaan pada rentang tanggal ini."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-rule text-left">
                    <th className="eyebrow py-2.5 pr-4 font-semibold">Tanggal</th>
                    <th className="eyebrow py-2.5 pr-4 font-semibold">Formulir</th>
                    <th className="eyebrow py-2.5 pr-4 font-semibold">Area</th>
                    <th className="eyebrow py-2.5 text-right font-semibold">
                      Temuan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id} className="border-b border-rule align-top">
                      <td className="py-2.5 pr-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {dateFmt.format(new Date(`${row.inspection_date}T00:00:00Z`))}
                      </td>
                      <td className="py-2.5 pr-4">
                        {FORM_BY_SLUG[row.form_slug]?.title ?? row.form_slug}
                      </td>
                      <td className="py-2.5 pr-4">{row.area}</td>
                      <td
                        className={`py-2.5 text-right font-mono tabular-nums ${
                          row.findings > 0
                            ? "font-semibold text-alarm"
                            : "text-ink-soft"
                        }`}
                      >
                        {row.findings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {recent.length >= 50 && (
            <p className="mt-3 text-xs text-ink-soft">
              Menampilkan 50 terbaru. Unduh Excel untuk data lengkap.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
