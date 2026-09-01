import Link from "next/link";
import { FORMS, allQuestions } from "@/lib/forms";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <SiteHeader
        right={
          <Link href="/admin" className="eyebrow hover:text-ink">
            Admin
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-5">
        <section className="border-b border-rule py-12 sm:py-16">
          <p className="eyebrow">Komite K3RS · Formulir Pemeriksaan</p>
          <h1 className="signage mt-3 max-w-4xl text-4xl leading-[0.98] sm:text-[3.5rem]">
            Catat temuan di tempat,
            <br />
            <span className="text-safe">bukan setelah kembali ke kantor.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
            Tiga daftar periksa untuk ronde K3RS. Isi langsung dari ponsel saat
            berkeliling area. Jawaban tersimpan otomatis di perangkat, jadi
            pemeriksaan tidak hilang bila halaman tertutup.
          </p>
        </section>

        <section className="py-10 sm:py-12">
          <h2 className="eyebrow mb-1">Pilih formulir</h2>

          <ul>
            {FORMS.map((form, i) => {
              const questions = allQuestions(form);
              const sections = form.sections.filter((s) => s.title).length;
              return (
                <li key={form.slug}>
                  <Link
                    href={`/forms/${form.slug}`}
                    className="group grid grid-cols-[2.5rem_1fr_auto] items-start gap-x-4 gap-y-2 border-t border-rule py-6 transition-colors hover:bg-surface sm:gap-x-6"
                  >
                    <span className="font-mono text-sm text-ink-soft tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <h3 className="signage text-2xl transition-colors group-hover:text-safe sm:text-[1.75rem]">
                        {form.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                        {form.description}
                      </p>
                      <p className="mt-2.5 font-mono text-xs text-ink-soft tabular-nums">
                        {questions.length} pertanyaan
                        {sections > 0 && ` · ${sections} bagian`}
                      </p>
                    </div>

                    <span
                      aria-hidden
                      className="signage col-start-3 row-start-1 self-center text-2xl text-rule transition-colors group-hover:text-safe"
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-rule" />
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10">
        <p className="text-xs text-ink-soft">
          Komite Kesehatan dan Keselamatan Kerja Rumah Sakit · RSUD dr. Achmad
          Darwis
        </p>
      </footer>
    </div>
  );
}
