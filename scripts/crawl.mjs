#!/usr/bin/env node
// crawl.mjs — run gosom/google-maps-scraper in Docker over the planned queries and
// wait for it to finish. Thin wrapper: resolves absolute host paths for the volume
// mounts (the #1 way this breaks on Git-Bash/Windows is paths the daemon can't see,
// e.g. /tmp), starts the container detached, polls until exit, prints the result count.
//
// Usage:
//   node scripts/crawl.mjs --queries queries.txt --out outdir [--depth 10] [--lang it]
//
// Requires: Docker running, ports reachable, no proxy needed for modest sweeps.
// The first run pulls the image (a few minutes); later runs reuse it.
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const queriesPath = resolve(opt("queries", "queries.txt"));
const outDir = resolve(opt("out", "crawl-out"));
const depth = opt("depth", "5");
const lang = opt("lang", "it");
const name = "prospect-sweep-crawl";

if (!existsSync(queriesPath)) {
  console.error(`queries file not found: ${queriesPath}`);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const docker = (...rest) => {
  const r = spawnSync("docker", rest, { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`docker ${rest[0]} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return r.stdout.trim();
};

// fresh container (refuse to kill a running crawl)
const state = docker("inspect", "-f", "{{.State.Running}}", name).catch?.(() => "");
try {
  if (state === "true") {
    console.error(`a crawl container named ${name} is already running; wait for it or remove it`);
    process.exit(1);
  }
  if (state !== "") spawnSync("docker", ["rm", name], { encoding: "utf8" });
} catch {
  /* container does not exist yet — fine */
}

console.log(`starting crawl: ${readFileSync(queriesPath, "utf8").split("\n").filter(Boolean).length} queries, depth ${depth}, lang ${lang}`);
docker(
  "run", "-d", "--name", name,
  "-v", "prospect-sweep-playwright:/opt",
  "-v", `${queriesPath}:/queries.txt:ro`,
  "-v", `${outDir}:/out`,
  "gosom/google-maps-scraper",
  "-input", "/queries.txt",
  "-results", "/out/results.csv",
  "-depth", depth,
  "-lang", lang,
  "-exit-on-inactivity", "3m",
);
console.log("container started; polling (dot = 30s)...");

const t0 = Date.now();
for (;;) {
  spawnSync("sleep", ["1"]); // no-op to yield; real wait below
  const s = spawnSync("docker", ["inspect", "-f", "{{.State.Running}} {{.State.ExitCode}}", name], { encoding: "utf8" }).stdout.trim();
  const [running, code] = s.split(" ");
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  let count = 0;
  try {
    count = readFileSync(`${outDir}/results.csv`, "utf8").split("\n").length - 1;
  } catch {}
  process.stdout.write(`\r${mins} min · ${count} rows · ${running === "true" ? "running" : `exited ${code}`}   `);
  if (running === "false") {
    console.log("");
    console.log(code === "0" ? `done: ${outDir}${basename("/")}${outDir}\\results.csv (${count} rows)` : `container exited with code ${code}; partial results kept`);
    process.exit(code === "0" ? 0 : 1);
  }
  spawnSync("sleep", ["29"]);
}
