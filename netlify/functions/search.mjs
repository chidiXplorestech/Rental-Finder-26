import { runSearch } from "../../lib/search-service.mjs";
const hits=new Map();
function rateLimited(ip){ const now=Date.now(), bucket=hits.get(ip)||[]; const recent=bucket.filter(t=>now-t<60000); recent.push(now); hits.set(ip,recent); return recent.length>12; }
export default async (req,context) => {
  if(req.method!=="POST") return Response.json({message:"Use POST."},{status:405});
  const ip=context?.ip || req.headers.get("x-forwarded-for") || "local"; if(rateLimited(ip)) return Response.json({message:"Too many searches. Please wait a minute.",code:"RATE_LIMIT"},{status:429});
  try {
    const input=await req.json(); const result=await runSearch(input); return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch(err) {
    const code=err.code||"SEARCH_ERROR"; const status=code==="SEARCH_NOT_CONFIGURED"?503:code==="DEMO_DISABLED"?403:code==="SEARCH_ALL_PROVIDERS_FAILED"?502:500;
    return Response.json({message:err.message||"Search failed.",code,providerErrors:err.providerErrors||[]},{status});
  }
};
export const config={path:"/.netlify/functions/search"};
