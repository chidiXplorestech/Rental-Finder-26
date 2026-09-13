import { SOURCES } from "../../config/sources.mjs";

const MAX_SOURCES = 40;
const MAX_ITEMS_PER_SOURCE = 100;
const FETCH_TIMEOUT_MS = 12000;

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}|${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function envUrls(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function pageAllowed(url) {
  const allowed = new Set(envUrls("DIRECT_SOURCE_ALLOWED_HOSTS").map((x) => x.toLowerCase()));
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowed.has(host) || allowed.has(host.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

export function directSources() {
  const builtinsDisabled = String(process.env.DISABLE_BUILTIN_SOURCES || "").toLowerCase() === "true";
  const configured = !builtinsDisabled && Array.isArray(SOURCES)
    ? SOURCES.filter((s) => s && s.enabled !== false && ["feed", "page"].includes(s.type) && validHttpUrl(s.url))
    : [];

  const feeds = envUrls("PUBLIC_FEED_URLS").filter(validHttpUrl).map((url, i) => ({
    id: `env-feed-${i + 1}`,
    label: new URL(url).hostname.replace(/^www\./, ""),
    type: "feed",
    url,
    enabled: true,
  }));

  const pages = envUrls("DIRECT_SOURCE_URLS").filter(validHttpUrl).filter(pageAllowed).map((url, i) => ({
    id: `env-page-${i + 1}`,
    label: new URL(url).hostname.replace(/^www\./, ""),
    type: "page",
    url,
    enabled: true,
  }));

  return unique([...configured, ...feeds, ...pages]).slice(0, MAX_SOURCES);
}

function stripCdata(value = "") {
  return String(value)
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? stripCdata(m[1]) : "";
}

function atomLink(block) {
  const m = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return m?.[1] || tag(block, "link");
}

function resolveUrl(value, base) {
  if (!value) return null;
  try { return new URL(value, base).toString(); } catch { return null; }
}

function parseXml(text, source) {
  const entries = [...text.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return entries.slice(0, MAX_ITEMS_PER_SOURCE).map((m, i) => {
    const block = m[2];
    const enclosure = block.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i);
    const media = block.match(/<(?:media:content|media:thumbnail)\b[^>]*url=["']([^"']+)["']/i);
    return {
      id: `${source.id}-${i}`,
      title: tag(block, "title"),
      url: resolveUrl(atomLink(block), source.url),
      snippet: tag(block, "description") || tag(block, "summary") || tag(block, "content"),
      date: tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || null,
      image: resolveUrl(enclosure?.[1] || media?.[1], source.url),
      discoveryProviderLabel: source.label,
      verificationMethod: "direct_feed",
    };
  }).filter((x) => x.url && x.title);
}

function first(...values) {
  return values.find((v) => typeof v === "string" && v.trim()) || null;
}

function parseJson(data, source) {
  let rows = Array.isArray(data) ? data : data?.items || data?.results || data?.listings || data?.properties || data?.data || [];
  if (!Array.isArray(rows)) rows = [];
  return rows.slice(0, MAX_ITEMS_PER_SOURCE).map((x, i) => {
    const photos = Array.isArray(x?.photos) ? x.photos : [];
    const image = first(x?.image, x?.imageUrl, x?.image_url, x?.photo, typeof photos[0] === "string" ? photos[0] : photos[0]?.url);
    return {
      id: `${source.id}-${i}-${x?.id || ""}`,
      title: first(x?.title, x?.name, x?.address, x?.display_address) || "Rental listing",
      url: resolveUrl(first(x?.url, x?.link, x?.source_url, x?.listing_url), source.url),
      snippet: first(x?.description, x?.snippet, x?.summary, x?.details) || "",
      date: first(x?.date, x?.published_at, x?.updated_at, x?.created_at),
      image: resolveUrl(image, source.url),
      discoveryProviderLabel: source.label,
      verificationMethod: "direct_feed",
    };
  }).filter((x) => x.url);
}

function flattenLd(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((x) => flattenLd(x, out));
    return out;
  }
  if (!value || typeof value !== "object") return out;
  out.push(value);
  if (Array.isArray(value["@graph"])) value["@graph"].forEach((x) => flattenLd(x, out));
  if (Array.isArray(value.itemListElement)) value.itemListElement.forEach((x) => flattenLd(x?.item || x, out));
  return out;
}

function jsonLdBlocks(html) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];
  for (const block of blocks) {
    try { flattenLd(JSON.parse(block[1].trim()), nodes); } catch { /* ignore invalid page JSON-LD */ }
  }
  return nodes;
}

function addressText(address) {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode].filter(Boolean).join(", ");
}

