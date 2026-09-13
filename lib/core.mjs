const STUDENT_PATTERNS = [
  /\bstudents?\s+only\b/i, /\bstudent\s+property\b/i, /\bstudent\s+house\b/i,
  /\bstudent\s+hmo\b/i, /\bstudent\s+accommodation\b/i, /\bpurpose[- ]built student accommodation\b/i, /\bpbsa\b/i,
  /\bacademic\s+year\b/i, /\bterm[- ]time\b/i, /\bseptember\s+to\s+(?:june|july|august)\b/i,
];
const STALE_PATTERNS = [/\blet agreed\b/i,/\bnow let\b/i,/\bproperty let\b/i,/\bunavailable\b/i,/\bno longer available\b/i,/\bremoved by agent\b/i];
const PRIORITY = { NG1:100, NG2:95, NG3:90, NG7:90, NG5:85, NG9:85 };

export function cleanText(value="") { return String(value).replace(/\s+/g," ").trim(); }
export function normalizeUrl(raw="") {
  try {
    const u=new URL(raw);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"].forEach(k=>u.searchParams.delete(k));
    u.hash="";
    return u.toString().replace(/\/$/,"");
  } catch { return raw; }
}
export function sourceName(url="") { try { return new URL(url).hostname.replace(/^www\./,""); } catch { return "unknown source"; } }
export function extractRent(text="") {
  const values=[];
  const patterns=[/£\s?([0-9]{3,4}(?:,[0-9]{3})?)\s*(?:pcm|per\s*month|p\/m|monthly)/gi,/(?:pcm|per\s*month)\s*[:\-]?\s*£\s?([0-9]{3,4}(?:,[0-9]{3})?)/gi];
  for (const p of patterns) { let m; while((m=p.exec(text))) values.push(Number(m[1].replace(/,/g,""))); }
  return values.length ? Math.min(...values) : null;
}
export function extractBedrooms(text="") { const m=text.match(/\b(\d+)\s*(?:bed(?:room)?s?|bed)\b/i) || text.match(/\b(\d+)[- ]bed\b/i); return m ? Number(m[1]) : null; }
export function extractFloorArea(text="") {
  let m=text.match(/\b([0-9]{3,4})\s*(?:sq\.?\s*ft|sqft|ft²|square\s*feet)\b/i); if(m) return Number(m[1]);
  m=text.match(/\b([0-9]{2,3}(?:\.\d+)?)\s*(?:m²|m2|sqm|sq\.?\s*m|square\s*met(?:re|er)s)\b/i); return m ? Math.round(Number(m[1])*10.7639) : null;
}
export function extractPostcode(text="") { const m=text.toUpperCase().match(/\b(NG\d{1,2})\s*([0-9][A-Z]{2})\b/); return m ? `${m[1]} ${m[2]}` : null; }
export function districtFrom(text="") { const full=extractPostcode(text); if(full) return full.split(" ")[0]; const m=text.toUpperCase().match(/\b(NG\d{1,2})\b/); return m ? m[1] : null; }
export function propertyType(text="") { if(/\bbungalow\b/i.test(text)) return "bungalow"; if(/\b(flat|apartment)\b/i.test(text)) return "flat"; if(/\bhouse|terrace|semi[- ]detached|detached\b/i.test(text)) return "house"; return "unknown"; }
export function classifyStudent(text="") { return STUDENT_PATTERNS.some(p=>p.test(text)); }
export function classifyStale(text="") { return STALE_PATTERNS.some(p=>p.test(text)); }
export function commuteApprox(postcodeDistrict) { const m={NG1:8,NG2:14,NG3:16,NG7:17,NG5:22,NG9:28}; return m[postcodeDistrict] ?? null; }
export function buildQuery(filters={}) {
  const p=[];
  if(filters.bedrooms) p.push(`"${filters.bedrooms} bedroom" OR "${filters.bedrooms} bed"`);
  p.push("to rent OR to let");
  if(filters.location) p.push(filters.location);
  if(filters.maxRent) p.push(`£${filters.maxRent} pcm`);
  if(filters.propertyType && filters.propertyType!=="any") p.push(filters.propertyType);
  if(filters.keywords) p.push(filters.keywords);
  if(filters.excludeStudents) p.push("-students -student -PBSA");
  return p.join(" ");
}
export function normalizeSearchResult(raw, filters={}) {
  const title=cleanText(raw.title);
  const snippet=cleanText(raw.snippet || raw.description || "");
  const text=`${title} ${snippet}`;
  const rentPcm=extractRent(text), bedrooms=extractBedrooms(text), floorAreaSqft=extractFloorArea(text), postcode=extractPostcode(text), postcodeDistrict=districtFrom(text);
  const pType=propertyType(text); const studentOnly=classifyStudent(text); const stale=classifyStale(text);
  if(stale) return null;
  if(filters.excludeStudents && studentOnly) return null;
  if(filters.bedrooms && bedrooms && bedrooms!==Number(filters.bedrooms)) return null;
  if(filters.maxRent && rentPcm && rentPcm>Number(filters.maxRent)) return null;
  if(filters.minSqft && floorAreaSqft && floorAreaSqft<Number(filters.minSqft)) return null;
  if(filters.propertyType && filters.propertyType!=="any" && pType!=="unknown" && pType!==filters.propertyType) return null;
  const mustChecks=[bedrooms===Number(filters.bedrooms), rentPcm!==null && (!filters.maxRent || rentPcm<=Number(filters.maxRent)), !filters.minSqft || (floorAreaSqft!==null && floorAreaSqft>=Number(filters.minSqft))];
  const verified=mustChecks.every(Boolean);
  const url=normalizeUrl(raw.url || raw.link || "");
  if (!url) return null;
  const score=(verified?70:35)+(PRIORITY[postcodeDistrict]??50)/10+(floorAreaSqft?5:0)+(rentPcm?5:0)+(raw.date?3:0);
  const discoveryProviders=[raw.discoveryProviderLabel || raw.discoveryProvider || "Connected source"].filter(Boolean);
  return {
    id: raw.id || Buffer.from(`${url}|${title}`).toString("base64url").slice(0,22), title, sourceUrl:url, source:sourceName(url), imageUrl:raw.image || null,
    rentPcm, bedrooms, floorAreaSqft, postcode, postcodeDistrict, location:postcode || filters.location || null, propertyType:pType,
    studentOnly, professionalSuitability: studentOnly ? "Student restricted" : "No student-only wording found", verified,
    availabilityStatus:"LIKELY_ACTIVE", freshnessLabel:"Seen in connected rental source", verificationMethod: raw.verificationMethod || "search_index", discoveredAt:new Date().toISOString(), lastCheckedAt:new Date().toISOString(),
    commuteApproxMinutes:commuteApprox(postcodeDistrict), score, snippet, discoveryProviders
  };
}

