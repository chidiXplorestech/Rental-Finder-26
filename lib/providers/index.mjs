import { directSourceSearch, directSources } from "./direct-sources.mjs";
const REGISTRY={direct_sources:{id:"direct_sources",label:"Independent Nottinghamshire agents",queryDriven:false,configured:()=>directSources().length>0,search:directSourceSearch}};
export function providerStatuses(){ return Object.values(REGISTRY).map(p=>({id:p.id,label:p.label,configured:p.configured(),queryDriven:p.queryDriven})); }
export function configuredProviders(){ return Object.values(REGISTRY).filter(p=>p.configured()); }
export function searchMode(){ return "tracked-inventory"; }
