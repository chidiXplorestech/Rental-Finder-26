import { cp,mkdir,rm,writeFile,readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
const root=process.cwd(), src=path.join(root,"app"), out=path.join(root,"dist");
await rm(out,{recursive:true,force:true}); await mkdir(path.join(out,"assets"),{recursive:true});
await cp(path.join(src,"index.html"),path.join(out,"index.html")); await cp(path.join(src,"styles.css"),path.join(out,"assets/styles.css")); await cp(path.join(src,"app.js"),path.join(out,"assets/app.js"));
await writeFile(path.join(out,"_redirects"),"/* /index.html 200\n");
const html=await readFile(path.join(out,"index.html"),"utf8");
for(const required of ["/assets/styles.css","/assets/app.js","Rental Finder 26"]){ if(!html.includes(required)) throw new Error(`Build validation failed: ${required}`); }
for(const f of ["netlify/functions/search.mjs","netlify/functions/health.mjs","netlify/functions/refresh.mjs"]){ if(!existsSync(path.join(root,f))) throw new Error(`Missing ${f}`); }
console.log("Build complete: dist/ is ready for Netlify.");
