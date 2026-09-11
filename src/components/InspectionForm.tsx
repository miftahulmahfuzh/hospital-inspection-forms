"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import type { FormDef, Question } from "@/lib/forms";
import { allQuestions } from "@/lib/forms";

type Answers = Record<string, string>;

type UploadedFile = { url: string; name: string; size: number };

function parseFileAnswer(value: string): UploadedFile[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as UploadedFile[]) : [];
  } catch {
    return [];
  }
}

/** Green for the compliant answer, red for the one that generates a work order. */
function toneFor(option: string): "safe" | "alarm" | "neutral" {
  if (option === "Ya" || option === "Baik") return "safe";
  if (option === "Tidak" || option === "Rusak") return "alarm";
  return "neutral";
}

function storageKey(slug: string) {
  return `k3rs:draft:${slug}`;
}

function todayLocalISO() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function InspectionForm({ form }: { form: FormDef }) {
  const questions = useMemo(() => allQuestions(form), [form]);
  const [answers, setAnswers] = useState<Answers>({});
  const [showErrors, setShowErrors] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [status, setStatus] = useState<"editing" | "sending" | "done">("editing");
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // --- draft persistence: an inspection round outlives a browser tab ---------

  // Reading persisted state on mount is the one case where seeding state from an
  // effect is correct: localStorage is a client-only external store, and doing it
  // during render would desync the server-rendered empty form from the hydrated one.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(form.slug));
      if (raw) {
        const parsed = JSON.parse(raw) as Answers;
        if (parsed && typeof parsed === "object") {
          setAnswers(parsed);
          if (Object.keys(parsed).length > 0) setRestored(true);
        }
      } else {
        setAnswers({ [form.dateQuestionId]: todayLocalISO() });
      }
    } catch {
      // A corrupt draft shouldn't block the form; start clean.
      setAnswers({ [form.dateQuestionId]: todayLocalISO() });
    }
  }, [form.slug, form.dateQuestionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (status === "done" || Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(storageKey(form.slug), JSON.stringify(answers));
    } catch {
      // Private-mode or full storage — the form still works, just without a draft.
    }
  }, [answers, form.slug, status]);

  // --- rail position --------------------------------------------------------

  useEffect(() => {
    if (status === "done") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const idx = sectionRefs.current.indexOf(visible.target as HTMLElement);
          if (idx >= 0) setActiveSection(idx);
        }
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 },
    );
    for (const el of sectionRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [status, form.slug]);

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  // --- validation -----------------------------------------------------------

  const missing = useMemo(() => {
    const out = new Set<string>();
    for (const q of questions) {
      if (!q.required) continue;
      const answered =
        q.type === "file"
          ? parseFileAnswer(answers[q.id] ?? "").length > 0
          : Boolean((answers[q.id] ?? "").trim());
      if (!answered) out.add(q.id);
    }
    return out;
  }, [questions, answers]);

  const answeredCount = questions.filter((q) =>
    q.type === "file"
      ? parseFileAnswer(answers[q.id] ?? "").length > 0
      : Boolean((answers[q.id] ?? "").trim()),
  ).length;
  const findingCount = questions.filter((q) =>
    ["Tidak", "Rusak"].includes(answers[q.id] ?? ""),
  ).length;

  const sectionProgress = form.sections.map((s) => ({
    total: s.questions.length,
    done: s.questions.filter((q) =>
      q.type === "file"
        ? parseFileAnswer(answers[q.id] ?? "").length > 0
        : Boolean((answers[q.id] ?? "").trim()),
    ).length,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (missing.size > 0) {
      setShowErrors(true);
      const firstId = questions.find((q) => missing.has(q.id))?.id;
      if (firstId) {
        document
          .getElementById(`q-${firstId}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formSlug: form.slug, answers }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Pengiriman gagal. Coba lagi.");
      }
      try {
        localStorage.removeItem(storageKey(form.slug));
      } catch {
        /* nothing to clean up */
      }
      setStatus("done");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setStatus("editing");
      setError(
        err instanceof Error
          ? err.message
          : "Pengiriman gagal. Periksa koneksi lalu coba lagi.",
      );
    }
  }

  function startNew() {
    setAnswers({ [form.dateQuestionId]: todayLocalISO() });
    setShowErrors(false);
    setRestored(false);
    setStatus("editing");
    setActiveSection(0);
  }

  function discardDraft() {
    try {
      localStorage.removeItem(storageKey(form.slug));
    } catch {
      /* nothing to clean up */
    }
    setAnswers({ [form.dateQuestionId]: todayLocalISO() });
    setRestored(false);
    setShowErrors(false);
  }

  // --- submitted ------------------------------------------------------------

  if (status === "done") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div
          className="border-l-4 border-safe bg-safe-wash px-5 py-6"
          role="status"
        >
          <p className="eyebrow text-safe">Terkirim</p>
          <h2 className="signage mt-2 text-3xl">{form.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Pemeriksaan tersimpan dan sudah masuk ke rekap admin.
            {findingCount > 0 && (
              <>
                {" "}
                <strong className="font-semibold text-alarm">
                  {findingCount} temuan
                </strong>{" "}
                tercatat pada pemeriksaan ini.
              </>
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={startNew} className="btn btn-primary">
            Isi pemeriksaan lain
          </button>
          <Link href="/" className="btn btn-ghost">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  // --- editing --------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Phone: the rail collapses to a segment bar pinned under the header. */}
      <div className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-5xl px-5 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="signage truncate text-sm">
              {form.sections[activeSection]?.title ?? form.title}
            </span>
            <span className="rail-count shrink-0">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="rail-bar mt-2" aria-hidden>
            {sectionProgress.map((p, i) => (
              <div
                key={i}
                className="rail-bar-seg"
                data-state={
                  p.done === p.total ? "done" : i === activeSection ? "active" : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 lg:grid-cols-[13rem_1fr] lg:gap-12">
        {/* Desktop: the evacuation rail. */}
        <nav className="rail hidden lg:block" aria-label="Bagian formulir">
          <p className="eyebrow mb-3">
            {answeredCount}/{questions.length} terisi
          </p>
          {form.sections.map((section, i) => {
            const p = sectionProgress[i];
            const state =
              p.done === p.total ? "done" : i === activeSection ? "active" : undefined;
            return (
              <a
                key={i}
                href={`#section-${i}`}
                className="rail-tick"
                data-state={state}
              >
                <span className="flex-1">
                  {section.title ?? "Identitas pemeriksaan"}
                </span>
                <span className="rail-count">
                  {p.done}/{p.total}
                </span>
              </a>
            );
          })}
        </nav>

        <div className="min-w-0">
          <header className="mb-2">
            <p className="eyebrow">Formulir pemeriksaan</p>
            <h1 className="signage mt-2 text-3xl sm:text-4xl">{form.title}</h1>
            <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-ink-soft">
              {form.description}
            </p>
          </header>

          {restored && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-signal bg-surface px-4 py-3">
              <p className="text-sm text-ink-soft">
                Draf sebelumnya dipulihkan dari perangkat ini.
              </p>
              <button
                type="button"
                onClick={discardDraft}
                className="eyebrow underline underline-offset-4 hover:text-ink"
              >
                Mulai kosong
              </button>
            </div>
          )}

          {form.sections.map((section, i) => (
            <section
              key={i}
              id={`section-${i}`}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className="mt-9 scroll-mt-28"
            >
              {section.title && (
                <h2 className="signage border-b-2 border-ink pb-1.5 text-xl">
                  {section.title}
                </h2>
              )}
              {section.questions.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id] ?? ""}
                  onChange={setAnswer}
                  formSlug={form.slug}
                  invalid={showErrors && missing.has(q.id)}
                />
              ))}
            </section>
          ))}

          <div className="mt-10 border-t-2 border-ink pt-6">
            {findingCount > 0 && (
              <p className="mb-4 text-sm text-ink-soft">
                <strong className="font-semibold text-alarm">
                  {findingCount} temuan
                </strong>{" "}
                tercatat sejauh ini.
              </p>
            )}

            {showErrors && missing.size > 0 && (
              <p
                className="mb-4 border-l-4 border-alarm bg-alarm-wash px-4 py-3 text-sm"
                role="alert"
              >
                {missing.size} pertanyaan wajib belum terisi. Bagian yang belum
                lengkap ditandai merah.
              </p>
            )}

            {error && (
              <p
                className="mb-4 border-l-4 border-alarm bg-alarm-wash px-4 py-3 text-sm"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={status === "sending"}
                className="btn btn-primary"
              >
                {status === "sending" ? "Mengirim…" : "Kirim pemeriksaan"}
              </button>
              <p className="text-xs text-ink-soft">
                Tersimpan otomatis di perangkat sampai dikirim.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  formSlug,
  invalid,
}: {
  question: Question;
  value: string;
  onChange: (id: string, value: string) => void;
  formSlug: string;
  invalid: boolean;
}) {
  const labelId = `label-${question.id}`;

  return (
    <div id={`q-${question.id}`} className="question" data-invalid={invalid}>
      <span id={labelId} className="question-label">
        {question.label}
        {question.required && (
          <span className="ml-1 text-alarm" aria-label="wajib diisi">
            *
          </span>
        )}
      </span>

      {question.type === "radio" && question.options ? (
        <div
          className="choice-group"
          role="radiogroup"
          aria-labelledby={labelId}
          aria-required={question.required}
        >
          {question.options.map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                className="choice"
                data-selected={selected}
                data-tone={toneFor(option)}
                onClick={() => onChange(question.id, selected ? "" : option)}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : question.type === "select" && question.options ? (
        <select
          className="field"
          aria-labelledby={labelId}
          aria-required={question.required}
          value={value}
          onChange={(e) => onChange(question.id, e.target.value)}
        >
          <option value="">Pilih…</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : question.type === "textarea" ? (
        <textarea
          className="field min-h-28 resize-y"
          aria-labelledby={labelId}
          aria-required={question.required}
          rows={4}
          value={value}
          placeholder="Tulis catatan bila ada"
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      ) : question.type === "file" ? (
        <FileQuestionField
          question={question}
          value={value}
          onChange={onChange}
          formSlug={formSlug}
          invalid={invalid}
        />
      ) : (
        <input
          className="field"
          type={question.type === "date" ? "date" : "text"}
          aria-labelledby={labelId}
          aria-required={question.required}
          value={value}
          placeholder={question.type === "date" ? undefined : "Tulis di sini"}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      )}
    </div>
  );
}

function FileQuestionField({
  question,
  value,
  onChange,
  formSlug,
  invalid,
}: {
  question: Question;
  value: string;
  onChange: (id: string, value: string) => void;
  formSlug: string;
  invalid: boolean;
}) {
  const files = useMemo(() => parseFileAnswer(value), [value]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxFiles = question.maxFiles ?? 1;
  const maxBytes = (question.maxSizeMB ?? 10) * 1024 * 1024;

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same file be re-picked after a "Hapus"

    if (picked.length === 0) return;
    if (files.length + picked.length > maxFiles) {
      setError(`Maksimal ${maxFiles} berkas.`);
      return;
    }
    const oversized = picked.find((f) => f.size > maxBytes);
    if (oversized) {
      setError(`"${oversized.name}" melebihi ${question.maxSizeMB ?? 10}MB.`);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of picked) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ formSlug, questionId: question.id }),
        });
        uploaded.push({ url: blob.url, name: file.name, size: file.size });
      }
      onChange(question.id, JSON.stringify([...files, ...uploaded]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unggah gagal. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  function remove(url: string) {
    onChange(question.id, JSON.stringify(files.filter((f) => f.url !== url)));
  }

  return (
    <div>
      <input
        type="file"
        className="field"
        accept={question.accept}
        multiple={maxFiles > 1}
        disabled={uploading || files.length >= maxFiles}
        onChange={handlePick}
        aria-invalid={invalid}
      />
      {uploading && <p className="mt-1.5 text-xs text-ink-soft">Mengunggah…</p>}
      {error && <p className="mt-1.5 text-xs text-alarm">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li key={f.url} className="flex items-center justify-between gap-3 text-xs">
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="truncate underline underline-offset-2"
              >
                {f.name}
              </a>
              <button
                type="button"
                onClick={() => remove(f.url)}
                className="shrink-0 text-alarm underline-offset-2 hover:underline"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
