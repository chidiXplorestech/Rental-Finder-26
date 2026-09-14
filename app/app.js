const AREAS=["West Bridgford","Beeston","Wollaton","Sherwood","Carrington","Mapperley","The Park","Lady Bay","Lace Market","City Centre"];
const DEFAULT_AREAS=new Set(AREAS);
const state={listings:[],tab:"verified",selectedAreas:new Set(DEFAULT_AREAS),health:null,lastMeta:null};
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function sanitize(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function plural(n,word){return `${n} ${word}${n===1?"":"s"}`;}
function formatDate(value){if(!value)return"Not yet";const d=new Date(value);if(Number.isNaN(d.getTime()))return"Unknown";return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);}
function furnishingLabel(value){return({furnished:"Furnished",part_furnished:"Part-furnished",unfurnished:"Unfurnished",unknown:"Not stated"})[value]||"Not stated";}
function renderAreaChips(){ $("areaChips").innerHTML=AREAS.map(a=>`<button class="chip ${state.selectedAreas.has(a)?"active":""}" type="button" data-area="${sanitize(a)}">${sanitize(a)}</button>`).join(""); }
function readForm(){return{location:$("location").value.trim()||"Nottingham",minBedrooms:Number($("minBedrooms").value),maxBedrooms:Number($("maxBedrooms").value),maxRent:Number($("maxRent").value),minSqft:Number($("minSqft").value),preferredType:$("preferredType").value,furnishing:$("furnishing").value,maxAgeDays:Number($("maxAgeDays").value),excludeStudents:$("excludeStudents").checked,acceptHouses:$("acceptHouses").checked,keywords:$("keywords").value.trim(),preferredAreas:[...state.selectedAreas]};}
function setLoading(loading,label="Searching inventory…"){ $("loadingState").hidden=!loading;$("searchButton").disabled=loading;$("refreshButton").disabled=loading;$("searchButton").querySelector("span").textContent=loading?label:"Find matching rentals";$("refreshButton").textContent=loading&&label.includes("agent")?"Refreshing agent sites…":"Refresh live sources";if(loading){$("errorState").hidden=true;$("partialNotice").hidden=true;} }
function setError(title,message){$("errorTitle").textContent=title;$("errorText").textContent=message;$("errorState").hidden=false;}
function metric(value,label){return `<div class="metric"><strong>${sanitize(value??"—")}</strong><span>${sanitize(label)}</span></div>`;}
function card(listing){
  const img=listing.imageUrl?`<img src="${sanitize(listing.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'placeholder-house',textContent:'⌂'}))"/>`:`<div class="placeholder-house">⌂</div>`;
  const status=(listing.availabilityStatus||"UNKNOWN").replaceAll("_"," ");
  const newBadge=listing.isNew?'<span class="badge new-badge">NEW</span>':"";
  const carriedBadge=listing.carriedForward?'<span class="badge">NOT RECHECKED THIS CYCLE</span>':"";
  const reasons=Array.isArray(listing.reasons)&&listing.reasons.length?`<div class="match-reasons">${listing.reasons.map(r=>`<span>${sanitize(r)}</span>`).join("")}</div>`:"";
  const ageLine=listing.firstSeenAt?`First seen ${formatDate(listing.firstSeenAt)}${listing.timesSeen?` · ${listing.timesSeen} sighting${listing.timesSeen===1?"":"s"}`:""}`:"First seen not recorded";
  const link=listing.demo?`<a class="card-link disabled" href="#" aria-disabled="true"><span>Demo listing</span><span>↗</span></a>`:`<a class="card-link" href="${sanitize(listing.sourceUrl)}" target="_blank" rel="noopener noreferrer"><span>Open original listing</span><span>↗</span></a>`;
  return `<article class="card"><div class="card-image">${img}<div class="image-badges"><span class="badge status">${sanitize(status)}</span>${newBadge}${carriedBadge}<span class="badge">${listing.verified?"CORE DETAILS KNOWN":"CHECK DETAILS"}</span></div></div><div class="card-body">
    <div class="card-price"><strong>${listing.rentPcm?`£${Number(listing.rentPcm).toLocaleString("en-GB")}`:"Price unclear"}</strong><small>${listing.rentPcm?"pcm":"verify"}</small></div>
    <h3>${sanitize(listing.title||"Rental listing")}</h3><p class="card-location">${sanitize(listing.location||listing.postcode||"Location needs verification")}</p>
    <div class="metrics">${metric(listing.bedrooms===0?"Studio":listing.bedrooms!=null?`${listing.bedrooms} bed`:"—","Bedrooms")}${metric(listing.floorAreaSqft?`${Math.round(listing.floorAreaSqft)} ft²`:"Unknown","Floor area")}${metric(listing.score?`${Math.round(listing.score)}`:"—","Match score")}</div>
    ${reasons}
    <div class="verification"><div class="verify-row"><span>Furnishing</span><strong>${sanitize(furnishingLabel(listing.furnishing))}</strong></div><div class="verify-row"><span>Freshness</span><strong>${sanitize(listing.freshnessLabel||"Source sighting")}</strong></div><div class="verify-row"><span>History</span><strong>${sanitize(ageLine)}</strong></div><div class="verify-row"><span>Last checked</span><strong>${sanitize(formatDate(listing.lastCheckedAt))}</strong></div></div>
    <div class="source-line"><span>Original source</span><b title="${sanitize(listing.source)}">${sanitize(listing.source)}</b></div>${link}</div></article>`;
}
function filteredListings(){let items=[...state.listings];if(state.tab==="verified")items=items.filter(x=>x.verified);if(state.tab==="needs")items=items.filter(x=>!x.verified);const sort=$("sortSelect").value;if(sort==="priceAsc")items.sort((a,b)=>(a.rentPcm??1e9)-(b.rentPcm??1e9));else if(sort==="sizeDesc")items.sort((a,b)=>(b.floorAreaSqft??0)-(a.floorAreaSqft??0));else if(sort==="newest")items.sort((a,b)=>new Date(b.firstSeenAt||b.lastCheckedAt||0)-new Date(a.firstSeenAt||a.lastCheckedAt||0));else items.sort((a,b)=>(b.score??0)-(a.score??0));return items;}
function renderSourceHealth(statuses=[]){
  const panel=$("sourceHealthPanel");if(!statuses.length){panel.hidden=true;return;}panel.hidden=false;
  const counts=statuses.reduce((a,s)=>(a[s.status]=(a[s.status]||0)+1,a),{});
  const pages=statuses.reduce((n,s)=>n+(Number(s.indexPagesChecked)||0),0);const details=statuses.reduce((n,s)=>n+(Number(s.detailPagesChecked)||0),0);
  $("sourceHealthSummary").textContent=`${counts.working||0} working · ${statuses.length} checked · ${pages} index pages · ${details} property pages`;
  $("sourceHealthList").innerHTML=statuses.map(s=>{
    const crawl=[];if(Number.isFinite(s.indexPagesChecked))crawl.push(`${s.indexPagesChecked} index page${s.indexPagesChecked===1?"":"s"}`);if(Number.isFinite(s.detailLinksFound))crawl.push(`${s.detailLinksFound} listing links found`);if(Number.isFinite(s.detailPagesChecked))crawl.push(`${s.detailPagesChecked} details checked`);if(s.scanMode)crawl.push(`${s.scanMode} scan`);
    return `<div class="source-health-item"><span class="source-dot ${sanitize(s.status)}"></span><div><strong>${sanitize(s.label)}</strong><small>${sanitize(s.status)}${Number.isFinite(s.items)?` · ${s.items} candidates`:""}${crawl.length?` · ${sanitize(crawl.join(" · "))}`:""}${s.error?` · ${sanitize(s.error)}`:""}</small></div></div>`;
  }).join("");
}
function refreshMessage(meta={}){
  const refreshed=meta.refreshedAt?formatDate(meta.refreshedAt):"unknown time";const d=meta.delta;
  if(meta.refreshedNow&&d){const changed=(d.addedCount||0)+(d.changedCount||0)+(d.droppedCount||0);if(changed===0)return `Live refresh completed ${refreshed}: no listing changes detected. ${d.seenAgainCount||0} seen again; ${d.carriedCount||0} retained from recent scans.`;return `Live refresh completed ${refreshed}: ${d.addedCount||0} new, ${d.changedCount||0} changed, ${d.droppedCount||0} expired; ${d.carriedCount||0} retained from recent scans.`;}
  if(meta.cached&&meta.refreshedAt)return `Showing stored inventory from ${refreshed}. Use Refresh live sources to re-check the agent sites.`;
  return meta.refreshedAt?`Inventory refreshed ${refreshed}.`:"Inventory refresh not recorded.";
}
function renderResults(meta={}){
  state.lastMeta=meta;const verified=state.listings.filter(x=>x.verified).length;const needs=state.listings.length-verified;$("verifiedCount").textContent=verified;$("needsCount").textContent=needs;$("allCount").textContent=state.listings.length;$("resultCount").textContent=plural(state.listings.length,"property");$("resultsTitle").textContent=state.listings.length?"Best tracked matches":"No matching tracked rentals";
  $("lastUpdated").textContent=`${refreshMessage(meta)} Always verify the original advert.`;
  const d=meta.delta;const deltaText=d?` · ${d.addedCount||0} new · ${d.changedCount||0} changed`:"";$("searchMeta").textContent=meta.provider?`${meta.workingSourceCount??0}/${meta.configuredSourceCount??0} sources working · ${plural(meta.rawResults??0,"tracked listing")} · ${plural(meta.returned??state.listings.length,"match")}${deltaText}`:"";
  renderSourceHealth(meta.sourceStatuses||state.health?.sourceStatuses||[]);
  if(meta.partial){const failed=(meta.sourceStatuses||[]).filter(s=>s.status!=="working");$("partialText").textContent=failed.length?`${failed.map(s=>`${s.label} (${s.status})`).join(", ")}. Results from working sources are still shown, and recent un-rechecked listings are retained temporarily instead of being falsely removed.`:"Some configured sources did not return usable data.";$("partialNotice").hidden=false;}else $("partialNotice").hidden=true;
  $("resultsGrid").innerHTML=filteredListings().map(card).join("");$("emptyState").hidden=state.listings.length>0;if(!state.listings.length){$("emptyState").querySelector("h3").textContent="No strong matches in the tracked inventory.";$("emptyState").querySelector("p").textContent="Try a broader area, longer first-seen window, higher budget, different furnishing choice, or refresh the live sources.";}
}
async function health(){
  try{const res=await fetch("/.netlify/functions/health",{cache:"no-store"});const data=await res.json();state.health=data;const configured=Number(data.configuredSourceCount||0),working=Number(data.workingSourceCount||0);if(data.inventoryRefreshedAt){$("providerBadge").textContent=`${working}/${configured} sources working`;$("providerBadge").classList.toggle("live",working>0);const d=data.refreshDelta;const delta=d?` · ${d.addedCount||0} new last refresh`:"";$("inventorySummary").textContent=`${data.inventoryCount||0} tracked listings · refreshed ${formatDate(data.inventoryRefreshedAt)}${delta}.`;}else{$("providerBadge").textContent=`${configured} sources configured`;$("inventorySummary").textContent="No inventory snapshot yet. Run the first live refresh.";}$("configNotice").hidden=configured>0;$("demoButton").hidden=!data.demoAllowed;renderSourceHealth(data.sourceStatuses||[]);return data;}catch{$("providerBadge").textContent="Status unavailable";$("inventorySummary").textContent="Could not read inventory status.";$("demoButton").hidden=false;return null;}
}
async function search({demo=false,showRefreshResult=false}={}){
  setLoading(true,"Searching inventory…");const payload={...readForm(),demo};
  try{const res=await fetch("/.netlify/functions/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||`Search failed (${res.status})`);if(showRefreshResult&&data.meta)data.meta.refreshedNow=true;state.listings=data.items||[];state.tab=state.listings.some(x=>x.verified)?"verified":"all";document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===state.tab));renderResults(data.meta||{});await health();}catch(err){state.listings=[];renderResults();setError("Search could not complete",err.message||"Please try again.");}finally{setLoading(false);}
}
async function refreshLive(){
  const before=state.health?.inventoryRefreshedAt||null;setLoading(true,"Re-checking agent websites…");
  try{
    const queued=await fetch("/.netlify/functions/refresh-background",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    if(!queued.ok&&queued.status!==202)throw new Error(`Refresh could not be queued (${queued.status}).`);
    $("inventorySummary").textContent="Live crawl is running against the agent websites. Waiting for a new inventory snapshot…";
    let completed=false;
    for(let i=0;i<48;i++){
      await sleep(2500);const data=await health();const after=data?.inventoryRefreshedAt||null;
      if(after&&after!==before){completed=true;break;}
    }
    if(!completed)throw new Error("The live crawl was queued but did not finish within two minutes. The previous inventory has been kept; try again shortly.");
    setLoading(false);await search({showRefreshResult:true});
  }catch(err){setError("Live refresh could not complete",err.message||"Please try again.");}
  finally{setLoading(false);}
}
function reset(){$("location").value="Nottingham";$("minBedrooms").value="1";$("maxBedrooms").value="2";$("maxRent").value="1000";$("minSqft").value="600";$("preferredType").value="flat";$("furnishing").value="any";$("maxAgeDays").value="14";$("excludeStudents").checked=true;$("acceptHouses").checked=true;$("keywords").value="";$("sortSelect").value="best";state.selectedAreas=new Set(DEFAULT_AREAS);renderAreaChips();}

$("searchForm").addEventListener("submit",e=>{e.preventDefault();search();});$("refreshButton").addEventListener("click",refreshLive);$("demoButton").addEventListener("click",()=>search({demo:true}));$("resetButton").addEventListener("click",reset);$("areaChips").addEventListener("click",e=>{const area=e.target.dataset.area;if(!area)return;state.selectedAreas.has(area)?state.selectedAreas.delete(area):state.selectedAreas.add(area);renderAreaChips();});$("sortSelect").addEventListener("change",()=>renderResults(state.lastMeta||{}));document.querySelector(".tabs").addEventListener("click",e=>{const tab=e.target.closest(".tab");if(!tab)return;state.tab=tab.dataset.tab;document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));renderResults(state.lastMeta||{});});
renderAreaChips();health();
