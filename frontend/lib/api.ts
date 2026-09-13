export type Listing = {
  id: string;
  title: string;
  rent_pcm: number;
  source: string;
  source_url: string;
  postcode: string;
  postcode_district: string;
  bedrooms: number;
  floor_area_sqft: number;
  floor_area_source: string;
  commute_minutes: number | null;
  last_checked_at: string | null;
  freshness_minutes: number | null;
  verification_method: "direct_http" | "search_index" | string;
};

export type SearchResponse = { count: number; items: Listing[] };
export type HealthResponse = {
  status: string;
  web_search_enabled: boolean;
  direct_verify_domains: string[];
};
export type DiscoveryResponse = {
  enabled: boolean;
  message: string;
  queries: number;
  documents: number;
  strict_candidates: number;
  created: number;
  updated: number;
  archived_by_search: number;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchListings(params: URLSearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/api/v1/listings?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  return response.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  return response.json();
}

export async function runWebDiscovery(): Promise<DiscoveryResponse> {
  const response = await fetch(`${API_BASE}/api/v1/discovery/run`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Web discovery failed (${response.status})`);
  return response.json();
}
