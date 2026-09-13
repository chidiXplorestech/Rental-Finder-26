import { dedupeListings, normalizeSearchResult, validateFilters } from "./core.mjs";
import { configuredProviders, providerStatuses, searchMode } from "./providers/index.mjs";
import { directSourceStatuses } from "./providers/direct-sources.mjs";
import { demoListings } from "./demo.mjs";
import { saveListings } from "./storage.mjs";

export function providerInfo(){
  const providers=providerStatuses();
  const configured=providers.filter(p=>p.configured);
  const connectedSources=directSourceStatuses();
  return {
    mode:searchMode(),
    providers,
    configured,
    configuredCount:configured.length,
    configuredAny:connectedSources.length>0,
    connectedSources,
    connectedSourceCount:connectedSources.length,
    label:connectedSources.length ? `${connectedSources.length} connected rental source${connectedSources.length===1?"":"s"}` : "No rental sources connected",
  };
}

async function callProvider(provider, filters){
  const started=Date.now();
  const results=await provider.search("",filters);
  return {
    provider,
    elapsedMs:Date.now()-started,
    results:(results||[]).map(x=>({
      ...x,
      discoveryProvider:provider.id,
      discoveryProviderLabel:x.discoveryProviderLabel || provider.label,
      verificationMethod:x.verificationMethod || "direct_source",
    })),
  };
}

async function aggregateSearch(providers,filters){
  const settled=await Promise.allSettled(providers.map(provider=>callProvider(provider,filters)));
  const raw=[]; const stats=[]; const errors=[];
  settled.forEach((result,i)=>{
    const provider=providers[i];
    if(result.status==="fulfilled") {
      stats.push({id:provider.id,label:provider.label,calls:1,results:result.value.results.length,errors:[]});
      raw.push(...result.value.results);
    } else {
      const message=result.reason?.message || "Source connector failed";
      stats.push({id:provider.id,label:provider.label,calls:1,results:0,errors:[message]});
      errors.push({provider:provider.id,label:provider.label,message});
    }
  });
  return {raw,providerStats:stats,errors};
}

export async function runSearch(input={}) {
  const filters=validateFilters(input);
  const demo=Boolean(input.demo);
  if(demo) {
    if(String(process.env.ALLOW_DEMO_MODE||"true").toLowerCase()!=="true") throw Object.assign(new Error("Demo mode is disabled."),{code:"DEMO_DISABLED"});
    const items=demoListings(filters);
    return {items,meta:{provider:"Demo dataset",providers:[{id:"demo",label:"Demo dataset",calls:1,results:items.length,errors:[]}],rawResults:items.length,demo:true,persisted:false,partial:false,connectedSourceCount:directSourceStatuses().length},filters};
  }

  const providers=configuredProviders();
  const connectedSources=directSourceStatuses();
  if(!providers.length || !connectedSources.length) {
    throw Object.assign(new Error("No rental sources are connected yet. Add a permitted public feed or approved rental source page; no search-engine credentials are required."),{code:"SEARCH_NOT_CONFIGURED"});
  }

  const discovery=await aggregateSearch(providers,filters);
  if(!discovery.raw.length && discovery.errors.length) {
    const err=Object.assign(new Error("The connected rental sources could not be refreshed right now."),{code:"SEARCH_ALL_PROVIDERS_FAILED"});
    err.providerErrors=discovery.errors; throw err;
  }

  const normalized=discovery.raw.map(r=>normalizeSearchResult(r,filters)).filter(Boolean);
  const items=dedupeListings(normalized).sort((a,b)=>(b.score??0)-(a.score??0));
  let persistence={enabled:false,saved:0};
  try{ persistence=await saveListings(items); }catch(err){ console.error("Persistence failed:",err.message); }

  return {
    items,
    meta:{
      provider:`${connectedSources.length} connected rental source${connectedSources.length===1?"":"s"}`,
      providers:discovery.providerStats,
      connectedSources,
      connectedSourceCount:connectedSources.length,
      rawResults:discovery.raw.length,
      partial:discovery.errors.length>0 && discovery.raw.length>0,
      providerErrors:discovery.errors,
      persisted:persistence.enabled,
      saved:persistence.saved,
    },
    filters,
  };
}
