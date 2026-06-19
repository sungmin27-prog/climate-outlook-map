import fs from "node:fs";
import readline from "node:readline";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/analyze-csv.mjs <csv-path>");
  process.exit(1);
}

const years = new Set();
const regions = new Set();
const scenarios = new Set();
const ranks = new Set();
let rows = 0;
let invalidRows = 0;
let minValue = Infinity;
let maxValue = -Infinity;

const stream = fs.createReadStream(input, { encoding: "utf8" });
const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

let first = true;
for await (const line of lines) {
  if (first) {
    first = false;
    continue;
  }
  if (!line.trim()) continue;

  const [yearRaw, region, rank, scenario, valueRaw] = line.split(",");
  const year = Number(yearRaw);
  const value = Number(valueRaw);
  if (!Number.isInteger(year) || !region || !rank || !scenario || !Number.isFinite(value)) {
    invalidRows += 1;
    continue;
  }

  rows += 1;
  years.add(year);
  regions.add(region);
  scenarios.add(scenario);
  ranks.add(rank);
  minValue = Math.min(minValue, value);
  maxValue = Math.max(maxValue, value);
}

const sortedYears = [...years].sort((a, b) => a - b);
const sortedRegions = [...regions].sort((a, b) => a.localeCompare(b, "ko"));

console.log(JSON.stringify({
  rows,
  invalidRows,
  yearRange: [sortedYears[0], sortedYears.at(-1)],
  yearCount: sortedYears.length,
  regionCount: sortedRegions.length,
  scenarios: [...scenarios].sort(),
  ranks: [...ranks].sort(),
  valueRange: [minValue, maxValue],
  regionSample: sortedRegions.slice(0, 20),
}, null, 2));
