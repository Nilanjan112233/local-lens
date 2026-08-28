# LocalLens validation report

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
