// verify.sh ui RUN submit-apar.mjs [-- NOTE [LOKASI [FIXTURE]]]
// Fills "Pemeriksaan Kondisi APAR" the way an inspector does on a phone: tries to send it empty
// first (the missing-answers alert), then picks a Lokasi, answers every Ya/Tidak with "Ya" except
// the seal ("Segel ... Tidak", one finding), writes the note, attaches a Dokumentasi file (browser
// upload straight to the Blob stand-in) and sends it.
const steps = async ({ page, base, shot, log, fixture, args }) => {
  const note = args[0] ?? `verify ui ${Date.now()}`
  const lokasi = args[1] ?? 'Gizi'
  const file = args[2] ?? 'dokumentasi.jpg'
  await page.goto(`${base}/forms/kondisi-apar`, { waitUntil: 'networkidle' }) // let it hydrate
  await page.getByRole('heading', { name: 'Pemeriksaan Kondisi APAR' }).waitFor()

  await page.getByRole('button', { name: 'Kirim pemeriksaan' }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'pertanyaan wajib belum terisi' })
  await alert.waitFor()
  log(`empty send: "${(await alert.innerText()).trim()}"`)
  await shot('missing')

  await page.getByRole('combobox', { name: /Lokasi/ }).selectOption(lokasi)
  const groups = page.getByRole('radiogroup')
  const count = await groups.count()
  for (let i = 0; i < count; i++) {
    const g = groups.nth(i)
    const label = (await g.getAttribute('aria-labelledby')) ?? ''
    const text = await page.locator(`[id="${label}"]`).innerText()
    const pick = /^Segel/.test(text) ? 'Tidak' : 'Ya'
    await g.getByRole('radio', { name: pick, exact: true }).click()
  }
  log(`answered ${count} Ya/Tidak questions (Segel = Tidak)`)
  await page.getByRole('textbox', { name: /Catatan Tambahan/ }).fill(note)

  await page.locator('#q-q_dokumentasi input[type=file]').setInputFiles(fixture(file))
  const link = page.locator('#q-q_dokumentasi').getByRole('link', { name: file })
  await link.waitFor()
  log(`uploaded: ${file} -> ${await link.getAttribute('href')}`)
  await shot('filled')

  await page.getByRole('button', { name: 'Kirim pemeriksaan' }).click()
  const done = page.getByRole('status').filter({ hasText: 'Terkirim' })
  await done.waitFor()
  log(`sent: "${(await done.innerText()).replace(/\s+/g, ' ').trim()}"`)
  const draft = await page.evaluate(() => localStorage.getItem('k3rs:draft:kondisi-apar'))
  log(`draft after send: ${draft === null ? 'cleared' : draft.slice(0, 80)}`)
}
export default steps
