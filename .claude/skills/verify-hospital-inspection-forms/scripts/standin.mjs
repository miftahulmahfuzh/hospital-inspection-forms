// node standin.mjs <tools-dir> <listen-port> <pg-port> <db> <blob-dir> <store-id> <state-file>
//
// Stands in for the hosted things a verify run must never reach, on one loopback port:
//
//   GET  /health             liveness, for verify.sh doctor
//   POST /sql                Neon's HTTP query protocol (what `neon()` speaks: single queries and
//                            transactions), executed against the run's own local Postgres
//   *    /blob/...           the Vercel Blob API (`put`, `del`, `head`, `list`, `copy`, and the
//                            browser's client-token PUT), stored under <blob-dir>; a client
//                            token's signature and options are enforced the way Vercel does.
//                            Also served over HTTPS + HTTP/2 on HIF_STANDIN_TLS_PORT for the browser
//                            (Vercel's real API is HTTP/2; Chromium streams a request body only
//                            over h2, which @vercel/blob/client does as soon as a caller passes
//                            onUploadProgress)
//   GET  /files/<pathname>   a stored blob's bytes (preload.mjs and ui.mjs route the fake store's
//                            https://<store-id>.public.blob.vercel-storage.com/... URLs here)
//   GET  /fault              the injected outages; POST /fault?db=0|1&blob=0|1 sets them. While
//                            one is on, every request to that service has its socket destroyed,
//                            which is what a dropped connection looks like to fetch.
//
// Why: the app reaches Postgres only through @neondatabase/serverless over HTTP, and Blob only
// through @vercel/blob, so a local Postgres and a local directory answer neither. Nothing here
// knows production's URLs; the connection string in a request is ignored and every query runs on
// this run's database. `pg` comes from the harness's own tool dir, not the app's node_modules.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { createSecureServer } from 'node:http2'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const [tools, portArg, pgPortArg, db, blobDir, storeId, stateFile] = process.argv.slice(2)
if (!tools || !portArg || !pgPortArg || !db || !blobDir || !storeId || !stateFile) {
  console.error(
    'usage: node standin.mjs <tools> <port> <pg-port> <db> <blob-dir> <store-id> <state-file>',
  )
  process.exit(2)
}
const port = Number(portArg)
const require = createRequire(path.join(tools, 'package.json'))
const pg = require('pg')

/* ── state: counters and injected faults ─────────────────────────────────────────────────── */

const state = {
  fault: { db: false, blob: false },
  sql: { queries: 0, dropped: 0 },
  blobs: { put: 0, deleted: 0, refused: 0, dropped: 0 },
}
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 1))
save()

/* ── Neon HTTP ───────────────────────────────────────────────────────────────────────────── */

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: Number(pgPortArg),
  user: 'postgres',
  database: db,
  max: 8,
})

// Neon's HTTP protocol returns every value as text and lets the driver parse it by type oid.
const RAW = { getTypeParser: () => (v) => v }
const ISO = {
  ReadUncommitted: 'READ UNCOMMITTED',
  ReadCommitted: 'READ COMMITTED',
  RepeatableRead: 'REPEATABLE READ',
  Serializable: 'SERIALIZABLE',
}
const shape = (r) => ({
  command: r.command,
  rowCount: r.rowCount,
  rowAsArray: true,
  fields: (r.fields ?? []).map((f) => ({
    name: f.name,
    dataTypeID: f.dataTypeID,
    tableID: f.tableID,
    columnID: f.columnID,
    dataTypeSize: f.dataTypeSize,
    dataTypeModifier: f.dataTypeModifier,
    format: 'text',
  })),
  rows: r.rows ?? [],
})
const run = (client, q) =>
  client.query({ text: q.query, values: q.params ?? [], rowMode: 'array', types: RAW })
const brief = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 160)

async function sql(req, body) {
  const client = await pool.connect()
  state.sql.queries++
  try {
    if (!Array.isArray(body.queries)) {
      console.log(`sql  ${brief(body.query)}`)
      return shape(await run(client, body))
    }
    const iso = ISO[req.headers['neon-batch-isolation-level']] ?? ''
    const ro = req.headers['neon-batch-read-only'] === 'true' ? ' READ ONLY' : ''
    console.log(`tx   ${body.queries.length} statement(s)${iso ? ' ' + iso : ''}${ro}`)
    await client.query(`BEGIN${iso ? ' ISOLATION LEVEL ' + iso : ''}${ro}`)
    try {
      const results = []
      for (const q of body.queries) {
        console.log(`  sql ${brief(q.query)}`)
        results.push(shape(await run(client, q)))
      }
      await client.query('COMMIT')
      return { results }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    }
  } finally {
    client.release()
    save()
  }
}

