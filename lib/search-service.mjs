import { dedupeListings, filterAndRankListings, normalizeSearchResult, validateFilters } from "./core.mjs";
import { configuredProviders, providerStatuses, searchMode } from "./providers/index.mjs";
import { directSourceStatuses } from "./providers/direct-sources.mjs";
import { demoListings } from "./demo.mjs";
import { loadSnapshot, saveSnapshot, snapshotAgeMinutes, storageMode } from "./storage.mjs";
import { envValue } from "./env.mjs";

export function providerInfo(){
  const providers=providerStatuses();
  const configured=providers.filter(p=>p.configured);
  const sources=directSourceStatuses();
  return {
    mode:searchMode(),providers,configured,configuredCount:configured.length,
    configuredAny:sources.length>0,connectedSources:sources,connectedSourceCount:sources.length,
    label:sources.length?`${sources.length} independent rental sources configured`:"No rental sources configured",
  };
}

async function callProvider(provider){
  const started=Date.now();
  const response=await provider.search("",{});
  const results=Array.isArray(response)?response:(response?.items||[]);
  const meta=Array.isArray(response)?{}:(response?.meta||{});
  return {provider,elapsedMs:Date.now()-started,meta,results:results.map(x=>({...x,discoveryProvider:provider.id,discoveryProviderLabel:x.discoveryProviderLabel||provider.label,verificationMethod:x.verificationMethod||"direct_source"}))};
}

async function aggregateDiscovery(providers){
  const settled=await Promise.allSettled(providers.map(callProvider));
  const raw=[]; const providerStats=[]; const errors=[]; let sourceStatuses=[];
  settled.forEach((result,i)=>{
    const provider=providers[i];
    if(result.status==="fulfilled"){
      raw.push(...result.value.results);
      sourceStatuses.push(...(result.value.meta.sourceStatuses||[]));
      providerStats.push({id:provider.id,label:provider.label,calls:1,results:result.value.results.length,errors:[],elapsedMs:result.value.elapsedMs});
    }else{
      const message=result.reason?.message||"Source connector failed";
      errors.push({provider:provider.id,label:provider.label,message});
      sourceStatuses.push(...(result.reason?.sourceStatuses||[]));
      providerStats.push({id:provider.id,label:provider.label,calls:1,results:0,errors:[message]});
    }
  });
  return {raw,providerStats,errors,sourceStatuses};
}

export async function refreshInventory(){
  const providers=configuredProviders();
  if(!providers.length)throw Object.assign(new Error("No rental sources are configured."),{code:"SEARCH_NOT_CONFIGURED"});
  const refreshStartedAt=new Date().toISOString();
  const discovery=await aggregateDiscovery(providers);
  const normalized=discovery.raw.map(r=>normalizeSearchResult(r,{excludeStudents:true})).filter(Boolean);
  const deduped=dedupeListings(normalized);
  const snapshot=await saveSnapshot({items:deduped,sourceStatuses:discovery.sourceStatuses,refreshStartedAt,refreshedAt:new Date().toISOString()});
  return {snapshot,providerStats:discovery.providerStats,errors:discovery.errors,rawResults:discovery.raw.length};
}

export async function runSearch(input={}){
  const filters=validateFilters(input);
  const demo=Boolean(input.demo);
  if(demo){
    if(String(envValue("ALLOW_DEMO_MODE","true")).toLowerCase()!=="true")throw Object.assign(new Error("Demo mode is disabled."),{code:"DEMO_DISABLED"});
    const items=filterAndRankListings(demoListings(filters),filters);
    return {items,meta:{provider:"Demo dataset",providers:[{id:"demo",label:"Demo dataset",calls:1,results:items.length,errors:[]}],rawResults:items.length,demo:true,persisted:false,partial:false,configuredSourceCount:directSourceStatuses().length,workingSourceCount:0,sourceStatuses:[],storage:storageMode()},filters};
  }

  let snapshot=await loadSnapshot();
  let refreshMeta=null;
  if(!snapshot || input.forceRefresh===true){
    refreshMeta=await refreshInventory();
    snapshot=refreshMeta.snapshot;
  }
  const items=filterAndRankListings(snapshot?.items||[],filters);
  const ageMinutes=await snapshotAgeMinutes();
  return {
    items,
    meta:{
      provider:"Tracked rental inventory",cached:true,refreshedAt:snapshot?.refreshedAt||null,ageMinutes,
      configuredSourceCount:snapshot?.configuredSourceCount||directSourceStatuses().length,
      workingSourceCount:snapshot?.workingSourceCount||0,sourceStatuses:snapshot?.sourceStatuses||[],
      rawResults:snapshot?.items?.length||0,returned:items.length,
      partial:(snapshot?.workingSourceCount||0)<(snapshot?.configuredSourceCount||0),
      providerErrors:refreshMeta?.errors||[],storage:storageMode(),
    },
    filters,
  };
}
