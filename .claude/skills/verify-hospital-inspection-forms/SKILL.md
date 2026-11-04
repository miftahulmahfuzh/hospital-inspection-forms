---
name: verify-hospital-inspection-forms
description: Prove an InsMobile (hospital-inspection-forms) change works by driving a real, throwaway copy of it (Next dev server on its own loopback port, its own local Postgres behind a Neon-protocol stand-in, a local Vercel Blob stand-in, five inspections seeded through /api/submit, random admin credentials and a minted admin session) and capturing evidence, including the Excel export read back cell by cell and injected database/Blob outages. Use before reporting any src/ change as done, when a plan's Proof section names feature-map entries, when a verifier must confirm another agent's work, or to reproduce a bug on main. Never touches the production Neon database, the production Blob store, Vercel (a push to main deploys), GitHub or the owner's dev server on :3000.
---

# verify-hospital-inspection-forms

The repo has no test suite and no e2e harness; "it builds" is not proof. Proof is the code under
test, running, doing what an inspector or the K3RS admin does, with the action and the resulting
state saved as evidence a reviewer can open. Everything goes through one script, run from the
checkout (or worktree) being verified:

```sh
V=.claude/skills/verify-hospital-inspection-forms/scripts/verify.sh
S=.claude/skills/verify-hospital-inspection-forms/features/steps
$V            # usage
```

The script is bash (shebang), so the zsh the Bash tool may run does not matter. Never hand-write
launch sequences, never `npm run dev` for verification (`.env.local` is production), and never
`pkill node` / `pkill -f "next dev"`: the owner's dev server and other runs look the same.

## Launch

```sh
$V up              # RUN= URL= EVIDENCE= ADMIN=   (~12 s warm; first route compiles add 2-10 s each)
```

`up` takes no flags: the app has no paid API and no optional dependency to switch on. What a run is:

- **Postgres**: database `v_<run>` in the Docker container `hospital-inspection-forms-pg-verify`
  (`postgres:16`, 127.0.0.1:55442, created on first use, left running). No migrations: the app
  creates `submissions` itself on first use (`ensureSchema` in `src/lib/db.ts`).
- **Stand-in** (`scripts/standin.mjs`): Neon's HTTP `/sql` protocol in front of that database; the
  Vercel Blob API (`put`, `del`, `head`, `list`, `copy`, and the browser's client-token PUT with its
  signature, size cap, content types, random suffix and expiry enforced); the stored blobs' bytes;
  the fault switch (`fault`). Plain HTTP on one port for the server, HTTPS + HTTP/2 on a second for
  the browser (see Gotchas). `scripts/preload.mjs` (in every Node process via `NODE_OPTIONS`)
  routes `neon()`'s fetches and the fake store's
  `https://hifverifystore000.public.blob.vercel-storage.com/...` URLs to it. No app code changes.
- **App**: a snapshot of the checkout (rsync without `.env*`, `.vercel`, `.git`, `docs`, `.next`,
  `.claude`, `.workflows`, `.worktrees`, `brand`, root `*.md`/`*.pdf`/`*.jpeg`; `node_modules`
  hard-linked) served by its own `next dev` on a free loopback port, never 3000. A snapshot because
  Next 16 locks `.next/dev` per project directory, and because `next dev` rewrites AGENTS.md /
  CLAUDE.md in the directory it serves.
- **Seed** (`scripts/seed.mjs`, `evidence/00-seed.log`): five inspections POSTed to the app's own
  `/api/submit`, answers built from the checkout's `src/lib/forms.ts`, Dokumentasi files first put
  into the stand-in store. Dates relative to today in Asia/Jakarta:

  | id | form | Lokasi | date | findings | files |
  | --- | --- | --- | --- | --- | --- |
  | 1 | inspeksi-lingkungan | Gedung Verify IGD Lt 2 | today-1 | 2 | dokumentasi.jpg, laporan.pdf |
  | 2 | inspeksi-lingkungan | Gedung Verify Gizi | today-3 | 0 | dokumentasi.jpg |
  | 3 | kondisi-apar | ICU | today-2 | 1 | dokumentasi.jpg |
  | 4 | kondisi-apar | Laboratorium | today | 0 | laporan.pdf |
  | 5 | tanggap-darurat | Gedung Verify Radiologi | today-40 | 3 | dokumentasi.jpg |

  So a fresh run shows **5 pemeriksaan, 6 temuan** open-ended and **4 / 3** over the last 30 days.
