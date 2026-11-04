# Outages: database and Blob unreachable

## Sub-features

- Upload while Blob is unreachable: the field shows "Mengunggah…" while the Blob SDK retries; when
  the connection returns, a retry lands and the file attaches by itself.
- Send while the database is unreachable: "Gagal menyimpan ke basis data. Coba lagi sebentar lagi."
  in an alert, the form and its draft stay, the button is usable again; once the database is back
  the same button sends it.
- `/admin` while the database is unreachable: "Tidak dapat membaca basis data. Periksa DATABASE_URL
  pada konfigurasi server." and "Data tidak dapat dimuat."; the export answers 500.

## How to get to it (user POV)

A round in a basement ward with no signal; the admin opening the recap during a Neon incident.

## Driving it with verify.sh

```sh
$V ui RUN $S/outage.mjs -- "verify outage catatan"
$V sql RUN "select id, area, findings, answers->>'q1109164454' note from submissions where area='Radiologi'"
```

End state: `blob down 20 s: "Mengunggah…" shown=true, error shown=false, links=0`, `blob back:
dokumentasi.jpg attached by the SDK's own retry 5 s after the outage ended` (0-32 s depending on the
backoff), `db down: "Gagal menyimpan ke basis data. Coba lagi sebentar lagi."`, `draft kept: true;
button: "KIRIM PEMERIKSAAN"`, `db back: sent; draft cleared`, `result: PASS`. SQL: one row
`Radiologi | 0 | verify outage catatan`. `zz-standin.log` shows `fault blob: dropped PUT /blob/` lines
and one `fault db: dropped POST /sql`.

```sh
$V fault RUN db
$V api RUN --as admin GET /admin
$V export RUN
$V fault RUN none
```

End state: `/admin` `200` with "Belum ada pemeriksaan masuk", "0 pemeriksaan sejak awal ." and the
alert "Tidak dapat membaca basis data. Periksa DATABASE_URL pada konfigurasi server."; export
`500 {"error":"Gagal menyusun berkas Excel."}`. After `none`, `doctor` is clean again.

## Gotchas

- **Product finding (base, 2026-11-04):** with Blob unreachable the field says "Mengunggah…" and
  nothing else for as long as `@vercel/blob/client` keeps retrying: 10 retries with exponential
  backoff from 1 s (`getRetries()`, `VERCEL_BLOB_RETRIES` is not inlined into the browser bundle),
  roughly 17 minutes before an error appears. `InspectionForm.tsx` passes no `abortSignal` and no
  timeout. Waiting on the error in a journey times out; the recipe asserts the spinner instead.
- **Product finding (base):** under a database outage the recap's headline reads "Belum ada
  pemeriksaan masuk" / "0 pemeriksaan sejak awal" above the error alert, i.e. it states there are no
  inspections when it could not read them.
- `fault` drops the TCP/h2 connection (no HTTP answer), as a dead network does; the browser logs
  `net::ERR_HTTP2_PROTOCOL_ERROR` for each dropped PUT (allowed in the steps).
- `ui` always ends with `fault none`; a manual `$V fault RUN db` stays on until you lift it, and
  `doctor` warns while it does.
