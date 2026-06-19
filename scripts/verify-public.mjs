import fs from "node:fs";
import path from "node:path";

const publicDir = "public";
const statistics = JSON.parse(fs.readFileSync(path.join(publicDir, "data/statistics.json"), "utf8"));
const geo = JSON.parse(fs.readFileSync(path.join(publicDir, "data/regions.geojson"), "utf8"));
const regionNames = Object.keys(statistics.regions);

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const sourceFiles = walk(publicDir).filter((file) => /\.(csv|tsv)$/i.test(file));
if (sourceFiles.length) throw new Error(`Source files found in public/: ${sourceFiles.join(", ")}`);
if (regionNames.length !== 228) throw new Error(`Expected 228 regions, got ${regionNames.length}`);
if (statistics.meta.rankCount !== 50) throw new Error(`Expected 50 source ranks, got ${statistics.meta.rankCount}`);

for (const [region, record] of Object.entries(statistics.regions)) {
  for (const scenario of statistics.meta.scenarios) {
    const series = record.series[scenario];
    if (!series || series.length !== 80) throw new Error(`${region} ${scenario}: expected 80 years`);
    if (series.some((row) => row.length !== 4)) throw new Error(`${region} ${scenario}: unexpected public measure`);
  }
}

const mappedRegions = new Set(geo.features.map((feature) => feature.properties.region));
const missing = regionNames.filter((region) => !mappedRegions.has(region));
const extra = [...mappedRegions].filter((region) => !statistics.regions[region]);
if (missing.length || extra.length) throw new Error(`Map mismatch. Missing: ${missing}; extra: ${extra}`);

console.log(JSON.stringify({
  regions: regionNames.length,
  scenarios: statistics.meta.scenarios.length,
  yearsPerScenario: 80,
  mapFeatures: geo.features.length,
  mappedRegions: mappedRegions.size,
  publicSourceFiles: sourceFiles.length,
}, null, 2));