/* ── Vercel Blob ─────────────────────────────────────────────────────────────────────────── */

const publicBase = `https://${storeId}.public.blob.vercel-storage.com`
mkdirSync(blobDir, { recursive: true })
const SUFFIX = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const suffix = () => [...randomBytes(30)].map((b) => SUFFIX[b % SUFFIX.length]).join('')
const safe = (p) => {
  const clean = path.posix.normalize(String(p).replace(/^\/+/, ''))
  if (!clean || clean.startsWith('..') || clean.includes('\0'))
    throw Object.assign(new Error('bad pathname'), { status: 400 })
  return clean
}
const fileOf = (p) => path.join(blobDir, safe(p))
const metaOf = (p) => `${fileOf(p)}.__meta.json`
const pathnameOf = (urlOrPath) => {
  const s = String(urlOrPath)
  if (s.startsWith('http')) {
    const u = new URL(s)
    if (u.hostname !== `${storeId}.public.blob.vercel-storage.com`)
      throw Object.assign(new Error(`not this run's store: ${u.hostname}`), { status: 404 })
    return safe(decodeURIComponent(u.pathname))
  }
  return safe(s)
}
const describe = (p) => {
  const m = JSON.parse(readFileSync(metaOf(p), 'utf8'))
  return {
    url: `${publicBase}/${p}`,
    downloadUrl: `${publicBase}/${p}?download=1`,
    pathname: p,
    size: m.size,
    uploadedAt: m.uploadedAt,
    contentType: m.contentType,
    contentDisposition: `inline; filename="${path.posix.basename(p)}"`,
    cacheControl: `public, max-age=${m.cacheControlMaxAge ?? 2592000}`,
    etag: `"${m.sha256}"`,
  }
}
function store(p, bytes, contentType, cacheControlMaxAge) {
  mkdirSync(path.dirname(fileOf(p)), { recursive: true })
  writeFileSync(fileOf(p), bytes)
  writeFileSync(
    metaOf(p),
    JSON.stringify({
      size: bytes.length,
      contentType,
      cacheControlMaxAge,
      sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 32),
      uploadedAt: new Date().toISOString(),
    }),
  )
  state.blobs.put++
  save()
  console.log(`blob put ${p} ${bytes.length}B ${contentType}`)
  return describe(p)
}
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (!e.name.endsWith('.__meta.json'))
      out.push(path.relative(blobDir, f).split(path.sep).join('/'))
  }
  return out
}
function withSuffix(p, headers) {
  if (headers['x-add-random-suffix'] !== '1' && headers['x-add-random-suffix'] !== 'true') return p
  const ext = path.posix.extname(p)
  return `${p.slice(0, p.length - ext.length)}-${suffix()}${ext}`
}
const blobErr = (status, code, message) => {
  state.blobs.refused++
  save()
  return { status, body: { error: { code, message } } }
}
// With no x-content-type header (the browser's upload() sends none), Vercel types a blob by its
// pathname's extension. The app's token allows jpeg, png, webp, heic and pdf.
const BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}
const typeOf = (h, p) =>
  h['x-content-type'] ?? BY_EXT[path.posix.extname(p).toLowerCase()] ?? 'application/octet-stream'

// The browser's upload() carries no option headers: the options live in the client token
// /api/upload minted (vercel_blob_client_<store>_<base64("<hmac>.<base64 json>")>), signed with
// the run's read-write token. Vercel verifies and applies them; so does this.
const rwToken = process.env.HIF_STANDIN_RW_TOKEN ?? ''
function clientTokenOptions(auth) {
  const token = String(auth ?? '').replace(/^Bearer /, '')
  if (!token.startsWith('vercel_blob_client_')) return null
  const [, , , , encoded = ''] = token.split('_')
  const [sig = '', payload = ''] = Buffer.from(encoded, 'base64').toString().split('.')
  const want = createHmac('sha256', rwToken).update(payload).digest('hex')
  if (
    !rwToken ||
    sig.length !== want.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(want))
  ) {
    throw Object.assign(new Error('Invalid client token signature'), { status: 403 })
  }
  return JSON.parse(Buffer.from(payload, 'base64').toString())
}
// A server-side call (put, del, head, list) carries the read-write token itself.
function serverToken(auth) {
  const token = String(auth ?? '').replace(/^Bearer /, '')
  if (token !== rwToken)
    throw Object.assign(new Error('Access denied, please provide a valid token'), { status: 403 })
}

