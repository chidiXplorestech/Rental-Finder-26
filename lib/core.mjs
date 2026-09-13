const STUDENT_PATTERNS = [
  /\bstudents?\s+only\b/i, /\bstudent\s+property\b/i, /\bstudent\s+house\b/i,
  /\bstudent\s+hmo\b/i, /\bstudent\s+accommodation\b/i, /\bpurpose[- ]built student accommodation\b/i, /\bpbsa\b/i,
  /\bacademic\s+year\b/i, /\bterm[- ]time\b/i, /\bseptember\s+to\s+(?:june|july|august)\b/i,
];
const STALE_PATTERNS = [
  /\blet agreed\b/i, /\blet stc\b/i, /\bnow let\b/i, /\bproperty let\b/i, /\bunavailable\b/i,
  /\bno longer available\b/i, /\bremoved by agent\b/i, /\bunder negotiation\b/i,
];
const ACTIVE_PATTERNS = [/\bavailable now\b/i, /\bavailable immediately\b/i, /\bto let\b/i, /\bto rent\b/i, /\bavailable from\b/i];
const UNFURNISHED_PATTERNS = [/\bunfurnished\b/i, /\bnot furnished\b/i, /\bwithout furniture\b/i];
const PART_FURNISHED_PATTERNS = [/\bpart[-\s]?furnished\b/i, /\bpartially furnished\b/i, /\bpart furnished\b/i];
const FURNISHED_PATTERNS = [/\bfully furnished\b/i, /\bfurnished\b/i, /\bfurniture included\b/i, /\bfurnished property\b/i];
const PRIORITY = { NG1:100, NG2:95, NG3:88, NG5:90, NG7:92, NG9:94, NG8:86, NG4:84 };

export const DEFAULT_PREFERRED_AREAS = [
  "West Bridgford", "Beeston", "Wollaton", "Sherwood", "Carrington", "Mapperley",
  "Mapperley Park", "The Park", "Lady Bay", "Lace Market", "City Centre", "Bramcote",
  "Ruddington", "NG1", "NG2", "NG5", "NG7", "NG9"
];

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
  const monthPatterns=[
    /£\s?([0-9]{2,4}(?:,[0-9]{3})?)\s*(?:pcm|per\s*month|p\/m|monthly|per\s+calendar\s+month)/gi,
    /(?:pcm|per\s*month|per\s+calendar\s+month)\s*[:\-]?\s*£\s?([0-9]{2,4}(?:,[0-9]{3})?)/gi,
    /(?:price\s+monthly|monthly\s+rent)\s*[:\-]?\s*£?\s?([0-9]{2,4}(?:,[0-9]{3})?)/gi,
  ];
  const weekPatterns=[/£\s?([0-9]{2,4})\s*(?:pw|pppw|per\s*week)/gi];
  for (const p of monthPatterns) { let m; while((m=p.exec(text))) values.push(Number(m[1].replace(/,/g,""))); }
  for (const p of weekPatterns) { let m; while((m=p.exec(text))) values.push(Math.round(Number(m[1])*52/12)); }
  const clean=values.filter(x=>Number.isFinite(x) && x>0);
  return clean.length ? Math.min(...clean) : null;
}
export function extractBedrooms(text="") {
  if (/\bstudio\b/i.test(text)) return 0;
  const m=text.match(/\b(\d+)\s*(?:bed(?:room)?s?|bed)\b/i) || text.match(/\b(\d+)[- ]bed\b/i);
  return m ? Number(m[1]) : null;
}
export function extractFloorArea(text="") {
  let m=text.match(/\b([0-9]{3,4})\s*(?:sq\.?\s*ft|sqft|ft²|square\s*feet)\b/i); if(m) return Number(m[1]);
  m=text.match(/\b([0-9]{2,3}(?:\.\d+)?)\s*(?:m²|m2|sqm|sq\.?\s*m|square\s*met(?:re|er)s)\b/i);
  return m ? Math.round(Number(m[1])*10.7639) : null;
}
export function extractPostcode(text="") { const m=text.toUpperCase().match(/\b(NG\d{1,2})\s*([0-9][A-Z]{2})\b/); return m ? `${m[1]} ${m[2]}` : null; }
export function districtFrom(text="") { const full=extractPostcode(text); if(full) return full.split(" ")[0]; const m=text.toUpperCase().match(/\b(NG\d{1,2})\b/); return m ? m[1] : null; }
export function propertyType(text="") {
  if(/\bstudio\b/i.test(text)) return "studio";
  if(/\bbungalow\b/i.test(text)) return "bungalow";
  if(/\b(flat|apartment|maisonette|penthouse)\b/i.test(text)) return "flat";
  if(/\bhouse|terrace|semi[- ]detached|detached|townhouse\b/i.test(text)) return "house";
  if(/\broom to rent\b|\bbedroom to rent\b/i.test(text)) return "room";
  return "unknown";
}
export function furnishingStatus(text="") {
  if (UNFURNISHED_PATTERNS.some(p=>p.test(text))) return "unfurnished";
  if (PART_FURNISHED_PATTERNS.some(p=>p.test(text))) return "part_furnished";
  if (FURNISHED_PATTERNS.some(p=>p.test(text))) return "furnished";
  return "unknown";
}
export function classifyStudent(text="") { return STUDENT_PATTERNS.some(p=>p.test(text)); }
export function classifyStale(text="") { return STALE_PATTERNS.some(p=>p.test(text)); }
export function classifyActive(text="") { return ACTIVE_PATTERNS.some(p=>p.test(text)); }
export function commuteApprox(postcodeDistrict) { const m={NG1:8,NG2:14,NG3:16,NG7:17,NG5:22,NG9:28,NG8:23,NG4:20}; return m[postcodeDistrict] ?? null; }

