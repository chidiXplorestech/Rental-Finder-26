import { providerInfo } from "../../lib/search-service.mjs";
import { storageConfigured } from "../../lib/storage.mjs";
export default async () => {
  const info=providerInfo();
  return Response.json({
    status:"ok",
    sourceMode:"direct",
    connectedSources:info.connectedSources,
    connectedSourceCount:info.connectedSourceCount,
    sourcesConfigured:info.configuredAny,
    providerLabel:info.label,
    storageConfigured:storageConfigured(),
    demoAllowed:String(process.env.ALLOW_DEMO_MODE||"true").toLowerCase()==="true"
  },{headers:{"Cache-Control":"no-store"}});
};
export const config={path:"/.netlify/functions/health"};