async function blobApi(req, url, bytes) {
  const sub = url.pathname.replace(/^\/blob/, '') || '/'
  const h = req.headers
  if (req.method === 'PUT' && sub === '/') {
    const requested = safe(url.searchParams.get('pathname'))
    const opts = clientTokenOptions(h.authorization)
    if (!opts) serverToken(h.authorization)
    if (url.searchParams.get('fromUrl')) {
      const from = pathnameOf(url.searchParams.get('fromUrl'))
      if (!existsSync(fileOf(from))) return blobErr(404, 'not_found', 'source blob not found')
      const p = withSuffix(requested, h)
      return {
        status: 200,
        body: store(
          p,
          readFileSync(fileOf(from)),
          h['x-content-type'] ?? JSON.parse(readFileSync(metaOf(from), 'utf8')).contentType,
          h['x-cache-control-max-age'],
        ),
      }
    }
    if (opts) {
      if (opts.pathname !== requested)
        return blobErr(403, 'forbidden', `client token is for ${opts.pathname}, not ${requested}`)
      if (opts.validUntil && Date.now() > opts.validUntil)
        return blobErr(403, 'forbidden', 'client token expired')
      if (opts.maximumSizeInBytes && bytes.length > opts.maximumSizeInBytes)
        return blobErr(
          400,
          'bad_request',
          `File size ${bytes.length} exceeds the maximum ${opts.maximumSizeInBytes}`,
        )
      const ct = typeOf(h, requested)
      if (opts.allowedContentTypes && !opts.allowedContentTypes.includes(ct))
        return blobErr(400, 'bad_request', `Content type ${ct} is not allowed`)
      if (opts.addRandomSuffix !== undefined)
        h['x-add-random-suffix'] = opts.addRandomSuffix ? '1' : '0'
      if (opts.allowOverwrite !== undefined)
        h['x-allow-overwrite'] = opts.allowOverwrite ? '1' : '0'
      if (opts.cacheControlMaxAge !== undefined)
        h['x-cache-control-max-age'] = String(opts.cacheControlMaxAge)
      console.log(
        `blob client-token put ${requested} (suffix=${opts.addRandomSuffix} max=${opts.maximumSizeInBytes} types=${opts.allowedContentTypes})`,
      )
    }
    const p = withSuffix(requested, h)
    if (
      existsSync(fileOf(p)) &&
      h['x-allow-overwrite'] !== '1' &&
      h['x-allow-overwrite'] !== 'true'
    ) {
      return blobErr(
        400,
        'bad_request',
        'This blob already exists, use `allowOverwrite: true` if you want to overwrite it.',
      )
    }
    return { status: 200, body: store(p, bytes, typeOf(h, p), h['x-cache-control-max-age']) }
  }
  serverToken(h.authorization)
  if (req.method === 'POST' && sub === '/delete') {
    const { urls = [] } = JSON.parse(bytes.toString('utf8') || '{}')
    for (const u of urls) {
      try {
        const p = pathnameOf(u)
        rmSync(fileOf(p), { force: true })
        rmSync(metaOf(p), { force: true })
        state.blobs.deleted++
        console.log(`blob del ${p}`)
      } catch (e) {
        console.log(`blob del refused ${u}: ${e.message}`)
      }
    }
    save()
    return { status: 200, body: {} }
  }
  if (req.method === 'GET' && sub === '/' && url.searchParams.get('url')) {
    const p = pathnameOf(url.searchParams.get('url'))
    if (!existsSync(metaOf(p)))
      return blobErr(404, 'not_found', 'The requested blob does not exist')
    return { status: 200, body: describe(p) }
  }
  if (req.method === 'GET' && sub === '/') {
    const prefix = url.searchParams.get('prefix') ?? ''
    const limit = Number(url.searchParams.get('limit') ?? 1000)
    const all = walk(blobDir)
      .filter((p) => p.startsWith(prefix))
      .sort()
    const start = Number(url.searchParams.get('cursor') ?? 0)
    const page = all.slice(start, start + limit)
    const hasMore = start + limit < all.length
    const blobs = page.map((p) => {
      const d = describe(p)
      return {
        url: d.url,
        downloadUrl: d.downloadUrl,
        pathname: p,
        size: d.size,
        uploadedAt: d.uploadedAt,
        etag: d.etag,
      }
    })
    return {
      status: 200,
      body: { blobs, hasMore, cursor: hasMore ? String(start + limit) : undefined },
    }
  }
  if (sub.startsWith('/mpu'))
    return blobErr(
      400,
      'bad_request',
      'verify stand-in: multipart uploads are not implemented (the app never passes multipart: true)',
    )
  return blobErr(400, 'bad_request', `verify stand-in: unhandled ${req.method} ${sub}`)
}

