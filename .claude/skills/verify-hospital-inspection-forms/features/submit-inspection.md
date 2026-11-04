# Fill and send an inspection

## Sub-features

- One tap per Ya/Tidak (`role=radio`, tapping the selected one clears it), selects for fixed
  Lokasi lists, text/textarea, a date defaulting to the browser's local today, a Dokumentasi file
  field (see dokumentasi-upload.md).
- Progress: `answered/total` in the phone rail, "N temuan tercatat sejauh ini." while filling.
- "Kirim pemeriksaan" with required answers missing: an alert "N pertanyaan wajib belum terisi.
  Bagian yang belum lengkap ditandai merah." and a scroll to the first one; nothing is sent.
- Sent: `POST /api/submit {formSlug, answers}`; the server rebuilds the answer map from the form
  definition (unknown keys dropped), validates required/options/dates/lengths/files, counts
  `Tidak`/`Rusak` as findings, inserts one `submissions` row, answers `201 {ok, id}`. The page shows
  "Terkirim ... N temuan tercatat pada pemeriksaan ini." and the device draft is removed.

## How to get to it (user POV)

Home -> "Pemeriksaan Kondisi APAR" -> answer everything, attach a photo -> "Kirim pemeriksaan".

## Driving it with verify.sh

```sh
$V ui RUN $S/submit-apar.mjs -- "verify ui catatan satu"
$V sql RUN "select id, form_slug, area, inspection_date, findings, answers->>'q1109164454' note, answers->>'q_dokumentasi' files from submissions order by id desc limit 1"
```

End state: transcript `empty send: "10 pertanyaan wajib belum terisi. ..."`, `answered 7 Ya/Tidak
questions (Segel = Tidak)`, `uploaded: dokumentasi.jpg -> https://hifverifystore000.public.blob.vercel-storage.com/dokumentasi-<30 chars>.jpg`,
`sent: "TERKIRIM PEMERIKSAAN KONDISI APAR ... 1 temuan tercatat pada pemeriksaan ini."`,
`draft after send: cleared`, `result: PASS`; `-3-final.png` shows the green Terkirim panel. SQL:
id 6, `kondisi-apar | Gizi | <today> | 1 | verify ui catatan satu`, files
`[{"url":"https://hifverifystore000...jpg","name":"dokumentasi.jpg","size":9376}]`. Args: NOTE,
LOKASI (default `Gizi`, must be a Lokasi option), FIXTURE (default `dokumentasi.jpg`).

Server-side validation, no browser (the answers of a valid kondisi-apar inspection):

```sh
A='"q1519942906":"2026-11-04","q877086558":"IGD","q_pressure_gauge":"Ya","q_segel_apar":"Ya","q_hose_apar":"Ya","q_cylinder_apar":"Ya","q_head_grip":"Ya","q_spindle_head":"Ya","q_hydrotest":"Tidak","q1109164454":"verify api"'
F='"q_dokumentasi":"[{\"url\":\"https://hifverifystore000.public.blob.vercel-storage.com/dokumentasi-x.jpg\",\"name\":\"a.jpg\",\"size\":1}]"'
$V api RUN POST /api/submit "{\"formSlug\":\"kondisi-apar\",\"answers\":{$A,$F,\"extra\":\"dropped\"}}"
$V api RUN POST /api/submit "{\"formSlug\":\"kondisi-apar\",\"answers\":{$A}}"
$V api RUN POST /api/submit "{\"formSlug\":\"kondisi-apar\",\"answers\":{${A/IGD/Mars},$F}}"
$V api RUN POST /api/submit "{\"formSlug\":\"nope\",\"answers\":{}}"
$V api RUN POST /api/submit "{\"formSlug\":\"kondisi-apar\",\"answers\":{${A/2026-11-04/2026-02-31},$F}}"
$V sql RUN "select id, findings, answers ? 'extra' as has_extra from submissions order by id desc limit 1"
```

End state, in order: `201 {"ok": true, "id": "<n>"}`; `400 "\"Dokumentasi\" wajib diisi."`;
`400 "Pilihan untuk \"Lokasi\" tidak valid."`; `400 "Formulir tidak dikenali."`; and **`500 "Gagal
menyimpan ke basis data. Coba lagi sebentar lagi."`** for 2026-02-31 (product bug, below). SQL:
the 201's row has `findings 1` (the hydrotest "Tidak") and `has_extra f`. (`${A/IGD/Mars}` is
bash/zsh substitution; run the block in one shell.)

## Gotchas

- **Product bug (base, 2026-11-04):** `/api/submit` validates dates with
  `Number.isNaN(Date.parse(text))`, and V8's `Date.parse("2026-02-31")` is a number (it rolls
  over), so the value reaches Postgres, which refuses it (`22008 date/time field value out of
  range`, in `zz-standin.log`), and the client gets a 500 that blames the database. Only reachable
  from the API: the browser's date picker cannot produce it.
- Each `submit-apar` run adds one inspection and one finding; later recap/export counts go up.
- The date default is the *browser's* local day (`todayLocalISO`); the `ui` driver runs in
  Asia/Jakarta, so it is the Jakarta today.
