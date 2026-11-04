// node ui.mjs <base-url> <steps.mjs> <evidence-dir> <cookie-value|-> <standin-url> <store-host> <tools-dir> [width] [tag]
// Steps module: `export default async ({ page, base, shot, log, fixture, args, allow, creds, fault, context }) => { ... }`.
//   args           the words after `--` on the verify.sh ui command line
//   shot(name)     viewport screenshot into evidence
//   log(text)      line into the run's ui transcript
//   fixture(name)  absolute path of a file under the skill's features/fixtures/
//   allow(regex)   a console error this journey causes on purpose (a refused submit's 400)
//   creds          { username, password }: the run's own admin login (random per run)
//   fault(kind)    'db' | 'blob' | 'both' | 'none': the stand-in drops that service's connections
//                  from now on (verify.sh fault, from inside a journey)
// Signed in as the run's admin (the k3rs_admin cookie verify.sh minted), or signed out when the
// cookie is `-`. The forms themselves are public: most journeys run signed out.
// Records a video of the whole drive and a final screenshot, pass or fail. Fails on a page error,
// a console error, a signed-in drive ending on /admin/login, or horizontal scroll.
//
// The browser's network is fenced like the server's: the run's own origin passes (not all of
// loopback: the owner's dev server is loopback too), the stand-in's HTTPS Blob listener passes, the
// run's fake Blob store (https://<store-host>/...) is served from the stand-in, and every other host
// is aborted and logged. No permission is granted. The browser runs in Asia/Jakarta (the form
// defaults its date to the browser's local day) with an Indonesian locale.
// Playwright comes from the harness's own tool dir, never from the app's node_modules.
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { appendFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'

const [base, stepsPath, evidence, cookie, standin, storeHost, tools, width = '390', tagArg] =
  process.argv.slice(2)
if (!base || !stepsPath || !evidence || !cookie || !standin || !storeHost || !tools) {
  console.error(
    'usage: node ui.mjs <base> <steps.mjs> <evidence> <cookie|-> <standin> <store-host> <tools> [width] [tag]',
  )
  process.exit(2)
}

const require = createRequire(path.join(tools, 'package.json'))
const { chromium } = require('playwright')

const n = readdirSync(evidence).filter(
  (f) => /^\d\d-.*\.txt$/.test(f) && !f.startsWith('00-'),
).length
const tag = tagArg || `${String(n + 1).padStart(2, '0')}-ui-${path.basename(stepsPath, '.mjs')}`
const transcript = path.join(evidence, `${tag}.txt`)
const log = (text) => {
  appendFileSync(transcript, `${text}\n`)
  console.log(text)
}

const own = new URL(base)
const tlsOrigin = process.env.HIF_VERIFY_BLOB_TLS ? new URL(process.env.HIF_VERIFY_BLOB_TLS).origin : ''

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({
  viewport: { width: Number(width), height: 844 },
  timezoneId: 'Asia/Jakarta',
  locale: 'id-ID',
  recordVideo: { dir: path.join(evidence, '.video'), size: { width: Number(width), height: 844 } },
  permissions: [],
  serviceWorkers: 'block',
  // The stand-in's browser-facing Blob listener has a per-run self-signed certificate. This
  // context reaches nothing but the run's origin, that listener and the fake store anyway.
  ignoreHTTPSErrors: true,
})
const anon = cookie === '-'
if (!anon) {
  await context.addCookies([
    {
      name: 'k3rs_admin',
      value: cookie,
      domain: own.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

const blocked = new Set()
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
  if (url.origin === own.origin || (tlsOrigin && url.origin === tlsOrigin)) return route.continue()
  if (url.hostname === storeHost) {
    const res = await fetch(`${standin}/files${url.pathname}`)
    return route.fulfill({
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: Buffer.from(await res.arrayBuffer()),
    })
  }
  if (!blocked.has(url.host)) {
    blocked.add(url.host)
    log(`egress BLOCKED (browser) ${route.request().method()} ${url.origin}`)
  }
  return route.abort('blockedbyclient')
})

// Next's dev-tools badge (<nextjs-portal>) exists only under `next dev` and sits over the bottom
// of the screen, where the submit button ends up, swallowing clicks. Hide it; the app is untouched.
await context.addInitScript(() => {
  const hide = () => {
    const st = document.createElement('style')
    st.textContent = 'nextjs-portal { display: none !important; }'
    document.head.appendChild(st)
  }
  if (document.head) hide()
  else document.addEventListener('DOMContentLoaded', hide)
})
const page = await context.newPage()
page.setDefaultTimeout(30_000)
const problems = []
const allowed = []
const allow = (re) => allowed.push(re)
// Errors only `next dev` produces, logged but not counted. React's development client times each
// server component with performance.measure (its production build has no such call), and a
// server-side redirect() mid-navigation (/admin -> /admin/login) hands it a negative start time.
const DEV_ONLY = [/Failed to execute 'measure' on 'Performance': .* cannot have a negative time stamp/]
page.on('console', (m) => {
  if (m.type() !== 'error') return
  // The aborted off-allowlist requests above surface as console errors; they are logged as egress.
  if (/ERR_BLOCKED_BY_CLIENT/.test(m.text())) return
  if (allowed.some((re) => re.test(m.text()))) {
    log(`console.error (allowed): ${m.text()}`)
    return
  }
  problems.push(m.text())
  log(`console.error: ${m.text()}`)
})
// The console only says "Failed to load resource"; this names the URL.
page.on('requestfailed', (r) => {
  if (r.failure()?.errorText === 'net::ERR_BLOCKED_BY_CLIENT') return
  log(`request failed: ${r.method()} ${r.url().slice(0, 200)} ${r.failure()?.errorText ?? ''}`)
})
page.on('pageerror', (e) => {
  if (DEV_ONLY.some((re) => re.test(e.message))) {
    log(`pageerror (dev-only, not counted): ${e.message}`)
    return
  }
  problems.push(e.message)
  log(`pageerror: ${e.message}`)
})
let shots = 0
const shot = async (name, opts = {}) => {
  const file = path.join(evidence, `${tag}-${++shots}-${name}.png`)
  // caret: 'initial' -- the default hides the caret by injecting a style, which races hydration
  // and is reported as a hydration mismatch the app does not have.
  await page.screenshot({ path: file, caret: 'initial', ...opts })
  log(`screenshot: ${file}`)
}
const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../features/fixtures',
)
const fixture = (name) => path.join(fixtureDir, name)
const FAULTS = { db: 'db=1&blob=0', blob: 'db=0&blob=1', both: 'db=1&blob=1', none: 'db=0&blob=0' }
const fault = async (kind) => {
  const res = await fetch(`${standin}/fault?${FAULTS[kind]}`, { method: 'POST' })
  log(`fault ${kind}: ${JSON.stringify((await res.json()).fault)}`)
}

let failed = null
try {
  log(`steps: ${stepsPath}  (${width}px, ${anon ? 'signed out' : 'signed in as admin'})`)
  const { default: steps } = await import(pathToFileURL(stepsPath).href)
  await steps({
    page,
    context,
    base,
    shot,
    log,
    fixture,
    allow,
    args: JSON.parse(process.env.HIF_VERIFY_ARGS ?? '[]'),
    creds: JSON.parse(process.env.HIF_VERIFY_CREDS ?? '{}'),
    fault,
  })
  if (!anon && new URL(page.url()).pathname === '/admin/login') {
    throw new Error('ended on /admin/login: the session was rejected')
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (overflow > 0)
    throw new Error(`horizontal scroll: ${overflow}px wider than the ${width}px viewport`)
  if (problems.length) throw new Error(`${problems.length} console/page error(s)`)
  log('result: PASS')
} catch (err) {
  failed = err
  log(`result: FAIL ${err?.stack ?? err}`)
} finally {
  await fault('none').catch(() => {}) // never leave an outage behind a journey
  await shot(failed ? 'failure' : 'final').catch(() => {})
  const video = page.video()
  await context.close()
  await browser.close()
  if (video) {
    const file = path.join(evidence, `${tag}.webm`)
    renameSync(await video.path(), file)
    rmSync(path.join(evidence, '.video'), { recursive: true, force: true })
    log(`video: ${file}`)
  }
  console.error(`[evidence: ${transcript}]`)
}
process.exit(failed ? 1 : 0)
