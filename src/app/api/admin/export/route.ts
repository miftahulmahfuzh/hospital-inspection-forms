import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { FORMS, allQuestions } from "@/lib/forms";
import { getAllForForm, parseRange, isOpenRange } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Excel has no timezone concept for datetimes, so the submitted-at column is written
// as a preformatted WIB string instead of a bare Date that would drift per reader.
const WIB = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const INK = "FF14261C";
const ALARM = "FFC6362B";
const SAFE = "FF0F7A3D";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const url = new URL(request.url);
  const range = parseRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "InsMobile · RSUD dr. Achmad Darwis";
    workbook.created = new Date();

    for (const form of FORMS) {
      const questions = allQuestions(form);
      const rows = await getAllForForm(form.slug, range);
      const sheet = workbook.addWorksheet(form.sheetName, {
        views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
      });

      sheet.columns = [
        { header: "No", key: "no", width: 6 },
        { header: "Dikirim (WIB)", key: "submitted", width: 18 },
        ...questions.map((q) => ({
          header: q.label,
          key: q.id,
          // Free-text answers need room; Ya/Tidak columns do not.
          width: q.type === "textarea" ? 40 : q.type === "radio" ? 14 : 20,
        })),
        { header: "Jumlah temuan", key: "findings", width: 16 },
      ];

      const header = sheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      header.alignment = { vertical: "middle", wrapText: true };
      header.height = 46;

      rows.forEach((row, i) => {
        const answers = row.answers ?? {};
        const added = sheet.addRow({
          no: i + 1,
          submitted: WIB.format(new Date(row.created_at)),
          ...Object.fromEntries(questions.map((q) => [q.id, answers[q.id] ?? ""])),
          findings: row.findings,
        });
        added.alignment = { vertical: "top", wrapText: true };

        for (const q of questions) {
          const cell = added.getCell(q.id);
          if (q.type === "date" && typeof answers[q.id] === "string" && answers[q.id]) {
            // Store as a real date so Excel can sort and filter on it.
            cell.value = new Date(`${answers[q.id]}T00:00:00Z`);
            cell.numFmt = "yyyy-mm-dd";
          }
          const v = answers[q.id];
          if (v === "Tidak" || v === "Rusak") {
            cell.font = { color: { argb: ALARM }, bold: true };
          } else if (v === "Ya" || v === "Baik") {
            cell.font = { color: { argb: SAFE } };
          }
        }
        if (row.findings > 0) {
          added.getCell("findings").font = { color: { argb: ALARM }, bold: true };
        }
      });

      if (rows.length > 0) {
        sheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: sheet.columnCount },
        };
      } else {
        const empty = sheet.addRow({ no: "", submitted: "" });
        empty.getCell(3).value = "Belum ada pemeriksaan pada rentang tanggal ini.";
        empty.getCell(3).font = { italic: true, color: { argb: "FF55645A" } };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = isOpenRange(range)
      ? "semua"
      : `${range.from}_sd_${range.to}`;
    const filename = `Inspeksi-K3RS_${stamp}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("export failed", err);
    return NextResponse.json(
      { error: "Gagal menyusun berkas Excel." },
      { status: 500 },
    );
  }
}
