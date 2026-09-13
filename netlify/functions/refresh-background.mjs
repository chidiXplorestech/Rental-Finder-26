import { runSearch } from "../../lib/search-service.mjs";
export default async () => {
  const fallback={location:"Nottingham",bedrooms:2,maxRent:1000,minSqft:600,radius:8,propertyType:"any",maxAgeDays:7,excludeStudents:true,priorityDistricts:["NG1","NG2","NG3","NG5","NG7","NG9"]};
  let query=fallback; if(process.env.DEFAULT_REFRESH_SEARCH_JSON){ try{ query={...fallback,...JSON.parse(process.env.DEFAULT_REFRESH_SEARCH_JSON)}; }catch{} }
  try { const result=await runSearch(query); console.log(`Background refresh: ${result.items.length} listings, provider=${result.meta.provider}`); }
  catch(err){ console.error("Background refresh failed:",err.message); }
};
export const config={background:true,path:"/.netlify/functions/refresh-background"};
