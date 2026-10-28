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

# prospect-sweep

This file is the discovery entrypoint when the whole repository is cloned
into a skills folder. The canonical skill lives one level down.

**Read [skill/SKILL.md](skill/SKILL.md) and follow it.** Candidate or user
data never belongs in this repository.
