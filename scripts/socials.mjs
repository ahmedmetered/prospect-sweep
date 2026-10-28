#!/usr/bin/env node
// socials.mjs — fetch each prospect's homepage and extract social profile links
// (Instagram, Facebook, LinkedIn, YouTube, TikTok, X). Finds what's linked on their
// own site, which beats guessing handles from search results.
//
// Usage: node scripts/socials.mjs https://site1 https://site2 ... > socials.json
// One request per site, no recursion, 10s timeout — polite by construction.
import { readFileSync } from "node:fs";

const urls = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!urls.length) {
  console.error("Usage: node scripts/socials.mjs https://site1 https://site2 ... > socials.json");
  process.exit(2);
}
const PATTERNS = [
  ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/g],
  ["facebook", /https?:\/\/(?:www\.|it-it\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/g],
  ["linkedin", /https?:\/\/(?:[a-z]{2}-?[a-z]{2}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_.\-%/]+/g],
  ["youtube", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_.\-/]+/g],
  ["tiktok", /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-]+/g],
  ["x", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/g],
];

const out = {};
for (const url of urls) {
  const found = {};
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "user-agent": "Mozilla/5.0 (compatible; prospect-sweep/0.1)" } });
    if (res.ok) {
      const html = await res.text();
      for (const [name, re] of PATTERNS) {
        const hits = [...new Set((html.match(re) || []).map((s) => s.replace(/&amp;/g, "&").replace(/[)'".,]+$/, "")))].slice(0, 3);
        if (hits.length) found[name] = hits;
      }
    } else found.error = `HTTP ${res.status}`;
  } catch (e) {
    found.error = String(e.cause?.code || e.message).slice(0, 60);
  }
  out[url] = found;
  process.stderr.write(`${url}: ${Object.keys(found).filter((k) => k !== "error").length} networks${found.error ? ` (${found.error})` : ""}\n`);
}
console.log(JSON.stringify(out, null, 1));
