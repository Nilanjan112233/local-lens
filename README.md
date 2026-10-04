# LocalLens

LocalLens is a private prospect-research and sales-workflow dashboard for finding well-reviewed local businesses whose Google listing does not show an owned website. It helps one operator verify the opportunity, analyze the business, prepare a responsible pitch, manage follow-ups, and track a separately delivered website project.

> LocalLens does not generate, host, or deliver websites. It also does not send email, WhatsApp messages, or calls. Website implementation and every client contact remain manual actions outside the application.

## What it includes

- Quick, Standard, and Deep Google Places discovery across useful business categories
- Location, category, rating, and minimum-review filters
- Place-ID deduplication, qualification reasons, rejection diagnostics, and search funnel metrics
- 24-hour search cache plus configurable daily Places and Gemini limits
- Independent website-presence verification with conservative verdicts
- Gemini 3.1 Flash-Lite research and structured opportunity analysis
- Competitor lessons, digital gaps, priority actions, recommended pages, features, and evidence limitations
- Commercial scoring based on reputation, demand, contactability, category value, verified website gap, and AI analysis
- Durable SQLite lead database, activity history, follow-up dates, notes, contact fields, do-not-contact control, and pipeline stages
- Manual-review outreach drafts for email, WhatsApp, phone, follow-up, discovery questions, objections, and claims to avoid
- Editable Starter, Growth, and Booking proposal options with configurable prices
- Client dossier and proposal PDF exports
- External-delivery checklist for work performed after a client agreement
- Today, Discover, Pipeline, Saved, Analytics, and Settings workspaces
- JSON export and timestamped SQLite backup

## Requirements

- Node.js 22.5 or newer; Node.js 24 is recommended for the built-in SQLite runtime
- Python 3.11 or newer with `reportlab` for PDF export
- Google Places API (New) key for live discovery
- Gemini key configured directly or through the existing encrypted NovelForge provider store

## Run locally

```powershell
npm install
python -m pip install reportlab
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:8787`.

Set `PDF_PYTHON` in `.env` if the Python installation containing ReportLab is not the default interpreter.

## Provider configuration

### Google Places

Enable Places API (New), put `GOOGLE_PLACES_API_KEY` in `.env`, restrict the key to the API, and set a Cloud quota. LocalLens keeps this key on the server.

- **Quick:** one query and one page; useful for a focused category check.
- **Standard:** up to eight category searches and one page each; the normal daily mode.
- **Deep:** twelve categories and up to two pages per category; broader but more expensive.

The same search is cached for the configured period. The Settings page controls the cache duration and local daily request ceilings. These local ceilings supplement, not replace, Google Cloud quotas.

### Gemini

Credentials resolve in this order:

1. `GEMINI_API_KEY` in this project.
2. The encrypted Gemini provider in NovelForge's local MongoDB, decrypted with NovelForge's existing settings key.

The default model is `gemini-3.1-flash-lite`. The plaintext NovelForge credential is never written into this repository or returned to the browser.

Analysis is evidence-aware: the first step researches the exact business with Google Maps grounding, and the second produces a strict structured assessment. When grounded evidence is weak, the UI preserves the limitation instead of presenting the absence of a source as proof.

## Safe operating model

A missing website field means **not listed on the source profile**, not definite proof that no website exists. Before outreach:

1. Open the Google Maps listing and confirm name, address, phone, and business status.
2. Run website verification and inspect candidate domains/social profiles.
3. Keep uncertain cases in `verification_required`.
4. Run AI analysis, then verify every factual claim and competitor reference.
5. Review and personalize an outreach draft; contact the business manually.
6. Save a proposal as `proposal_draft`. Move it to `proposal_sent` only after you actually deliver it.
7. Record deposits and agreements before starting implementation outside LocalLens.

The do-not-contact flag blocks outreach-draft generation. Proposal text avoids guarantees about ranking, traffic, leads, or revenue. Analytics reports recorded pipeline values, not promised income.

## Data and backups

Operational data is stored in `data/locallens.db`. On first use, the frontend offers a one-time migration of legacy locally saved leads into SQLite. The Settings page can:

- Export all LocalLens data as JSON.
- Create a timestamped database backup under `data/backups/`.
- Configure local API limits, cache time, currency, proposal prices, and default follow-up interval.

The SQLite files, `data/backups/`, and generated `output/pdf/` contents are intentionally excluded from source control.

## Commands

```powershell
npm run dev       # API and Vite development servers
npm run typecheck # Strict TypeScript validation
npm run test      # Qualification and workflow tests
npm run build     # Production frontend build
npm run check     # Typecheck, tests, and production build
npm start         # API only
```

See [PERSONAL_WORKFLOW_GUIDE.md](./PERSONAL_WORKFLOW_GUIDE.md) for the daily operating process, [TESTING_REPORT.md](./TESTING_REPORT.md) for verified evidence, and [OPEN_SOURCE_RESEARCH.md](./OPEN_SOURCE_RESEARCH.md) for the reusable-project research.

## Local access controls

The API listens on `127.0.0.1` by default. Keep that default for a personal workspace.

- Set `HOST` only when you deliberately need another network interface.
- Set `LOCALLENS_ALLOWED_ORIGINS` to a comma-separated list when the frontend uses a non-default origin.
- Set `LOCALLENS_API_TOKEN` to require an `X-LocalLens-Token` header for every API route except the health check.

The workspace also keeps the six most recent searches so useful location/category combinations can be loaded again. Saved and discovered businesses can be filtered by name, category, address, or status and sorted by score, rating, review count, or follow-up date.
