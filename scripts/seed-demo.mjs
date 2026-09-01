/**
 * Seeds a handful of fictional inspections so `/admin` and the form pages have
 * something to show — used to regenerate the README screenshots.
 *
 *   npm run seed:demo            # insert demo rows
 *   npm run seed:demo -- --clean # remove exactly the rows this script inserted
 *
 * Rows go in through POST /api/submit, so every answer is validated by the same
 * code a real submission hits — a demo row can never be shaped in a way the app
 * itself would reject. The ids come back from that endpoint and are recorded in
 * `scripts/.demo-ids.json`; `--clean` deletes those ids and nothing else, which
 * is why it needs direct database access while seeding does not.
 *
 * Requires a dev server on BASE_URL (default http://localhost:3000) and
 * DATABASE_URL (or DATABASE_URL_UNPOOLED) in .env.local.
 */

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { FORMS, allQuestions } from "../src/lib/forms.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, ".demo-ids.json");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Areas per form. Forms whose area question is a `select` ignore these and draw
// from their own option list instead, since only those values validate.
const AREAS = {
  "inspeksi-lingkungan": [
    "Ruang Rawat Inap Melati",
    "Instalasi Gawat Darurat",
    "Laboratorium",
    "Instalasi Gizi",
  ],
  "kondisi-apar": ["Koridor Lantai 2", "Ruang Operasi", "Gudang Farmasi"],
  "tanggap-darurat": ["Ruang Rawat Inap Anggrek", "Radiologi"],
};

// Days before today, so a fresh seed always looks like a recent round of rounds.
const DAY_OFFSETS = [8, 7, 5, 4, 1];

const NOTES = [
  "Lampu koridor sisi timur mati, sudah dilaporkan ke IPSRS.",
  "Segel APAR lepas, dijadwalkan penggantian minggu ini.",
  "Jalur evakuasi tertutup troli linen saat inspeksi.",
  "",
];

/** Share of answerable questions that come back as a finding. */
const FINDING_RATE = 0.18;

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Seeded LCG — the same run twice produces the same answers. */
function makeRandom(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function db() {
  try {
    process.loadEnvFile(join(HERE, "..", ".env.local"));
  } catch {
    // Already-exported env vars are fine; the check below is the real gate.
  }
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    die("DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set. Check .env.local.");
  }
  console.log(`database: ${new URL(url).host}`);
  return neon(url);
}

function die(message) {
  console.error(`seed-demo: ${message}`);
  process.exit(1);
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
}

/** One filled-in submission for `form`, as the API expects it. */
function buildAnswers(form, index, rnd) {
  const areas = AREAS[form.slug] ?? ["Area Contoh"];
  const answers = {};

  for (const q of allQuestions(form)) {
    if (q.id === form.areaQuestionId) {
      answers[q.id] = q.options ? q.options[index % q.options.length] : areas[index % areas.length];
      continue;
    }
    if (q.id === form.dateQuestionId) {
      answers[q.id] = isoDaysAgo(DAY_OFFSETS[(index + form.slug.length) % DAY_OFFSETS.length]);
      continue;
    }

    if (q.options) {
      // Mostly compliant, with a scattering of findings so the admin recap has
      // non-zero numbers to show.
      const finding = q.options.find((o) => o === "Tidak" || o === "Rusak");
      const ok = q.options.find((o) => o === "Ya" || o === "Baik") ?? q.options[0];
      answers[q.id] = finding && rnd() < FINDING_RATE ? finding : ok;
    } else if (q.type === "date") {
      answers[q.id] = isoDaysAgo(DAY_OFFSETS[0]);
    } else if (q.type === "textarea") {
      answers[q.id] = NOTES[Math.floor(rnd() * NOTES.length)];
    } else if (q.required) {
      answers[q.id] = "Tim K3RS";
    }
  }

  return answers;
}

async function seed({ force }) {
  const sql = db();

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM submissions`;
  if (count > 0 && !force) {
    die(
      `submissions already holds ${count} row(s). Seeding demo data into a table ` +
        `with real inspections is probably not what you want — pass --force to do it anyway.`,
    );
  }

  const rnd = makeRandom(7);
  const ids = [];

  for (const form of FORMS) {
    const total = (AREAS[form.slug] ?? ["Area Contoh"]).length;
    for (let i = 0; i < total; i++) {
      const res = await fetch(`${BASE_URL}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formSlug: form.slug, answers: buildAnswers(form, i, rnd) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        die(`POST /api/submit for ${form.slug} failed (${res.status}): ${body.error ?? "?"}`);
      }
      ids.push(String(body.id));
    }
  }

  writeFileSync(MANIFEST, `${JSON.stringify(ids, null, 2)}\n`);
  console.log(`seeded ${ids.length} submission(s): ${ids.join(", ")}`);
  console.log(`ids recorded in ${MANIFEST} — run with --clean to remove them.`);
}

async function clean() {
  const ids = readManifest();
  if (!ids?.length) {
    die(
      `no ${MANIFEST} to clean up. It is written by a seed run; without it there ` +
        `is no record of which rows were demo data, and guessing would risk real ones.`,
    );
  }

  const sql = db();
  const deleted = await sql`
    DELETE FROM submissions WHERE id = ANY(${ids}::bigint[]) RETURNING id
  `;
  rmSync(MANIFEST, { force: true });

  console.log(`deleted ${deleted.length} of ${ids.length} recorded submission(s).`);
  if (deleted.length < ids.length) {
    console.log("(the rest were already gone)");
  }
}

const args = process.argv.slice(2);
const unknown = args.filter((a) => !["--clean", "--force"].includes(a));
if (unknown.length) die(`unknown argument(s): ${unknown.join(", ")}`);

if (args.includes("--clean")) {
  await clean();
} else {
  await seed({ force: args.includes("--force") });
}
