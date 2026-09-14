# Rental Finder 26 — discovery engine v2

Rental Finder 26 is a Nottinghamshire rental discovery tracker built for people who want to find useful homes **directly from letting-agent websites**, including listings that can appear before or outside the most obvious portal searches.

The production target is Netlify. There is no Google CSE, Serper, Brave Search, Docker, or permanent backend server requirement.

## What v2 changes

The app now separates **discovery** from **search**:

1. Netlify refreshes configured rental sources on a schedule.
2. The source adapters read the rental index and, where appropriate, follow a limited number of same-site property-detail pages.
3. Listings are normalized, student-only / stale properties are rejected, and duplicates are merged.
4. The resulting inventory and listing history are saved in Netlify Blobs.
5. User searches run against that tracked inventory instead of re-requesting every letting-agent website on every click.

This lets the app identify when a listing is first seen, how often it has been seen, and whether it is newly discovered.

## Search preferences

The default search is intentionally a preference profile rather than a hard-coded two-bedroom rule:

- 1–2 bedrooms;
- flat/apartment preferred;
- studio can be selected;
- houses can be allowed as a fallback;
- maximum rent £1,000 pcm;
- preferred floor area 600 sq ft when the source provides it;
- student-only / academic-year accommodation excluded by default;
- preferred Nottingham areas can be selected and used for ranking.

Area matching is presented as **preference fit**, not as an objective claim that one neighbourhood is universally "good" or "bad".

## Independent Nottinghamshire source registry

`config/sources.mjs` contains one entry per letting organisation, rather than counting each branch of the same chain as a separate source.

The current registry includes independent/local organisations such as:

- FHP Living
- Robert Ellis
- Granger & Oaks
- City Lettings Nottingham
- Truelove Property Lettings
- Wellington Lettings
- CP Walker & Son
- Walton & Allen
- HoldenCopley
- Hammond Property Services
- Richard Watkinson & Partners
- Places2Nest
- Alasdair Morrison Lettings

A configured URL is **not** automatically described as working. After every refresh the app records a runtime state for each source:

- `working` — usable rental candidates were extracted;
- `empty` — the page loaded but no usable candidates were found;
- `blocked` — the source returned 403/429;
- `timeout` — the source did not answer within the limit;
- `error` — another connector failure occurred.

The UI exposes these source-health states so the displayed source count is based on what actually worked during the latest refresh.

## Responsible access

Rental Finder uses ordinary HTTP GET requests only. It does not bypass CAPTCHAs, anti-bot protections, authentication, or rate limits.

Only public/permitted sources should be enabled. Website terms and robots policies can change, so the source registry should be reviewed periodically. If a source begins returning 403/429 or no longer permits automated access, disable it rather than attempting to circumvent the restriction.

## Freshness and availability

A scheduled Netlify function runs every 15 minutes and queues a background refresh. The longer background job performs source discovery and saves a new inventory snapshot.

Rental Finder distinguishes between:

- first seen time;
- last seen / last checked time;
- source refresh time;
- obvious stale signals such as `Let Agreed`, `Let STC`, `Under Negotiation`, or `No longer available`.

A timeout, 403, 429, or anti-bot page is never interpreted as proof that a property was removed.

## Persistence

Production persistence uses **Netlify Blobs**, which is provisioned by Netlify and requires no database credentials. The app stores:

- `inventory/current` — the latest deduplicated rental inventory;
- `inventory/history` — first/last-seen timestamps and sighting counts.

Local development falls back to an in-memory store.

## Source adapters

For public JSON/RSS/Atom feeds the app reads the feed directly.

For permitted HTML sources it:

1. requests the configured rental-index page;
2. reads structured JSON-LD where available;
3. discovers likely property-detail links using a source-specific path pattern;
4. follows only a limited number of detail pages with bounded concurrency;
5. extracts structured data or useful page text;
6. reports per-source success/failure rather than failing the whole refresh when one source breaks.

The source pack is intentionally modular because estate-agent websites change independently.

## Optional environment sources

Extra public feeds can be configured without changing code:

```bash
PUBLIC_FEED_URLS="https://agent.example/properties.json,https://another.example/to-let.rss"
```

Extra approved HTML pages require an explicit hostname allowlist:

```bash
DIRECT_SOURCE_URLS="https://agent.example/properties/to-rent"
DIRECT_SOURCE_ALLOWED_HOSTS="agent.example"
```

Other optional variables:

```bash
ALLOW_DEMO_MODE=true
DEFAULT_REFRESH_SEARCH_JSON=
DISABLE_BUILTIN_SOURCES=false
```

No search-engine credentials or database secrets are required.

## Local development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

For a Netlify-native local environment with Functions/Blobs emulation, use the Netlify CLI after installing dependencies.

## Quality checks

```bash
npm test
npm run build
npm run check
```

The v2 tests cover normalization, weekly-to-monthly rent conversion, studio handling, student/stale exclusions, preference scoring, source-health reporting, detail-page extraction, deduplication, and first-seen history.

## Netlify functions

- `search` — searches the stored inventory and applies the user's preferences;
- `health` — reports inventory age and source health;
- `refresh` — scheduled every 15 minutes;
- `refresh-background` — performs the longer discovery refresh and persists the result.

## Important limitation

A source adapter is only considered reliable after it has been exercised against the live production website. The automated test suite uses controlled fixtures; real agent sites can change markup, JavaScript rendering, URLs, or access policy at any time. The source-health panel exists specifically so those failures are visible rather than hidden.
