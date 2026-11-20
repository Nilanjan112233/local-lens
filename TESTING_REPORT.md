# LocalLens validation report

## Update: 2026-11-20 review and browser pass

Fixes from this review, each covered by a test where marked:

- Demo search diagnostics reported 8 raw/unique places even when the category filter returned fewer (tested).
- Non-numeric rating/review thresholds were accepted and silently matched nothing (now `400`, tested).
- Settings accepted empty or negative values. An empty Gemini limit was stored as `""`, which blocked every AI call. Values are now validated and clamped (tested).
- A disallowed CORS origin returned a `500` HTML page with a stack trace. It now returns a `403` JSON error (tested).
- Updating a missing delivery task returned `{}`. It now returns `404` (tested).
- Re-running website verification could move a contacted or won lead back to `qualified`. Verification now changes only leads that are still being qualified (tested).
- The saved-leads list showed the original search score instead of the score after verification and analysis (tested).
- Setting `LOCALLENS_API_TOKEN` broke the UI, because the browser never sent the token. The Vite dev proxy now adds it server-side (checked manually: direct call `401`, proxied call `200`, token absent from served JS).
- The UI gave up on long Gemini or Deep-scan requests after 30 s while the server kept working. Those calls now allow 150 s.
- Follow-up dates used UTC, so they could be off by one day in IST. They now use local dates.
- The demo dataset used realistic Indian mobile numbers. It now uses deliberately invalid `+91 00000 …` numbers (tested).
- UI: the AI strategy tab now shows whether the brief was grounded, plus the model's caveats. Other fixes: the truncated scan-depth select, the off-screen export button at phone width, duplicate recent-search chips, a "live" label shown on demo results, Escape to close the lead drawer, labels on icon-only buttons, `rel="noopener"` on external links, and the backup button now reports errors in the page instead of `alert()`.
- `npm audit fix` (lockfile only): 0 known vulnerabilities after the update.

Automated: `npm run typecheck` passed. `npm test`: 19 passed, 0 failed.

Browser pass (Chrome, 1440×900 and 390×844, demo dataset): Discover search, ranked list and map, lead drawer, a real Gemini strategy run, CRM tab, Escape-to-close, Pipeline, and the phone layout. Not exercised in the browser this time: PDF downloads, the proposal and delivery tabs, and Settings saves (Settings validation is covered by the API test).

---

Date: 2026-07-20

## Scope validated

This validation covers the expanded personal workflow: live discovery, caching, durable lead storage, independent website verification, Gemini analysis, commercial scoring, outreach drafting, proposal preparation, delivery tracking, provider budgets, backups/exports, and PDF generation. No website generator or automatic outreach sender is present.

## Live provider evidence

### Google Places

Query: All businesses, Kolkata, India; Standard depth; minimum 4.5 rating; minimum 50 reviews.

| Measurement             | First request |   Cached repeat |
| ----------------------- | ------------: | --------------: |
| Category requests       |             8 | 0 live requests |
| Raw results             |           160 |             160 |
| Unique Place IDs        |           160 |             160 |
| No-website candidates   |            65 |              65 |
| Qualified opportunities |            31 |              31 |
| Duration                | 2.270 seconds |   0.007 seconds |

Counts can change because Google results and business profiles change.

### Gemini and qualification workflow

- Provider: encrypted NovelForge provider store
- Model: `gemini-3.1-flash-lite`
- Website verification: completed conservatively as `manual_verification_required`, high confidence, with no unsupported owned-domain claim
- Business analysis: completed as `strong_opportunity`
- Structured competitor lessons: 3
- Google Maps sources attached to analysis: 2
- Commercial score after evidence: 80/100
- Manual-review outreach drafts: email, WhatsApp, phone, and follow-up generated
- No message was sent by LocalLens

### CRM, proposal, and delivery

- Lead, verification, analysis, activities, and CRM fields persisted in SQLite
- Growth proposal recorded at INR 30,000 as a draft
- Saving a proposal no longer implies it was sent
- External-delivery checklist created with 13 tasks
- Do-not-contact is enforced before outreach drafting
- Analytics uses recorded proposal values and makes no income guarantee

## PDF validation

- Private opportunity dossier: 3 A4 pages
- Client proposal: 2 A4 pages with an acceptance record
- Both files were rendered to page images with Poppler and visually inspected
- Headers, tables, typography, wrapping, margins, and page boundaries are clean
- Malformed source-name apostrophes were repaired
- The proposal explicitly states that LocalLens does not generate or deliver the website
- Final generated files are written under `output/pdf/`

## Automated gates

Final gates (the same sequence performed by `npm run check`):

- Strict TypeScript: passed
- Node tests: 10 passed, 0 failed
- Production Vite build: passed (1,624 modules transformed)
- Dependency audit: 0 vulnerabilities

## Known manual gate

The in-app browser control was unavailable in this execution session, so a screenshot-based responsive/click-through review could not be recorded. Functional behavior was exercised through live HTTP requests, compilation, provider calls, database persistence, PDF rendering, and server-side tests. A later manual browser pass should still check desktop and mobile navigation, drawer tabs, pipeline stage changes, Settings forms, and file downloads.
