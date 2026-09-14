import test from "node:test";
import assert from "node:assert/strict";
import { SOURCES } from "../config/sources.mjs";
import { directSources } from "../lib/providers/direct-sources.mjs";

test("independent Nottinghamshire source pack is populated and unique",()=>{
  assert.ok(SOURCES.length>=10,`expected >=10 independent sources, got ${SOURCES.length}`);
  assert.equal(new Set(SOURCES.map(s=>s.id)).size,SOURCES.length);
  assert.equal(new Set(SOURCES.map(s=>s.url)).size,SOURCES.length);
  assert.ok(SOURCES.every(s=>s.enabled&&s.type==="page"&&/^https:\/\//.test(s.url)));
});
test("registry includes smaller local sources instead of branch-count inflation",()=>{
  const ids=new Set(directSources().map(s=>s.id));
  for(const id of ["fhp-living","robert-ellis","granger-oaks","city-lettings","truelove-lettings","wellington-lettings","places2nest"])assert.ok(ids.has(id),id);
  assert.equal([...ids].some(id=>id.startsWith("belvoir-")),false);
});