/* ── server ──────────────────────────────────────────────────────────────────────────────── */

const cors = (req) => ({
  'access-control-allow-origin': req.headers.origin ?? '*',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
  'access-control-max-age': '600',
})
const json = (req, res, status, body) =>
  res
    .writeHead(status, { 'content-type': 'application/json', ...cors(req) })
    .end(JSON.stringify(body))

// An injected outage: drop the connection without an answer, as a dead network does.
function dropped(req, url) {
  const service = url.pathname.startsWith('/sql')
    ? 'db'
    : url.pathname === '/blob' || url.pathname.startsWith('/blob/')
      ? 'blob'
      : null
  if (!service || !state.fault[service] || req.method === 'OPTIONS') return false
  if (service === 'db') state.sql.dropped++
  else state.blobs.dropped++
  save()
  console.log(`fault ${service}: dropped ${req.method} ${url.pathname}`)
  if (req.stream) req.stream.close(2)
  else req.socket.destroy()
  return true
}

function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  if (dropped(req, url)) return
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req)).end()
    return
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    res
      .writeHead(200, { 'content-type': 'text/plain' })
      .end(`hospital-inspection-forms-verify-standin ok db=${db} store=${storeId}\n`)
    return
  }
  if (url.pathname === '/fault') {
    if (req.method === 'POST') {
      for (const k of ['db', 'blob'])
        if (url.searchParams.has(k)) state.fault[k] = url.searchParams.get(k) === '1'
      save()
      console.log(`fault set db=${state.fault.db} blob=${state.fault.blob}`)
    }
    json(req, res, 200, state)
    return
  }
  if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
    let p
    try {
      p = safe(decodeURIComponent(url.pathname.slice('/files/'.length)))
    } catch {
      res.writeHead(400).end()
      return
    }
    if (!existsSync(metaOf(p))) {
      res
        .writeHead(404, { 'content-type': 'text/plain', ...cors(req) })
        .end('The requested blob does not exist')
      return
    }
    const m = JSON.parse(readFileSync(metaOf(p), 'utf8'))
    res.writeHead(200, {
      'content-type': m.contentType,
      'content-length': statSync(fileOf(p)).size,
      'cache-control': 'no-store',
      ...cors(req),
    })
    res.end(readFileSync(fileOf(p)))
    return
  }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    const bytes = Buffer.concat(chunks)
    try {
      if (url.pathname === '/blob' || url.pathname.startsWith('/blob/')) {
        const out = await blobApi(req, url, bytes)
        if (out.status >= 400)
          console.log(
            `blob ${req.method} ${url.pathname}${url.search} -> ${out.status} ${out.body?.error?.message ?? ''}`,
          )
        json(req, res, out.status, out.body)
        return
      }
      if (req.method === 'POST' && url.pathname.startsWith('/sql')) {
        json(req, res, 200, await sql(req, JSON.parse(bytes.toString('utf8'))))
        return
      }
      res.writeHead(404).end()
    } catch (e) {
      console.log(`err  ${req.method} ${url.pathname} ${e.code ?? ''} ${brief(e.message)}`)
      if (url.pathname.startsWith('/blob')) {
        state.blobs.refused++
        save()
        json(req, res, e.status ?? 400, {
          error: { code: e.status === 403 ? 'forbidden' : 'bad_request', message: e.message },
        })
        return
      }
      const fields = [
        'code',
        'severity',
        'detail',
        'hint',
        'position',
        'schema',
        'table',
        'column',
        'constraint',
        'where',
      ]
      const err = { message: e.message }
      for (const f of fields) if (e[f] !== undefined) err[f] = e[f]
      json(req, res, 400, err)
    }
  })
}

const server = createServer(handle)

const tlsPort = Number(process.env.HIF_STANDIN_TLS_PORT ?? 0)
if (tlsPort) {
  // A per-run self-signed certificate for 127.0.0.1; only the run's own browser accepts it.
  const tls = createSecureServer(
    {
      key: readFileSync(process.env.HIF_STANDIN_TLS_KEY),
      cert: readFileSync(process.env.HIF_STANDIN_TLS_CERT),
      allowHTTP1: true,
    },
    handle,
  )
  tls.listen(tlsPort, '127.0.0.1', () =>
    console.log(`standin listening on https://127.0.0.1:${tlsPort} (h2, for the browser)`),
  )
}

server.listen(port, '127.0.0.1', () =>
  console.log(
    `standin listening on http://127.0.0.1:${port} -> pg 127.0.0.1:${pgPortArg}/${db}, blobs ${blobDir}`,
  ),
)
