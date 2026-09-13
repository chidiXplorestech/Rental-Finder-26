# Rental Finder 26 — direct-source rebuild

This is the Netlify-first direct-source rebuild of Rental Finder 26. The production Netlify site should only be updated after the branch/preview has been reviewed.

## What changed

The application no longer depends on Google CSE, Serper, Brave Search or any other search-engine API.

The default architecture is now **direct-source rental discovery**:

- public/permitted JSON property feeds;
- public/permitted RSS or Atom property feeds;
- approved letting-agent rental pages with structured data;
- a scheduled Netlify refresh every 15 minutes;
- normalization, filtering and deduplication after ingestion;
- optional database persistence;
- demo data remains clearly labelled and is never presented as live.

No search API key is required.

## Connect rental sources

There are two supported ways to connect a source.

### 1. Source registry

Edit `config/sources.mjs` and add sources you are permitted to poll:

```js
export const SOURCES = [
  {
    id: "my-agent-feed",
    label: "My Agent",
    type: "feed",
    url: "https://agent.example/to-let.rss",
    enabled: true,
  },
  {
    id: "another-agent-page",
    label: "Another Agent",
    type: "page",
    url: "https://another-agent.example/properties/to-rent",
    enabled: true,
  },
];
```

Supported `type` values are `feed` and `page`.

### 2. Netlify environment variables

For public feeds:

```bash
PUBLIC_FEED_URLS="https://agent.example/properties.json,https://another.example/to-let.rss"
```

For approved HTML rental pages:

```bash
DIRECT_SOURCE_URLS="https://agent.example/properties/to-rent"
DIRECT_SOURCE_ALLOWED_HOSTS="agent.example"
```

The allowlist is intentional: the deployed app should not become an arbitrary server-side URL fetcher.

Only connect websites or feeds where automated access is permitted.

## How the source adapter works

For feeds, Rental Finder accepts common JSON collections plus RSS/Atom.

For approved HTML pages, the adapter looks for structured JSON-LD property information first. It can also collect likely property links from a rental index page, but it does not bypass anti-bot controls and does not treat 403/429/timeouts as evidence that a property was removed.

Listings are normalized into price, bedrooms, floor area, postcode, property type, student restrictions, freshness and source provenance where the source actually provides those fields.

## Local preview

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

If no rental sources are connected yet, the app still loads normally and offers the clearly labelled demo dataset. It does not display a Google-key or CSE warning.

## Scheduled refresh

`netlify.toml` schedules `refresh` every 15 minutes. That function queues the background refresh, which re-runs the configured Nottingham search profile against the connected sources.

## Optional persistence

The app works without a database. For Supabase/Postgres persistence, create the table from `supabase/schema.sql` and configure:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role key stays server-side.

## Quality checks

```bash
npm test
npm run build
npm run check
```

## Deployment workflow

This rebuild is intended to be committed to a review branch first. Use a Netlify branch/preview deployment for validation, then merge to the production branch only after review.

## Nottinghamshire source pack

The rebuild now ships with a broad Nottinghamshire direct-source pack enabled in `config/sources.mjs`. It currently includes public rental/lettings pages from:

- FHP Living
- Robert Ellis
- Rex Gooding
- CP Walker & Son
- Walton & Allen
- HoldenCopley
- Hammond Property Services
- Richard Watkinson & Partners
- Martin & Co (Nottingham City, Hucknall and Mansfield)
- Whitegates (Nottingham Sherwood, Beeston, Newark and Mansfield)
- Belvoir (Nottingham Central, Nottingham West, West Bridgford and Mansfield)
- Leaders Nottinghamshire
- William H Brown Nottinghamshire
- Frank Innes Nottingham
- haart Nottingham

The registry uses the agents' own public rental/branch pages, not Rightmove or Zoopla scraping. A configured source can still fail at runtime if the owner changes its site, blocks automated requests, changes robots/terms, or moves its listing page. Rental Finder treats those conditions as source failures and continues with the remaining sources.

For responsible polling, keep the app's 15-minute scheduled run as the orchestration interval but avoid bypassing rate limits or anti-bot measures. If a source repeatedly returns `403`/`429`, disable that source rather than attempting to circumvent the restriction.
