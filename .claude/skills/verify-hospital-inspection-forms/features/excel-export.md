# Excel export ("Unduh Excel")

## Sub-features

- `GET /api/admin/export[?from&to]` (admin only) returns one `.xlsx`: three sheets named after the
  forms, header row frozen with the first column, autofilter when there are rows.
- Columns: No, Dikirim (WIB), every question in display order, Jumlah temuan. One row per
  inspection, oldest inspection date first. Date answers are real dates; `Tidak`/`Rusak` cells red
  and bold, `Ya`/`Baik` green, a non-zero Jumlah temuan red. File answers are `name: url` lines.
- An empty sheet gets "Belum ada pemeriksaan pada rentang tanggal ini.".
- Filename `Inspeksi-K3RS_semua.xlsx`, or `Inspeksi-K3RS_<from>_sd_<to>.xlsx` for a range.

## How to get to it (user POV)

`/admin` -> "Unduh Excel" (after "Terapkan" for a range).

## Driving it with verify.sh

```sh
$V export RUN
$V export RUN 2026-10-05 2026-11-04
$V export RUN 2030-01-01 2030-01-31
$V export RUN --anon
```

End state on a fresh run: `200`, `filename="Inspeksi-K3RS_semua.xlsx"`, `sheets=3`;
`sheet "Inspeksi Lingkungan K3RS": 46 columns, 2 data row(s), frozen=x1/y1, autoFilter=yes`, rows
`1 | <today> HH:MM | date:<today-3> | Gedung Verify Gizi | findings=0 | red=0 green=38` and
`2 | ... | Gedung Verify IGD Lt 2 | findings=2 | red=3 green=36` with `files: dokumentasi.jpg:
https://hifverifystore000...jpg ; laporan.pdf: https://hifverifystore000...pdf`; APAR 14 columns,
ICU (`findings=1 | red=2`) then Laboratorium; Tanggap Darurat 30 columns, Gedung Verify Radiologi
`findings=3 | red=4`. `red` counts the finding cells plus the Jumlah temuan cell. The 30-day range
gives `Inspeksi-K3RS_2026-10-05_sd_2026-11-04.xlsx` with an empty Tanggap Darurat sheet; an empty
range gives three sheets with the "Belum ada pemeriksaan" line (`1 data row(s)`, `autoFilter=no`).
Signed out: `401 {"error":"Tidak diizinkan."}`.

## Gotchas

- `export` reads the workbook with the app's own exceljs from the run's snapshot; the saved
  `.xlsx` is in evidence for a human to open.
- "Dikirim (WIB)" is the send time, so every seeded row shows the `up` minute.
- A planted file URL (dokumentasi-upload.md's product bug) is printed here like any other file.
