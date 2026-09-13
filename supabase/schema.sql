create table if not exists public.listings (
  fingerprint text primary key,
  source_url text not null,
  source text,
  title text,
  rent_pcm integer,
  bedrooms integer,
  floor_area_sqft integer,
  postcode text,
  postcode_district text,
  property_type text,
  availability_status text,
  verified_match boolean not null default false,
  score numeric,
  discovered_at timestamptz,
  last_checked_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists listings_postcode_idx on public.listings(postcode_district);
create index if not exists listings_checked_idx on public.listings(last_checked_at desc);
