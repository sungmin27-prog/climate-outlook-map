import fs from "node:fs";

const sourcePath = process.argv[2] ?? "sources/korea-municipalities.json";
const statisticsPath = process.argv[3] ?? "public/data/statistics.json";
const outputPath = process.argv[4] ?? "public/data/regions.geojson";

const geo = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const statistics = JSON.parse(fs.readFileSync(statisticsPath, "utf8"));
const validRegions = new Set(Object.keys(statistics.regions));

const provinces = {
  11: "서울특별시",
  21: "부산광역시",
  22: "대구광역시",
  23: "인천광역시",
  24: "광주광역시",
  25: "대전광역시",
  26: "울산광역시",
  29: "세종특별자치시",
  31: "경기도",
  32: "강원특별자치도",
  33: "충청북도",
  34: "충청남도",
  35: "전라북도",
  36: "전라남도",
  37: "경상북도",
  38: "경상남도",
  39: "제주특별자치도",
};

const resolveRegion = (feature) => {
  const { code, name } = feature.properties;
  if (code === "37310") return "대구광역시 군위군";
  if (code === "23030") return "인천광역시 미추홀구";

  const province = provinces[code.slice(0, 2)];
  const direct = `${province} ${name}`;
  if (validRegions.has(direct)) return direct;

  const parentCity = name.match(/^(.+?시).+구$/)?.[1];
  if (parentCity) {
    const parent = `${province} ${parentCity}`;
    if (validRegions.has(parent)) return parent;
  }

  if (name === "청원군" && validRegions.has("충청북도 청주시")) {
    return "충청북도 청주시";
  }
  return null;
};

const features = geo.features
  .map((feature) => {
    const region = resolveRegion(feature);
    if (!region) return null;
    return {
      type: "Feature",
      properties: { region, hasData: validRegions.has(region) },
      geometry: feature.geometry,
    };
  })
  .filter(Boolean);

const covered = new Set(
  features.filter((feature) => feature.properties.hasData).map((feature) => feature.properties.region),
);
const missing = [...validRegions].filter((region) => !covered.has(region));
if (missing.length) {
  throw new Error(`Regions without geometry: ${missing.join(", ")}`);
}

fs.writeFileSync(outputPath, JSON.stringify({ type: "FeatureCollection", features }));
console.log(JSON.stringify({
  outputPath,
  features: features.length,
  coveredRegions: covered.size,
  noDataRegions: [...new Set(
    features.filter((feature) => !feature.properties.hasData).map((feature) => feature.properties.region),
  )],
}, null, 2));
