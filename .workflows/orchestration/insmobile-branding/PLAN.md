# Plan: InsMobile branding + institutional logos

**Slug:** insmobile-branding
**Date:** 2026-09-11 10:56 WIB
**Analysis:** `20260911-105646_code_analyzer.md`
**Worktree:** `/home/miftah/.worktrees/hospital-inspection-forms/insmobile-branding`
**Branch:** `feature/insmobile-branding` (base: `origin/main` @ `d7c2aae`)
**Phases:** 1
**Status:** planned
**Coordinator:** —

## Why

> terus, arif kemarin bikin singkatannya InsMobile (inspeksi mobile). Kira kira bisa dimasukkan kata kata itu di dalam dashboard nya nanti bang adek?
> mau nambahin logo juga untuk itu bisa bang adek? ada logo kabupaten lima puluh kota nya sama logo k3

Arif's Latsar CPNS actualization report titles the system "Sistem Inspeksi Mobile (InsMobile)". His evaluation requires the delivered product — dashboard included — to carry that name and the two institutional marks from his report cover (Kabupaten Lima Puluh Kota arms; K3 gear).

## Requirements

| ID | What the user asked for | Phases |
|---|---|---|
| R1 | Masukkan nama **InsMobile** (inspeksi mobile) ke dalam dashboard aplikasi | 1 |
| R2 | Tambahkan **logo K3** dan **logo Kabupaten Lima Puluh Kota** ke tampilan situs | 1 |

## Scope

**In scope:** brand asset pipeline (key + trim + resize the two JPEGs → committed PNGs); SiteHeader rebrand (logos + "InsMobile" wordmark) which covers the dashboard and every other route; root metadata (title/template/description); `icon.png` + `apple-icon.png` beside the existing `favicon.ico`; landing hero eyebrow + footer; `.xlsx` `workbook.creator`; README title/note.
**Out of scope:** the mentor's "beberapa pertanyaan yang direvisi" — the revised questions were never shared, so there is nothing to plan against; when Arif lists them, run a new `/analyze`. Re-shooting `docs/screenshots/*` (they will show the old header until someone re-runs the seed + screenshots). DB, auth, form schemas, API contracts.

## Invariants

1. `npm run build` and `npm run lint` pass at the end of the phase.
2. Brand casing is visual: the wordmark reads **"InsMobile"**, never "INSMOBILE" — `.signage`'s `text-transform: uppercase` must be opted out (`normal-case`) or the wordmark must not use `.signage`.
3. The kabupaten logo renders with **no checkerboard artifact** — keying must be border-connected flood-fill (keeps the white quadrants inside the shield), not a global near-white threshold.
4. Header total height stays ≤ 5.5rem (`.rail { top: 5.5rem }` and `scroll-padding-top: 5.5rem` depend on it); no horizontal overflow at 360 px viewport.
5. No changes outside branding surfaces: DB, auth, form schemas/questions, API request/response shapes untouched.
6. Arif's original files at the repo root of the primary checkout are **copied, never moved or deleted**.

## Phases

| # | Title | Satisfies | Package | Files | Depends on | Difficulty | Plan | TaskID | Card |
|---|-------|-----------|---------|-------|-----------|------------|------|--------|------|
| 1 | InsMobile wordmark + K3 & Kabupaten Lima Puluh Kota logos across the app | R1, R2 | `src/`, `scripts/`, `brand/` | 13 | — | NORMAL | `.workflows/plan/insmobile-branding/phase-1.md` | — | — |

### Phase 1 — InsMobile wordmark + K3 & Kabupaten Lima Puluh Kota logos across the app
**Satisfies:** R1, R2
**Owns:** asset pipeline + all branding surfaces listed in Scope
**Does not touch:** DB/auth/forms/API logic, seed script, screenshots, Arif's original root files
**Exit criteria:** dashboard (`/admin`), login, landing, form pages and 404 all show the InsMobile wordmark with both logos in a clean white header; tab title/metadata carry InsMobile; icons derive from the K3 mark; exported `.xlsx` creator reads "InsMobile · RSUD dr. Achmad Darwis"; invariants 1–6 hold.

## Reconciliation Log

| Conflict | Phases | Resolution |
|---|---|---|
| single phase — nothing to reconcile | — | — |

## Decisions

| Fork | Chosen | Rung |
|---|---|---|
| Where "InsMobile" appears — Arif said "dashboard", but the header is shared chrome | Wordmark in `SiteHeader` (all 5 routes incl. `/admin`), metadata titles, landing eyebrow + footer, `.xlsx` creator — coherent branding, dashboard explicitly covered | 5: user's raw input, extended by convention (a brand lives in shared chrome, not one page) |
| Wordmark styling — `.signage` is the house display style but uppercases | `.wordmark` class (unlayered, declared after `.signage` in globals.css) — `normal-case` loses the cascade: Tailwind v4 utilities sit in `@layer utilities` and unlayered author CSS beats them regardless of order | 1: plan invariant 2, via the phase plan's cascade-verified code |
| Header image eager-load prop — Next 16 deprecates `priority` | `preload` (direct successor, same semantics) per bundled `image.md` | 1: project invariant (AGENTS.md — the bundled Next 16 docs win) |
| Kabupaten logo has a baked-in checkerboard (transparent PNG saved as JPEG) | Border-connected flood-fill keying via committed PIL script; global threshold and `mix-blend-mode` rejected (gray squares / eaten shield whites) | 3: plan's prescribed code approach |
| Replace `favicon.ico` or add alongside | Keep `favicon.ico`; add `src/app/icon.png` + `src/app/apple-icon.png` from the K3 mark (Next 16 file convention, confirmed in bundled docs) | 3: plan's code blocks |
| Are the untracked source JPEGs committed? | Copies committed under `brand/` (source of truth for the script); originals at root left untouched for the user to delete | 1: plan invariant 6 |
| Mentor's "beberapa pertanyaan yang direvisi" | Not actionable — content never shared; excluded from scope, flagged at termination for the user to relay | 5: user's raw input (absent detail) |

## Open Questions

(none)

## Rollback

Single phase: `git revert` of the phase commit restores the previous branding byte-for-byte; generated PNGs and the `brand/` copies are additive files, so removal is clean. The primary checkout's root files are never touched by implementation, so there is nothing to restore outside the branch.

## Next

Execute the phase:

    /implement -f INSMOBILE_BRANDING_PLAN.md --phase 1

Or run the whole set as a swarm — a session per phase, concurrent wherever `Depends on` allows, resumable on any machine:

    /analyze-orchestrator -f INSMOBILE_BRANDING_PLAN.md
