import { providerInfo } from "../../lib/search-service.mjs";
import { loadSnapshot, snapshotAgeMinutes, storageMode } from "../../lib/storage.mjs";
import { envValue } from "../../lib/env.mjs";

export default async () => {
  const info=providerInfo();
  const snapshot=await loadSnapshot();
  const ageMinutes=await snapshotAgeMinutes();
  return Response.json({
    status:"ok",sourceMode:"tracked-inventory",
    configuredSources:info.connectedSources,
    configuredSourceCount:info.connectedSourceCount,
    workingSourceCount:snapshot?.workingSourceCount||0,
    sourceStatuses:snapshot?.sourceStatuses||[],
    sourcesConfigured:info.configuredAny,
    providerLabel:info.label,
    inventoryCount:snapshot?.items?.length||0,
    inventoryRefreshedAt:snapshot?.refreshedAt||null,
    inventoryAgeMinutes:ageMinutes,
    storageMode:storageMode(),
    demoAllowed:String(envValue("ALLOW_DEMO_MODE","true")).toLowerCase()==="true"
  },{headers:{"Cache-Control":"no-store"}});
};
export const config={path:"/.netlify/functions/health"};
