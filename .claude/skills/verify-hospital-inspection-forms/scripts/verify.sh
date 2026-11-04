#!/usr/bin/env bash
# verify.sh: launch, drive and tear down a throwaway InsMobile (hospital-inspection-forms) for verification.
#
# Every run gets its own Postgres database (in one shared Docker container), a stand-in on
# loopback that speaks Neon's HTTP protocol and the Vercel Blob API in front of it, a snapshot of
# the checkout served by its own `next dev` on a free loopback port (never 3000, the owner's
# `npm run dev` default), five seeded inspections, random admin credentials and a minted admin
# session cookie. Nothing touches the production Neon database, the production Blob store, Vercel
# or GitHub. The app has no paid API and messages nobody. Evidence lives under
# $VERIFY_HOME/<run>/evidence and survives `down`.
#
#   verify.sh up                         start a run from the current checkout; prints RUN= URL= EVIDENCE= ADMIN=
#   verify.sh doctor RUN                 is this run worth driving? (read-only)
#   verify.sh api RUN [--as admin|--anon] METHOD PATH [JSON]
#                                        HTTP signed out (default) or as the admin; request + response saved
#                                        as evidence, pages as visible text, client tokens decoded
#   verify.sh login RUN [USERNAME PASSWORD]
#                                        POST /api/admin/login as the login form does (default: the run's creds)
#   verify.sh export RUN [--anon] [FROM TO]
#                                        GET /api/admin/export as the "Unduh Excel" link does; the .xlsx is saved
#                                        and its sheets, rows, red cells and file cells printed
#   verify.sh ui RUN STEPS.mjs [--as admin|--anon] [--width N] [-- ARG...]
#                                        drive the app with Playwright (video + screenshots), fenced;
#                                        signed out by default; ARGs reach the steps module as `args`
#   verify.sh sql RUN [--value] "SELECT ..."
#                                        read the run's Postgres (read-only transaction); --value: one bare cell
#   verify.sh until RUN "SELECT one value" EXPECTED [SECONDS]
#                                        poll sql --value until it prints EXPECTED (default 30 s)
#   verify.sh blobs RUN [PREFIX]         list the run's stand-in Blob store
#   verify.sh fault RUN db|blob|both|none
#                                        inject an outage: the stand-in drops every connection to that service
#   verify.sh seed-demo RUN [--force|--clean]
#                                        the repo's own `npm run seed:demo`, pointed at this run
#   verify.sh logs RUN [REGEX] [N]       the server log's matching lines (default: errors, blocks, faults)
#   verify.sh note RUN "TEXT"            append a line to evidence/LOG.md (what you proved)
#   verify.sh down RUN|--all             stop what `up` started, drop its DB; evidence stays
#   verify.sh ls                         runs with state and evidence count
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$(dirname "$HERE")"
VERIFY_HOME="${VERIFY_HOME:-$HOME/.local/state/hospital-inspection-forms-verify}"
# The harness's own dependencies (Playwright, pg), installed once, outside every checkout: the
# repo's package.json stays exactly what the app needs.
TOOLS="$VERIFY_HOME/.tools"
TOOL_PKGS=(playwright@1.62.1 pg@8.16.3)
PG_CONTAINER=hospital-inspection-forms-pg-verify
PG_IMAGE=postgres:16
PG_PORT=55442
# README: `npm run dev`, then http://localhost:3000. That is the owner's server. A run never binds
# 3000 and never touches whatever listens there.
OWNER_PORT=3000
# The run's fake Blob store. Its public host keeps Vercel's domain, because /api/submit only
# accepts file URLs containing ".public.blob.vercel-storage.com/"; preload.mjs and ui.mjs serve it
# from the stand-in, and every other store host, production's included, is refused. No underscore:
# the Blob SDK splits tokens on "_".
STORE_ID=hifverifystore000
STORE_HOST=$STORE_ID.public.blob.vercel-storage.com
# next/font/google downloads Barlow Condensed, Public Sans and IBM Plex Mono while compiling.
FONT_HOSTS=fonts.googleapis.com,fonts.gstatic.com
ADMIN_USER=verify-admin

die() { echo "verify: $*" >&2; exit 1; }
repo_root() { git rev-parse --show-toplevel 2>/dev/null || die "run from inside a hospital-inspection-forms checkout"; }

run_dir() {
  local run=${1:-}
  [ -n "$run" ] || die "missing RUN id (see: verify.sh ls)"
  [ -d "$VERIFY_HOME/$run" ] || die "no run $run under $VERIFY_HOME"
  echo "$VERIFY_HOME/$run"
}
live_dir() { local d; d="$(run_dir "${1:-}")"; [ ! -f "$d/state" ] || die "run $1 is stopped"; echo "$d"; }
meta() { sed -n "s/^$2=//p" "$1/meta" | sed -n 1p; }
free_port() {
  local p
  while :; do
    p="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
    [ "$p" != "$OWNER_PORT" ] && { echo "$p"; return; }
  done
}
slug() { printf %s "$1" | tr -c 'a-zA-Z0-9_.-' '_' | cut -c1-40; }

