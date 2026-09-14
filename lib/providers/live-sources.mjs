import { SOURCES } from "../../config/sources.mjs";
import { envValue } from "../env.mjs";

const MAX_SOURCES=40;
const MAX_ITEMS_PER_SOURCE=120;
const FETCH_TIMEOUT_MS=12000;
const DETAIL_CONCURRENCY=4;
const MAX_DETAIL_FETCHES_PER_SOURCE=18;
const MAX_INDEX_PAGES_PER_SOURCE=3;

function envUrls(name){ return String(envValue(name,"")).split(",").map(x=>x.trim()).filter(Boolean); }
function validHttpUrl(value){ try{ const u=new URL(value); return u.protocol==="https:"||u.protocol==="http:"; }catch{return false;} }
function unique(items,keyFn=(item)=>`${item.type||"item"}|${item.url||""}`){ const seen=new Set(); return items.filter(item=>{const key=keyFn(item); if(!key||seen.has(key)) return false; seen.add(key); return true;}); }
function pageAllowed(url){
  const allowed=new Set(envUrls("DIRECT_SOURCE_ALLOWED_HOSTS").map(x=>x.toLowerCase()));
  try{ const host=new URL(url).hostname.toLowerCase(); return allowed.has(host)||allowed.has(host.replace(/^www\./,"")); }catch{return false;}
}
export function directSources(){
  const builtinsDisabled=String(envValue("DISABLE_BUILTIN_SOURCES","")).toLowerCase()==="true";
  const configured=!builtinsDisabled&&Array.isArray(SOURCES)?SOURCES.filter(s=>s&&s.enabled!==false&&["feed","page"].includes(s.type)&&validHttpUrl(s.url)):[];
  const feeds=envUrls("PUBLIC_FEED_URLS").filter(validHttpUrl).map((url,i)=>({id:`env-feed-${i+1}`,label:new URL(url).hostname.replace(/^www\./,""),type:"feed",url,enabled:true}));
  const pages=envUrls("DIRECT_SOURCE_URLS").filter(validHttpUrl).filter(pageAllowed).map((url,i)=>({id:`env-page-${i+1}`,label:new URL(url).hostname.replace(/^www\./,""),type:"page",url,enabled:true,maxDetails:12,detailPathPattern:"(property|rent|let|details)"}));
  return unique([...configured,...feeds,...pages]).slice(0,MAX_SOURCES);
}

