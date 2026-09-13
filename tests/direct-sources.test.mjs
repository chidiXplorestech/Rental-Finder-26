import test from "node:test";
import assert from "node:assert/strict";
import { runSearch, providerInfo } from "../lib/search-service.mjs";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function restore() {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value;
}

test("source health reports public feed connections without API credentials", { concurrency: false }, () => {
  delete process.env.GOOGLE_CSE_API_KEY;
  delete process.env.GOOGLE_CSE_CX;
  process.env.DISABLE_BUILTIN_SOURCES = "true";
  process.env.PUBLIC_FEED_URLS = "https://feed.example/listings.json,https://other.example/to-let.rss";
  delete process.env.DIRECT_SOURCE_URLS;
  const info = providerInfo();
  assert.equal(info.connectedSourceCount, 2);
  assert.equal(info.configuredAny, true);
  assert.equal(info.label, "2 connected rental sources");
  restore();
});

test("direct JSON feeds are merged and deduplicated", { concurrency: false }, async () => {
  process.env.DISABLE_BUILTIN_SOURCES = "true";
  process.env.PUBLIC_FEED_URLS = "https://feed-one.example/listings.json,https://feed-two.example/listings.json";
  delete process.env.DIRECT_SOURCE_URLS;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  global.fetch = async (url) => {
    const u = String(url);
    if (u === "https://feed-one.example/listings.json") {
      return new Response(JSON.stringify({ listings: [
        { title: "2 bedroom flat to rent Nottingham NG7 1AA", url: "https://agent.example/property/123?utm_source=feed", description: "£950 pcm. 690 sqft. Professional let." }
      ] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (u === "https://feed-two.example/listings.json") {
      return new Response(JSON.stringify({ listings: [
        { title: "2 bedroom flat to rent Nottingham NG7 1AA", url: "https://agent.example/property/123", description: "£950 pcm. 690 sqft. Available now." },
        { title: "2 bedroom apartment Nottingham NG2 2AA", url: "https://another.example/property/55", description: "£995 pcm. 650 sqft. Professional tenants welcome." }
      ] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch: ${u}`);
  };

  try {
    const result = await runSearch({ location: "Nottingham", bedrooms: 2, maxRent: 1000, minSqft: 600, excludeStudents: true, priorityDistricts: ["NG7"] });
    assert.equal(result.items.length, 2);
    assert.equal(result.meta.connectedSourceCount, 2);
    const duplicate = result.items.find((x) => x.sourceUrl.includes("property/123"));
    assert.ok(duplicate);
    assert.deepEqual(new Set(duplicate.discoveryProviders), new Set(["feed-one.example", "feed-two.example"]));
  } finally { restore(); }
});

test("direct HTML source extracts JSON-LD rental data", { concurrency: false }, async () => {
  process.env.DISABLE_BUILTIN_SOURCES = "true";
  delete process.env.PUBLIC_FEED_URLS;
  process.env.DIRECT_SOURCE_URLS = "https://agent.example/to-rent";
  process.env.DIRECT_SOURCE_ALLOWED_HOSTS = "agent.example";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  global.fetch = async (url) => {
    assert.equal(String(url), "https://agent.example/to-rent");
    const html = `<!doctype html><script type="application/ld+json">${JSON.stringify({
      "@context":"https://schema.org",
      "@type":"Apartment",
      name:"2 bedroom apartment Nottingham NG1 2AA",
      url:"/property/abc",
      description:"Spacious professional apartment",
      numberOfBedrooms:2,
      floorSize:{value:650,unitText:"sq ft"},
      address:{postalCode:"NG1 2AA",addressLocality:"Nottingham"},
      offers:{price:975,priceCurrency:"GBP",url:"/property/abc"}
    })}</script>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  };

  try {
    const result = await runSearch({ location:"Nottingham", bedrooms:2, maxRent:1000, minSqft:600, excludeStudents:true });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].verified, true);
    assert.equal(result.items[0].rentPcm, 975);
    assert.equal(result.items[0].floorAreaSqft, 650);
    assert.equal(result.items[0].sourceUrl, "https://agent.example/property/abc");
  } finally { restore(); }
});

test("unapproved direct pages are not connected", { concurrency: false }, () => {
  process.env.DISABLE_BUILTIN_SOURCES = "true";
  delete process.env.PUBLIC_FEED_URLS;
  process.env.DIRECT_SOURCE_URLS = "https://agent.example/to-rent";
  process.env.DIRECT_SOURCE_ALLOWED_HOSTS = "different.example";
  const info = providerInfo();
  assert.equal(info.connectedSourceCount, 0);
  assert.equal(info.configuredAny, false);
  restore();
});