# Numbered evidence: evidence/NN-<kind>-<slug>.<ext>, counting only the primary .txt files.
next_evidence() {
  local dir=$1/evidence n
  n=$(find "$dir" -maxdepth 1 -type f -name '[0-9][0-9]-*.txt' ! -name '00-*' | wc -l)   # 00-*: up's own
  printf '%s/%02d-%s-%s.%s' "$dir" $((n + 1)) "$2" "$(slug "$3")" "$4"
}

# What the code under test is: HEAD plus a digest of uncommitted changes to the app's own paths.
# .workflows/, docs/ and the untracked PDFs/logos at the root are left out so neither a peer's
# bookkeeping nor the owner's documents read as drift.
APP_PATHS=(src public scripts next.config.ts package.json package-lock.json tsconfig.json postcss.config.mjs eslint.config.mjs)
tree_digest() {
  { git -C "$1" diff HEAD -- "${APP_PATHS[@]}"
    git -C "$1" ls-files --others --exclude-standard -- "${APP_PATHS[@]}" | sort | while read -r f; do sha1sum "$1/$f"; done
  } 2>/dev/null | sha1sum | cut -c1-12
}

ensure_tools() {
  local want have
  want="$(printf '%s\n' "${TOOL_PKGS[@]}")"
  have="$(cat "$TOOLS/.installed" 2>/dev/null || true)"
  [ "$want" = "$have" ] && [ -d "$TOOLS/node_modules/playwright" ] && return 0
  mkdir -p "$TOOLS"
  [ -f "$TOOLS/package.json" ] || echo '{"name":"hif-verify-tools","private":true}' >"$TOOLS/package.json"
  # Harness tooling, fetched from the npm registry once; the app's own processes never see it.
  (cd "$TOOLS" && npm install --no-audit --no-fund --save-exact "${TOOL_PKGS[@]}") >"$TOOLS/install.log" 2>&1 \
    || { tail -20 "$TOOLS/install.log" >&2; die "could not install the harness tools into $TOOLS"; }
  echo "$want" >"$TOOLS/.installed"
}

ensure_pg() {
  command -v docker >/dev/null || die "docker is not on PATH"
  local state
  state="$(docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null)" || state=missing
  case "$state" in
    true) ;;
    false) docker start "$PG_CONTAINER" >/dev/null ;;
    # trust auth: bound to 127.0.0.1 only, holds nothing but throwaway v_* databases.
    *) docker run -d --name "$PG_CONTAINER" -e POSTGRES_HOST_AUTH_METHOD=trust \
         -p "127.0.0.1:$PG_PORT:5432" "$PG_IMAGE" >/dev/null ;;
  esac
  for _ in $(seq 1 60); do
    docker exec "$PG_CONTAINER" pg_isready -q -h 127.0.0.1 -U postgres >/dev/null 2>&1 && return 0
    sleep 1
  done
  die "$PG_CONTAINER did not become ready in 60s"
}
psql_run() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -U postgres "$@"; }

# The environment of the app: nothing inherited but PATH/HOME/locale, so no secret in the caller's
# shell (VERCEL_OIDC_TOKEN, BLOB_*, the production DATABASE_URL*, OPENROUTER_API_KEY) leaks in.
# The snapshot has no .env* file, so Next finds nothing to load either. Every value is the run's own.
write_web_env() {
  local dir=$1 sp port
  sp="http://127.0.0.1:$(cat "$dir/standin_port")"; port="$(cat "$dir/port")"
  {
    printf '%s\n' "PATH=$PATH" "HOME=$dir/home" "LANG=${LANG:-C.UTF-8}" "TERM=dumb" "NEXT_TELEMETRY_DISABLED=1"
    echo "PORT=$port"
    echo "DATABASE_URL=$(meta "$dir" neon_url)"
    echo "ADMIN_USERNAME=$ADMIN_USER"
    echo "ADMIN_PASSWORD=$(cat "$dir/secrets/admin_password")"
    echo "SESSION_SECRET=$(cat "$dir/secrets/session")"
    echo "BLOB_READ_WRITE_TOKEN=$(cat "$dir/secrets/blob")"
    echo "VERCEL_BLOB_API_URL=$sp/blob"
    # The browser's twin (inlined into the client bundle) is the stand-in's HTTPS + HTTP/2 listener,
    # as Vercel's API is: the Blob client streams its PUT body when a caller asks for progress, and
    # Chromium streams a request body only over HTTP/2.
    echo "NEXT_PUBLIC_VERCEL_BLOB_API_URL=https://127.0.0.1:$(cat "$dir/standin_tls_port")/blob"
    echo "NODE_OPTIONS=--import=file://$HERE/preload.mjs"
    echo "HIF_VERIFY_STANDIN=$sp"
    echo "HIF_VERIFY_STORE_HOST=$STORE_HOST"
    echo "HIF_VERIFY_ALLOW_HOSTS=$FONT_HOSTS"
  } >"$dir/web.env"
  chmod 600 "$dir/web.env"
}

# Run a command under an env file (one VAR=value per line), with nothing else inherited.
with_env() { local file=$1; shift; local -a e=(); mapfile -t e <"$file"; env -i "${e[@]}" "$@"; }

