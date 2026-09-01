import { ensureSchema, sql, type SubmissionRow } from "./db";

/** Widest sensible bounds, so the query shape stays constant when no filter is set. */
const MIN_DATE = "1900-01-01";
const MAX_DATE = "9999-12-31";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { from: string; to: string };

/** Accepts raw query-string values and falls back to open bounds when absent or malformed. */
export function parseRange(from?: string, to?: string): DateRange {
  return {
    from: from && ISO_DATE.test(from) ? from : MIN_DATE,
    to: to && ISO_DATE.test(to) ? to : MAX_DATE,
  };
}

export function isOpenRange(range: DateRange): boolean {
  return range.from === MIN_DATE && range.to === MAX_DATE;
}

/**
 * The Neon driver hands back JS Date objects for DATE/TIMESTAMPTZ columns, which then
 * lie about the declared string types and re-serialise through the server/client
 * boundary inconsistently. Every query below casts to a strict ISO string instead.
 */
export type FormSummary = {
  form_slug: string;
  submissions: number;
  findings: number;
  last_submission: string | null;
};

export async function getSummary(range: DateRange): Promise<FormSummary[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT form_slug,
           COUNT(*)::int                   AS submissions,
           COALESCE(SUM(findings), 0)::int AS findings,
           to_char(MAX(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             AS last_submission
    FROM submissions
    WHERE inspection_date BETWEEN ${range.from} AND ${range.to}
    GROUP BY form_slug
  `;
  return rows as FormSummary[];
}

export async function getRecent(
  range: DateRange,
  limit = 50,
): Promise<SubmissionRow[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, form_slug, area,
           inspection_date::text AS inspection_date,
           answers, findings,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             AS created_at
    FROM submissions
    WHERE inspection_date BETWEEN ${range.from} AND ${range.to}
    ORDER BY inspection_date DESC, id DESC
    LIMIT ${limit}
  `;
  return rows as SubmissionRow[];
}

/** Every submission for one form, oldest first — the row order used in the export. */
export async function getAllForForm(
  formSlug: string,
  range: DateRange,
): Promise<SubmissionRow[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, form_slug, area,
           inspection_date::text AS inspection_date,
           answers, findings,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             AS created_at
    FROM submissions
    WHERE form_slug = ${formSlug}
      AND inspection_date BETWEEN ${range.from} AND ${range.to}
    ORDER BY inspection_date ASC, id ASC
  `;
  return rows as SubmissionRow[];
}
