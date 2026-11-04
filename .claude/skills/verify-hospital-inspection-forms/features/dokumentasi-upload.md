# Dokumentasi upload (photos and PDFs)

## Sub-features

- Every form has one required file question (`q_dokumentasi`, or `q_dokumentasi_pemeriksaan` on
  tanggap-darurat): jpeg/png/webp/heic/pdf; kondisi-apar 1 file up to 10 MB, the other two up to
  10 files of 100 MB.
- In the browser: count and size checked first ("Maksimal N berkas.", "\"x\" melebihi NMB."), then
  `@vercel/blob/client` `upload()` asks `POST /api/upload` for a client token (no sign-in: the forms
  are public) and PUTs straight to Blob. The file then shows as a link with "Hapus"; the input is
  disabled at the limit.
- `/api/upload` mints a token only for a real file question of a real form; the token carries the
  allowed types, the size cap and a random suffix.
- `/api/submit` checks each file entry's `url` contains `.public.blob.vercel-storage.com/` and the
  count is within `maxFiles`.

## How to get to it (user POV)

On any form, scroll to "Dokumentasi", tap the file field, pick a photo.

## Driving it with verify.sh

```sh
$V ui RUN $S/upload-refused.mjs
$V blobs RUN laporan
```

End state: `oversize: ""besar.jpg" melebihi 10MB."` (no request made), `txt: "Vercel Blob: Content
type text/plain is not allowed"` (token minted, PUT refused by Blob with 400), `pdf: attached
https://hifverifystore000.public.blob.vercel-storage.com/laporan-<30 chars>.pdf`, `error after pdf:
none`, `input disabled at 1/1: true`, `after Hapus: links=0 disabled=false`, `result: PASS`.
`blobs`: that `laporan-*.pdf`, `608 bytes`, `application/pdf` (Hapus only forgets the link; the blob
stays).

Token route, no browser:

```sh
$V api RUN POST /api/upload '{"type":"blob.generate-client-token","payload":{"pathname":"foto.jpg","clientPayload":"{\"formSlug\":\"kondisi-apar\",\"questionId\":\"q_dokumentasi\"}","multipart":false}}'
$V api RUN POST /api/upload '{"type":"blob.generate-client-token","payload":{"pathname":"foto.jpg","clientPayload":"{\"formSlug\":\"kondisi-apar\",\"questionId\":\"q1109164454\"}","multipart":false}}'
$V api RUN POST /api/upload '{"type":"blob.generate-client-token","payload":{"pathname":"foto.jpg","clientPayload":null,"multipart":false}}'
```

End state: `200` with `vercel_blob_client_hifverifystore000_...` and `[client token options:
{"allowedContentTypes":["image/jpeg","image/png","image/webp","image/heic","application/pdf"],"maximumSizeInBytes":10485760,"addRandomSuffix":true,...,"pathname":"foto.jpg","validUntil":<now+1h>}]`;
then `400 "Unggahan tidak dikenali untuk formulir/pertanyaan ini."` twice (a textarea question, no
payload).

What `/api/submit` accepts as a file (same `$A` as submit-inspection.md):

```sh
$V api RUN POST /api/submit "{\"formSlug\":\"kondisi-apar\",\"answers\":{$A,\"q_dokumentasi\":\"[{\\\"url\\\":\\\"https://evil.example/.public.blob.vercel-storage.com/x.jpg\\\",\\\"name\\\":\\\"x.jpg\\\",\\\"size\\\":1}]\"}}"
$V api RUN POST /api/submit "{\"formSlug\":\"kondisi-apar\",\"answers\":{$A,\"q_dokumentasi\":\"[{\\\"url\\\":\\\"https://a.public.blob.vercel-storage.com/1.jpg\\\"},{\\\"url\\\":\\\"https://a.public.blob.vercel-storage.com/2.jpg\\\"}]\"}}"
```

End state: **`201`** for the `evil.example` URL (product bug, below; the row's `q_dokumentasi` holds
it verbatim and the export prints it as the file's link); `400 "Maksimal 1 berkas untuk
\"Dokumentasi\"."` for two files.

## Gotchas

- **Product bug (base, 2026-11-04):** the file check is `url.includes(".public.blob.vercel-storage.com/")`,
  a substring test, so any URL with that string in its path passes (`https://evil.example/.public.blob.vercel-storage.com/x.jpg`
  was stored as id 8), as does any other Vercel customer's store. Since `/api/submit` needs no
  sign-in, anyone can plant links the admin later opens from the recap's Excel. Parse the URL and
  compare `hostname` with the app's own store.
- `/api/upload` mints tokens for anyone (forms are public by design): 100 MB per file, 10 files,
  per request, on the owner's Blob quota. Not a verify failure; worth knowing.
- The PUT goes to the stand-in's HTTPS + HTTP/2 listener (SKILL.md Gotchas).
- `catatan.txt` reaches Blob only because Playwright's `setInputFiles` ignores the input's
  `accept`; a person's picker would hide it.
- Each `upload-refused` run adds one orphaned pdf blob to the run's store.
