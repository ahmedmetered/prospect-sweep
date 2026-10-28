#!/usr/bin/env node
// combine.mjs — dedupe raw crawl CSVs, filter to the target vertical, rank, and write
// the working CSVs. The two rules that make output usable:
//   1. Dedupe by Google place cid (falls back to place_id, then name+phone), merging
//      the richest row across overlapping crawls.
//   2. FILTER BY CATEGORY BEFORE RANKING. At depth 10 a raw review-count ranking
//      surfaces IKEA and supermarkets; keep only rows matching your vertical first.
//
// Usage:
//   node scripts/combine.mjs raw1.csv raw2.csv --keep "formazion|scuola|academy" \
//        [--drop "centro commerciale|negozio"] [--out prospects] [--top 60]
// Writes: <out>.csv (kept, ranked), <out>-all.csv (deduped, unfiltered), prints stats.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const inputs = args.filter((a) => !a.startsWith("--") && a.endsWith(".csv"));
const keep = opt("keep", "");
const drop = opt("drop", "");
const outPrefix = opt("out", "prospects");
if (!inputs.length) {
  console.error("Usage: node scripts/combine.mjs raw.csv [raw2.csv ...] --keep \"regex\" [--drop \"regex\"] [--out prefix]");
  process.exit(2);
}

// robust CSV parsing (quoted fields, doubled quotes, CRLF)
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function load(path) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const head = rows.shift();
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  return rows.filter((r) => r.length > 10).map((r) => ({
    cid: (r[idx.cid] || "").trim(),
    placeId: (r[idx.place_id] || "").trim(),
    title: (r[idx.title] || "").trim(),
    category: (r[idx.category] || "").trim(),
    address: (r[idx.address] || "").trim(),
    website: (r[idx.website] || "").trim(),
    phone: (r[idx.phone] || "").trim(),
    reviews: parseInt(r[idx.review_count] || "0", 10) || 0,
    rating: parseFloat(r[idx.review_rating] || "0") || 0,
    city: (() => { try { return JSON.parse(r[idx.complete_address] || "{}").city || ""; } catch { return ""; } })(),
  }));
}

const all = inputs.flatMap(load);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const seen = new Map();
for (const r of all) {
  const key = r.cid || r.placeId || `${norm(r.title)}|${norm(r.phone)}`;
  const prev = seen.get(key);
  if (!prev) seen.set(key, r);
  else {
    for (const k of ["website", "phone", "address", "category", "city"]) if (!prev[k] && r[k]) prev[k] = r[k];
    if (r.reviews > prev.reviews) { prev.reviews = r.reviews; prev.rating = r.rating; }
  }
}
const deduped = [...seen.values()];

const KEEP = keep ? new RegExp(keep, "i") : null;
const DROP = drop ? new RegExp(drop, "i") : null;
const kept = deduped.filter((r) => {
  const hay = `${r.category} ${r.title}`;
  if (KEEP && !KEEP.test(hay)) return false;
  if (DROP && DROP.test(r.category)) return false;
  return true;
});

const score = (r) => (r.phone ? 2 : 0) + (r.website ? 1 : 0);
kept.sort((a, b) => score(b) - score(a) || b.reviews - a.reviews);

const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csvOf = (rows) => ["title,category,city,address,phone,website,rating,reviews,cid", ...rows.map((r) => [r.title, r.category, r.city, r.address, r.phone, r.website, r.rating, r.reviews, r.cid].map(esc).join(","))].join("\n");
writeFileSync(`${outPrefix}-all.csv`, csvOf(deduped), "utf8");
writeFileSync(`${outPrefix}.csv`, csvOf(kept), "utf8");

const byCity = {};
for (const r of kept) byCity[r.city || "?"] = (byCity[r.city || "?"] || 0) + 1;
console.log(`raw ${all.length} -> deduped ${deduped.length} -> kept ${kept.length} (keep: ${keep || "-"}${drop ? ` drop: ${drop}` : ""})`);
console.log(`phone ${kept.filter((r) => r.phone).length}/${kept.length} · website ${kept.filter((r) => r.website).length}/${kept.length} · both ${kept.filter((r) => r.phone && r.website).length}`);
console.log(`by city: ${Object.entries(byCity).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")}`);
console.log(`wrote ${outPrefix}.csv, ${outPrefix}-all.csv`);
