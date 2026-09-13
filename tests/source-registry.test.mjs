import test from "node:test";
import assert from "node:assert/strict";
import { SOURCES } from "../config/sources.mjs";
import { directSources } from "../lib/providers/direct-sources.mjs";

test("Nottinghamshire source pack is populated and unique", () => {
  assert.ok(SOURCES.length >= 20, `expected >=20 sources, got ${SOURCES.length}`);
  const ids = new Set(SOURCES.map((s) => s.id));
  const urls = new Set(SOURCES.map((s) => s.url));
  assert.equal(ids.size, SOURCES.length);
  assert.equal(urls.size, SOURCES.length);
  assert.ok(SOURCES.every((s) => s.enabled && s.type === "page" && /^https:\/\//.test(s.url)));
});

test("Nottinghamshire source pack is exposed by the direct-source provider", () => {
  const sources = directSources();
  assert.ok(sources.length >= 20);
  assert.ok(sources.some((s) => s.id === "fhp-living"));
  assert.ok(sources.some((s) => s.id === "robert-ellis"));
  assert.ok(sources.some((s) => s.id === "belvoir-mansfield"));
  assert.ok(sources.some((s) => s.id === "whitegates-newark"));
  assert.ok(sources.some((s) => s.id === "leaders-nottinghamshire"));
});
