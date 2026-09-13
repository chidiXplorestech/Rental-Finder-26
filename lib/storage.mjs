export function storageConfigured(){ return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
function headers(extra={}) { return {apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json",...extra}; }
export async function saveListings(items=[]) {
  if(!storageConfigured()||!items.length) return {enabled:false,saved:0};
  const rows=items.map(x=>({fingerprint:x.id,source_url:x.sourceUrl,source:x.source,title:x.title,rent_pcm:x.rentPcm,bedrooms:x.bedrooms,floor_area_sqft:x.floorAreaSqft,postcode:x.postcode,postcode_district:x.postcodeDistrict,property_type:x.propertyType,availability_status:x.availabilityStatus,verified_match:x.verified,score:x.score,last_checked_at:x.lastCheckedAt,discovered_at:x.discoveredAt,payload:x}));
  const url=`${process.env.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/listings?on_conflict=fingerprint`;
  const res=await fetch(url,{method:"POST",headers:headers({Prefer:"resolution=merge-duplicates,return=minimal"}),body:JSON.stringify(rows),signal:AbortSignal.timeout(10000)});
  if(!res.ok) throw new Error(`Persistence returned ${res.status}.`); return {enabled:true,saved:rows.length};
}