# The run is addressed as localhost (bound to 127.0.0.1 only): `next dev` reports every request's
# req.url as http://localhost:PORT whatever the Host header said, and /api/admin/logout redirects
# with new URL("/admin/login", request.url).
base_of() { echo "http://localhost:$(cat "$1/port")"; }
cookie_of() { cat "$1/sessions/admin"; }

# curl signed out (USER=-) or as the admin, from the same origin.
curl_app() {
  local dir=$1 user=$2; shift 2
  local -a h=(-H "Origin: $(base_of "$dir")")
  [ "$user" = - ] || h+=(-H "Cookie: k3rs_admin=$(cookie_of "$dir")")
  curl -sS -m 180 "${h[@]}" "$@"
}

admin_ready() {
  # admin_ready DIR OUTFILE: the admin recap renders the seeded inspections, signed in.
  local code
  code="$(curl -s -o "$2" -m 90 -w '%{http_code}' -H "Cookie: k3rs_admin=$(cookie_of "$1")" "$(base_of "$1")/admin" || true)"
  [ "$code" = 200 ] && grep -q 'Gedung Verify IGD Lt 2' "$2"
}

cmd_up() {
  [ $# -eq 0 ] || die "up takes no flags (the app has no paid or optional dependency to switch)"
  local root run dir db
  root="$(repo_root)"
  [ -f "$root/src/lib/forms.ts" ] && [ -f "$root/src/app/api/submit/route.ts" ] || die "$root is not a hospital-inspection-forms checkout"
  [ -d "$root/node_modules/next" ] || die "no node_modules in $root (npm ci)"
  ensure_tools

  run="$(date +%m%d-%H%M%S)-$$"
  dir="$VERIFY_HOME/$run"
  db="v_$(echo "$run" | tr -- '-' '_')"
  mkdir -p "$dir/evidence" "$dir/secrets" "$dir/home" "$dir/blobs" "$dir/sessions"
  chmod 700 "$dir/secrets" "$dir/sessions"
  : >"$dir/pgids"
  {
    echo "repo=$root"
    echo "head=$(git -C "$root" rev-parse --short HEAD)"; echo "tree=$(tree_digest "$root")"
    echo "db=$db"
    echo "neon_url=postgresql://postgres:hifverify@pg.hifverify.invalid/$db?sslmode=require"
    echo "started=$(date -Iseconds)"
  } >"$dir/meta"

  # Secrets of the run's own, all random. Nothing is read from .env.local: every value there is
  # production's, and the app needs none of them to run locally.
  head -c 36 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' >"$dir/secrets/session"
  head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' >"$dir/secrets/admin_password"
  echo "vercel_blob_rw_${STORE_ID}_$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')" >"$dir/secrets/blob"

  # The app is served from a snapshot: Next 16's `next dev` locks .next/dev per project directory,
  # so two runs (or the owner's own dev server) cannot share the checkout. The snapshot has no
  # .env*, no .vercel link, no git, and none of the owner's untracked documents. node_modules is
  # hard-linked (a symlink breaks Turbopack). Edits after `up` are not picked up: doctor warns.
  rsync -a --exclude /node_modules --exclude /.next --exclude /.git --exclude '/.env*' --exclude /.vercel \
    --exclude /.worktrees --exclude /.workflows --exclude /docs --exclude /.claude --exclude /brand \
    --exclude '/*.pdf' --exclude '/*.jpeg' --exclude '/*.md' --exclude /tsconfig.tsbuildinfo \
    --exclude /scripts/.demo-ids.json "$root/" "$dir/app/"
  cp -al "$root/node_modules" "$dir/app/node_modules"

  # The app creates its own schema on first use (ensureSchema in src/lib/db.ts): no migrations.
  ensure_pg
  psql_run -c "create database $db" </dev/null >/dev/null

  free_port >"$dir/standin_port"
  free_port >"$dir/standin_tls_port"
  free_port >"$dir/port"
  # A self-signed certificate for the stand-in's browser-facing HTTPS listener, minted per run and
  # accepted only by the run's own Playwright context (ignoreHTTPSErrors); nothing else trusts it.
  openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1 \
    -keyout "$dir/secrets/tls.key" -out "$dir/secrets/tls.crt" >/dev/null 2>&1 || die "openssl could not mint the stand-in's certificate"
  HIF_STANDIN_RW_TOKEN="$(cat "$dir/secrets/blob")" HIF_STANDIN_TLS_PORT="$(cat "$dir/standin_tls_port")" \
    HIF_STANDIN_TLS_KEY="$dir/secrets/tls.key" HIF_STANDIN_TLS_CERT="$dir/secrets/tls.crt" \
    setsid node "$HERE/standin.mjs" "$TOOLS" "$(cat "$dir/standin_port")" "$PG_PORT" "$db" "$dir/blobs" "$STORE_ID" \
    "$dir/standin.json" </dev/null >"$dir/standin.log" 2>&1 &
  echo "standin $!" >>"$dir/pgids"
  local sp="http://127.0.0.1:$(cat "$dir/standin_port")"
  for _ in $(seq 1 40); do curl -fsS -m 2 "$sp/health" >/dev/null 2>&1 && break; sleep 0.25; done
  curl -fsS -m 2 "$sp/health" >/dev/null || { cat "$dir/standin.log" >&2; die "stand-in did not start (verify.sh down $run)"; }
  write_web_env "$dir"

  # The admin session: an HS256 JWT signed with the run's random SESSION_SECRET by jose, the same
  # library and claims src/lib/auth.ts's createSessionToken uses ({sub}, iat, 12 h expiry). Not a
  # bypass: the app verifies it like any other. The real login route works too (verify.sh login).
  (cd "$dir/app" && with_env "$dir/web.env" node --input-type=module -e "
    import { SignJWT } from 'jose';
    const t = await new SignJWT({ sub: process.env.ADMIN_USERNAME }).setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt().setExpirationTime('12h').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    process.stdout.write(t);
  ") >"$dir/sessions/admin" || die "could not mint the admin session"

  local port; port="$(cat "$dir/port")"
  # setsid: own process group (down kills exactly this tree); every fd redirected so no caller's
  # pipe stays open behind the server. Not `(cd ... && setsid ... &)`: that backgrounds a bash
  # wrapper and records its pid.
  local -a webenv=()
  mapfile -t webenv <"$dir/web.env"
  cd "$dir/app"
  local try url code="" last="" same=0 started=0
  url="$(base_of "$dir")"
  # Turbopack's next/font/google fetch fails now and then, and every page then answers 500 until
  # the server restarts: match its signature and restart, at most three times.
  for try in 1 2 3; do
    setsid env -i "${webenv[@]}" node node_modules/next/dist/bin/next dev -p "$port" -H 127.0.0.1 </dev/null >"$dir/next.log" 2>&1 &
    echo "next $!" >>"$dir/pgids"
    same=0; last=""
    # Usable, step one: the home page lists the three forms.
    for _ in $(seq 1 240); do
      code="$(curl -s -o "$dir/ready.html" -m 90 -w '%{http_code}' "$url/" || true)"
      [ "$code" = 200 ] && grep -q 'Pemeriksaan Kondisi APAR' "$dir/ready.html" && { started=1; break; }
      # The same 5xx several times in a row is a broken page, not a slow compile.
      if [[ $code == 5* ]] && [ "$code" = "$last" ]; then same=$((same + 1)); else same=0; fi
      last=$code
      [ "$same" -ge 4 ] && break
      kill -0 "$(awk '$1=="next"{p=$2} END{print p}' "$dir/pgids")" 2>/dev/null || { tail -30 "$dir/next.log" >&2; die "next dev exited during startup (verify.sh down $run)"; }
      sleep 1
    done
    [ "$started" = 1 ] && break
    if grep -qE 'Failed to fetch .*(font|Google Fonts)|fonts.googleapis.com' "$dir/next.log"; then
      cp "$dir/next.log" "$dir/evidence/00-next-font-failure-$try.log"
      local pg; pg="$(awk '$1=="next"{p=$2} END{print p}' "$dir/pgids")"
      kill -TERM -- "-$pg" 2>/dev/null || true
      for _ in $(seq 1 20); do pgrep -g "$pg" >/dev/null 2>&1 || break; sleep 0.25; done
      kill -KILL -- "-$pg" 2>/dev/null || true
      continue
    fi
    break
  done
  [ "$started" = 1 ] || { tail -30 "$dir/next.log" >&2; die "/ did not list the forms (last $code; log $dir/next.log; verify.sh down $run)"; }
  rm -f "$dir/ready.html"

  # Seed through the app (POST /api/submit), files through the stand-in's Blob API.
  env -i PATH="$PATH" HOME="$dir/home" HIF_SEED_RW_TOKEN="$(cat "$dir/secrets/blob")" \
    node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$HERE/seed.mjs" "$dir/app" "$url" "$sp" "$SKILL/features/fixtures" "$dir/seed.json" \
    >"$dir/evidence/00-seed.log" 2>&1 || { cat "$dir/evidence/00-seed.log" >&2; tail -20 "$dir/next.log" >&2; die "seed failed (verify.sh down $run)"; }

  # Usable, step two: the admin recap renders them, signed in.
  local ok=0
  for _ in $(seq 1 60); do admin_ready "$dir" "$dir/ready.html" && { ok=1; break; }; sleep 1; done
  [ "$ok" = 1 ] || { tail -30 "$dir/next.log" >&2; die "/admin did not render the seeded inspections (log $dir/next.log; verify.sh down $run)"; }
  rm -f "$dir/ready.html"
  echo "RUN=$run"; echo "URL=$url"; echo "EVIDENCE=$dir/evidence"
  echo "ADMIN=$ADMIN_USER / $(cat "$dir/secrets/admin_password")   (random, this run only)"
}

pgid_of() { awk -v k="$2" '$1==k{p=$2} END{print p}' "$1/pgids" 2>/dev/null; }
listener_pid() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -oE 'pid=[0-9]+' | sed -n 1p | cut -d= -f2 || true; }

cmd_doctor() {
  local dir ok=1 root
  dir="$(live_dir "${1:-}")"
  root="$(meta "$dir" repo)"
  local si next sp port db base
  si="$(pgid_of "$dir" standin)"; next="$(pgid_of "$dir" next)"; db="$(meta "$dir" db)"
  sp="http://127.0.0.1:$(cat "$dir/standin_port")"; port="$(cat "$dir/port")"; base="$(base_of "$dir")"
  if curl -fsS -m 3 "$sp/health" | grep -q hospital-inspection-forms-verify-standin; then echo "standin  ok   $sp (pgid $si)"; else echo "standin  FAIL $sp not answering"; ok=0; fi
  if [ -n "$next" ] && kill -0 "$next" 2>/dev/null; then echo "next     ok   pgid $next"; else echo "next     FAIL not running"; ok=0; fi
  local owner
  owner="$(listener_pid "$port")"
  if [ -n "$owner" ] && [ "$(ps -o pgid= -p "$owner" | tr -d ' ')" = "$next" ]; then
    echo "port     ok   :$port owned by this run (pid $owner)"
  else
    echo "port     FAIL :$port is ${owner:+owned by pid $owner, }not this run's next"; ok=0
  fi
  local o3000; o3000="$(listener_pid "$OWNER_PORT")"
  echo "$OWNER_PORT     --   ${o3000:+the owner's server (pid $o3000), not this run's: never driven}${o3000:-nothing listening (not ours either way)}"
  local fault; fault="$(curl -fsS -m 3 "$sp/fault" | python3 -c 'import json,sys; s=json.load(sys.stdin); print(" ".join(k for k,v in s["fault"].items() if v))' || true)"
  if admin_ready "$dir" "$dir/doctor.html"; then echo "admin    ok   /admin answers 200 signed in, seeded inspections listed"
  elif [ -n "$fault" ]; then echo "admin    WARN /admin does not list the seed while a fault is on ($fault)"
  else echo "admin    FAIL /admin did not render the seeded inspections signed in"; ok=0; fi
  local code
  code="$(curl -s -o /dev/null -m 30 -w '%{http_code}|%{redirect_url}' "$base/admin" || true)"
  if [[ $code == 307\|*/admin/login ]]; then echo "anon     ok   /admin signed out -> /admin/login"; else echo "anon     FAIL /admin signed out answered $code"; ok=0; fi
  rm -f "$dir/doctor.html"
  local counts
  if counts="$(psql_run -d "$db" -tAc "select 'submissions '||count(*)||', findings '||coalesce(sum(findings),0)||', by form: '||coalesce((select string_agg(form_slug||'='||n, ' ' order by form_slug) from (select form_slug, count(*) n from submissions group by 1) x),'-') from submissions" </dev/null 2>/dev/null)"; then
    echo "database ok   $db ($counts)"
  else echo "database FAIL $db"; ok=0; fi
  echo "blobs    ok   $(find "$dir/blobs" -type f ! -name '*.__meta.json' | wc -l) object(s) in the run's store ($STORE_HOST)"
  if [ -n "$fault" ]; then echo "fault    WARN injected outage on: $fault (verify.sh fault $(basename "$dir") none)"; else echo "fault    ok   none injected"; fi
  printf 'meta     repo=%s head=%s\n' "$root" "$(meta "$dir" head)"
  if [ "$(git -C "$root" rev-parse --short HEAD)" != "$(meta "$dir" head)" ]; then
    echo "code     WARN HEAD moved since up: the snapshot is stale (down + up)"
  fi
  if [ "$(tree_digest "$root")" != "$(meta "$dir" tree)" ]; then
    echo "code     WARN working tree changed since up: the snapshot is stale (down + up)"
  fi
  # Egress, from a process with the server's exact env and preload. Nothing leaves either way:
  # the guard refuses before connecting.
  local probe
  probe="$(cd "$dir/app" && with_env "$dir/web.env" node --input-type=module -e "
    import https from 'node:https';
    const out = [];
    for (const u of ['https://api.github.com/', 'https://abcdefghij123456.public.blob.vercel-storage.com/x.jpg', 'https://console.neon.tech/', 'https://ep-x.ap-southeast-1.aws.neon.tech/sql', 'https://api.vercel.com/', 'https://vercel.com/api/blob/', 'https://openrouter.ai/api/v1/models']) {
      try { await fetch(u); out.push('REACHED ' + u) } catch (e) { out.push((/blocked/.test(e.message) ? 'blocked ' : 'error ') + new URL(u).host) }
    }
    try { https.request('https://api.github.com/').end(); out.push('REACHED https.request') } catch (e) { out.push((/blocked/.test(e.message) ? 'blocked ' : 'error ') + 'https.request') }
    try { const r = await fetch('https://$STORE_HOST/__doctor_probe__'); out.push('store ' + r.status) } catch (e) { out.push('store ERROR ' + e.message) }
    console.log(out.join('; '));
  " 2>/dev/null)"
  if [[ $probe == *REACHED* ]] || [[ $probe == *error* ]] || [[ $probe != *"store 404"* ]]; then echo "egress   FAIL $probe"; ok=0
  else echo "egress   ok   $probe (fake store answers from the stand-in)"; fi
  local blocked
  blocked="$(grep -oE 'egress BLOCKED [A-Za-z.]+ (https?://)?[^/ :]+' "$dir/next.log" 2>/dev/null | sort | uniq -c || true)"
  [ -n "$blocked" ] && echo "$blocked" | sed 's/^/egress   /'
  grep -E "⨯|Error:" "$dir/next.log" 2>/dev/null | grep -v "hif-verify" | tail -3 | sed 's/^/log      /' || true
  [ "$ok" = 1 ] || exit 1
}

save_response() {
  # save_response OUT BODYFILE CODE CTYPE [REDIRECT]: prints the response as text, binary goes to a file.
  local out=$1 bodyf=$2 code=$3 ctype=$4 redir=${5:-}
  echo "< HTTP $code ${ctype:-} ${redir:+-> $redir}"
  if [[ ${ctype:-} =~ json|text|javascript ]] || [[ $code == 3* ]] || [ ! -s "$bodyf" ]; then
    if [[ ${ctype:-} =~ html ]]; then
      echo "[html $(wc -c <"$bodyf") bytes; visible text:]"
      python3 "$HERE/htmltext.py" "$bodyf" 150
      mv "$bodyf" "${out%.txt}.html"; echo "[full html: ${out%.txt}.html]"
    elif [[ ${ctype:-} =~ json ]]; then
      # A Blob client token carries its options inside; print them, they are what Blob enforces.
      python3 -c '
import base64, json, sys
b = json.load(open(sys.argv[1]))
print(json.dumps(b, indent=1, ensure_ascii=False)[:20000])
t = b.get("clientToken") if isinstance(b, dict) else None
if isinstance(t, str) and t.startswith("vercel_blob_client_"):
    sig, _, payload = base64.b64decode(t.split("_", 4)[4]).decode().partition(".")
    print("[client token options: " + base64.b64decode(payload).decode() + "]")
' "$bodyf" 2>/dev/null || cat "$bodyf"
      echo; rm -f "$bodyf"
    else cat "$bodyf"; echo; rm -f "$bodyf"; fi
  else
    mv "$bodyf" "${out%.txt}.bin"
    echo "[binary $(wc -c <"${out%.txt}.bin") bytes, sha256 $(sha256sum "${out%.txt}.bin" | cut -c1-16): ${out%.txt}.bin]"
  fi
}

# --as admin / --anon, leading a drive's arguments. Sets AS (admin, or - for signed out). The
# forms are public, so signed out is the default.
AS=-; NARGS=0
parse_as() {
  AS=-; NARGS=0
  case "${1:-}" in
    --as) [ "${2:-}" = admin ] || die "--as takes admin (the app has one identity)"; AS=admin; NARGS=2 ;;
    --as=admin) AS=admin; NARGS=1 ;;
    --anon) AS=-; NARGS=1 ;;
  esac
}

