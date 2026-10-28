---
name: prospect-sweep
description: >
  Build a ranked, deduplicated prospect list for a vertical in a metro area: plan
  per-municipality Google Maps queries, run the gosom scraper in Docker, filter by
  category BEFORE ranking, enrich socials from prospects' own sites, and write a
  markdown + CSV report. Use for requests like "find all dentists in Turin", "build
  a lead list for dentists in Turin and hinterland", "scrape prospects for
  this vertical". Requires Docker and Node 18+.
license: MIT
compatibility: Docker daemon running, Node 18+. Works on Windows (Git Bash) and Unix.
metadata:
  author: user
  origin: Method proven on a real four-digit metropolitan sweep; scripts in this repo.
---

# Prospect sweep — vertical lead lists from Google Maps

Turn "every X in city Y and its hinterland" into a ranked, contactable prospect list
(markdown report + CSVs). Five steps, four scripts, one honest output.

## Workflow

1. **Plan queries.** Cross search-kinds with places. Per-municipality sweeps beat one
   big-city query at high depth: Google truncates results per query, so 40-60 small
   queries cover a metro area far better. Do NOT grid-search a whole metro bbox unless
   the user insists (hundreds of cells for the same coverage).
   `node scripts/plan-queries.mjs --kinds "clinica veterinaria,pensione animali" --places "Torino,Moncalieri,Rivoli,..."`
   Validate first: 1-2 queries at depth 1 before committing to the full run.
2. **Crawl.** `node scripts/crawl.mjs --queries queries.txt --out out --depth 8-10 --lang <prospect language>`.
   Depth 5-10 is the useful band; depth 1 finds only the top listings. First run pulls
   the Docker image. Monitor the printed row count; a full metro sweep takes 30-90 min.
3. **Combine and filter.** THE CRITICAL STEP: filter by category BEFORE ranking.
   `node scripts/combine.mjs out/results.csv --keep "formazion|scuola|academy|corsi" --drop "centro commerciale|negozio|ristorante" --out prospects`
   Without the filter, raw review-count ranking surfaces IKEA and supermarkets.
   Iterating on keep/drop is cheap: rerun on the same CSV until the stats look right.
4. **Enrich socials** for the top 20-50 (their own sites link their real profiles):
   `node scripts/socials.mjs $(top websites) > socials.json` — or fetch them yourself in
   batches of 3 (many agents have a 3-parallel fetch limit).
5. **Report.** `node scripts/report.mjs prospects.csv --socials socials.json --top 50 --title "..." > REPORT.md`

## Gotchas (all paid-for)

- Docker Desktop on Git Bash: volume mounts need real Windows host paths. The scripts
  resolve paths themselves — but if you wrap them in bash, `MSYS_NO_PATHCONV=1` and
  avoid `/tmp` (invisible to the daemon; mounts become bogus directories and the
  container dies with "read /queries.txt: is a directory").
- Never kill a running crawl container to start another; wait or use a different name.
- Missing phone/website = crawl miss, not business fact. Say so in the report.
- Category labels are Google's, in the crawl language — write keep/drop regexes in
  that language.
- The output is a snapshot with coverage gaps by construction; "not exhaustive"
  belongs in every report you hand over.

## Ethics and limits

One crawl per target market, modest depth, no proxy fleets. The list is for genuine
B2B outreach by the user; prospecting data still personal data in the EU — the user
owns lawful-use compliance for what they do with the output.

## Credits

Crawl engine: [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper)
(MIT) run in Docker. This repo adds the sweep method (query planning, category-first
filtering, dedupe, socials, reporting).
