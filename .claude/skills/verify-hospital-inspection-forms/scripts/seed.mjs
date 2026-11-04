// node --experimental-strip-types seed.mjs <app-dir> <base-url> <standin-url> <fixtures-dir> <out.json>
// (BLOB token in HIF_SEED_RW_TOKEN)
//
// Five inspections, put through the app's own POST /api/submit so `findings` and the stored answer
// map are what the app derives, not what a seeder wrote. Each Dokumentasi file is first stored in
// the run's stand-in Blob store with the run's read-write token (the end state of the browser's
// direct upload: a public URL on the fake store, random suffix, pathname = the file's name), then
// referenced from the answers exactly as the form does it ([{url, name, size}] as a JSON string).
//
// Answers are built from the checkout's own src/lib/forms.ts, so the seed follows the questions as
// they change: every required radio gets its compliant option except the ones named below, every
// required text gets a fixed string, optional questions stay blank. Dates are relative to today in
// Asia/Jakarta and never in the future.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [appDir, base, standin, fixtures, out] = process.argv.slice(2)
const rw = process.env.HIF_SEED_RW_TOKEN
if (!appDir || !base || !standin || !fixtures || !out || !rw) {
  console.error('usage: seed.mjs <app-dir> <base> <standin> <fixtures> <out.json> (HIF_SEED_RW_TOKEN)')
  process.exit(2)
}
const { FORMS, allQuestions } = await import(pathToFileURL(path.join(appDir, 'src/lib/forms.ts')).href)

const jakartaDay = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(d)
}

// slug, area, days ago, how many required radios answer the finding option, note, files
const SEED = [
  ['inspeksi-lingkungan', 'Gedung Verify IGD Lt 2', 1, 2, 'Lampu koridor timur mati (verify seed).', ['dokumentasi.jpg', 'laporan.pdf']],
  ['inspeksi-lingkungan', 'Gedung Verify Gizi', 3, 0, 'Tidak ada temuan (verify seed).', ['dokumentasi.jpg']],
  ['kondisi-apar', 'ICU', 2, 1, 'Segel lepas (verify seed).', ['dokumentasi.jpg']],
  ['kondisi-apar', 'Laboratorium', 0, 0, 'APAR siap pakai (verify seed).', ['laporan.pdf']],
  ['tanggap-darurat', 'Gedung Verify Radiologi', 40, 3, 'Jalur evakuasi terhalang troli (verify seed).', ['dokumentasi.jpg']],
]

async function putBlob(name) {
  const bytes = readFileSync(path.join(fixtures, name))
  const res = await fetch(`${standin}/blob/?pathname=${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${rw}`, 'x-add-random-suffix': '1' },
    body: bytes,
  })
  if (!res.ok) throw new Error(`blob put ${name}: ${res.status} ${await res.text()}`)
  const blob = await res.json()
  return { url: blob.url, name, size: bytes.length }
}

const ids = []
for (const [slug, area, daysAgo, findings, note, files] of SEED) {
  const form = FORMS.find((f) => f.slug === slug)
  if (!form) throw new Error(`no form ${slug} in src/lib/forms.ts`)
  const answers = {}
  let left = findings
  for (const q of allQuestions(form)) {
    if (q.id === form.areaQuestionId) {
      if (q.options && !q.options.includes(area)) throw new Error(`${slug}: ${area} is not a Lokasi option`)
      answers[q.id] = area
    } else if (q.id === form.dateQuestionId) {
      answers[q.id] = jakartaDay(daysAgo)
    } else if (q.type === 'file') {
      if (q.required) answers[q.id] = JSON.stringify(await Promise.all(files.slice(0, q.maxFiles ?? 1).map(putBlob)))
    } else if (q.options && q.required) {
      const bad = q.options.find((o) => o === 'Tidak' || o === 'Rusak')
      const ok = q.options.find((o) => o === 'Ya' || o === 'Baik') ?? q.options[0]
      answers[q.id] = bad && left > 0 ? (left--, bad) : ok
    } else if (q.type === 'textarea' && q.required) {
      answers[q.id] = note
    } else if (q.type === 'date' && q.required) {
      answers[q.id] = jakartaDay(daysAgo)
    } else if (q.required) {
      answers[q.id] = 'Tim K3RS Verify'
    }
  }
  const res = await fetch(`${base}/api/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ formSlug: slug, answers }),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status !== 201) throw new Error(`submit ${slug} ${area}: ${res.status} ${JSON.stringify(body)}`)
  ids.push({ id: String(body.id), slug, area, date: jakartaDay(daysAgo), findings })
  console.log(`seeded ${body.id} ${slug} "${area}" ${jakartaDay(daysAgo)} findings=${findings} files=${files.join(',')}`)
}
writeFileSync(out, JSON.stringify(ids, null, 1))