cmd_api() {
  local dir; dir="$(live_dir "${1:-}")"; shift
  parse_as "$@"; shift "$NARGS"
  local method=${1:?METHOD} path=${2:?PATH} body=${3:-} out
  out="$(next_evidence "$dir" api "$method$path" txt)"
  local -a args=(-o "$out.body" -D "$out.headers" -w '%{http_code}|%{content_type}|%{redirect_url}' -X "$method" "$(base_of "$dir")$path")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' --data "$body")
  local m code ctype redir cookies
  m="$(curl_app "$dir" "$AS" "${args[@]}")"
  IFS='|' read -r code ctype redir <<<"$m"
  # Cookie names and attributes only: the value is a session.
  cookies="$(grep -i '^set-cookie:' "$out.headers" | sed -E 's/^[Ss]et-[Cc]ookie: ([^=]+)=[^;]*/\1=<value>/' | tr -d '\r' || true)"
  rm -f "$out.headers"
  { echo "> $method $path  (as ${AS/#-/signed out})"; [ -n "$body" ] && echo "> $(printf %s "$body" | cut -c1-400)"
    save_response "$out" "$out.body" "$code" "$ctype" "$redir"
    [ -n "$cookies" ] && echo "$cookies" | sed 's/^/< set-cookie: /'; } >"$out"
  cat "$out"
  echo "[evidence: $out]" >&2
}

