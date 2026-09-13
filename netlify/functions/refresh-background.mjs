import { refreshInventory } from "../../lib/search-service.mjs";

export default async () => {
  try {
    const result=await refreshInventory();
    console.log(`Background refresh: ${result.snapshot.items.length} tracked listings, ${result.snapshot.workingSourceCount}/${result.snapshot.configuredSourceCount} sources working.`);
  } catch(err) {
    console.error("Background refresh failed:",err?.message||err);
  }
};
export const config={background:true,path:"/.netlify/functions/refresh-background"};
