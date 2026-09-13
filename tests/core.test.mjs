import test from "node:test";
import assert from "node:assert/strict";
import {
  extractRent,extractBedrooms,extractFloorArea,extractPostcode,classifyStudent,classifyStale,
  normalizeSearchResult,dedupeListings,validateFilters,buildQuery,filterAndRankListings,listingMatchesFilters
} from "../lib/core.mjs";

test("extracts monthly rental details",()=>{const t="2 bedroom flat £950 pcm, total floor area 68 m2, Nottingham NG7 1AA";assert.equal(extractRent(t),950);assert.equal(extractBedrooms(t),2);assert.ok(extractFloorArea(t)>=730);assert.equal(extractPostcode(t),"NG7 1AA");});
test("converts weekly rent to pcm",()=>{assert.equal(extractRent("£200 pw"),867);});
test("recognises studios as zero bedrooms",()=>{assert.equal(extractBedrooms("Modern studio apartment to let"),0);});
test("student-only and stale text is detected",()=>{assert.equal(classifyStudent("Student house - academic year"),true);assert.equal(classifyStale("This property is now Let Agreed"),true);});
test("normalizer keeps incomplete candidates",()=>{const x=normalizeSearchResult({title:"2 bed flat to rent NG3",snippet:"£900 pcm professional let",url:"https://agent.example/a",verificationMethod:"direct_property_detail"},{excludeStudents:true});assert.ok(x);assert.equal(x.verified,true);assert.equal(x.availabilityStatus,"ACTIVE");});
test("normalizer rejects known student failures",()=>{const x=normalizeSearchResult({title:"2 bed student house",snippet:"£900 pcm students only NG7 1AA",url:"https://agent.example/a"},{excludeStudents:true});assert.equal(x,null);});
test("validation defaults to one to two bedrooms and flat preference",()=>{const f=validateFilters({});assert.equal(f.minBedrooms,1);assert.equal(f.maxBedrooms,2);assert.equal(f.preferredType,"flat");assert.equal(f.acceptHouses,true);});
test("legacy bedrooms input remains compatible",()=>{const f=validateFilters({bedrooms:2});assert.equal(f.minBedrooms,2);assert.equal(f.maxBedrooms,2);});
test("filters reject over-budget listings",()=>{const f=validateFilters({maxRent:1000,minBedrooms:1,maxBedrooms:2});const item=normalizeSearchResult({title:"2 bed flat",snippet:"£1100 pcm NG1 1AA",url:"https://a.test/p"},{});assert.equal(listingMatchesFilters(item,f),false);});
test("preferred area and type improve ranking",()=>{const now=new Date().toISOString();const a=normalizeSearchResult({title:"2 bed apartment West Bridgford",snippet:"£950 pcm NG2 1AA",url:"https://a.test/1",lastCheckedAt:now},{});const b=normalizeSearchResult({title:"2 bed house generic Nottingham",snippet:"£950 pcm NG6 1AA",url:"https://a.test/2",lastCheckedAt:now},{});const r=filterAndRankListings([b,a],{minBedrooms:1,maxBedrooms:2,maxRent:1000,preferredType:"flat",acceptHouses:true,preferredAreas:["West Bridgford"]});assert.equal(r[0].sourceUrl,"https://a.test/1");assert.match(r[0].reasons.join(" "),/Area fit/);});
test("dedupe removes tracking URL duplicates",()=>{const a={sourceUrl:"https://x.test/a?utm_source=x",title:"A",score:1},b={sourceUrl:"https://x.test/a",title:"A",score:2};const d=dedupeListings([a,b]);assert.equal(d.length,1);assert.equal(d[0].score,2);});
test("query reflects preference range",()=>{const q=buildQuery({location:"Nottingham",minBedrooms:1,maxBedrooms:2,maxRent:1000,excludeStudents:true,preferredType:"flat"});assert.match(q,/1-2 bedrooms/);assert.match(q,/Nottingham/);assert.match(q,/£1000/);assert.match(q,/-student/);});