cmd_login() {
  local dir; dir="$(live_dir "${1:-}")"
  local user=${2:-$ADMIN_USER} pass=${3:-$(cat "$dir/secrets/admin_password")} body
  body="$(python3 -c 'import json,sys; print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}))' "$user" "$pass")"
  cmd_api "$(basename "$dir")" --anon POST /api/admin/login "$body"
}

cmd_export() {
  local dir; dir="$(live_dir "${1:-}")"; shift
  local as=admin q=""
  [ "${1:-}" = --anon ] && { as=-; shift; }
  [ $# -ge 2 ] && q="?from=$1&to=$2"
  local out code ctype disp
  out="$(next_evidence "$dir" export "${q:-all}" txt)"
  local m
  m="$(curl_app "$dir" "$as" -o "${out%.txt}.xlsx" -D "$out.headers" -w '%{http_code}|%{content_type}' "$(base_of "$dir")/api/admin/export$q")"
  IFS='|' read -r code ctype <<<"$m"
  disp="$(grep -i '^content-disposition:' "$out.headers" | tr -d '\r' || true)"
  rm -f "$out.headers"
  { echo "> GET /api/admin/export$q  (as ${as/#-/signed out})"
    echo "< HTTP $code $ctype"; [ -n "$disp" ] && echo "< $disp"
    if [[ $ctype == *spreadsheetml* ]]; then
      echo "[xlsx $(wc -c <"${out%.txt}.xlsx") bytes, sha256 $(sha256sum "${out%.txt}.xlsx" | cut -c1-16): ${out%.txt}.xlsx]"
      node "$HERE/xlsx.mjs" "$dir/app" "${out%.txt}.xlsx" 20 2>&1
    else cat "${out%.txt}.xlsx"; echo; rm -f "${out%.txt}.xlsx"; fi; } >"$out"
  cat "$out"
  echo "[evidence: $out]" >&2
}

cmd_ui() {
  local dir steps; dir="$(live_dir "${1:-}")"; steps=${2:?STEPS.mjs}; shift 2
  local width=390 as=-
  local -a args=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --as) [ "${2:-}" = admin ] || die "--as takes admin"; as=admin; shift 2 ;;
      --anon) as=-; shift ;;
      --width) width=$2; shift 2 ;;
      --) shift; args=("$@"); break ;;
      *) die "ui: unknown flag $1 (step arguments go after --)" ;;
    esac
  done
  [ -f "$steps" ] || die "no such steps file: $steps"
  steps="$(realpath "$steps")"   # before the cd into the snapshot, so relative paths work
  local cookie=-; [ "$as" = - ] || cookie="$(cookie_of "$dir")"
  local argv creds
  argv="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "${args[@]}")"
  creds="$(python3 -c 'import json,sys; print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}))' "$ADMIN_USER" "$(cat "$dir/secrets/admin_password")")"
  (cd "$dir/app" && env -i PATH="$PATH" HOME="$dir/home" PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" \
    HIF_VERIFY_ARGS="$argv" HIF_VERIFY_CREDS="$creds" HIF_VERIFY_BLOB_TLS="https://127.0.0.1:$(cat "$dir/standin_tls_port")" \
    node "$HERE/ui.mjs" "$(base_of "$dir")" "$steps" "$dir/evidence" "$cookie" \
    "http://127.0.0.1:$(cat "$dir/standin_port")" "$STORE_HOST" "$TOOLS" "$width")
}

