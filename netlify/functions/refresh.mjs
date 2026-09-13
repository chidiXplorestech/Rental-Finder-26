export default async (_req,context) => {
  const base=context?.site?.url || process.env.URL;
  if(!base){ console.log("Scheduled refresh skipped: site URL unavailable."); return; }
  const res=await fetch(`${base}/.netlify/functions/refresh-background`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  console.log(`Queued background refresh: ${res.status}`);
};
export const config={schedule:"*/15 * * * *"};
