const SCENARIOS = ["SSP126", "SSP245", "SSP370", "SSP585"];
const PALETTE = ["#c9dfdc", "#7eb6aa", "#e9c568", "#e07a64", "#a63f52"];
const UNIT = "천만원";
const state = { scenario: "SSP245", year: 2050, region: "강원특별자치도 강릉시" };
let statistics;
let map;
let geoLayer;
let trendChart;
let comparisonChart;
let sortedMapValues = [];

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

const valueAt = (region, scenario, year) => {
  const series = statistics.regions[region]?.series[scenario];
  return series?.[year - 2021];
};

const colorFor = (value, sortedValues) => {
  if (!Number.isFinite(value)) return "#dfe5e3";
  const rank = sortedValues.findIndex((candidate) => candidate >= value);
  const percentile = (rank < 0 ? sortedValues.length - 1 : rank) / Math.max(1, sortedValues.length - 1);
  return PALETTE[Math.min(PALETTE.length - 1, Math.floor(percentile * PALETTE.length))];
};

const currentValues = () => Object.keys(statistics.regions)
  .map((region) => valueAt(region, state.scenario, state.year)?.[1])
  .filter(Number.isFinite)
  .sort((a, b) => a - b);

function initSelectors() {
  const provinces = [...new Set(Object.values(statistics.regions).map((item) => item.province))]
    .sort((a, b) => a.localeCompare(b, "ko"));
  $("provinceSelect").innerHTML = provinces.map((province) => `<option>${province}</option>`).join("");
  $("provinceSelect").value = statistics.regions[state.region].province;
  updateRegionOptions();

  $("provinceSelect").addEventListener("change", () => {
    updateRegionOptions();
    selectRegion($("regionSelect").value, true);
  });
  $("regionSelect").addEventListener("change", () => selectRegion($("regionSelect").value, true));
}

function updateRegionOptions() {
  const province = $("provinceSelect").value;
  const regions = Object.entries(statistics.regions)
    .filter(([, item]) => item.province === province)
    .sort(([, a], [, b]) => a.locality.localeCompare(b.locality, "ko"));
  $("regionSelect").innerHTML = regions.map(([name, item]) => `<option value="${name}">${item.locality}</option>`).join("");
  if (regions.some(([name]) => name === state.region)) $("regionSelect").value = state.region;
}

function initScenarioTabs() {
  $("scenarioTabs").innerHTML = SCENARIOS.map((scenario) =>
    `<button type="button" data-scenario="${scenario}" class="${scenario === state.scenario ? "active" : ""}">${scenario}</button>`
  ).join("");
  $("scenarioTabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scenario]");
    if (!button) return;
    state.scenario = button.dataset.scenario;
    document.querySelectorAll("#scenarioTabs button").forEach((item) => item.classList.toggle("active", item === button));
    refresh();
  });
}

function initMap(geojson) {
  map = L.map("map", { zoomControl: false, attributionControl: true, minZoom: 6, maxZoom: 11 });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution("행정경계: southkorea-maps (2013)");

  geoLayer = L.geoJSON(geojson, {
    renderer: L.canvas({ padding: 0.4 }),
    style: styleFeature,
    onEachFeature(feature, layer) {
      const region = feature.properties.region;
      const hasData = feature.properties.hasData !== false;
      layer.on({
        click: () => hasData && selectRegion(region, false),
        mouseover: () => layer.setStyle({ weight: 2, color: "#182127", fillOpacity: 0.92 }),
        mouseout: () => geoLayer.resetStyle(layer),
      });
      layer.bindTooltip(() => {
        if (!hasData) {
          return `<div class="map-tooltip"><strong>${region}</strong><span>원본 데이터 없음</span></div>`;
        }
        const point = valueAt(region, state.scenario, state.year);
        return `<div class="map-tooltip"><strong>${region}</strong><span>${state.year} · ${format.format(point?.[1] ?? 0)}${UNIT}</span></div>`;
      }, { sticky: true });
    },
  }).addTo(map);
  map.fitBounds(geoLayer.getBounds(), { padding: [18, 18] });
  $("resetMap").addEventListener("click", () => map.fitBounds(geoLayer.getBounds(), { padding: [18, 18] }));
}

function styleFeature(feature) {
  const region = feature.properties.region;
  if (feature.properties.hasData === false) {
    return { fillColor: "#c9cfcd", fillOpacity: 0.72, color: "#ffffff", weight: 0.7 };
  }
  const selected = region === state.region;
  return {
    fillColor: colorFor(valueAt(region, state.scenario, state.year)?.[1], sortedMapValues),
    fillOpacity: selected ? 1 : 0.82,
    color: selected ? "#182127" : "#ffffff",
    weight: selected ? 2.2 : 0.7,
  };
}

