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

export function mergeHistory(items=[],history={},now=new Date().toISOString()){
  const next={...history};
  const annotated=items.map(item=>{
    const key=item.id || item.sourceUrl;
    const prev=next[key];
    const firstSeenAt=prev?.firstSeenAt || now;
    const timesSeen=(prev?.timesSeen||0)+1;
    next[key]={firstSeenAt,lastSeenAt:now,timesSeen,sourceUrl:item.sourceUrl,title:item.title,rentPcm:item.rentPcm,bedrooms:item.bedrooms};
    return {...item,firstSeenAt,lastSeenAt:now,timesSeen,isNew:!prev};
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
  const history=await loadHistory();
  const merged=mergeHistory(items,history,refreshedAt);
  const snapshot={
    version:2,
    refreshedAt,
    refreshStartedAt:refreshStartedAt||refreshedAt,
    items:merged.items,
    sourceStatuses,
    workingSourceCount:sourceStatuses.filter(x=>x.status==="working").length,
    configuredSourceCount:sourceStatuses.length,
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
