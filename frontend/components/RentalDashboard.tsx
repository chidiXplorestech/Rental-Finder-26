"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE, fetchHealth, fetchListings, Listing, runWebDiscovery } from "../lib/api";

const DISTRICTS = ["NG1", "NG2", "NG3", "NG5", "NG7", "NG9"];

export default function RentalDashboard() {
  const [maxRent, setMaxRent] = useState(1000);
  const [minSqft, setMinSqft] = useState(600);
  const [maxCommute, setMaxCommute] = useState(0);
  const [districts, setDistricts] = useState<string[]>(DISTRICTS);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean | null>(null);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      max_rent: String(Math.min(maxRent, 1000)),
      min_sqft: String(Math.max(minSqft, 600)),
    });
    if (maxCommute > 0) params.set("max_commute", String(maxCommute));
    districts.forEach((district) => params.append("postcode", district));
    return params;
  }, [maxRent, minSqft, maxCommute, districts]);

  const runSearch = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchListings(query, signal);
      setListings(result.items);
      setLastRefresh(new Date());
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const searchInternetNow = async () => {
    setDiscovering(true);
    setDiscoveryMessage(null);
    setError(null);
    try {
      const result = await runWebDiscovery();
      setWebSearchEnabled(result.enabled);
      setDiscoveryMessage(
        result.enabled
          ? `${result.strict_candidates} strict candidates from ${result.documents} web results; ${result.created} new, ${result.updated} refreshed.`
          : result.message,
      );
      await runSearch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    fetchHealth()
      .then((health) => setWebSearchEnabled(health.web_search_enabled))
      .catch(() => setWebSearchEnabled(null));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => runSearch(controller.signal), 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query.toString()]);

  useEffect(() => {
    const events = new EventSource(`${API_BASE}/api/v1/events`);
    events.addEventListener("listing", () => runSearch());
    return () => events.close();
  }, [query.toString()]);

  const toggleDistrict = (district: string) => {
    setDistricts((current) =>
      current.includes(district) ? current.filter((item) => item !== district) : [...current, district],
    );
  };

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">NOTTINGHAMSHIRE · PROFESSIONAL LETS</p>
          <h1>Find the two-bed that is actually still available.</h1>
          <p className="subhead">
            Strictly ≤ £1,000 pcm, exactly 2 bedrooms, verified 600+ sq ft, no student-only lets, ranked around Nottingham city-centre access.
          </p>
        </div>
        <div className="heroActions">
          <div className={webSearchEnabled ? "liveBadge" : "liveBadge mutedBadge"}><span /> {webSearchEnabled ? "web search ready" : "search key needed"}</div>
          <button className="searchWebButton" type="button" onClick={searchInternetNow} disabled={discovering}>
            {discovering ? "Searching the web…" : "Search internet now"}
          </button>
        </div>
      </header>

      {discoveryMessage && <div className="notice">{discoveryMessage}</div>}

      <section className="filters" aria-label="Rental filters">
        <div className="filterBlock">
          <label>Max rent <strong>£{maxRent}</strong></label>
          <input type="range" min="700" max="1000" step="25" value={maxRent} onChange={(e) => setMaxRent(Number(e.target.value))} />
        </div>
        <div className="filterBlock">
          <label>Min floor area <strong>{minSqft} sq ft</strong></label>
          <input type="range" min="600" max="900" step="25" value={minSqft} onChange={(e) => setMinSqft(Number(e.target.value))} />
        </div>
        <div className="filterBlock">
          <label>Max measured commute <strong>{maxCommute === 0 ? "Any" : `${maxCommute} min`}</strong></label>
          <input type="range" min="0" max="60" step="5" value={maxCommute} onChange={(e) => setMaxCommute(Number(e.target.value))} />
        </div>
        <div className="districts">
          {DISTRICTS.map((district) => (
            <button
              key={district}
              className={districts.includes(district) ? "chip active" : "chip"}
              onClick={() => toggleDistrict(district)}
              type="button"
            >
              {district}
            </button>
          ))}
        </div>
      </section>

      <section className="resultsHeader">
        <div>
          <p className="eyebrow">MATCHES</p>
          <h2>{loading ? "Searching…" : `${listings.length} strict matches`}</h2>
        </div>
        <p className="freshness">
          {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting…"}
        </p>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        {listings.map((listing) => (
          <article className="card" key={listing.id}>
            <div className="cardTop">
              <span className="postcode">{listing.postcode_district}</span>
              <span className="status">ACTIVE</span>
            </div>
            <h3>{listing.title}</h3>
            <p className="location">{listing.postcode} · {listing.source}</p>
            <div className="metrics">
              <div><strong>£{listing.rent_pcm}</strong><span>pcm</span></div>
              <div><strong>{Math.round(listing.floor_area_sqft)}</strong><span>sq ft</span></div>
              <div><strong>{listing.commute_minutes ?? "—"}</strong><span>min to centre</span></div>
            </div>
            <div className="cardFooter">
              <span>Area: {listing.floor_area_source}</span>
              <span>{listing.verification_method === "direct_http" ? "directly checked" : "search-index seen"} {listing.freshness_minutes == null ? "" : `${listing.freshness_minutes}m ago`}</span>
            </div>
            <a className="viewButton" href={listing.source_url} target="_blank" rel="noreferrer">View source</a>
          </article>
        ))}
      </section>

      {!loading && !error && listings.length === 0 && (
        <section className="empty">
          <h3>No strict matches right now.</h3>
          <p>Search the internet now, or wait for the 10–15 minute worker cycle. Unknown-size and student-restricted listings remain excluded.</p>
        </section>
      )}
    </main>
  );
}