cmd_sql() {
  local dir; dir="$(live_dir "${1:-}")"; shift
  if [ "${1:-}" = --value ]; then
    printf 'begin read only;\n%s;\nrollback;\n' "${2:?SQL}" | psql_run -d "$(meta "$dir" db)" -tA 2>&1 | sed -n 1p
    return
  fi
  local out; out="$(next_evidence "$dir" sql query txt)"
  { echo "> ${1:?SQL}"; printf 'begin read only;\n%s;\nrollback;\n' "$1" | psql_run -d "$(meta "$dir" db)" 2>&1; } >"$out" || true
  cat "$out"
  echo "[evidence: $out]" >&2
}

cmd_until() {
  local run=${1:-} q=${2:?SELECT} want=${3:?EXPECTED} secs=${4:-30} got=""
  live_dir "$run" >/dev/null
  for _ in $(seq 1 "$secs"); do
    got="$(cmd_sql "$run" --value "$q")"
    [ "$got" = "$want" ] && { echo "until: $want"; return 0; }
    sleep 1
  done
  die "until: still '$got' after ${secs}s (wanted '$want')"
}

cmd_blobs() {
  local dir out
  dir="$(live_dir "${1:-}")"
  out="$(next_evidence "$dir" blobs "${2:-all}" txt)"
  { echo "> list ${2:-(all)} in $STORE_HOST (the run's stand-in store)"
    (cd "$dir/blobs" && find . -type f ! -name '*.__meta.json' -path "./${2:-}*" -printf '%P  %s bytes  %TY-%Tm-%Td %TH:%TM\n' | sort)
    for m in "$dir"/blobs/"${2:-}"*.__meta.json; do [ -f "$m" ] && printf '%s  %s\n' "$(basename "${m%.__meta.json}")" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["contentType"])' "$m")"; done
  } >"$out"
  cat "$out"
  echo "[evidence: $out]" >&2
}