function decodeEntities(value=""){
  return String(value).replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g," ").replace(/&#xA3;|&pound;/gi,"£").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function stripHtml(value=""){ return decodeEntities(String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim(); }
function stripCdata(value=""){ return stripHtml(String(value).replace(/^<!\[CDATA\[/,"").replace(/\]\]>$/, "")); }
function resolveUrl(value,base){ if(!value)return null; try{return new URL(value,base).toString();}catch{return null;} }
function canonicalUrl(value){ try{const u=new URL(value);["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"].forEach(k=>u.searchParams.delete(k));u.hash="";return u.toString().replace(/\/$/,"");}catch{return value||"";} }
function stableId(source,url,prefix="listing"){ return `${source.id}-${prefix}-${Buffer.from(canonicalUrl(url)).toString("base64url").slice(0,24)}`; }
function tag(block,name){ const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i")); return m?stripCdata(m[1]):""; }
function atomLink(block){ const m=block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i); return m?.[1]||tag(block,"link"); }
function first(...values){ return values.find(v=>typeof v==="string"&&v.trim())||null; }
function metaContent(html,key){
  const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const rxs=[new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,`i`),new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`,`i`)];
  for(const rx of rxs){const m=html.match(rx);if(m)return decodeEntities(m[1]);} return null;
}
function titleFromHtml(html){ return metaContent(html,"og:title")||stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||"")||stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""); }
function imageFromHtml(html,base){ return resolveUrl(metaContent(html,"og:image")||metaContent(html,"twitter:image"),base); }

function flattenLd(value,out=[]){
  if(Array.isArray(value)){value.forEach(x=>flattenLd(x,out));return out;}
  if(!value||typeof value!=="object")return out;
  out.push(value);
  if(Array.isArray(value["@graph"]))value["@graph"].forEach(x=>flattenLd(x,out));
  if(Array.isArray(value.itemListElement))value.itemListElement.forEach(x=>flattenLd(x?.item||x,out));
  return out;
}
function jsonLdBlocks(html){
  const blocks=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes=[]; for(const block of blocks){try{flattenLd(JSON.parse(block[1].trim()),nodes);}catch{}} return nodes;
}
function addressText(address){ if(!address)return""; if(typeof address==="string")return address; return [address.streetAddress,address.addressLocality,address.addressRegion,address.postalCode].filter(Boolean).join(", "); }
function imageFromLd(value){ if(typeof value==="string")return value; if(Array.isArray(value))return imageFromLd(value[0]); if(value&&typeof value==="object")return value.url||value.contentUrl||null; return null; }
function candidateFromLd(node,source,index,method="direct_page_structured_data"){
  const type=Array.isArray(node["@type"])?node["@type"].join(" "):String(node["@type"]||"");
  const looksProperty=/Apartment|House|Residence|Accommodation|Product|Offer|RealEstateListing|Place|SingleFamilyResidence|Room/i.test(type);
  const offer=Array.isArray(node.offers)?node.offers[0]:node.offers;
  const url=resolveUrl(node.url||node["@id"]||offer?.url,source.url);
  if(!url||(!looksProperty&&!offer))return null;
  const title=first(node.name,node.headline,addressText(node.address))||"Rental listing";
  const detail=[]; if(node.description)detail.push(stripHtml(node.description));
  const price=offer?.price??node.price; const currency=offer?.priceCurrency||node.priceCurrency;
  if(price&&(!currency||String(currency).toUpperCase()==="GBP"))detail.push(`£${price} pcm`);
  const beds=node.numberOfBedrooms??node.numberOfRooms; if(beds!==undefined&&beds!==null)detail.push(`${beds} bedrooms`);
  const floor=node.floorSize; if(floor?.value)detail.push(`${floor.value} ${floor.unitText||floor.unitCode||"sq ft"}`);
  const addr=addressText(node.address); if(addr)detail.push(addr);
  return {id:stableId(source,url,"ld"),title,url:canonicalUrl(url),snippet:detail.filter(Boolean).join(". "),date:node.dateModified||node.datePublished||null,image:resolveUrl(imageFromLd(node.image),source.url),discoveryProviderLabel:source.label,verificationMethod:method};
}

function parseXml(text,source){
  const entries=[...text.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return entries.slice(0,MAX_ITEMS_PER_SOURCE).map((m)=>{const block=m[2];const enclosure=block.match(/<enclosure\b[^>]*url=["']([^"']+)["']/i);const url=resolveUrl(atomLink(block),source.url);return{id:stableId(source,url,"feed"),title:tag(block,"title"),url:canonicalUrl(url),snippet:tag(block,"description")||tag(block,"summary")||tag(block,"content"),date:tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||null,image:resolveUrl(enclosure?.[1],source.url),discoveryProviderLabel:source.label,verificationMethod:"direct_feed"};}).filter(x=>x.url&&x.title);
}
function parseJson(data,source){
  let rows=Array.isArray(data)?data:data?.items||data?.results||data?.listings||data?.properties||data?.data||[]; if(!Array.isArray(rows))rows=[];
  return rows.slice(0,MAX_ITEMS_PER_SOURCE).map((x)=>{const photos=Array.isArray(x?.photos)?x.photos:[];const image=first(x?.image,x?.imageUrl,x?.image_url,x?.photo,typeof photos[0]==="string"?photos[0]:photos[0]?.url);const url=resolveUrl(first(x?.url,x?.link,x?.source_url,x?.listing_url),source.url);return{id:stableId(source,url,"feed"),title:first(x?.title,x?.name,x?.address,x?.display_address)||"Rental listing",url:canonicalUrl(url),snippet:first(x?.description,x?.snippet,x?.summary,x?.details)||"",date:first(x?.date,x?.published_at,x?.updated_at,x?.created_at),image:resolveUrl(image,source.url),discoveryProviderLabel:source.label,verificationMethod:"direct_feed"};}).filter(x=>x.url);
}

function sameHost(a,b){ try{return new URL(a).hostname.replace(/^www\./,"")===new URL(b).hostname.replace(/^www\./,"");}catch{return false;} }
function detailPattern(source){ return source.detailPathPattern?new RegExp(source.detailPathPattern,"i"):/(property|to-rent|to-let|letting|rentals|details)/i; }
function detailLinks(html,source,baseUrl=source.url){
  const pattern=detailPattern(source); const out=[]; const seen=new Set(); const rx=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=rx.exec(html))&&out.length<160){
    const href=resolveUrl(m[1],baseUrl); if(!href||!sameHost(href,source.url)||canonicalUrl(href)===canonicalUrl(source.url)||seen.has(canonicalUrl(href)))continue;
    const u=new URL(href); if(!pattern.test(`${u.pathname}${u.search}`))continue;
    const text=stripHtml(m[2]); if(text.length<3)continue;
    seen.add(canonicalUrl(href)); out.push({url:canonicalUrl(href),anchorText:text});
  }
  return out;
}
function paginationLinks(html,source,baseUrl=source.url){
  const out=[]; const seen=new Set(); const rx=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=rx.exec(html))&&out.length<12){
    const href=resolveUrl(m[1],baseUrl); if(!href||!sameHost(href,source.url)||seen.has(canonicalUrl(href)))continue;
    const text=stripHtml(m[2]).toLowerCase(); const u=new URL(href); const target=`${u.pathname}${u.search}`;
    const pagey=/(?:\/page\/\d+)|(?:[?&](?:page|paged|pg|p)=\d+)|(?:\/page-\d+)/i.test(target) || /^(?:next|older|more|\d+|›|»)$/.test(text);
    if(!pagey)continue; seen.add(canonicalUrl(href)); out.push(canonicalUrl(href));
  }
  return out;
}
async function fetchText(url,accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"){
  const response=await fetch(url,{headers:{Accept:accept,"User-Agent":"RentalFinder26/2.1 (+rental discovery; respectful polling)"},signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});
  if(!response.ok){const err=new Error(`HTTP ${response.status}`);err.status=response.status;throw err;}
  return {text:await response.text(),type:response.headers.get("content-type")||""};
}
function detailCandidate(html,url,source){
  const detailSource={...source,url};
  const structured=jsonLdBlocks(html).map((x,i)=>candidateFromLd(x,detailSource,i,"direct_property_detail")).filter(x=>x&&sameHost(x.url,url));
  if(structured.length){ const exact=structured.find(x=>canonicalUrl(x.url)===canonicalUrl(url))||structured[0]; return {...exact,id:stableId(source,url,"detail"),url:canonicalUrl(url),verificationMethod:"direct_property_detail",discoveryProviderLabel:source.label}; }
  const title=titleFromHtml(html)||"Rental listing"; const body=stripHtml(html).slice(0,35000);
  if(!/(rent|let|pcm|bed|apartment|flat|house|studio)/i.test(`${title} ${body}`))return null;
  return {id:stableId(source,url,"detail"),title,url:canonicalUrl(url),snippet:body,image:imageFromHtml(html,url),date:null,discoveryProviderLabel:source.label,verificationMethod:"direct_property_detail"};
}
async function mapLimit(items,limit,fn){
  const out=new Array(items.length); let next=0;
  async function worker(){while(true){const i=next++; if(i>=items.length)return; try{out[i]=await fn(items[i],i);}catch(err){out[i]={__error:err};}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length||1)},worker)); return out;
}
function statusFromError(source,err,started){
  const message=err?.message||"Source failed"; const status=err?.status;
  const kind=status===403||status===429?"blocked":message.includes("Timeout")||err?.name==="TimeoutError"?"timeout":"error";
  return {id:source.id,label:source.label,url:source.url,status:kind,items:0,indexPagesChecked:0,detailLinksFound:0,detailPagesChecked:0,error:message,elapsedMs:Date.now()-started,checkedAt:new Date().toISOString()};
}
function rotatingSelection(links,limit){
  if(links.length<=limit)return links;
  const headCount=Math.min(4,limit); const head=links.slice(0,headCount); const rest=links.slice(headCount); const need=limit-headCount;
  if(need<=0||!rest.length)return head;
  const bucket=Math.floor(Date.now()/(15*60*1000)); const start=(bucket*need)%rest.length; const picked=[];
  for(let i=0;i<Math.min(need,rest.length);i++)picked.push(rest[(start+i)%rest.length]);
  return unique([...head,...picked],x=>x.url);
}
async function fetchPageSource(source){
  const started=Date.now();
  try{
    const firstPage=await fetchText(source.url); const pages=[{url:source.url,text:firstPage.text}];
    const pageUrls=paginationLinks(firstPage.text,source).slice(0,MAX_INDEX_PAGES_PER_SOURCE-1);
    for(const url of pageUrls){ try{const res=await fetchText(url);pages.push({url,text:res.text});}catch{} }
    const allLinks=unique(pages.flatMap(p=>detailLinks(p.text,source,p.url)),x=>x.url);
    const limit=Math.min(Number(source.maxDetails)||12,MAX_DETAIL_FETCHES_PER_SOURCE);
    const selected=rotatingSelection(allLinks,limit);
    const detailResults=await mapLimit(selected,DETAIL_CONCURRENCY,async(link)=>{const {text}=await fetchText(link.url);return detailCandidate(text,link.url,source);});
    const details=detailResults.filter(x=>x&&!x.__error); const detailErrors=detailResults.filter(x=>x?.__error).length;
    const indexStructured=pages.flatMap((p)=>jsonLdBlocks(p.text).map((x,i)=>candidateFromLd(x,{...source,url:p.url},i,"direct_page_structured_data"))).filter(x=>x&&sameHost(x.url,source.url)&&canonicalUrl(x.url)!==canonicalUrl(source.url)&&detailPattern(source).test(`${new URL(x.url).pathname}${new URL(x.url).search}`));
    const items=unique([...details,...indexStructured].filter(Boolean),x=>canonicalUrl(x.url)).slice(0,MAX_ITEMS_PER_SOURCE);
    return {items,status:{id:source.id,label:source.label,url:source.url,status:items.length?"working":"empty",items:items.length,indexPagesChecked:pages.length,detailLinksFound:allLinks.length,detailPagesChecked:selected.length-detailErrors,detailPagesFailed:detailErrors,scanMode:allLinks.length>selected.length?"rotating":"full",error:null,elapsedMs:Date.now()-started,checkedAt:new Date().toISOString()}};
  }catch(err){return {items:[],status:statusFromError(source,err,started)};}
}
async function fetchFeedSource(source){
  const started=Date.now();
  try{
    const {text,type}=await fetchText(source.url,"application/json,application/rss+xml,application/atom+xml,text/xml;q=0.9,*/*;q=0.5");
    let items; if(type.includes("json")||/^[\s\r\n]*[\[{]/.test(text)){try{items=parseJson(JSON.parse(text),source);}catch{throw new Error("Invalid JSON feed");}} else items=parseXml(text,source);
    items=unique(items,x=>canonicalUrl(x.url));
    return {items,status:{id:source.id,label:source.label,url:source.url,status:items.length?"working":"empty",items:items.length,indexPagesChecked:1,detailLinksFound:items.length,detailPagesChecked:0,scanMode:"feed",error:null,elapsedMs:Date.now()-started,checkedAt:new Date().toISOString()}};
  }catch(err){return {items:[],status:statusFromError(source,err,started)};}
}

export function directSourceStatuses(){ return directSources().map(source=>({id:source.id,label:source.label,type:source.type,url:source.url,status:"configured"})); }
export async function directSourceSearch(){
  const sources=directSources(); if(!sources.length)throw Object.assign(new Error("No rental sources are configured."),{code:"SEARCH_NOT_CONFIGURED"});
  const settled=await Promise.all(sources.map(source=>source.type==="feed"?fetchFeedSource(source):fetchPageSource(source)));
  const items=settled.flatMap(x=>x.items||[]); const sourceStatuses=settled.map(x=>x.status);
  return {items,meta:{sourceStatuses}};
}