- **Admin**: `ADMIN_USERNAME=verify-admin`, a random password (printed by `up`, used by `login` and
  the `admin-login` steps), a random `SESSION_SECRET`, and one `k3rs_admin` cookie minted with jose
  exactly as `createSessionToken` does (HS256, `{sub}`, 12 h). The app verifies it like any other.
- **Env**: the server starts from `env -i` with only the run's values; nothing is read from
  `.env.local`.
- **Tools**: Playwright 1.62.1 and `pg` live in `~/.local/state/hospital-inspection-forms-verify/.tools`,
  installed by the first `up` (npm registry, once). The repo's `package.json` is untouched.

Runs are isolated: parallel verifiers each `up` their own. Measured 2026-11-04: two runs up at
once, an inspection submitted in one is absent from the other's database, and one run's admin
cookie answers `307 -> /admin/login` on the other.

## Doctor

```sh
$V doctor RUN
```

Read-only. Checks the stand-in, that `next` is alive and owns its port (process group, not a
name), who holds :3000 (reported, never touched), that `/admin` renders the seed signed in and
redirects signed out, the database counts, the run's blobs, injected faults, and the egress fence:
from a process with the server's exact env and preload, GitHub, a foreign Blob store, Neon's
console and a Neon endpoint, Vercel's API, OpenRouter and an `https.request` must all be `blocked`,
and the fake store must answer 404 from the stand-in. Then the hosts blocked so far and the last
three errors in `next.log` (`log` lines: informational, and they include errors a journey caused
on purpose, such as an outage). Run it before the first drive and after any surprise.

- `code WARN HEAD moved` / `working tree changed since up`: the snapshot is stale. `down` + `up`.
- `fault WARN injected outage on: db`: a `$V fault RUN db` is still on; `$V fault RUN none`.

## Drive

| Surface | Command | Notes |
| --- | --- | --- |
| Web page (text) | `$V api RUN [--as admin\|--anon] GET /path` | Signed out by default (the forms are public). HTML saved whole; visible text (aria-labels as `[label]`) printed. |
| HTTP route | `$V api RUN [--as admin] POST /api/... '{json}'` | Status, JSON body, cookie names set; a Blob client token is decoded to its options. |
| Admin login | `$V login RUN [USERNAME PASSWORD]` | `POST /api/admin/login` as the login form sends it; default the run's credentials. |
| Excel export | `$V export RUN [--anon] [FROM TO]` | `GET /api/admin/export` as "Unduh Excel" does; `.xlsx` saved, then per sheet: columns, rows, red/green cells, file cells. |
| Browser | `$V ui RUN steps.mjs [--as admin] [--width 390] [-- ARG...]` | Playwright, fenced network, Asia/Jakarta, id-ID, video + screenshots. |
| State | `$V sql RUN [--value] "select ..."` | Read-only transaction; writes are refused. `--value`: one bare cell for recipes. |
| Wait | `$V until RUN "select ..." EXPECTED [SECONDS]` | Polls `sql --value`. |
| Blobs | `$V blobs RUN [PREFIX]` | The run's stand-in store, with sizes and content types. |
| Outage | `$V fault RUN db\|blob\|both\|none` | The stand-in drops every connection to that service until `none`. |
| Repo seeder | `$V seed-demo RUN [--force\|--clean]` | The repo's `npm run seed:demo`, aimed at this run (broken on base, see Gotchas). |
| Server log | `$V logs RUN [REGEX] [N]` | Matching `next.log` lines (default: errors, blocks, faults). |
| Log | `$V note RUN "what this proved"` | Appends to `evidence/LOG.md`. |

A steps file (the ones in `features/steps/` run as they are; put ad-hoc ones in the scratchpad):

```js
const steps = async ({ page, base, shot, log, fixture, allow, creds, fault, args }) => {
  await page.goto(`${base}/forms/kondisi-apar`, { waitUntil: 'networkidle' }) // let it hydrate
  await page.getByRole('combobox', { name: /Lokasi/ }).selectOption(args[0] ?? 'ICU')
  await page.locator('#q-q_dokumentasi input[type=file]').setInputFiles(fixture('dokumentasi.jpg'))
  await page.locator('#q-q_dokumentasi').getByRole('link', { name: 'dokumentasi.jpg' }).waitFor()
  await shot('attached')
}
export default steps
```