export function buildQuery(filters={}) {
  const p=[];
  const min=filters.minBedrooms ?? filters.bedrooms;
  const max=filters.maxBedrooms ?? filters.bedrooms;
  if(min!=null && max!=null) p.push(min===max ? `"${min} bedroom" OR "${min} bed"` : `${min}-${max} bedrooms`);
  p.push("to rent OR to let");
  if(filters.location) p.push(filters.location);
  if(filters.maxRent) p.push(`£${filters.maxRent} pcm`);
  if(filters.preferredType && filters.preferredType!=="any") p.push(filters.preferredType);
  if(filters.furnishing && filters.furnishing!=="any") p.push(filters.furnishing==="part_furnished" ? "part furnished" : filters.furnishing);
  if(filters.keywords) p.push(filters.keywords);
  if(filters.excludeStudents) p.push("-students -student -PBSA");
  return p.join(" ");
}

function parseDate(value) { if (!value) return null; const d=new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
function areaText(item) { return cleanText(`${item.title||""} ${item.location||""} ${item.postcode||""} ${item.snippet||""}`); }
function locationMatches(item, location="") {
  const wanted=cleanText(location).toLowerCase();
  if (!wanted || wanted==="nottingham" || wanted==="nottinghamshire") return true;
  const text=areaText(item).toLowerCase();
  const compactWanted=wanted.replace(/\s+/g,"");
  const compactText=text.replace(/\s+/g,"");
  if (/^ng\d{1,2}(?:\d[a-z]{2})?$/i.test(compactWanted)) return compactText.includes(compactWanted);
  return text.includes(wanted);
}
function areaFit(item, preferredAreas=DEFAULT_PREFERRED_AREAS) {
  const text=areaText(item).toLowerCase();
  const matched=(preferredAreas||[]).filter(x=>text.includes(String(x).toLowerCase()));
  const districtBoost=PRIORITY[item.postcodeDistrict] ?? 50;
  return { score: Math.min(25, matched.length*7 + districtBoost/10), matched };
}

export function normalizeSearchResult(raw, filters={}) {
  const title=cleanText(raw.title);
  const snippet=cleanText(raw.snippet || raw.description || raw.pageText || "");
  const text=`${title} ${snippet}`;
  const rentPcm=raw.rentPcm ?? extractRent(text);
  const bedrooms=raw.bedrooms ?? extractBedrooms(text);
  const floorAreaSqft=raw.floorAreaSqft ?? extractFloorArea(text);
  const postcode=raw.postcode ?? extractPostcode(text);
  const postcodeDistrict=raw.postcodeDistrict ?? districtFrom(text);
  const pType=raw.propertyType ?? propertyType(text);
  const furnishing=raw.furnishing ?? raw.furnishingStatus ?? furnishingStatus(text);
  const studentOnly=raw.studentOnly ?? classifyStudent(text);
  const stale=raw.stale ?? classifyStale(text);
  if(stale) return null;
  if(filters.excludeStudents !== false && studentOnly) return null;
  const url=normalizeUrl(raw.url || raw.link || raw.sourceUrl || "");
  if (!url) return null;
  const directDetail=String(raw.verificationMethod||"").includes("detail");
  const activeSignal=raw.activeSignal ?? classifyActive(text);
  const availabilityStatus=activeSignal && directDetail ? "ACTIVE" : "LIKELY_ACTIVE";
  const checkedAt=raw.lastCheckedAt || new Date().toISOString();
  const location=cleanText(raw.location || raw.area || postcode || "") || null;
  const discoveryProviders=[raw.discoveryProviderLabel || raw.discoveryProvider || "Connected source"].filter(Boolean);
  return {
    id: raw.id || Buffer.from(`${url}|${title}`).toString("base64url").slice(0,22), title, sourceUrl:url, source:sourceName(url), imageUrl:raw.image || raw.imageUrl || null,
    rentPcm, bedrooms, floorAreaSqft, postcode, postcodeDistrict, location, propertyType:pType, furnishing,
    studentOnly, professionalSuitability:studentOnly ? "Student restricted" : "No student-only wording found",
    verified:rentPcm!==null && bedrooms!==null, availabilityStatus,
    freshnessLabel:directDetail ? "Property page checked" : "Seen on source listing page",
    verificationMethod:raw.verificationMethod || "direct_source",
    discoveredAt:raw.discoveredAt || raw.date || checkedAt, lastCheckedAt:checkedAt,
    commuteApproxMinutes:commuteApprox(postcodeDistrict), score:0, snippet, discoveryProviders,
    firstSeenAt:raw.firstSeenAt || null, isNew:Boolean(raw.isNew), timesSeen:raw.timesSeen||0,
  };
}

export function validateFilters(input={}) {
  const location=cleanText(input.location||"Nottingham").slice(0,100);
  const legacyRaw=input.bedrooms;
  const legacyBeds=legacyRaw===undefined || legacyRaw===null || legacyRaw==="" ? null : Number(legacyRaw);
  let minBedrooms=Number.isFinite(Number(input.minBedrooms)) ? Number(input.minBedrooms) : (Number.isFinite(legacyBeds)?legacyBeds:1);
  let maxBedrooms=Number.isFinite(Number(input.maxBedrooms)) ? Number(input.maxBedrooms) : (Number.isFinite(legacyBeds)?legacyBeds:2);
  minBedrooms=Math.max(0,Math.min(8,minBedrooms)); maxBedrooms=Math.max(minBedrooms,Math.min(8,maxBedrooms));
  const maxRent=Math.max(300,Math.min(10000,Number(input.maxRent)||1000));
  const minSqft=Math.max(0,Math.min(5000,Number(input.minSqft)||600));
  const maxAgeDays=Math.max(1,Math.min(90,Number(input.maxAgeDays)||14));
  const preferredType=["any","flat","house","studio","bungalow"].includes(input.preferredType)?input.preferredType:(["any","flat","house","studio","bungalow"].includes(input.propertyType)?input.propertyType:"flat");
  const furnishing=["any","furnished","part_furnished","unfurnished"].includes(input.furnishing)?input.furnishing:"any";
  const acceptHouses=input.acceptHouses!==false;
  const keywords=cleanText(input.keywords||"").slice(0,120);
  const excludeStudents=input.excludeStudents!==false;
  const preferredAreas=Array.isArray(input.preferredAreas) && input.preferredAreas.length
    ? input.preferredAreas.map(x=>cleanText(x).slice(0,50)).filter(Boolean).slice(0,30)
    : DEFAULT_PREFERRED_AREAS;
  const priorityDistricts=Array.isArray(input.priorityDistricts)?input.priorityDistricts.filter(x=>/^NG\d{1,2}$/i.test(x)).slice(0,20):[];
  return {location,minBedrooms,maxBedrooms,maxRent,minSqft,maxAgeDays,preferredType,furnishing,acceptHouses,keywords,excludeStudents,preferredAreas,priorityDistricts};
}

export function listingMatchesFilters(item, filters) {
  if (!item) return false;
  if (!locationMatches(item,filters.location)) return false;
  if (filters.excludeStudents && item.studentOnly) return false;
  if (item.bedrooms!==null && item.bedrooms!==undefined && (item.bedrooms<filters.minBedrooms || item.bedrooms>filters.maxBedrooms)) return false;
  if (item.rentPcm!==null && item.rentPcm!==undefined && item.rentPcm>filters.maxRent) return false;
  if (filters.preferredType!=="any") {
    const allowed=new Set([filters.preferredType]);
    if (filters.preferredType==="flat") allowed.add("studio");
    if (filters.acceptHouses) allowed.add("house");
    if (item.propertyType!=="unknown" && !allowed.has(item.propertyType)) return false;
  }
  if (filters.furnishing==="furnished" && !["furnished","part_furnished"].includes(item.furnishing)) return false;
  if (filters.furnishing==="part_furnished" && item.furnishing!=="part_furnished") return false;
  if (filters.furnishing==="unfurnished" && item.furnishing!=="unfurnished") return false;
  if (filters.keywords) {
    const words=filters.keywords.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const text=`${item.title||""} ${item.snippet||""}`.toLowerCase();
    if (words.length && !words.some(w=>text.includes(w))) return false;
  }
  const seen=parseDate(item.firstSeenAt || item.discoveredAt || item.lastCheckedAt);
  if (seen && filters.maxAgeDays) {
    const age=(Date.now()-seen.getTime())/86400000;
    if (age>filters.maxAgeDays && !item.isNew) return false;
  }
  return true;
}

export function scoreListing(item, filters) {
  let score=0; const reasons=[];
  if (filters.location && !["nottingham","nottinghamshire"].includes(filters.location.toLowerCase()) && locationMatches(item,filters.location)) { score+=8; reasons.push(`Location: ${filters.location}`); }
  if (item.rentPcm!==null) { score+=12; if(item.rentPcm<=filters.maxRent) reasons.push(`£${item.rentPcm} within budget`); }
  if (item.bedrooms!==null && item.bedrooms>=filters.minBedrooms && item.bedrooms<=filters.maxBedrooms) { score+=18; reasons.push(`${item.bedrooms===0?"Studio":`${item.bedrooms}-bed`} match`); }
  if (filters.preferredType!=="any") {
    if (item.propertyType===filters.preferredType || (filters.preferredType==="flat" && item.propertyType==="studio")) { score+=20; reasons.push("Preferred property type"); }
    else if (filters.acceptHouses && item.propertyType==="house") { score+=9; reasons.push("House fallback"); }
  }
  if (filters.furnishing==="furnished" && item.furnishing==="furnished") { score+=10; reasons.push("Furnished"); }
  else if (filters.furnishing==="furnished" && item.furnishing==="part_furnished") { score+=7; reasons.push("Part-furnished"); }
  else if (filters.furnishing==="part_furnished" && item.furnishing==="part_furnished") { score+=10; reasons.push("Part-furnished"); }
  else if (filters.furnishing==="unfurnished" && item.furnishing==="unfurnished") { score+=8; reasons.push("Unfurnished"); }
  if (item.floorAreaSqft) {
    if(item.floorAreaSqft>=filters.minSqft){ score+=10; reasons.push(`Size ${Math.round(item.floorAreaSqft)} ft²`); }
    else score+=2;
  }
  const fit=areaFit(item,filters.preferredAreas); score+=fit.score; if(fit.matched.length) reasons.push(`Area fit: ${fit.matched.slice(0,2).join(", ")}`);
  if (item.availabilityStatus==="ACTIVE") { score+=8; reasons.push("Direct availability wording"); }
  else if (item.availabilityStatus==="LIKELY_ACTIVE") score+=4;
  if (String(item.verificationMethod).includes("detail")) score+=7;
  if (item.isNew) { score+=12; reasons.push("New since previous refresh"); }
  score+=(PRIORITY[item.postcodeDistrict]??50)/20;
  return {score:Math.round(score*10)/10, reasons:[...new Set(reasons)].slice(0,5), areaFit:fit.matched.length?"preferred":"neutral"};
}

export function filterAndRankListings(items=[], input={}) {
  const filters=validateFilters(input);
  return items.filter(item=>listingMatchesFilters(item,filters)).map(item=>{
    const ranked=scoreListing(item,filters);
    const verified=item.rentPcm!==null && item.bedrooms!==null;
    return {...item,...ranked,verified,sizeMeetsPreference:item.floorAreaSqft===null || item.floorAreaSqft===undefined ? null : item.floorAreaSqft>=filters.minSqft};
  }).sort((a,b)=>(b.score??0)-(a.score??0));
}

function propertyKey(item) {
  if (!item.postcode || item.bedrooms===null || item.bedrooms===undefined || !item.rentPcm) return null;
  const titleKey=cleanText(item.title).toLowerCase().replace(/\W/g,"").slice(0,36);
  return [item.postcode,item.rentPcm,item.bedrooms,titleKey].join("|");
}
function mergeListing(existing, incoming) {
  const better=(incoming.score??0)>(existing.score??0) ? incoming : existing;
  const other=better===incoming ? existing : incoming;
  return {
    ...other,...better,
    imageUrl:better.imageUrl || other.imageUrl,
    floorAreaSqft:better.floorAreaSqft || other.floorAreaSqft,
    postcode:better.postcode || other.postcode,
    postcodeDistrict:better.postcodeDistrict || other.postcodeDistrict,
    rentPcm:better.rentPcm || other.rentPcm,
    bedrooms:better.bedrooms ?? other.bedrooms,
    furnishing:better.furnishing && better.furnishing!=="unknown" ? better.furnishing : (other.furnishing || "unknown"),
    discoveryProviders:[...new Set([...(existing.discoveryProviders||[]),...(incoming.discoveryProviders||[])])],
  };
}
export function dedupeListings(items=[]) {
  const out=[]; const urlIndex=new Map(); const propertyIndex=new Map();
  for(const item of [...items].filter(Boolean).sort((a,b)=>(b.score??0)-(a.score??0))) {
    const urlKey=normalizeUrl(item.sourceUrl); const pKey=propertyKey(item);
    const existingIndex=urlIndex.has(urlKey) ? urlIndex.get(urlKey) : (pKey && propertyIndex.has(pKey) ? propertyIndex.get(pKey) : undefined);
    if(existingIndex!==undefined) {
      out[existingIndex]=mergeListing(out[existingIndex],item); urlIndex.set(urlKey,existingIndex); if(pKey) propertyIndex.set(pKey,existingIndex); continue;
    }
    const index=out.length; out.push(item); urlIndex.set(urlKey,index); if(pKey) propertyIndex.set(pKey,index);
  }
  return out;
}