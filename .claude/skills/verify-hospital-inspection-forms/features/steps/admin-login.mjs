// verify.sh ui RUN admin-login.mjs            (signed out, the default)
// The admin's way in and out: "Admin" from the home page lands on /admin/login (the recap
// redirects signed-out visitors), a wrong password shows the vague error, the run's own
// credentials land on the recap, "Keluar" ends on /admin/login again and /admin stays shut.
const steps = async ({ page, base, shot, log, creds, allow }) => {
  allow(/status of 401/) // the wrong-password attempt
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Admin' }).click()
  await page.getByRole('heading', { name: 'Masuk admin' }).waitFor()
  log(`Admin link -> ${new URL(page.url()).pathname}`)

  await page.getByLabel('Nama pengguna').fill(creds.username)
  await page.getByLabel('Kata sandi').fill('salah-sekali')
  await page.getByRole('button', { name: 'Masuk' }).click()
  // Not getByRole('alert'): Next's route announcer is an alert too, holding the page title.
  const alert = page.locator('p[role=alert]')
  await alert.waitFor()
  log(`wrong password: "${await alert.innerText()}"`)
  await shot('wrong')

  await page.getByLabel('Kata sandi').fill(creds.password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await page.getByText('Rekap pemeriksaan').waitFor()
  const h1 = await page.getByRole('heading', { level: 1 }).innerText()
  log(`signed in -> ${new URL(page.url()).pathname}: "${h1.replace(/\s+/g, ' ')}"`)
  const cookie = (await page.context().cookies()).find((c) => c.name === 'k3rs_admin')
  log(`cookie k3rs_admin: httpOnly=${cookie?.httpOnly} sameSite=${cookie?.sameSite} secure=${cookie?.secure}`)
  await shot('recap')

  await page.getByRole('button', { name: 'Keluar' }).click()
  await page.getByRole('heading', { name: 'Masuk admin' }).waitFor()
  log(`Keluar -> ${new URL(page.url()).pathname}; cookie left: ${(await page.context().cookies()).some((c) => c.name === 'k3rs_admin')}`)
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' })
  log(`/admin after Keluar -> ${new URL(page.url()).pathname}`)
}
export default steps
