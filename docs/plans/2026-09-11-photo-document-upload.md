# Photo/document upload for inspection forms — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Let inspectors attach photos/PDFs to each of the three inspection forms, matching the "Dokumentasi" upload field the brother's source Google Forms now require, without breaking the existing draft/submit/export pipeline.

**Architecture:** Files upload directly from the browser to Vercel Blob (public access) via `@vercel/blob`'s client-upload handshake — never through our own serverless function body, which has a small size limit that would reject a 100MB photo set. Each question's answer stays a plain string in the existing `answers: Record<string,string>` shape: for a `"file"` question the string is a JSON array of `{url, name, size}`, so localStorage drafts, `/api/submit`, the Neon `answers` JSONB column, and the Excel export all keep working with zero schema migration.

**Tech Stack:** Next.js 16 (App Router) on Vercel, `@vercel/blob` (new dependency), Neon Postgres (unchanged), ExcelJS (unchanged).

---

## Why this shape (read before coding)

- **No new DB column.** `submissions.answers` is already `JSONB` keyed by question id → string. A file question's "string" is just `JSON.stringify([{url,name,size}, ...])`. This is the only design that touches zero rows of the existing pipeline (draft save/restore, `/api/submit` validation loop, `allQuestions()` export loop) — everything else already iterates "some string per question id."
- **Client-direct upload, not a proxy route.** The forms allow up to 10 files × 100MB. Routing that through our Next.js API route on Vercel would hit the platform's request body limit long before 100MB. Vercel Blob's client-upload pattern (`@vercel/blob/client`'s `upload()` + a server route that only *authorizes* each upload via `handleUpload()`) is the standard way around this — the bytes go straight from the browser to Blob storage.
- **Public access, not private/signed.** These are facility-condition photos (a cracked stair, a rusted APAR tank), not patient data. Public Blob URLs are simplest and are what the free/hobby Blob tier supports without extra signing code. If that assumption is wrong for this hospital, that's a one-line change (`access: "public"` → `"private"` plus a signed-URL helper for the export) — flag it in review, don't block on it.
- **Upload on file-pick, not on form-submit.** Uploading immediately (per file) gives the inspector progress feedback and means the final "Kirim pemeriksaan" click only ever sends small JSON — no multi-hundred-MB submit request, no risk of losing a completed checklist to a flaky upload at the very end.

## Prerequisite (you, not the agent, must do this first)

**Task 0 — Provision a Vercel Blob store.** In the Vercel dashboard: Storage → Create Database → Blob → name it (e.g. `k3rs-uploads`) → connect it to the `hospital-inspection-forms` project. This automatically sets `BLOB_READ_WRITE_TOKEN` in the project's Production/Preview env vars. For local dev, copy that same token into `.env.local`:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
```

Nothing below will work end-to-end without this. Everything through Task 7 can still be *written and type-checked* without it — only Task 8 (live upload test) needs the real token.

---

### Task 1: Add the dependency and confirm its current API

**Files:**
- Modify: `package.json`

**Step 1: Install**

```bash
npm install @vercel/blob
```

**Step 2: Confirm the API shape before writing Task 3/4 code**

Library APIs drift between versions. Before copying the code in this plan verbatim, check what actually shipped:

```bash
sed -n '1,120p' node_modules/@vercel/blob/dist/client.d.ts
```

Confirm `upload()` (client) and `handleUpload()` (server) still exist with roughly the signatures used below — `handleUpload({ body, request, onBeforeGenerateToken, onUploadCompleted })` returning a JSON response, and `upload(pathname, file, { access, handleUploadUrl, clientPayload })` returning `{ url, pathname, ... }`. If the names or shapes changed, adapt Tasks 3–4 to match what's actually installed; don't force the old shape.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @vercel/blob for form file uploads"
```

---

### Task 2: Extend the form schema and add the three "Dokumentasi" questions

**Files:**
- Modify: `src/lib/forms.ts`

**Step 1: Extend the type**

```ts
export type QuestionType = "text" | "textarea" | "radio" | "select" | "date" | "file";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  /** "file" questions only. */
  maxFiles?: number;
  maxSizeMB?: number;
  /** Passed to the <input accept> attribute and enforced server-side. */
  accept?: string;
};
```

**Step 2: Add a shared constant near `LOKASI_OPTIONS`**

```ts
const DOC_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
```

**Step 3: Append a file question to each form**

The source forms all call this field "Dokumentasi" — the environmental form's copy read "Dokumetasi" (missing an "n"), which reads as a typo rather than a deliberate label; use "Dokumentasi" everywhere for consistency.

In `inspeksi-lingkungan`'s `"Penanganan B3"` section, after `q445808133` (Catatan temuan lain):

```ts
{ id: "q_dokumentasi", label: "Dokumentasi", type: "file", required: true, maxFiles: 10, maxSizeMB: 100, accept: DOC_ACCEPT },
```

In `kondisi-apar`'s single section, after `q1109164454` (Catatan Tambahan):

```ts
{ id: "q_dokumentasi", label: "Dokumentasi", type: "file", required: true, maxFiles: 1, maxSizeMB: 10, accept: DOC_ACCEPT },
```

In `tanggap-darurat`'s `"Keselamatan Kebakaran"` section, after `q_temuan_lainnya` (Temuan lainnya):

```ts
{ id: "q_dokumentasi_pemeriksaan", label: "Dokumentasi Pemeriksaan", type: "file", required: true, maxFiles: 10, maxSizeMB: 100, accept: DOC_ACCEPT },
```

**Step 4: Verify**

```bash
npx tsc --noEmit
```

Expect no errors — `Question`'s new fields are all optional, so every existing literal still type-checks.

**Step 5: Commit**

```bash
git add src/lib/forms.ts
git commit -m "feat: add file question type and Dokumentasi fields to all three forms"
```

---

### Task 3: Server route that authorizes each upload

**Files:**
- Create: `src/app/api/upload/route.ts`

This route never sees file bytes — it only decides *whether* a given upload is allowed (right form, right question, right size/type) and hands back a short-lived token that the browser then uses to talk to Blob storage directly.

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { FORM_BY_SLUG, allQuestions } from "@/lib/forms";

export const runtime = "nodejs";

type ClientPayload = { formSlug?: string; questionId?: string };

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload: ClientPayload = clientPayload ? JSON.parse(clientPayload) : {};
        const form = payload.formSlug ? FORM_BY_SLUG[payload.formSlug] : undefined;
        const question = form
          ? allQuestions(form).find((q) => q.id === payload.questionId)
          : undefined;

        if (!form || !question || question.type !== "file") {
          throw new Error("Unggahan tidak dikenali untuk formulir/pertanyaan ini.");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "application/pdf",
          ],
          maximumSizeInBytes: (question.maxSizeMB ?? 10) * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ formSlug: form.slug, questionId: question.id }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to persist here — the browser attaches the returned URL to its
        // answers map and it rides along with the normal /api/submit POST. (This
        // callback also won't fire against a localhost dev server, since Blob needs
        // a public URL to call back to — that's expected, not a bug.)
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unggah gagal." },
      { status: 400 },
    );
  }
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: authorize per-question file uploads via Vercel Blob"
```

---

### Task 4: File-picker UI in the form

**Files:**
- Modify: `src/components/InspectionForm.tsx`

**Step 1: Add imports and the shared file-answer helper (top of file, near existing helpers)**

```ts
import { upload } from "@vercel/blob/client";

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
```

**Step 2: Fix `missing` and `answeredCount` for file questions**

A `"file"` answer with no uploads yet is the string `"[]"`, which is truthy under `.trim()` — the existing required-check would wrongly treat an empty file list as answered. Replace the two spots that check `(answers[q.id] ?? "").trim()`:

```ts
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
```

Update `sectionProgress`'s `done` count the same way (it currently reuses the same `.trim()` check inline).

**Step 3: Thread `form.slug` down to `QuestionField`**

`QuestionField` is called from the section-rendering loop as `<QuestionField key={q.id} question={q} value={...} onChange={setAnswer} invalid={...} />`. Add `formSlug={form.slug}` there, and accept it in the component's props.

**Step 4: Dispatch to a new `FileQuestionField` inside `QuestionField`'s render**

Add a branch before the final `<input>` fallback:

```tsx
) : question.type === "file" ? (
  <FileQuestionField
    question={question}
    value={value}
    onChange={onChange}
    formSlug={formSlug}
    invalid={invalid}
  />
) : (
```

**Step 5: Implement `FileQuestionField`**

```tsx
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
```

**Step 6: Verify — manual, in the browser (no test framework in this repo)**

```bash
npm run dev
```

Open any of the three forms, scroll to the Dokumentasi field, confirm: the picker respects `accept`/`multiple`, an oversized or over-count pick shows the red error text without calling `upload()`, and a real small image shows "Mengunggah…" then appears in the list with a working link. (The link will 404 until Task 0's Blob store is live — that's expected before then.)

**Step 7: Commit**

```bash
git add src/components/InspectionForm.tsx
git commit -m "feat: file-picker UI for Dokumentasi questions"
```

---

### Task 5: Validate file answers on submit

**Files:**
- Modify: `src/app/api/submit/route.ts`

**Step 1: Add a file branch inside the per-question loop**

The loop currently does one thing for every question type (trim, check required, check options/date/length). Split out `"file"` before that shared logic, since a file answer is a JSON array, not a plain trimmed value:

```ts
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
```

The `.includes(".public.blob.vercel-storage.com/")` check exists so `/api/submit` can't be used to smuggle in an arbitrary attacker-controlled URL under a legitimate-looking answer — every accepted file must actually be a blob our own store issued.

**Step 2: Verify**

```bash
npx tsc --noEmit
```

Then manually: submit a form with the Dokumentasi field empty → expect the existing `"${label}" wajib diisi.` error. Submit with 2 real uploaded files → expect `201` and check the Neon row's `answers` JSONB has the file question as a JSON-array string.

**Step 3: Commit**

```bash
git add src/app/api/submit/route.ts
git commit -m "feat: validate file-question answers server-side on submit"
```

---

### Task 6: Show attached files in the Excel export

**Files:**
- Modify: `src/app/api/admin/export/route.ts`

**Step 1: Add a formatting helper near the top**

```ts
function formatFileAnswer(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  try {
    const files = JSON.parse(raw) as { url: string; name: string }[];
    return files.map((f) => `${f.name}: ${f.url}`).join("\n");
  } catch {
    return "";
  }
}
```

**Step 2: Widen file columns, same as textarea**

```ts
width: q.type === "textarea" || q.type === "file" ? 40 : q.type === "radio" ? 14 : 20,
```

**Step 3: Use the formatted value instead of the raw JSON string**

In the `rows.forEach` block, the row object is built with:

```ts
...Object.fromEntries(questions.map((q) => [q.id, answers[q.id] ?? ""])),
```

Change to:

```ts
...Object.fromEntries(
  questions.map((q) => [
    q.id,
    q.type === "file" ? formatFileAnswer(answers[q.id]) : (answers[q.id] ?? ""),
  ]),
),
```

Leave the per-cell date/color-coding loop below untouched — it already only acts on `"Tidak"`/`"Rusak"`/`"Ya"`/`"Baik"` values, none of which a file cell will ever equal, so it's a no-op there.

**Step 4: Verify — manual**

Download the Excel export after submitting a test row with attachments; confirm the file question's column shows `name: url` (one per line) and the column is wide enough to read. Bare `https://...` lines are usually auto-linkified by Excel on open — nice to have, not required.

**Step 5: Commit**

```bash
git add src/app/api/admin/export/route.ts
git commit -m "feat: include attached files in the Excel export"
```

---

### Task 7: Document the new env var

**Files:**
- Modify: `.env.example`

**Step 1: Add**

```
# Vercel Blob store token, for photo/document uploads attached to inspection forms.
# Create a Blob store in the Vercel dashboard (Storage -> Create Database -> Blob),
# connect it to this project (sets this automatically in Production/Preview), then
# copy the same token here for local dev.
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document BLOB_READ_WRITE_TOKEN"
```

---

### Task 8: End-to-end verification

This repo has no test runner (`package.json` has no `test` script) — the existing gate, per `docs/plans/2026-09-01-ios-date-input-overflow.md`, is lint + typecheck + build, plus a real browser pass for anything visual. Do all of it:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Then, with `BLOB_READ_WRITE_TOKEN` set from Task 0:

```bash
npm run dev
```

1. Open `/forms/kondisi-apar`, fill every required field, attach one real photo to Dokumentasi, submit. Confirm the success screen and that `findings`/redirect behave as before.
2. Open the Vercel dashboard's Blob store browser (or `curl` the returned URL) — confirm the file is actually there and publicly fetchable.
3. Log into `/admin`, confirm the new submission shows up in "Pemeriksaan terakhir".
4. Download the Excel export, open it, confirm the Dokumentasi column has the file name + URL.
5. Repeat once on `/forms/inspeksi-lingkungan` picking 2–3 files at once (multi-file path), and confirm picking an 11th file (over `maxFiles: 10`) is rejected client-side with the red error text, not silently uploaded.

**Step: Final commit if anything was tweaked during verification**

```bash
git add -A
git commit -m "fix: address issues found during upload feature verification"
```

---

## Deliberately out of scope (say so if asked, don't silently do it)

- **Deleting orphaned blobs.** If an inspector uploads a file then removes it via "Hapus" before submitting, the blob is never deleted from storage — it's just dropped from the answer. Low-volume internal tool, low cost; a cleanup job is a separate task if it ever matters.
- **Private/signed Blob access.** Everything here assumes public-read blobs are fine for facility photos. Revisit only if the hospital says otherwise.
- **Editing a submission after the fact.** There's no "add a photo to an old inspection" flow — matches how every other field on this site already works (submit-once, no admin edit).
