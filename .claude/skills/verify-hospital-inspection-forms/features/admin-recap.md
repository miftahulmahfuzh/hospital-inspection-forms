# Admin recap and date filter

## Sub-features

- `/admin` (signed in): headline "N temuan menunggu tindak lanjut" (or "Tidak ada temuan pada
  periode ini" / "Belum ada pemeriksaan masuk"), "N pemeriksaan sejak awal ." or "pada <from> –
  <to> .".
- "Per formulir": each form's submissions ("isian"), findings ("temuan") and last submission time
  in WIB.
- "Pemeriksaan terakhir (N)": up to 50 rows by inspection date desc, then id desc: Tanggal,
  Formulir, Area, Temuan; "Menampilkan 50 terbaru..." at 50.
- "Dari tanggal" / "Sampai tanggal" + "Terapkan" is a GET form (`?from=&to=`), filtering on
  `inspection_date`; malformed values fall back to open bounds. "Unduh Excel" carries the range.

## How to get to it (user POV)

Sign in at `/admin`; pick two dates, "Terapkan".

## Driving it with verify.sh

```sh
$V api RUN --as admin GET /admin
$V api RUN --as admin GET "/admin?from=2026-10-05&to=2026-11-04"
$V api RUN --as admin GET "/admin?from=bukan-tanggal"
$V sql RUN "select form_slug, count(*), sum(findings) from submissions group by 1 order by 1"
```

End state on a fresh run: "6 temuan menunggu tindak lanjut", "5 pemeriksaan sejak awal .",
`Inspeksi Lingkungan K3RS 2 isian 2 temuan <today>, HH.MM`, `Pemeriksaan Kondisi APAR 2 isian 1
temuan`, `Tanggap Darurat & Kebakaran 1 isian 3 temuan`, then "Pemeriksaan terakhir (5)" in the order
Laboratorium (today, 0), Gedung Verify IGD Lt 2 (today-1, 2), ICU (today-2, 1), Gedung Verify Gizi
(today-3, 0), Gedung Verify Radiologi (today-40, 3). With the last-30-days range: "3 temuan
menunggu tindak lanjut", "4 pemeriksaan pada 5 Okt 2026 – 4 Nov 2026 ." (Radiologi drops out).
A malformed `from` is the open range again. The SQL agrees with the per-form lines.

Use a range ending today and starting 30 days back; the dates above are 2026-11-04's.

## Gotchas

- `inspection_date` is the inspector's date answer, not the send time; the "last submission" stamp
  is `created_at` (seeded rows all share the `up` minute).
- A database outage turns this page into the error state (outages.md).
