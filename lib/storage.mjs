import { envValue } from "./env.mjs";

const STORE_NAME="rental-finder-26";
const SNAPSHOT_KEY="inventory/current";
const HISTORY_KEY="inventory/history";
const memory=globalThis.__RF26_MEMORY_STORE__ || (globalThis.__RF26_MEMORY_STORE__={snapshot:null,history:{}});

function isNetlifyRuntime(){ return Boolean(globalThis.Netlify || envValue("NETLIFY") || envValue("CONTEXT")); }
async function blobStore(){
  if(!isNetlifyRuntime()) return null;
  try {
    const {getStore,getDeployStore}=await import("@netlify/blobs");
    const context=globalThis.Netlify?.context?.deploy?.context || envValue("CONTEXT");
    return context==="production" ? getStore(STORE_NAME,{consistency:"strong"}) : getDeployStore(STORE_NAME);
  } catch (err) {
    console.error("Netlify Blobs unavailable:",err?.message||err);
    return null;
  }
}
export function storageConfigured(){ return true; }
export function storageMode(){ return isNetlifyRuntime()?"netlify-blobs":"memory-dev"; }

function canonicalKey(item){
  const raw=item?.sourceUrl || item?.url || item?.id || "";
  try{
    const u=new URL(raw);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"].forEach(k=>u.searchParams.delete(k));
    u.hash="";
    return u.toString().replace(/\/$/,"");
  }catch{return String(raw);}
}
function listingFingerprint(item={}){
  return JSON.stringify({
    title:item.title||null,rentPcm:item.rentPcm??null,bedrooms:item.bedrooms??null,
    floorAreaSqft:item.floorAreaSqft??null,postcode:item.postcode||null,propertyType:item.propertyType||null,
    furnishing:item.furnishing||null,availabilityStatus:item.availabilityStatus||null,imageUrl:item.imageUrl||null,
  });
}

export function mergeHistory(items=[],history={},now=new Date().toISOString()){
  const next={...history};
  const annotated=items.map(item=>{
    const key=canonicalKey(item);
    const prev=next[key];
    const firstSeenAt=prev?.firstSeenAt || now;
    const timesSeen=(prev?.timesSeen||0)+1;
    next[key]={firstSeenAt,lastSeenAt:now,timesSeen,sourceUrl:item.sourceUrl,title:item.title,rentPcm:item.rentPcm,bedrooms:item.bedrooms};
    return {...item,firstSeenAt,lastSeenAt:now,timesSeen,isNew:!prev,carriedForward:false};
  });
  return {items:annotated,history:next};
}

export async function loadSnapshot(){
  const store=await blobStore();
  if(!store) return memory.snapshot;
  try { return await store.get(SNAPSHOT_KEY,{type:"json"}); } catch { return memory.snapshot; }
}
export async function loadHistory(){
  const store=await blobStore();
  if(!store) return memory.history||{};
  try { return (await store.get(HISTORY_KEY,{type:"json"})) || {}; } catch { return memory.history||{}; }
}

export async function saveSnapshot({items=[],sourceStatuses=[],refreshStartedAt=null,refreshedAt=new Date().toISOString()}={}){
  const previous=await loadSnapshot();
  const history=await loadHistory();
  const merged=mergeHistory(items,history,refreshedAt);
  const previousItems=Array.isArray(previous?.items)?previous.items:[];
  const previousByKey=new Map(previousItems.map(item=>[canonicalKey(item),item]));
  const currentByKey=new Map(merged.items.map(item=>[canonicalKey(item),item]));

  let addedCount=0, changedCount=0, seenAgainCount=0;
  for(const [key,item] of currentByKey){
    const old=previousByKey.get(key);
    if(!old){ addedCount++; continue; }
    seenAgainCount++;
    if(listingFingerprint(old)!==listingFingerprint(item)) changedCount++;
  }

  const carryHours=Math.max(1,Math.min(168,Number(envValue("INVENTORY_CARRY_HOURS","72"))||72));
  const carryCutoff=Date.parse(refreshedAt)-carryHours*60*60*1000;
  const carried=[];
  for(const old of previousItems){
    const key=canonicalKey(old);
    if(currentByKey.has(key)) continue;
    const lastSeen=Date.parse(old.lastSeenAt||old.lastCheckedAt||previous?.refreshedAt||0);
    if(Number.isFinite(lastSeen)&&lastSeen>=carryCutoff){
      carried.push({...old,isNew:false,carriedForward:true,availabilityStatus:"UNCONFIRMED",freshnessLabel:"Seen on an earlier refresh; not rechecked this cycle"});
    }
  }
  const carriedKeys=new Set(carried.map(canonicalKey));
  const droppedCount=previousItems.filter(old=>!currentByKey.has(canonicalKey(old))&&!carriedKeys.has(canonicalKey(old))).length;
  const inventory=[...merged.items,...carried];
  const delta={addedCount,changedCount,seenAgainCount,carriedCount:carried.length,droppedCount,previousCount:previousItems.length,currentScanCount:merged.items.length,inventoryCount:inventory.length};

  const snapshot={
    version:3,
    refreshedAt,
    refreshStartedAt:refreshStartedAt||refreshedAt,
    items:inventory,
    sourceStatuses,
    workingSourceCount:sourceStatuses.filter(x=>x.status==="working").length,
    configuredSourceCount:sourceStatuses.length,
    delta,
  };
  memory.snapshot=snapshot; memory.history=merged.history;
  const store=await blobStore();
  if(store){ await store.setJSON(SNAPSHOT_KEY,snapshot); await store.setJSON(HISTORY_KEY,merged.history); }
  return snapshot;
}
export async function snapshotAgeMinutes(){
  const snapshot=await loadSnapshot(); if(!snapshot?.refreshedAt) return null;
  return Math.max(0,Math.round((Date.now()-Date.parse(snapshot.refreshedAt))/60000));
}
export function clearMemoryStoreForTests(){ memory.snapshot=null; memory.history={}; }
