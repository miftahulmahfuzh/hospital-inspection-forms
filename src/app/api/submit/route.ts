import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { allQuestions, countFindings, getForm } from "@/lib/forms";

export const runtime = "nodejs";

const MAX_TEXT = 2000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return bad("Format permintaan tidak valid.");
  }

  const { formSlug, answers } = (payload ?? {}) as {
    formSlug?: unknown;
    answers?: unknown;
  };

  if (typeof formSlug !== "string") return bad("Formulir tidak dikenali.");
  const form = getForm(formSlug);
  if (!form) return bad("Formulir tidak dikenali.");

  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return bad("Jawaban tidak valid.");
  }
  const raw = answers as Record<string, unknown>;

  // Rebuild the answer map from the form definition, so unknown keys are dropped
  // rather than persisted, and every value is checked against its question.
  const clean: Record<string, string> = {};
  for (const q of allQuestions(form)) {
    const value = raw[q.id];
    if (value !== undefined && typeof value !== "string") {
      return bad(`Jawaban untuk "${q.label}" tidak valid.`);
    }
    const text = (value ?? "").trim();

    if (q.type === "file") {
      let uploaded: unknown;
      try {
        uploaded = text ? JSON.parse(text) : [];
      } catch {
        return bad(`Berkas untuk "${q.label}" tidak valid.`);
      }
      if (!Array.isArray(uploaded)) {
        return bad(`Berkas untuk "${q.label}" tidak valid.`);
      }
      if (q.required && uploaded.length === 0) {
        return bad(`"${q.label}" wajib diisi.`);
      }
      if (uploaded.length > (q.maxFiles ?? 1)) {
        return bad(`Maksimal ${q.maxFiles ?? 1} berkas untuk "${q.label}".`);
      }
      for (const f of uploaded) {
        const url = (f as { url?: unknown } | null)?.url;
        if (typeof url !== "string" || !url.includes(".public.blob.vercel-storage.com/")) {
          return bad(`Berkas untuk "${q.label}" tidak valid.`);
        }
      }
      if (text.length > MAX_TEXT * 4) {
        return bad(`Jawaban untuk "${q.label}" terlalu panjang.`);
      }
      if (uploaded.length > 0) clean[q.id] = text;
      continue;
    }

    if (!text) {
      if (q.required) return bad(`"${q.label}" wajib diisi.`);
      continue;
    }

    if (q.options && !q.options.includes(text)) {
      return bad(`Pilihan untuk "${q.label}" tidak valid.`);
    }
    if (q.type === "date" && (!ISO_DATE.test(text) || Number.isNaN(Date.parse(text)))) {
      return bad(`Tanggal pada "${q.label}" tidak valid.`);
    }
    if (text.length > MAX_TEXT) {
      return bad(`Jawaban untuk "${q.label}" terlalu panjang.`);
    }

    clean[q.id] = text;
  }

  const area = clean[form.areaQuestionId];
  const inspectionDate = clean[form.dateQuestionId];
  if (!area || !inspectionDate) {
    return bad("Area dan tanggal pemeriksaan wajib diisi.");
  }

  try {
    await ensureSchema();
    const rows = await sql`
      INSERT INTO submissions (form_slug, area, inspection_date, answers, findings)
      VALUES (${form.slug}, ${area}, ${inspectionDate}, ${JSON.stringify(clean)}::jsonb,
              ${countFindings(clean)})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: rows[0]?.id }, { status: 201 });
  } catch (err) {
    console.error("submission failed", err);
    return NextResponse.json(
      { error: "Gagal menyimpan ke basis data. Coba lagi sebentar lagi." },
      { status: 500 },
    );
  }
}
