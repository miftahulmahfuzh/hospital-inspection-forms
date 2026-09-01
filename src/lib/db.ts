import { neon } from "@neondatabase/serverless";

/**
 * Neon over HTTP. The pooled `DATABASE_URL` is what Vercel's Neon integration sets;
 * `DATABASE_URL_UNPOOLED` is accepted so a locally-pasted direct URL also works.
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL (or DATABASE_URL_UNPOOLED) to your Neon connection string.",
    );
  }
  return url;
}

export const sql = neon(connectionString());

export type SubmissionRow = {
  id: number;
  form_slug: string;
  area: string;
  inspection_date: string;
  answers: Record<string, string>;
  findings: number;
  created_at: string;
};

let ensured: Promise<void> | null = null;

/**
 * Creates the schema on first use. Cheap enough to await on every request path
 * (all statements are IF NOT EXISTS) and it keeps deploys free of a migration step.
 */
export function ensureSchema(): Promise<void> {
  ensured ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id            BIGSERIAL PRIMARY KEY,
        form_slug     TEXT        NOT NULL,
        area          TEXT        NOT NULL,
        inspection_date DATE      NOT NULL,
        answers       JSONB       NOT NULL,
        findings      INTEGER     NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS submissions_form_date_idx
        ON submissions (form_slug, inspection_date DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS submissions_created_idx
        ON submissions (created_at DESC)
    `;
  })().catch((err) => {
    ensured = null; // let the next request retry rather than caching the failure
    throw err;
  });
  return ensured;
}
