// verify.sh ui RUN outage.mjs [-- NOTE]
// A round on a bad connection, on "Pemeriksaan Kondisi APAR":
//   1. Blob unreachable: picking a Dokumentasi file shows "Mengunggah…" and no error for as long as
//      the outage lasts (the Blob SDK retries a failed PUT 10 times with exponential backoff,
//      ~17 minutes before it gives up), nothing is attached
//   2. Blob back: the SDK's next retry lands and the file attaches by itself
//   3. database unreachable: "Kirim pemeriksaan" shows the save error, the form and its draft stay
//   4. database back: the same button sends it ("Terkirim"), and the draft is cleared
const steps = async ({ page, base, shot, log, fixture, fault, allow, args }) => {
  allow(/status of 500/) // the refused save in step 3
  allow(/ERR_HTTP2_PROTOCOL_ERROR/) // the dropped PUTs in step 1
  const note = args[0] ?? `verify outage ${Date.now()}`
  await page.goto(`${base}/forms/kondisi-apar`, { waitUntil: 'networkidle' })
  await page.getByRole('combobox', { name: /Lokasi/ }).selectOption('Radiologi')
  const groups = page.getByRole('radiogroup')
  for (let i = 0; i < (await groups.count()); i++)
    await groups.nth(i).getByRole('radio', { name: 'Ya', exact: true }).click()
  await page.getByRole('textbox', { name: /Catatan Tambahan/ }).fill(note)

  const field = page.locator('#q-q_dokumentasi')
  await fault('blob')
  await field.locator('input[type=file]').setInputFiles(fixture('dokumentasi.jpg'))
  await page.waitForTimeout(20_000)
  const spinning = await field.getByText('Mengunggah…').isVisible()
  const errors = await field.locator('p.text-alarm').count()
  log(`blob down 20 s: "Mengunggah…" shown=${spinning}, error shown=${errors > 0}, links=${await field.getByRole('link').count()}`)
  await shot('blob-down')
  await fault('none')
  const t0 = Date.now()
  await field.getByRole('link', { name: 'dokumentasi.jpg' }).waitFor({ timeout: 90_000 })
  log(`blob back: dokumentasi.jpg attached by the SDK's own retry ${Math.round((Date.now() - t0) / 1000)} s after the outage ended`)

  await fault('db')
  await page.getByRole('button', { name: 'Kirim pemeriksaan' }).click()
  const err = page.locator('p[role=alert]')
  await err.waitFor({ timeout: 60_000 })
  log(`db down: "${await err.innerText()}"`)
  const draft = await page.evaluate(() => localStorage.getItem('k3rs:draft:kondisi-apar'))
  log(`draft kept: ${draft !== null && draft.includes(note)}; button: "${await page.getByRole('button', { name: /Kirim|Mengirim/ }).innerText()}"`)
  await shot('db-down')

  await fault('none')
  await page.getByRole('button', { name: 'Kirim pemeriksaan' }).click()
  await page.getByRole('status').filter({ hasText: 'Terkirim' }).waitFor()
  log(`db back: sent; draft ${(await page.evaluate(() => localStorage.getItem('k3rs:draft:kondisi-apar'))) === null ? 'cleared' : 'still there'}`)
}
export default steps