`fixture(name)` is `features/fixtures/<name>`: `dokumentasi.jpg` (640×480, 9376 B),
`laporan.pdf` (one page, 608 B), `catatan.txt` (a type the token refuses). `allow(/re/)` admits a
console error the journey causes on purpose. `creds` is the run's admin login; `fault('db')` /
`fault('blob')` / `fault('none')` switch outages from inside a journey (every `ui` ends with
`none`). Handles: radio groups are `getByRole('radiogroup', { name: <question label> })` with
`radio` "Ya"/"Tidak"; selects are `combobox`; each question sits in `#q-<id>` (ids in
`src/lib/forms.ts`); the success panel is `role=status` "Terkirim". The UI is Indonesian on
purpose. Never coordinates. `ui` fails on a console error, a page error, a signed-in drive ending
on `/admin/login`, or horizontal scroll.

Examples, one per surface:

```sh
$V api RUN GET /                                   # "Pilih formulir" ... "11 pertanyaan"
$V ui RUN $S/submit-apar.mjs -- "catatan saya"     # "1 temuan tercatat pada pemeriksaan ini." PASS
$V sql RUN "select id, form_slug, area, findings from submissions order by id desc limit 3"
$V export RUN 2026-10-05 2026-11-04                # filename Inspeksi-K3RS_2026-10-05_sd_2026-11-04.xlsx
$V fault RUN db; $V api RUN --as admin GET /admin; $V fault RUN none
```

## Evidence

Everything lands in `~/.local/state/hospital-inspection-forms-verify/<RUN>/evidence/`, numbered in
drive order: `NN-api-*.txt` (+ `.html`/`.bin`), `NN-export-*.txt` + `.xlsx`, `NN-sql-*.txt`,
`NN-blobs-*.txt`, `NN-logs-*.txt`, `NN-seed-demo-*.txt`, `NN-ui-*.{txt,png,webm}`, `LOG.md`,
`00-seed.log`, and after `down`: `zz-next.log`, `zz-standin.log` (every SQL statement, blob write
and dropped connection), `zz-standin.json` (counters), `zz-seed.json`, `zz-meta`.

Proof standards:

- Drive the real user path: the page, button or route the user touches, not a lib function. Writes
  go through the app (`ui`, `api`, `login`). `sql` only reads.
- Capture the action AND the resulting state. "Terkirim" is not proof the answers are right: read
  the row back with `sql`, and the recap/export that shows it.
- For a bug fix, show the failure first (a run from `main`, or before the fix), then the pass.
- **Read the PNGs.** A green `ui` exit only means nothing threw.
- A step you could not drive is `inconclusive` with its reason. Never weaken a journey to make it
  pass.

The report you hand back lists the evidence files that prove each claim, one line each.

## Cleanup

```sh
$V down RUN       # kills exactly the process groups up started, drops v_<run>, deletes the snapshot and blobs
$V down --all     # every run still up
$V ls             # runs, state, evidence count
```

Evidence survives `down`. Run `down` after every run, failed ones included. The container
`hospital-inspection-forms-pg-verify` stays up for the next run; it holds nothing but `v_*` databases.

## Feature map

`features/README.md` indexes what the app does and what proves each feature works, one file per
feature. A plan's **Proof** section names entries from it. A change that adds or alters a
user-facing feature updates its entry in the same change. A journey that fails because the app is
wrong is a product bug: report it, do not edit the entry to match.

## Gotchas

- **Never driven, no flag turns them on (harmful):**
  - The production Neon database. `.env.local`'s `DATABASE_URL_UNPOOLED` is production; the
    snapshot has no `.env*`, the server env holds only `pg.hifverify.invalid` (routed to the
    stand-in by the preload), and the preload refuses every other host, Neon's included.
  - The production Blob store. `BLOB_READ_WRITE_TOKEN` is a per-run fake for store id
    `hifverifystore000`; `VERCEL_OIDC_TOKEN` (which the Blob SDK prefers over the token, and which
    `.env.local` holds) and `BLOB_STORE_ID` are never in the env; any other
    `*.public.blob.vercel-storage.com` host is refused by the preload and aborted by the browser.
  - Vercel: no `.vercel` link and no `VERCEL*` variable in a run, and nothing here runs `vercel`.
    `vercel.json` deploys `main` on every push: committing is the owner's call, never a verify step.
  - `OPENROUTER_API_KEY` sits in `.env.local` but no code reads it; it never enters a run and
    openrouter.ai is in doctor's must-be-blocked list.
  - `npm run seed:demo` on the owner's side: it loads `.env.local` (production) for its row count
    and `--clean`. Only `$V seed-demo RUN` runs it, in the snapshot, against the run.
  - The owner's dev server. CLAUDE.md pins no port; the README's `npm run dev` takes Next's default
    3000. Decided 2026-11-04: the free-port picker refuses 3000, `up` never stops or reuses whatever
    holds it, `doctor` only reports who does, and every run is tracked by process group.
  - No part of the app messages a person (no email, push, chat or bot) and nothing is paid, so
    there is no sink to fake, no budget, and no `--real` / `--offline` flag. The outage switch
    (`fault`) is the run's fault injection instead.