cmd_fault() {
  local dir q; dir="$(live_dir "${1:-}")"
  case "${2:-}" in
    db) q="db=1&blob=0" ;; blob) q="db=0&blob=1" ;; both) q="db=1&blob=1" ;; none) q="db=0&blob=0" ;;
    *) die "fault RUN db|blob|both|none" ;;
  esac
  curl -fsS -m 3 -X POST "http://127.0.0.1:$(cat "$dir/standin_port")/fault?$q" | python3 -c 'import json,sys; s=json.load(sys.stdin); print("fault:", s["fault"], "sql:", s["sql"], "blobs:", s["blobs"])'
  echo "$(date -Iseconds) fault set: ${2}" >>"$dir/evidence/LOG.md"
}

# The repo's own demo seeder (scripts/seed-demo.mjs), pointed at this run: BASE_URL is the run, and
# DATABASE_URL is the run's fake Neon host, which the preload routes to the stand-in. The script
# calls process.loadEnvFile('.env.local') but the snapshot has none, and loadEnvFile never
# overrides a variable that is already set. Its bookkeeping (scripts/.demo-ids.json) lands in the
# snapshot.
cmd_seed_demo() {
  local dir; dir="$(live_dir "${1:-}")"; shift
  local out; out="$(next_evidence "$dir" seed-demo "${1:-seed}" txt)"
  { echo "> npm run seed:demo -- $*  (in the run's snapshot, BASE_URL=$(base_of "$dir"))"
    (cd "$dir/app" && with_env "$dir/web.env" env BASE_URL="$(base_of "$dir")" \
      node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      scripts/seed-demo.mjs "$@" 2>&1) && echo "[exit 0]" || echo "[exit $?]"; } >"$out"
  cat "$out"
  echo "[evidence: $out]" >&2
}

