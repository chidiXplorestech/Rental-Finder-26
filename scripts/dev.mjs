import http from "node:http"; import { readFile } from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
import healthHandler from "../netlify/functions/health.mjs"; import searchHandler from "../netlify/functions/search.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."); const port=Number(process.env.PORT||4173);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml"};
function toRequest(req,body){ return new Request(`http://localhost:${port}${req.url}`,{method:req.method,headers:req.headers,body:["GET","HEAD"].includes(req.method)?undefined:body}); }
async function sendResponse(res,response){ res.writeHead(response.status,Object.fromEntries(response.headers.entries())); res.end(Buffer.from(await response.arrayBuffer())); }
const server=http.createServer(async(req,res)=>{
  try{
    let body=""; for await(const c of req) body+=c;
    if(req.url.startsWith("/.netlify/functions/health")) return sendResponse(res,await healthHandler(toRequest(req,body),{ip:req.socket.remoteAddress,site:{url:`http://localhost:${port}`}}));
    if(req.url.startsWith("/.netlify/functions/search")) return sendResponse(res,await searchHandler(toRequest(req,body),{ip:req.socket.remoteAddress,site:{url:`http://localhost:${port}`}}));
    const clean=req.url.split("?")[0]; let file=clean==="/"?"index.html":clean.replace(/^\//,""); if(file.startsWith("assets/")) file=file.replace(/^assets\//,"");
    const source=file==="index.html"?path.join(root,"app/index.html"):file==="styles.css"?path.join(root,"app/styles.css"):file==="app.js"?path.join(root,"app/app.js"):path.join(root,"app",file);
    const data=await readFile(source); res.writeHead(200,{"Content-Type":types[path.extname(source)]||"application/octet-stream"}); res.end(data);
  }catch{ try{ const data=await readFile(path.join(root,"app/index.html")); res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}); res.end(data);}catch{res.writeHead(404);res.end("Not found");} }
});
server.listen(port,"127.0.0.1",()=>console.log(`Rental Finder 26 local preview: http://127.0.0.1:${port}`));