function selectRegion(region, zoom) {
  state.region = region;
  const record = statistics.regions[region];
  $("provinceSelect").value = record.province;
  updateRegionOptions();
  $("regionSelect").value = region;
  if (zoom) {
    const layers = [];
    geoLayer.eachLayer((layer) => {
      if (layer.feature.properties.region === region) layers.push(layer);
    });
    if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [52, 52], maxZoom: 9 });
  }
  refresh();
}

function updateStats() {
  const record = statistics.regions[state.region];
  const point = valueAt(state.region, state.scenario, state.year);
  const base = valueAt(state.region, state.scenario, 2021)?.[1];
  const change = base ? ((point[1] - base) / base) * 100 : 0;
  const values = currentValues();
  const rank = values.findIndex((value) => value >= point[1]);
  const percentile = Math.round(((rank < 0 ? values.length - 1 : rank) / Math.max(1, values.length - 1)) * 100);

  $("provinceName").textContent = record.province;
  $("regionName").textContent = record.locality;
  $("yearLabel").textContent = state.year;
  $("comparisonYear").textContent = state.year;
  $("meanValue").textContent = `${format.format(point[1])}${UNIT}`;
  $("rangeValue").textContent = `${format.format(point[2])}–${format.format(point[3])}${UNIT}`;
  $("changeValue").textContent = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  $("changeValue").style.color = change >= 0 ? "#c7554a" : "#087f72";
  $("percentileValue").textContent = `상위 ${Math.max(1, 100 - percentile)}%`;
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#182127",
        padding: 10,
        displayColors: false,
        callbacks: { label: (context) => `${context.dataset.label}: ${format.format(context.parsed.y)}${UNIT}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#748188", maxTicksLimit: 6, font: { size: 10 } }, border: { display: false } },
      y: { grid: { color: "#edf0ef" }, ticks: { color: "#748188", maxTicksLimit: 5, font: { size: 10 }, callback: (value) => `${formatCompact(value)}${UNIT}` }, border: { display: false } },
    },
  };
}

const formatCompact = (value) => new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function updateTrendChart() {
  const series = statistics.regions[state.region].series[state.scenario];
  const data = {
    labels: series.map((row) => row[0]),
    datasets: [
      { label: "P90", data: series.map((row) => row[3]), borderColor: "rgba(8,127,114,.2)", backgroundColor: "rgba(8,127,114,.13)", borderWidth: 1, pointRadius: 0, fill: false },
      { label: "P10", data: series.map((row) => row[2]), borderColor: "rgba(8,127,114,.2)", backgroundColor: "rgba(8,127,114,.13)", borderWidth: 1, pointRadius: 0, fill: "-1" },
      { label: "평균", data: series.map((row) => row[1]), borderColor: "#087f72", backgroundColor: "#087f72", borderWidth: 2.4, pointRadius: (ctx) => ctx.dataIndex === state.year - 2021 ? 4 : 0, pointBackgroundColor: "#ffffff", pointBorderWidth: 2, tension: 0.25 },
    ],
  };
  if (trendChart) {
    trendChart.data = data;
    trendChart.update("none");
  } else {
    trendChart = new Chart($("trendChart"), { type: "line", data, options: chartOptions() });
  }
}

function updateComparisonChart() {
  const values = SCENARIOS.map((scenario) => valueAt(state.region, scenario, state.year)?.[1]);
  const data = {
    labels: SCENARIOS,
    datasets: [{ data: values, backgroundColor: ["#66a99c", "#356f9f", "#e9b949", "#e56b5d"], borderRadius: 3, borderSkipped: false, barThickness: 24 }],
  };
  const options = chartOptions();
  options.scales.x.ticks.font = { size: 10, weight: "600" };
  if (comparisonChart) {
    comparisonChart.data = data;
    comparisonChart.options = options;
    comparisonChart.update("none");
  } else {
    comparisonChart = new Chart($("comparisonChart"), { type: "bar", data, options });
  }
}

function refresh() {
  sortedMapValues = currentValues();
  updateStats();
  updateTrendChart();
  updateComparisonChart();
  if (geoLayer) geoLayer.setStyle(styleFeature);
}

async function start() {
  try {
    const [statisticsResponse, geoResponse] = await Promise.all([
      fetch("./data/statistics.json", { cache: "no-store" }),
      fetch("./data/regions.geojson"),
    ]);
    if (!statisticsResponse.ok || !geoResponse.ok) throw new Error("데이터 파일을 불러오지 못했습니다.");
    const [statisticsData, geojson] = await Promise.all([statisticsResponse.json(), geoResponse.json()]);
    statistics = statisticsData;
    sortedMapValues = currentValues();

    initSelectors();
    initScenarioTabs();
    initMap(geojson);
    $("yearSlider").addEventListener("input", (event) => {
      state.year = Number(event.target.value);
      refresh();
    });
    refresh();
    lucide.createIcons();
    $("loading").classList.add("hidden");
  } catch (error) {
    $("loading").innerHTML = `<p>${error.message}</p>`;
    console.error(error);
  }
}

start();
