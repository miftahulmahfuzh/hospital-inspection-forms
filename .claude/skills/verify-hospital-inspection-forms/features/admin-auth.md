# Admin sign-in and sign-out

## Sub-features

- `/admin` and `/api/admin/export` need the `k3rs_admin` cookie: an HS256 JWT (`{sub}`, 12 h)
  signed with `SESSION_SECRET`. Signed out, `/admin` redirects (307) to `/admin/login` and the
  export answers 401.
- `/admin/login`: "Nama pengguna", "Kata sandi", "Masuk" -> `POST /api/admin/login`, constant-time
  compare against `ADMIN_USERNAME`/`ADMIN_PASSWORD`; a wrong pair gets the same vague error for
  either field. Success sets the cookie (httpOnly, SameSite=Lax, Secure only in production) and
  goes to `/admin`. A signed-in visit to `/admin/login` goes straight to `/admin`.
- "Keluar" posts to `/api/admin/logout`: clears the cookie, 303 to `/admin/login`.

## How to get to it (user POV)

Home -> "Admin" (top right) -> sign in -> "Keluar" when done.

## Driving it with verify.sh

```sh
$V ui RUN $S/admin-login.mjs
```

End state: `Admin link -> /admin/login`, `wrong password: "Nama pengguna atau kata sandi salah."`,
`signed in -> /admin: "6 TEMUAN MENUNGGU TINDAK LANJUT"` (higher after other journeys),
`cookie k3rs_admin: httpOnly=true sameSite=Lax secure=false`, `Keluar -> /admin/login; cookie left:
false`, `/admin after Keluar -> /admin/login`, `result: PASS`; in about half the runs also one
`pageerror (dev-only, not counted)` line (SKILL.md Gotchas).

No browser:

```sh
$V login RUN
$V login RUN verify-admin salah
$V api RUN POST /api/admin/login '{"username":1}'
$V api RUN GET /admin
$V api RUN --as admin GET /admin/login
$V export RUN --anon
```

End state: `200 {"ok": true}` with `< set-cookie: k3rs_admin=<value>; Path=/; Expires=...; Max-Age=43200; HttpOnly; SameSite=lax`;
`401 "Nama pengguna atau kata sandi salah."`; `400 "Nama pengguna dan kata sandi wajib diisi."`;
`307 -> http://localhost:<port>/admin/login`; `307 -> .../admin`; `401 {"error":"Tidak diizinkan."}`.

## Gotchas

- The credentials are the run's own (`up` prints them; `login` and the steps' `creds` use them);
  production's are never read.
- `getByRole('alert')` on this page also finds Next's route announcer; the steps use
  `p[role=alert]`.
- There is no rate limit on `/api/admin/login`; not driven (it would only prove the absence).
