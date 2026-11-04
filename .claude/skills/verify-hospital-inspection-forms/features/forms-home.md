# Home and form pages

## Sub-features

- `/` lists the three forms from `FORMS` in `src/lib/forms.ts`, each with its question count and
  titled-section count, and links to `/forms/<slug>`. "Admin" in the header links to `/admin`.
- `/forms/<slug>` renders the form (static params for the three slugs); an unknown slug is a 404
  with "Halaman tidak ditemukan".
- Page titles: `InsMobile · Inspeksi K3RS`, `<form title> · InsMobile`.

## How to get to it (user POV)

Open the site on a phone; tap a form.

## Driving it with verify.sh

```sh
$V api RUN GET /
$V api RUN GET /forms/kondisi-apar
$V api RUN GET /forms/nope
```

End state: `/` is `200` with "Pilih formulir", then `Inspeksi Lingkungan K3RS ... 43 pertanyaan ·
9 bagian`, `Pemeriksaan Kondisi APAR ... 11 pertanyaan`, `Tanggap Darurat & Kebakaran ... 27
pertanyaan · 2 bagian`, and the footer "InsMobile · Komite Kesehatan dan Keselamatan Kerja Rumah
Sakit". `/forms/kondisi-apar` is `200` titled `Pemeriksaan Kondisi APAR · InsMobile`.
`/forms/nope` is `404`.

## Gotchas

- A change to `forms.ts` moves the counts above; check them against the file, not the README
  (which still says 36/10/19).
- The 404 page's copy is only in the RSC payload under `next dev`; the text view shows the brand
  alone. Assert the status here and the copy in a `ui` drive if it matters.