function propertyKey(item) {
  if (!item.postcode || !item.bedrooms || !item.rentPcm) return null;
  const titleKey=cleanText(item.title).toLowerCase().replace(/\W/g,"").slice(0,36);
  return [item.postcode,item.rentPcm,item.bedrooms,titleKey].join("|");
}
function mergeListing(existing, incoming) {
  const better=(incoming.score??0)>(existing.score??0) ? incoming : existing;
  const other=better===incoming ? existing : incoming;
  return {
    ...other,
    ...better,
    imageUrl: better.imageUrl || other.imageUrl,
    floorAreaSqft: better.floorAreaSqft || other.floorAreaSqft,
    postcode: better.postcode || other.postcode,
    postcodeDistrict: better.postcodeDistrict || other.postcodeDistrict,
    rentPcm: better.rentPcm || other.rentPcm,
    bedrooms: better.bedrooms || other.bedrooms,
    discoveryProviders:[...new Set([...(existing.discoveryProviders||[]),...(incoming.discoveryProviders||[])])],
  };
}
export function dedupeListings(items=[]) {
  const out=[]; const urlIndex=new Map(); const propertyIndex=new Map();
  for(const item of [...items].filter(Boolean).sort((a,b)=>(b.score??0)-(a.score??0))) {
    const urlKey=normalizeUrl(item.sourceUrl);
    const pKey=propertyKey(item);
    const existingIndex=urlIndex.has(urlKey) ? urlIndex.get(urlKey) : (pKey && propertyIndex.has(pKey) ? propertyIndex.get(pKey) : undefined);
    if(existingIndex!==undefined) {
      out[existingIndex]=mergeListing(out[existingIndex],item);
      urlIndex.set(urlKey,existingIndex);
      if(pKey) propertyIndex.set(pKey,existingIndex);
      continue;
    }
    const index=out.length; out.push(item); urlIndex.set(urlKey,index); if(pKey) propertyIndex.set(pKey,index);
  }
  return out;
}
export function validateFilters(input={}) {
  const location=cleanText(input.location||"Nottingham").slice(0,100); const bedrooms=Math.max(1,Math.min(8,Number(input.bedrooms)||2));
  const maxRent=Math.max(300,Math.min(10000,Number(input.maxRent)||1000)); const minSqft=Math.max(0,Math.min(5000,Number(input.minSqft)||0));
  const radius=Math.max(1,Math.min(50,Number(input.radius)||8)); const maxAgeDays=Math.max(1,Math.min(90,Number(input.maxAgeDays)||7));
  const propertyType=["any","flat","house","bungalow"].includes(input.propertyType)?input.propertyType:"any";
  const keywords=cleanText(input.keywords||"").slice(0,120); const excludeStudents=input.excludeStudents!==false;
  const priorityDistricts=Array.isArray(input.priorityDistricts)?input.priorityDistricts.filter(x=>/^NG\d{1,2}$/i.test(x)).slice(0,12):[];
  return {location,bedrooms,maxRent,minSqft,radius,maxAgeDays,propertyType,keywords,excludeStudents,priorityDistricts};
}
