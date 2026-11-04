// verify.sh ui RUN upload-refused.mjs
// The Dokumentasi picker on "Pemeriksaan Kondisi APAR" (1 file, 10 MB) refusing what it must:
//   1. a file over 10 MB: refused in the browser before any request ("... melebihi 10MB.")
//   2. a .txt file (the picker's accept= hides it, setInputFiles does not): the token is minted,
//      then Blob refuses the PUT on content type and the field shows the SDK's error
//   3. a PDF: accepted; then a second file: refused ("Maksimal 1 berkas.") -- the input is
//      disabled at the limit, so this is checked as the disabled state
const steps = async ({ page, base, shot, log, fixture, allow }) => {
  allow(/status of 400/) // the refused PUT in step 2
  await page.goto(`${base}/forms/kondisi-apar`, { waitUntil: 'networkidle' })
  const field = page.locator('#q-q_dokumentasi')
  const input = field.locator('input[type=file]')
  const error = field.locator('p.text-alarm')

  await input.setInputFiles({
    name: 'besar.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0xff),
  })
  await error.waitFor()
  log(`oversize: "${await error.innerText()}"`)

  await input.setInputFiles(fixture('catatan.txt'))
  await page.getByText('Mengunggah…').waitFor({ state: 'detached' }).catch(() => {})
  await error.filter({ hasNotText: 'melebihi' }).waitFor()
  log(`txt: "${await error.innerText()}"`)
  await shot('txt-refused')

  await input.setInputFiles(fixture('laporan.pdf'))
  await field.getByRole('link', { name: 'laporan.pdf' }).waitFor()
  log(`pdf: attached ${await field.getByRole('link', { name: 'laporan.pdf' }).getAttribute('href')}`)
  log(`error after pdf: ${(await error.count()) ? `"${await error.innerText()}"` : 'none'}`)
  log(`input disabled at 1/1: ${await input.isDisabled()}`)
  await field.getByRole('button', { name: 'Hapus' }).click()
  log(`after Hapus: links=${await field.getByRole('link').count()} disabled=${await input.isDisabled()}`)
  await shot('removed')
}
export default steps
