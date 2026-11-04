# Feature map

One file per user-facing feature. Each names the journeys that prove it, with the end states seen
on 2026-11-04 (commit 0598071). `$V` is `scripts/verify.sh`, `$S` is `features/steps`. Nothing in
the app is paid, so no journey has a cost. Counts assume a fresh `up` (5 inspections, 6 findings)
unless a file says what an earlier journey added.

| Feature | File | Surfaces | Known failures on base |
| --- | --- | --- | --- |
| Home and form pages | [forms-home.md](forms-home.md) | api | none |
| Fill and send an inspection | [submit-inspection.md](submit-inspection.md) | ui, api, sql | a 31st-of-a-short-month date answers 500 (api only) |
| Dokumentasi upload | [dokumentasi-upload.md](dokumentasi-upload.md) | ui, api, blobs, sql | any URL containing `.public.blob.vercel-storage.com/` is stored |
| Draft kept on the device | [draft.md](draft.md) | ui | none |
| Outages (database, Blob) | [outages.md](outages.md) | ui, api, fault | upload spins ~17 min before an error; recap headline says "Belum ada pemeriksaan" while the DB is down |
| Admin sign-in and out | [admin-auth.md](admin-auth.md) | ui, api, login | none |
| Admin recap and date filter | [admin-recap.md](admin-recap.md) | api, sql | none |
| Excel export | [excel-export.md](excel-export.md) | export | none |

The repo's own `npm run seed:demo` fails on base (`$V seed-demo RUN --force` -> `400 Berkas untuk
"Dokumentasi" tidak valid.`); it is a developer tool, not a feature, so it has no entry here.
