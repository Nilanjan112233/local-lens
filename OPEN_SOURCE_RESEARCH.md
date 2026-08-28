# Open-source foundation research

Research date: 2026-07-19

## Decision

Build LocalLens as a small provider-based application, reuse focused libraries, and keep Google Places API (New) as the supported live provider. Do not make an unofficial Google Maps scraper the core dependency.

## Projects evaluated

### gosom/google-maps-scraper

- Repository: https://github.com/gosom/google-maps-scraper
- License: MIT
- Useful parts: mature extraction engine, CLI, Web UI, REST API, CSV/JSON/PostgreSQL outputs, and broad place fields.
- Fit: strongest open-source scraper candidate if an operator deliberately chooses a scraping deployment.
- Concern: DOM/scraping maintenance, blocking/proxy operations, and Google Maps terms. It should be an optional adapter only after legal/terms review, not the default source.

### asiifdev/business-leads-ai-automation

- Repository: https://github.com/asiifdev/business-leads-ai-automation
- License: MIT (as stated by the repository)
- Useful parts: close product reference—Maps lead collection, AI content generation, campaign dashboard, export, and lead scoring.
- Fit: helpful UX/workflow reference.
- Concern: its marketing automation scope is broader than this product, and its scraper-first acquisition layer inherits the same operational risk.

### kaymen99/google-maps-lead-generator

- Repository: https://github.com/kaymen99/google-maps-lead-generator
- Useful parts: location-based discovery, contact enrichment, AI recommendations, and a dashboard-shaped workflow.
- Fit: product reference rather than a dependency.
- Concern: verify its license and maintenance posture before copying or vendoring any code.

### OpenStreetMap + Overpass API

- Project: https://www.openstreetmap.org / https://overpass-api.de
- Useful parts: open geospatial business data and `website` tags; excellent for an open provider and map visualization.
- Fit: a future discovery adapter and the current neutral demo basemap.
- Limitation: OSM intentionally does not provide subjective ratings/reviews, so it cannot independently satisfy the “good reviews” requirement. It needs a separate review source or a different qualification signal.

### Leaflet / React Leaflet

- Repositories: https://github.com/Leaflet/Leaflet and https://github.com/PaulLeCam/react-leaflet
- License: Leaflet is BSD-2-Clause; React Leaflet currently uses the Hippocratic License. Review the latter against your intended commercial use before production distribution.
- Useful parts: responsive interactive map UI.
- Fit: used in this MVP only for the fictional demo dataset. Live Google results are kept off the OpenStreetMap layer and use a Google-rendered area map plus source-listing links.

## Why a custom thin application is preferable

The differentiated part is not raw extraction. It is the auditable workflow:

`discover -> threshold -> detect missing listing website -> independently verify -> recommend -> qualify -> export`

A provider interface lets the same scoring and dashboard work with an approved Places API, an OSM-derived provider, imported CSV data, or a deliberately operated scraper later. It also keeps source-specific attribution and retention rules isolated.

## Next integrations

1. Add an independent web-search verifier that records candidate domains and evidence.
2. Add persistent storage and team accounts instead of browser-only lead status.
3. Add duplicate/chain detection so national brands do not dominate results.
4. Add configurable recommendation playbooks and an optional LLM adapter.
5. Use the correct provider-compatible map for live data and implement required attribution.
