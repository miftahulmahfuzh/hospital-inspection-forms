// verify.sh ui RUN draft.mjs [-- LOKASI]
// Draft persistence on "Tanggap Darurat & Kebakaran": answer a few questions, reload the page (a
// closed tab), see "Draf sebelumnya dipulihkan" with the answers back, then "Mulai kosong" clears
// them and the stored draft, leaving only today's date.
const steps = async ({ page, base, shot, log, args }) => {
  const lokasi = args[0] ?? 'Gedung Draft Verify'
  await page.goto(`${base}/forms/tanggap-darurat`, { waitUntil: 'networkidle' })
  const date = page.getByRole('textbox', { name: /Waktu Pemeriksaan/ })
  log(`date default: ${await date.inputValue()}`)
  await page.getByRole('textbox', { name: /^Lokasi/ }).fill(lokasi)
  const g = page.getByRole('radiogroup', { name: /Terdapat dokumen prosedur tanggap darurat/ })
  await g.getByRole('radio', { name: 'Tidak', exact: true }).click()
  await page.getByText('1 temuan').first().waitFor()
  log(`stored: ${await page.evaluate(() => localStorage.getItem('k3rs:draft:tanggap-darurat'))}`)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Draf sebelumnya dipulihkan dari perangkat ini.').waitFor()
  log(`after reload: Lokasi="${await page.getByRole('textbox', { name: /^Lokasi/ }).inputValue()}" Tidak checked=${await g.getByRole('radio', { name: 'Tidak', exact: true }).getAttribute('aria-checked')}`)
  await shot('restored')

  await page.getByRole('button', { name: 'Mulai kosong' }).click()
  await page.getByText('Draf sebelumnya dipulihkan dari perangkat ini.').waitFor({ state: 'detached' })
  log(`after Mulai kosong: Lokasi="${await page.getByRole('textbox', { name: /^Lokasi/ }).inputValue()}" date=${await date.inputValue()}`)
  log(`stored: ${await page.evaluate(() => localStorage.getItem('k3rs:draft:tanggap-darurat'))}`)
}
export default steps
