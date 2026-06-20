import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const defaultInput = "/content/drive/MyDrive/Colab Notebooks/호우재해 물리적 리스크 평가(논문)/전체시나리오_통합_전망데이터.csv";
const input = process.argv[2] ?? defaultInput;
const output = process.argv[3] ?? "public/data/statistics.json";

const buckets = new Map();
const source = readline.createInterface({
  input: fs.createReadStream(input, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let first = true;
for await (const line of source) {
  if (first) {
    first = false;
    continue;
  }
  if (!line.trim()) continue;

  const [yearRaw, region, , scenario, valueRaw] = line.split(",");
  const year = Number(yearRaw);
  const sourceValue = Number(valueRaw);
  if (!Number.isInteger(year) || !region || !scenario || !Number.isFinite(sourceValue)) continue;
  const value = sourceValue / 10_000;

  const key = `${region}\u001f${scenario}\u001f${year}`;
  const values = buckets.get(key);
  if (values) values.push(value);
  else buckets.set(key, [value]);
}

const quantile = (sorted, p) => {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const fraction = index - lower;
  const upper = sorted[lower + 1];
  return upper === undefined ? sorted[lower] : sorted[lower] + fraction * (upper - sorted[lower]);
};

const round = (value) => Math.round(value * 10) / 10;
const regions = {};
let rankCount = null;

for (const [key, values] of buckets) {
  values.sort((a, b) => a - b);
  rankCount ??= values.length;
  if (values.length !== rankCount) {
    throw new Error(`Unexpected Rank count for ${key}: ${values.length}`);
  }

  const [region, scenario, yearRaw] = key.split("\u001f");
  const year = Number(yearRaw);
  const splitAt = region.indexOf(" ");
  const province = splitAt === -1 ? region : region.slice(0, splitAt);
  const locality = splitAt === -1 ? region : region.slice(splitAt + 1);
  const record = regions[region] ??= { province, locality, series: {} };
  const series = record.series[scenario] ??= [];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  series.push([year, round(mean), round(quantile(values, 0.1)), round(quantile(values, 0.9))]);
}

for (const record of Object.values(regions)) {
  for (const series of Object.values(record.series)) {
    series.sort((a, b) => a[0] - b[0]);
  }
}

const payload = {
  meta: {
    title: "기후변화 시나리오 지역별 전망 통계",
    generatedAt: new Date().toISOString(),
    years: [2021, 2100],
    scenarios: ["SSP126", "SSP245", "SSP370", "SSP585"],
    rankCount,
    sourceUnit: "천원",
    unit: "천만원",
    conversionDivisor: 10_000,
    measures: ["year", "mean", "p10", "p90"],
    disclosure: "개별 Rank 원자료를 제외한 지역·연도·시나리오별 요약 통계",
  },
  regions: Object.fromEntries(
    Object.entries(regions).sort(([a], [b]) => a.localeCompare(b, "ko")),
  ),
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(payload));
console.log(JSON.stringify({
  output,
  regions: Object.keys(regions).length,
  buckets: buckets.size,
  bytes: fs.statSync(output).size,
  rankCount,
}, null, 2));