cmd_logs() {
  local dir re=${2:-'⨯|Error|error|BLOCKED|fault'} n=${3:-40} out
  dir="$(run_dir "${1:-}")"
  local log="$dir/next.log"; [ -f "$log" ] || log="$dir/evidence/zz-next.log"
  out="$(next_evidence "$dir" logs "$re" txt)"
  { echo "> grep -E '$re' next.log (last $n)"; grep -E -- "$re" "$log" | tail -n "$n" || echo "(no match)"; } >"$out"
  cat "$out"
  echo "[evidence: $out]" >&2
}

cmd_note() {
  local dir; dir="$(run_dir "${1:-}")"
  echo "$(date -Iseconds) ${2:?TEXT}" >>"$dir/evidence/LOG.md"
}

stop_run() {
  local dir=$1 kind pgid
  while read -r kind pgid; do
    [ -n "${pgid:-}" ] || continue
    # Wait for the whole group, not the leader: next dev's workers outlive it and keep writing
    # into the snapshot, which made a plain rm -rf fail half way.
    if pgrep -g "$pgid" >/dev/null 2>&1; then
      kill -TERM -- "-$pgid" 2>/dev/null || true
      for _ in $(seq 1 20); do pgrep -g "$pgid" >/dev/null 2>&1 || break; sleep 0.25; done
      kill -KILL -- "-$pgid" 2>/dev/null || true
      for _ in $(seq 1 20); do pgrep -g "$pgid" >/dev/null 2>&1 || break; sleep 0.25; done
    fi
  done <"$dir/pgids"
  for f in next.log standin.log seed.json meta; do [ -f "$dir/$f" ] && cp "$dir/$f" "$dir/evidence/zz-$f"; done
  [ -f "$dir/standin.json" ] && cp "$dir/standin.json" "$dir/evidence/zz-standin.json"
  if docker inspect "$PG_CONTAINER" >/dev/null 2>&1 && [ -n "$(meta "$dir" db)" ]; then
    psql_run -c "drop database if exists $(meta "$dir" db) with (force)" </dev/null >/dev/null || true
  fi
  for _ in 1 2 3 4 5; do
    rm -rf "$dir/app" "$dir/blobs" "$dir/home" "$dir/secrets" "$dir/sessions" "$dir/web.env" "$dir/port" "$dir/standin_port" "$dir/standin_tls_port" 2>/dev/null && break
    sleep 1
  done
  : >"$dir/pgids"; echo stopped >"$dir/state"
  echo "verify: stopped $(basename "$dir"); evidence kept in $dir/evidence ($(find "$dir/evidence" -type f | wc -l) files)"
}

cmd_down() {
  if [ "${1:-}" = --all ]; then
    for d in "$VERIFY_HOME"/*/; do [ -f "$d/meta" ] && [ ! -f "$d/state" ] && stop_run "${d%/}"; done
    return 0
  fi
  local dir; dir="$(run_dir "${1:-}")"
  [ ! -f "$dir/state" ] || { echo "verify: $1 is already stopped"; return 0; }
  stop_run "$dir"
}

cmd_ls() {
  [ -d "$VERIFY_HOME" ] || return 0
  for d in "$VERIFY_HOME"/*/; do
    d=${d%/}
    [ -f "$d/meta" ] || continue
    local state=stopped
    [ -f "$d/state" ] || state="up:$(cat "$d/port" 2>/dev/null || echo '?')"
    printf '%-20s %-10s %3s evidence  %s\n' "$(basename "$d")" "$state" \
      "$(find "$d/evidence" -type f 2>/dev/null | wc -l)" "$(meta "$d" repo 2>/dev/null)"
  done
}

sub=${1:-}; shift || true
case "$sub" in
  up) cmd_up "$@" ;;
  doctor) cmd_doctor "$@" ;;
  api) cmd_api "$@" ;;
  login) cmd_login "$@" ;;
  export) cmd_export "$@" ;;
  ui) cmd_ui "$@" ;;
  sql) cmd_sql "$@" ;;
  until) cmd_until "$@" ;;
  blobs) cmd_blobs "$@" ;;
  fault) cmd_fault "$@" ;;
  seed-demo) cmd_seed_demo "$@" ;;
  logs) cmd_logs "$@" ;;
  note) cmd_note "$@" ;;
  down) cmd_down "$@" ;;
  ls) cmd_ls ;;
  *) sed -n '2,38p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
