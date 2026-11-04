// node xlsx.mjs <app-dir> <file.xlsx> [max-rows-per-sheet]
// Prints what a reader of the admin's Excel export sees: each sheet's name, header row, data rows
// (No, Dikirim, Lokasi/date and Jumlah temuan in full, other answers summarised), which cells are
// coloured red (findings) or green, and the file-question cells. exceljs is the app's own copy, read
// from the run's snapshot.
import { createRequire } from 'node:module'
import path from 'node:path'

const [appDir, file, maxArg] = process.argv.slice(2)
if (!appDir || !file) {
  console.error('usage: node xlsx.mjs <app-dir> <file.xlsx> [max-rows]')
  process.exit(2)
}
const max = Number(maxArg ?? 20)
const ExcelJS = createRequire(path.join(appDir, 'package.json'))('exceljs')
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(file)
console.log(`workbook creator="${wb.creator}" sheets=${wb.worksheets.length}`)

const text = (v) => {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return `date:${v.toISOString().slice(0, 10)}`
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('')
  return String(v)
}
const RED = 'FFC6362B'
const GREEN = 'FF0F7A3D'

for (const ws of wb.worksheets) {
  const header = ws.getRow(1).values.slice(1).map(text)
  const data = ws.rowCount - 1
  console.log(`\n== sheet "${ws.name}": ${header.length} columns, ${data} data row(s), frozen=x${ws.views?.[0]?.xSplit ?? 0}/y${ws.views?.[0]?.ySplit ?? 0}, autoFilter=${ws.autoFilter ? 'yes' : 'no'}`)
  console.log(`header: ${header.slice(0, 4).join(' | ')} | ... | ${header.slice(-2).join(' | ')}`)
  const fileCols = header.flatMap((h, i) => (/^Dokumentasi/.test(h) ? [i + 1] : []))
  for (let r = 2; r <= Math.min(ws.rowCount, max + 1); r++) {
    const row = ws.getRow(r)
    const cells = header.map((_, i) => row.getCell(i + 1))
    const red = cells.filter((c) => c.font?.color?.argb === RED).length
    const green = cells.filter((c) => c.font?.color?.argb === GREEN).length
    const vals = cells.map((c) => text(c.value))
    const files = fileCols.map((c) => text(row.getCell(c).value).replace(/\n/g, ' ; ')).filter(Boolean)
    console.log(
      `row ${r - 1}: ${vals.slice(0, 4).join(' | ')} | findings=${vals.at(-1)} | red=${red} green=${green}` +
        (files.length ? `\n  files: ${files.join(' ; ')}` : ''),
    )
  }
  if (ws.rowCount - 1 > max) console.log(`[... ${ws.rowCount - 1 - max} more row(s)]`)
}
