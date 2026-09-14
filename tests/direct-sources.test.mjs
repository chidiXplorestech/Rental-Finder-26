import test from "node:test";
import assert from "node:assert/strict";
import { runSearch, refreshInventory, providerInfo } from "../lib/search-service.mjs";
import { clearMemoryStoreForTests } from "../lib/storage.mjs";

const originalFetch=global.fetch;
const originalEnv={...process.env};
function restore(){global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];for(const [k,v] of Object.entries(originalEnv))process.env[k]=v;clearMemoryStoreForTests();}
function envOnlyFeeds(urls){process.env.DISABLE_BUILTIN_SOURCES="true";process.env.PUBLIC_FEED_URLS=urls;delete process.env.DIRECT_SOURCE_URLS;delete process.env.DIRECT_SOURCE_ALLOWED_HOSTS;clearMemoryStoreForTests();}

test("provider info reports configured independent sources, not working claims",{concurrency:false},()=>{
  envOnlyFeeds("https://feed.example/listings.json,https://other.example/to-let.rss");
  const info=providerInfo();assert.equal(info.connectedSourceCount,2);assert.equal(info.label,"2 independent rental sources configured");restore();
});

test("JSON feeds build a tracked inventory and deduplicate",{concurrency:false},async()=>{
  envOnlyFeeds("https://feed-one.example/listings.json,https://feed-two.example/listings.json");
  global.fetch=async url=>{
    const u=String(url);
    if(u.includes("feed-one"))return new Response(JSON.stringify({listings:[{title:"2 bedroom flat Nottingham NG7 1AA",url:"https://agent.example/property/123?utm_source=feed",description:"£950 pcm. 690 sqft. Available now."}]}),{status:200,headers:{"content-type":"application/json"}});
    if(u.includes("feed-two"))return new Response(JSON.stringify({listings:[{title:"2 bedroom flat Nottingham NG7 1AA",url:"https://agent.example/property/123",description:"£950 pcm. 690 sqft."},{title:"1 bedroom apartment Beeston NG9 2AA",url:"https://another.example/property/55",description:"£825 pcm. Professional let."}]}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error(`Unexpected fetch ${u}`);
  };
  try{const result=await runSearch({location:"Nottingham",minBedrooms:1,maxBedrooms:2,maxRent:1000,preferredType:"flat",acceptHouses:true});assert.equal(result.items.length,2);assert.equal(result.meta.workingSourceCount,2);assert.equal(result.meta.configuredSourceCount,2);const dupe=result.items.find(x=>x.sourceUrl.includes("property/123"));assert.ok(dupe);assert.deepEqual(new Set(dupe.discoveryProviders),new Set(["feed-one.example","feed-two.example"]));}finally{restore();}
});

test("approved HTML source follows property detail pages",{concurrency:false},async()=>{
  process.env.DISABLE_BUILTIN_SOURCES="true";delete process.env.PUBLIC_FEED_URLS;process.env.DIRECT_SOURCE_URLS="https://agent.example/to-rent";process.env.DIRECT_SOURCE_ALLOWED_HOSTS="agent.example";clearMemoryStoreForTests();
  global.fetch=async url=>{
    const u=String(url);
    if(u==="https://agent.example/to-rent")return new Response('<a href="/property/abc">View 2 bedroom apartment</a>',{status:200,headers:{"content-type":"text/html"}});
    if(u==="https://agent.example/property/abc")return new Response('<html><head><meta property="og:title" content="2 bedroom apartment Nottingham NG1 2AA"></head><body><h1>2 bedroom apartment</h1><p>£975 pcm. 650 sq ft. Available now. Professional tenants welcome. Nottingham NG1 2AA.</p></body></html>',{status:200,headers:{"content-type":"text/html"}});
    throw new Error(`Unexpected ${u}`);
  };
  try{const result=await runSearch({minBedrooms:1,maxBedrooms:2,maxRent:1000,preferredType:"flat"});assert.equal(result.items.length,1);assert.equal(result.items[0].rentPcm,975);assert.equal(result.items[0].floorAreaSqft,650);assert.equal(result.items[0].availabilityStatus,"ACTIVE");assert.equal(result.meta.sourceStatuses[0].status,"working");assert.equal(result.meta.sourceStatuses[0].detailPagesChecked,1);}finally{restore();}
});

test("blocked sources are visible as blocked, not silently counted working",{concurrency:false},async()=>{
  process.env.DISABLE_BUILTIN_SOURCES="true";delete process.env.PUBLIC_FEED_URLS;process.env.DIRECT_SOURCE_URLS="https://agent.example/to-rent";process.env.DIRECT_SOURCE_ALLOWED_HOSTS="agent.example";clearMemoryStoreForTests();
  global.fetch=async()=>new Response("blocked",{status:403});
  try{const refreshed=await refreshInventory();assert.equal(refreshed.snapshot.workingSourceCount,0);assert.equal(refreshed.snapshot.sourceStatuses[0].status,"blocked");}finally{restore();}
});

test("listing history marks first sighting new and later sightings existing",{concurrency:false},async()=>{
  envOnlyFeeds("https://feed.example/listings.json");
  global.fetch=async()=>new Response(JSON.stringify({listings:[{id:"a",title:"1 bedroom flat Nottingham NG1 1AA",url:"https://agent.example/a",description:"£850 pcm"}]}),{status:200,headers:{"content-type":"application/json"}});
  try{const first=await refreshInventory();assert.equal(first.snapshot.items[0].isNew,true);assert.equal(first.snapshot.items[0].timesSeen,1);const second=await refreshInventory();assert.equal(second.snapshot.items[0].isNew,false);assert.equal(second.snapshot.items[0].timesSeen,2);assert.equal(second.snapshot.items[0].firstSeenAt,first.snapshot.items[0].firstSeenAt);}finally{restore();}
});
