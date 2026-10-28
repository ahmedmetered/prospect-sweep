#!/usr/bin/env node
// plan-queries.mjs — build the query list for a locality sweep: every search-kind
// ("clinica veterinaria", "pensione animali") crossed with every place ("Torino", "Moncalieri"
// Giovanni", ...). Per-municipality sweeps beat one giant-city query because Google
// truncates deep results per query; 40-60 small queries cover a metro area better
// than one query at depth 20.
//
// Usage:
//   node scripts/plan-queries.mjs --kinds "clinica veterinaria,pensione animali" \
//        --places "Torino,Moncalieri,Rivoli" [--lang it] [--out queries.txt]
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const kinds = (opt("kinds", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const places = (opt("places", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const out = opt("out", "queries.txt");
if (!kinds.length || !places.length) {
  console.error("Usage: node scripts/plan-queries.mjs --kinds \"a,b\" --places \"City1,City2\" [--out queries.txt]");
  process.exit(2);
}
const queries = [];
for (const p of places) {
  for (const k of kinds) queries.push(`${k} ${p}`);
}
writeFileSync(out, queries.join("\n") + "\n", "utf8");
console.log(`${queries.length} queries (${kinds.length} kinds x ${places.length} places) -> ${out}`);
console.log("Tip: start with the main city at depth 1-3 as a validation crawl before the full sweep.");
