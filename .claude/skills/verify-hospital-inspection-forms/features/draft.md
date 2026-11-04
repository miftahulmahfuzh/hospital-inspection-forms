# Draft kept on the device

## Sub-features

- Every answer change is saved to `localStorage["k3rs:draft:<slug>"]` until the form is sent.
- Reopening the form restores it with "Draf sebelumnya dipulihkan dari perangkat ini." and a
  "Mulai kosong" button, which clears the draft and leaves only today's date.
- A sent form removes its draft.

## How to get to it (user POV)

Start a form, close the tab mid-round, open the form again.

## Driving it with verify.sh

```sh
$V ui RUN $S/draft.mjs
```

End state: `date default: <Jakarta today>`, `stored: {"q409004017":"<today>","q62346334":"Gedung
Draft Verify","q1126741817":"Tidak"}`, `after reload: Lokasi="Gedung Draft Verify" Tidak
checked=true`, `after Mulai kosong: Lokasi="" date=<today>`, `stored: {"q409004017":"<today>"}`,
`result: PASS`; `-1-restored.png` shows the restored banner. Arg: LOKASI. Sending clears the draft:
see `draft after send: cleared` in submit-inspection.md and outages.md.

## Gotchas

- Each `ui` run is a fresh browser context, so a draft never survives from one drive to the next;
  the restore has to be shown inside one steps file (the reload here).
- Nothing reaches the server; there is no row to read back.