function imageFromLd(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageFromLd(value[0]);
  if (value && typeof value === "object") return value.url || value.contentUrl || null;
  return null;
}

function candidateFromLd(node, source, index) {
  const type = Array.isArray(node["@type"]) ? node["@type"].join(" ") : String(node["@type"] || "");
  const looksProperty = /Apartment|House|Residence|Accommodation|Product|Offer|RealEstateListing|Place|SingleFamilyResidence|Room/i.test(type);
  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const url = resolveUrl(node.url || node["@id"] || offer?.url, source.url);
  if (!url || (!looksProperty && !offer)) return null;

  const title = first(node.name, node.headline, addressText(node.address)) || "Rental listing";
  const detail = [];
  if (node.description) detail.push(stripCdata(node.description));
  const price = offer?.price ?? node.price;
  const currency = offer?.priceCurrency || node.priceCurrency;
  if (price && (!currency || String(currency).toUpperCase() === "GBP")) detail.push(`£${price} pcm`);
  const beds = node.numberOfBedrooms ?? node.numberOfRooms;
  if (beds) detail.push(`${beds} bedrooms`);
  const floor = node.floorSize;
  if (floor?.value) detail.push(`${floor.value} ${floor.unitText || floor.unitCode || "sq ft"}`);
  const addr = addressText(node.address);
  if (addr) detail.push(addr);

  return {
    id: `${source.id}-ld-${index}`,
    title,
    url,
    snippet: detail.filter(Boolean).join(". "),
    date: node.dateModified || node.datePublished || null,
    image: resolveUrl(imageFromLd(node.image), source.url),
    discoveryProviderLabel: source.label,
    verificationMethod: "direct_page_structured_data",
  };
}

function anchorCandidates(html, source) {
  const out = [];
  const rx = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = rx.exec(html)) && out.length < 40) {
    const href = resolveUrl(m[1], source.url);
    const text = stripCdata(m[2]);
    if (!href || text.length < 18) continue;
    if (!/(property|properties|to-rent|to-let|rentals|lettings|listing)/i.test(href)) continue;
    out.push({
      id: `${source.id}-link-${out.length}`,
      title: text.slice(0, 180),
      url: href,
      snippet: text,
      date: null,
      image: null,
      discoveryProviderLabel: source.label,
      verificationMethod: "direct_page_index",
    });
  }
  return out;
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      Accept: source.type === "feed" ? "application/json, application/rss+xml, application/atom+xml, text/xml;q=0.9, */*;q=0.5" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      "User-Agent": "RentalFinder26/1.0",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${source.label} returned ${response.status}.`);
  const type = response.headers.get("content-type") || "";
  const text = await response.text();

  if (source.type === "feed") {
    if (type.includes("json") || /^[\s\r\n]*[\[{]/.test(text)) {
      try { return parseJson(JSON.parse(text), source); }
      catch { throw new Error(`${source.label} returned invalid JSON.`); }
    }
    return parseXml(text, source);
  }

  const structured = jsonLdBlocks(text).map((x, i) => candidateFromLd(x, source, i)).filter(Boolean);
  const links = anchorCandidates(text, source);
  return [...structured, ...links].slice(0, MAX_ITEMS_PER_SOURCE);
}

export function directSourceStatuses() {
  return directSources().map((source) => ({ id: source.id, label: source.label, type: source.type, url: source.url }));
}

export async function directSourceSearch() {
  const sources = directSources();
  if (!sources.length) {
    throw Object.assign(new Error("No rental sources are connected. Add permitted RSS/Atom/JSON feeds or approved rental pages in config/sources.mjs or Netlify environment variables."), { code: "SEARCH_NOT_CONFIGURED" });
  }

  const settled = await Promise.allSettled(sources.map(fetchSource));
  const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const errors = settled.map((result, i) => result.status === "rejected" ? `${sources[i].label}: ${result.reason?.message || "source failed"}` : null).filter(Boolean);
  if (!items.length && errors.length) throw new Error(errors.join("; "));
  return items;
}
