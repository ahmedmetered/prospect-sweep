#!/usr/bin/env node
// report.mjs — turn the ranked CSV (+ optional socials.json from socials.mjs) into a
// markdown prospect report: top-N table with socials merged in, per-city coverage,
// methodology notes. Run AFTER combine.mjs.
//
// Usage: node scripts/report.mjs prospects.csv [--socials socials.json] [--top 50] \
//          [--title "Torino — cliniche veterinarie"] > REPORT.md
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const csv = args.find((a) => a.endsWith(".csv") && !a.startsWith("--"));
if (!csv) {
  console.error("Usage: node scripts/report.mjs prospects.csv [--socials socials.json] [--top 50] [--title \"...\"]");
  process.exit(2);
}
const top = parseInt(opt("top", "50"), 10);
const title = opt("title", "Prospect report");
let socials = {};
try { socials = JSON.parse(readFileSync(opt("socials", "socials.json"), "utf8")); } catch {}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
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
const rows = parseCsv(readFileSync(csv, "utf8"));
const head = rows.shift();
const I = Object.fromEntries(head.map((h, i) => [h, i]));
const recs = rows.map((r) => ({ title: r[I.title], category: r[I.category], city: r[I.city], phone: r[I.phone], website: r[I.website], rating: r[I.rating], reviews: r[I.reviews] }));

const icon = { instagram: "IG", facebook: "FB", linkedin: "LI", youtube: "YT", tiktok: "TT", x: "X" };
const socialLinks = (site) => {
  const e = socials[site] || {};
  return Object.entries(e).filter(([k]) => icon[k]).map(([k, urls]) => `[${icon[k]}](${urls[0]})`).join(" · ");
};

const lines = [];
lines.push(`# ${title}`, "", `Generated: ${new Date().toISOString().slice(0, 10)} · ${recs.length} prospects (ranked: contactable first, then reviews)`, "");
lines.push(`| # | Business | Category | City | Rating | Reviews | Phone | Website | Socials |`, `|---|---|---|---|---|---|---|---|---|`);
recs.slice(0, top).forEach((r, i) => {
  lines.push(`| ${i + 1} | ${r.title} | ${r.category} | ${r.city} | ${r.rating || "-"} | ${r.reviews || 0} | ${r.phone || ""} | ${r.website ? `[site](${r.website})` : ""} | ${r.website ? socialLinks(r.website) : ""} |`);
});
lines.push("", "## Coverage by city", "");
const byCity = {};
for (const r of recs) byCity[r.city || "?"] = (byCity[r.city || "?"] || 0) + 1;
lines.push(Object.entries(byCity).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(" · "));
lines.push("", "## Notes", "", "- Google Maps snapshot, not exhaustive: Google truncates deep results per query; more/smaller queries extend coverage.", "- Categories are Google's labels; review the top rows for off-target entries before outreach.", "- Socials were collected from each business's own site (top rows only); empty cells mean not linked there, not nonexistent.", "- Phone/website empty = not captured by the crawl, not necessarily absent.", "");
console.log(lines.join("\n"));
