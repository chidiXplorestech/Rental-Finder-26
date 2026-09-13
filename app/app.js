const DISTRICTS = ["NG1", "NG2", "NG3", "NG5", "NG7", "NG9"];
const state = { listings: [], tab: "verified", selectedDistricts: new Set(DISTRICTS), provider: null };
const $ = (id) => document.getElementById(id);

function renderDistrictChips() {
  $("districtChips").innerHTML = DISTRICTS.map(d => `<button class="chip ${state.selectedDistricts.has(d) ? "active" : ""}" type="button" data-district="${d}">${d}</button>`).join("");
}
function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }
function formatDate(value) {
  if (!value) return "Not checked";
  const d = new Date(value);
  return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }).format(d);
}
function sanitize(value="") { return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function readForm() {
  return {
    location: $("location").value.trim() || "Nottingham",
    bedrooms: Number($("bedrooms").value),
    maxRent: Number($("maxRent").value),
    minSqft: Number($("minSqft").value),
    radius: Number($("radius").value),
    propertyType: $("propertyType").value,
    maxAgeDays: Number($("maxAgeDays").value),
    excludeStudents: $("excludeStudents").checked,
    keywords: $("keywords").value.trim(),
    priorityDistricts: [...state.selectedDistricts],
    sort: $("sortSelect").value,
  };
}
function setLoading(loading) {
  $("loadingState").hidden = !loading;
  if (loading) $("partialNotice").hidden = true;
  $("searchButton").disabled = loading;
  $("searchButton").querySelector("span").textContent = loading ? "Refreshing sources…" : "Refresh rental sources";
  if (loading) { $("emptyState").hidden = true; $("resultsGrid").innerHTML = ""; $("errorState").hidden = true; }
}
function setError(title, message) {
  $("errorTitle").textContent = title;
  $("errorText").textContent = message;
  $("errorState").hidden = false;
}
function metric(value, label) { return `<div class="metric"><strong>${sanitize(value ?? "—")}</strong><span>${sanitize(label)}</span></div>`; }
function card(listing) {
  const img = listing.imageUrl ? `<img src="${sanitize(listing.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\"placeholder-house\",textContent:\"⌂\"}))"/>` : `<div class="placeholder-house">⌂</div>`;
  const statusLabel = listing.availabilityStatus?.replaceAll("_", " ") || "UNKNOWN";
  const link = listing.demo ? `<a class="card-link disabled" href="#" aria-disabled="true"><span>Demo listing</span><span>↗</span></a>` : `<a class="card-link" href="${sanitize(listing.sourceUrl)}" target="_blank" rel="noopener noreferrer"><span>Open original listing</span><span>↗</span></a>`;
  return `<article class="card">
    <div class="card-image">${img}<div class="image-badges"><span class="badge status">${sanitize(statusLabel)}</span>${listing.demo ? '<span class="badge demo">DEMO DATA</span>' : `<span class="badge">${listing.verified ? "VERIFIED MATCH" : "CHECK DETAILS"}</span>`}</div></div>
    <div class="card-body">
      <div class="card-price"><strong>${listing.rentPcm ? `£${Number(listing.rentPcm).toLocaleString("en-GB")}` : "Price unclear"}</strong><small>${listing.rentPcm ? "pcm" : "verify"}</small></div>
      <h3>${sanitize(listing.title || "Rental listing")}</h3>
      <p class="card-location">${sanitize(listing.location || listing.postcode || "Location needs verification")}</p>
      <div class="metrics">
        ${metric(listing.bedrooms ? `${listing.bedrooms} bed` : "—", "Bedrooms")}
        ${metric(listing.floorAreaSqft ? `${Math.round(listing.floorAreaSqft)} ft²` : "Unknown", "Floor area")}
        ${metric(listing.commuteApproxMinutes ? `~${listing.commuteApproxMinutes} min` : listing.postcodeDistrict || "—", listing.commuteApproxMinutes ? "City centre approx." : "Postcode")}
      </div>
      <div class="verification">
        <div class="verify-row"><span>Suitability</span><strong>${sanitize(listing.professionalSuitability || "Unclear")}</strong></div>
        <div class="verify-row"><span>Freshness</span><strong>${sanitize(listing.freshnessLabel || "Search-index sighting")}</strong></div>
        <div class="verify-row"><span>Last checked</span><strong>${sanitize(formatDate(listing.lastCheckedAt))}</strong></div>
      </div>
      <div class="source-line"><span>Listing source</span><b title="${sanitize(listing.source)}">${sanitize(listing.source)}</b></div>
      ${Array.isArray(listing.discoveryProviders) && listing.discoveryProviders.length ? `<div class="source-line"><span>Discovered via</span><b title="${sanitize(listing.discoveryProviders.join(", "))}">${sanitize(listing.discoveryProviders.join(" + "))}</b></div>` : ""}
      ${link}
    </div>
  </article>`;
}
function filteredListings() {
  let items = [...state.listings];
  if (state.tab === "verified") items = items.filter(x => x.verified);
  if (state.tab === "needs") items = items.filter(x => !x.verified);
  const sort = $("sortSelect").value;
  if (sort === "priceAsc") items.sort((a,b) => (a.rentPcm ?? 1e9) - (b.rentPcm ?? 1e9));
  else if (sort === "sizeDesc") items.sort((a,b) => (b.floorAreaSqft ?? 0) - (a.floorAreaSqft ?? 0));
  else if (sort === "newest") items.sort((a,b) => new Date(b.lastCheckedAt || 0) - new Date(a.lastCheckedAt || 0));
  else items.sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
  return items;
}
function renderResults(meta={}) {
  const verified = state.listings.filter(x => x.verified).length;
  const needs = state.listings.length - verified;
  $("verifiedCount").textContent = verified; $("needsCount").textContent = needs; $("allCount").textContent = state.listings.length;
  $("resultCount").textContent = plural(state.listings.length, "property");
  $("resultsTitle").textContent = state.listings.length ? "Fresh rental leads" : "No matching leads";
  $("lastUpdated").textContent = state.listings.length ? `Updated ${formatDate(new Date().toISOString())}. Verify details on the original listing before applying.` : "Try widening the filters or changing location.";
  $("searchMeta").textContent = meta.provider ? `${meta.connectedSourceCount ? `${meta.connectedSourceCount} connected source${meta.connectedSourceCount === 1 ? "" : "s"} · ` : ""}${plural(meta.rawResults ?? state.listings.length, "raw result")} scanned · merged & deduplicated` : "";
  if (meta.partial && Array.isArray(meta.providerErrors) && meta.providerErrors.length) {
    $("partialText").textContent = `Results were returned, but ${meta.providerErrors.map(x => x.label || x.provider).join(", ")} could not complete. Other sources were still used.`;
    $("partialNotice").hidden = false;
  } else {
    $("partialNotice").hidden = true;
  }
  const items = filteredListings();
  $("resultsGrid").innerHTML = items.map(card).join("");
  $("emptyState").hidden = state.listings.length > 0;
  if (!state.listings.length) { $("emptyState").querySelector("h3").textContent = "No strong matches found."; $("emptyState").querySelector("p").textContent = "Try widening the radius, increasing the budget, or searching a broader location."; }
}
async function health() {
  try {
    const res = await fetch("/.netlify/functions/health", { cache:"no-store" });
    const data = await res.json(); state.provider = data;
    const live = data.sourcesConfigured;
    const count = Number(data.connectedSourceCount || 0);
    $("providerBadge").textContent = live ? `${count} rental source${count === 1 ? "" : "s"} connected` : "No sources connected";
    $("providerBadge").classList.toggle("live", live);
    $("configNotice").hidden = live;
    $("demoButton").hidden = !data.demoAllowed;
  } catch {
    $("providerBadge").textContent = "Local preview";
    $("configNotice").hidden = false;
    $("demoButton").hidden = false;
  }
}
async function search({ demo=false }={}) {
  setLoading(true);
  const payload = { ...readForm(), demo };
  try {
    const res = await fetch("/.netlify/functions/search", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.code === "SEARCH_NOT_CONFIGURED") { $("configNotice").hidden = false; $("demoButton").hidden = false; }
      throw new Error(data.message || `Search failed (${res.status})`);
    }
    state.listings = data.items || [];
    state.tab = state.listings.some(x => x.verified) ? "verified" : "all";
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === state.tab));
    renderResults(data.meta || {});
  } catch (err) {
    $("partialNotice").hidden = true;
    state.listings = [];
    renderResults();
    setError("Search could not complete", err.message || "Please try again.");
  } finally { setLoading(false); }
}
function reset() {
  $("location").value="Nottingham"; $("bedrooms").value="2"; $("maxRent").value="1000"; $("minSqft").value="600"; $("radius").value="8";
  $("propertyType").value="any"; $("maxAgeDays").value="7"; $("excludeStudents").checked=true; $("keywords").value=""; $("sortSelect").value="best";
  state.selectedDistricts = new Set(DISTRICTS); renderDistrictChips();
}

$("searchForm").addEventListener("submit", e => { e.preventDefault(); search(); });
$("demoButton").addEventListener("click", () => search({demo:true}));
$("resetButton").addEventListener("click", reset);
$("districtChips").addEventListener("click", e => { const d=e.target.dataset.district; if(!d) return; state.selectedDistricts.has(d) ? state.selectedDistricts.delete(d) : state.selectedDistricts.add(d); renderDistrictChips(); });
$("sortSelect").addEventListener("change", () => renderResults());
document.querySelector(".tabs").addEventListener("click", e => { const tab=e.target.closest(".tab"); if(!tab) return; state.tab=tab.dataset.tab; document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab)); renderResults(); });
renderDistrictChips(); health();
