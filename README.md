# Prospect Sweep

**"Every X in city Y and its hinterland" → a ranked, contactable prospect list. Markdown report + CSVs, from Google Maps, on your machine.**

You describe the vertical and the territory. Prospect Sweep plans per-municipality search queries, runs the open-source Google Maps scraper in Docker, dedupes by Google place ID, filters to your vertical (the step everyone skips — and the reason raw scrapes are full of IKEA), pulls the social profiles linked on each prospect's own site, and writes a report your outreach can start from today.

```
$ node scripts/plan-queries.mjs --kinds "clinica veterinaria,pensione animali" --places "Torino,Moncalieri,Rivoli,..."
48 queries (2 kinds x 24 places) -> queries.txt

$ node scripts/crawl.mjs --queries queries.txt --out out --depth 10 --lang it
87.1 min · 1517 rows · exited 0

$ node scripts/combine.mjs out/results.csv --keep "formazion|scuola|academy|corsi" --drop "commerciale|negozio" --out prospects
raw 1204 -> deduped 1204 -> kept 502 (phone 470/502 · website 455/502 · both 412)
by city: Torino 289, Moncalieri 44, Rivoli 39, Nichelino 33, ...

$ node scripts/report.mjs prospects.csv --socials socials.json --top 50 > REPORT.md
```

(Counts above are sample output from an example sweep.)

## Why per-municipality queries

Google truncates how deep one query's results go. A single "clinica veterinaria Torino" at high
depth still misses most of the metro; the same kinds crossed with 20-25 municipality
names recover it. Grid-searching a whole metro bounding box costs hundreds of search
cells for the same coverage. `plan-queries.mjs` encodes the winning shape.

## Why filter before ranking

At depth 10, ranking by review count surfaces shopping malls and chain stores that
happen to match a word in your query. The pipeline ranks *after* a category keep/drop
regex — the difference between a usable list and noise. Iterating the regex on an
already-crawled CSV costs seconds.

## What you get

- `prospects.csv` — the filtered, ranked list (contactable first, then by reviews)
- `prospects-all.csv` — every deduped business the crawl saw, for re-filtering later
- `socials.json` — Instagram/Facebook/LinkedIn/YouTube/TikTok/X per prospect, from their own sites
- `REPORT.md` — top-N table with socials merged, per-city coverage, honest caveats
- `skill/SKILL.md` — an agent skill that runs this whole pipeline for you (tested with ZCode; works with any assistant that can run shell commands)

## Requirements

Docker (daemon running) and Node 18+. No API keys, no paid data providers, no proxies
for modest sweeps. Crawl engine: [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) (MIT) — star it too.

## Quick start

```bash
git clone https://github.com/ahmedmetered/prospect-sweep.git
cd prospect-sweep
node scripts/plan-queries.mjs --kinds "dental clinic" --places "Torino,Moncalieri,Rivoli" --out queries.txt
node scripts/crawl.mjs --queries queries.txt --out out --depth 5 --lang it
node scripts/combine.mjs out/results.csv --keep "dentist|dental" --out prospects
node scripts/socials.mjs $(awk -F'","' 'NR>1{print}' prospects.csv | head -3 | grep -o 'https\?://[^"]*' | head -3) > socials.json
node scripts/report.mjs prospects.csv --socials socials.json --top 30 --title "Torino — dentisti" > REPORT.md
```

## Honest limits

A sweep is a snapshot, not a census: Google truncates per query, categories are
Google's labels (in the crawl language), and missing phone/website means the crawl
missed it, not that it doesn't exist. The report says all of this; keep it that way.
In the EU, prospect lists are personal data — you own what you do with the output.

## License

MIT. Crediting and building on gosom's scraper; the sweep method (query planning,
category-first filtering, cid-dedupe, socials, reporting) is this repo's.

## Works with

- [anydeals](https://github.com/ahmedmetered/anydeals) bundles this skill with anyoutreach into one lead-generation + approval-first outreach pipeline.