- **Decided here, because the code cannot say (2026-11-04, nobody to ask):** the seed is the
  harness's own `seed.mjs`, not the repo's `scripts/seed-demo.mjs`, because the latter fails on base
  (it answers the required Dokumentasi file questions with the text "Tim K3RS", and `/api/submit`
  refuses that: `400 Berkas untuk "Dokumentasi" tidak valid.`); it is still wrapped as `seed-demo`
  so its state is visible. Admin credentials are random per run rather than copied from
  `.env.local`, so no production secret is ever needed. Playwright and `pg` are installed into the
  harness's tool dir, because the run was limited to committing the paths it created.
- **The browser uploads to an HTTPS + HTTP/2 listener.** `NEXT_PUBLIC_VERCEL_BLOB_API_URL` (inlined
  into the client bundle) points at the stand-in's h2 listener with a per-run self-signed
  certificate that only the run's Playwright context accepts (`ignoreHTTPSErrors`). Today's
  `upload()` call passes no `onUploadProgress`, so its PUT is not streamed and HTTP/1.1 would also
  work; the moment someone adds a progress bar, Chromium streams the body and needs h2
  (`net::ERR_ALPN_NEGOTIATION_FAILED` otherwise). The server keeps `VERCEL_BLOB_API_URL` on HTTP.
- **A dropped Blob connection spins, it does not fail.** `@vercel/blob/client` retries a failed PUT
  10 times with exponential backoff (~17 minutes) before the field shows an error, so the outage
  journey asserts "Mengunggah…" and no error after 20 s, then recovery once the fault is lifted.
  A drive that waits for the upload error will time out; that is the app (see `features/outages.md`).
- **The Blob completion webhook never fires** (Vercel cannot call a laptop; `route.ts` says so and
  persists nothing there). The browser carries the URL into `/api/submit`, which is what production
  relies on too.
- **Next's route announcer is an `alert`.** `getByRole('alert')` also matches
  `<next-route-announcer>` (holding the page title); use `p[role=alert]` or filter by text.
- **One dev-only page error is ignored by `ui`:** `Failed to execute 'measure' on 'Performance':
  'AdminPage' cannot have a negative time stamp`, on a client navigation to `/admin` that the server
  redirects. React's development client times server components with `performance.measure`; its
  production build has no such call (checked in `next/dist/compiled/react-dom`). It is logged as
  `pageerror (dev-only, not counted)`; nothing else is.
- **`/forms/<unknown>` answers 404 with the brand only in the text view**: the not-found copy lives
  in the RSC payload under `next dev`. Assert the status with `api`, the copy with `ui`.
- **Egress control is best effort.** The preload wraps `globalThis.fetch` (Next wraps it later, so
  the guard stays underneath) and `node:http(s)`'s `request`/`get`. `@vercel/blob`'s server calls go
  through undici's own dispatcher, which neither sees, but only ever to `VERCEL_BLOB_API_URL` (the
  stand-in). A native addon or a raw `net.connect` would slip past. The server has no dead proxy:
  Turbopack fetches the three `next/font/google` families in Rust, and the font CDN is
  allowlisted; `up` restarts `next dev` (three tries) on a font-fetch failure.
- `next.log` noise that is not a finding: `egress BLOCKED GET https://registry.npmjs.org/-/package/next/dist-tags`
  (Next dev's version check), once per run.
- `ensureSchema` is memoised per server process; once the first query has run, a `fault db` drops
  only the statements the page itself sends.
- The snapshot does not follow your edits. `down` + `up` after changing the app.
- The first hit on each route compiles it (2-10 s once). Steps use `waitUntil: 'networkidle'`
  before clicking: a click before hydration is silently dropped (React 19).
- The README's question counts drift: the README says 36/10/19 questions, the home page counts
  43/11/27 (the 2026-09-11 resync and the Dokumentasi fields). Assert on the page, not the README.
- Seed text is fictional and marked "(verify seed)"; nothing real sits in a run.
