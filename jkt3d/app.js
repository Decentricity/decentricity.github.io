const DATA_FILES = {
  routes: "./data/transjakarta-routes.geojson",
  stops: "./data/transjakarta-stops.geojson",
  railLines: "./data/jakarta-rail-lines.geojson",
  mrtStations: "./data/mrt-stations.geojson",
  mrtLine: "./data/mrt-line.geojson",
  lrtStations: "./data/lrtj-stations.geojson",
  lrtLine: "./data/lrtj-line.geojson",
  manifest: "./data/source-manifest.json",
};

const ROUTE_SEQUENCE_URL = "./data/transjakarta-route-sequences.json";
const ROUTE_SEQUENCE_TIMEOUT_MS = 8000;
const BMKG_FORECAST_URLS = [
  "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=31.71.01.1001",
  "https://raw.githubusercontent.com/infoBMKG/data-cuaca/main/31.71.01.1001.json",
  "./data/bmkg-gambir-forecast-fallback.json",
];
const BMKG_FORECAST_SOURCE_URL = "https://data.bmkg.go.id/prakiraan-cuaca/";
const BMKG_FORECAST_REPO_URL = "https://github.com/infoBMKG/data-cuaca";
const PETABENCANA_DOCS_URL = "https://docs.petabencana.id/routes";
const PETABENCANA_ENDPOINTS = {
  waterways: "https://data.petabencana.id/infrastructure/waterways?admin=ID-JK&geoformat=geojson",
  pumps: "https://data.petabencana.id/infrastructure/pumps?admin=ID-JK&geoformat=geojson",
  floodgates: "https://data.petabencana.id/infrastructure/floodgates?admin=ID-JK&geoformat=geojson",
  floodgauges: "https://data.petabencana.id/floodgauges?admin=ID-JK&geoformat=geojson",
  reports: "https://data.petabencana.id/reports?admin=ID-JK&disaster=flood&geoformat=geojson",
};
const PANEL_IDS = ["searchDialog", "disasterDrawer", "atlasDrawer", "layersDrawer"];
const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

const INITIAL_VIEW = {
  center: [106.8272, -6.1754],
  zoom: 10.85,
  pitch: 61,
  bearing: -20,
};

const TYPE_PALETTE = [
  "#ff7a21",
  "#2fd1c3",
  "#f3ca4d",
  "#f75e57",
  "#78c4ff",
  "#ffd166",
  "#7ce0a3",
  "#ff9f6e",
];

const LAYER_GROUPS = {
  routes: ["tj-routes-shadow", "tj-routes-line", "tj-routes-hit"],
  stops: ["tj-stop-clusters", "tj-stop-cluster-count", "tj-stops-unclustered"],
  rail: ["rail-lines"],
  mrt: [
    "mrt-line-shadow",
    "mrt-line-glow",
    "mrt-line",
    "mrt-line-flow-forward",
    "mrt-line-flow-reverse",
    "mrt-stations-shadow",
    "mrt-stations",
    "mrt-station-labels",
    "mrt-train-halo",
    "mrt-train-core",
    "mrt-train-labels",
  ],
  lrt: [
    "lrt-line-shadow",
    "lrt-line-glow",
    "lrt-line",
    "lrt-line-flow-forward",
    "lrt-line-flow-reverse",
    "lrt-stations-shadow",
    "lrt-stations",
    "lrt-station-labels",
    "lrt-train-halo",
    "lrt-train-core",
    "lrt-train-labels",
  ],
  disaster: [
    "pb-waterways",
    "pb-waterways-hit",
    "pb-pumps",
    "pb-floodgates",
    "pb-floodgauges-halo",
    "pb-floodgauges",
    "pb-reports-halo",
    "pb-reports",
    "bmkg-forecast-halo",
    "bmkg-forecast-core",
    "bmkg-forecast-labels",
  ],
};

const state = {
  data: null,
  map: null,
  routeTypeColors: {},
  searchIndex: [],
  searchResults: [],
  selection: null,
  routeLookup: new Map(),
  routeSequences: null,
  routeSequencesPromise: null,
  routeSequencesStatus: "idle",
  routeSequencesError: null,
  openPanel: null,
  motionSystems: {},
  motionFrame: null,
  lastMotionUpdate: 0,
  disaster: {
    status: "idle",
    data: null,
    error: null,
  },
};

const elements = {};

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  cacheElements();
  bindStaticUi();
  renderDisasterPanel();
  updateDisasterControls();
  setOpenPanel(null);
  renderSearchResults([], "");
  clearSelection();

  try {
    state.data = await loadData();
    decorateRouteFeatures(state.data.routes);
    decorateStationFeatures(state.data.mrtStations);
    decorateStationFeatures(state.data.lrtStations);
    state.routeTypeColors = buildRouteTypeColors(summarizeRouteGroups(state.data.routes.features));
    state.routeLookup = new Map(state.data.routes.features.map((feature) => [feature.properties.KODRUTE, feature]));
    state.motionSystems = buildMotionSystems();

    renderStats();
    renderRouteLegend();
    renderSources();
    renderGeneratedAt();
    renderFlowLegend();
    buildSearchIndex();

    state.map = createMap();
    state.map.on("load", () => {
      addSources(state.map);
      addLayers(state.map);
      bindMapEvents(state.map);
      syncLayerToggleVisibility();
      startMotionAnimation();
      hideLoading();
      warmRouteSequences();
    });
  } catch (error) {
    console.error(error);
    showLoadingError(error);
  }
}

function cacheElements() {
  elements.statsGrid = document.getElementById("statsGrid");
  elements.routeLegend = document.getElementById("routeLegend");
  elements.sourceList = document.getElementById("sourceList");
  elements.generatedAt = document.getElementById("generatedAt");
  elements.searchInput = document.getElementById("searchInput");
  elements.searchResults = document.getElementById("searchResults");
  elements.clearSearchButton = document.getElementById("clearSearchButton");
  elements.loadingScreen = document.getElementById("loadingScreen");
  elements.detailEmpty = document.getElementById("detailEmpty");
  elements.detailContent = document.getElementById("detailContent");
  elements.detailSheet = document.getElementById("detailSheet");
  elements.closeDetailButton = document.getElementById("closeDetailButton");
  elements.lineFlowLegend = document.getElementById("lineFlowLegend");
  elements.disasterStatus = document.getElementById("disasterStatus");
  elements.disasterStatsGrid = document.getElementById("disasterStatsGrid");
  elements.disasterLegend = document.getElementById("disasterLegend");
  elements.disasterBmkgSummary = document.getElementById("disasterBmkgSummary");
  elements.disasterSourceList = document.getElementById("disasterSourceList");
  elements.panels = Object.fromEntries(PANEL_IDS.map((id) => [id, document.getElementById(id)]));
  elements.panelButtons = Array.from(document.querySelectorAll("[data-panel-target]"));
  elements.panelCloseButtons = Array.from(document.querySelectorAll("[data-close-target]"));
  elements.layerInputs = Array.from(document.querySelectorAll("[data-layer-group]"));
  elements.disasterLayerInput = elements.layerInputs.find((input) => input.dataset.layerGroup === "disaster") || null;
  elements.resetButtons = Array.from(document.querySelectorAll('[data-map-action="reset-view"]'));
}

function bindStaticUi() {
  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.clearSearchButton.addEventListener("click", clearSearch);
  elements.searchResults.addEventListener("click", handleSearchResultClick);
  elements.detailContent.addEventListener("click", handleDetailAction);
  elements.closeDetailButton.addEventListener("click", clearSelection);

  elements.panelButtons.forEach((button) => {
    button.addEventListener("click", () => togglePanel(button.dataset.panelTarget));
  });

  elements.panelCloseButtons.forEach((button) => {
    button.addEventListener("click", () => setOpenPanel(null));
  });

  elements.resetButtons.forEach((button) => {
    button.addEventListener("click", resetView);
  });

  elements.layerInputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      if (!state.map || !state.map.isStyleLoaded()) {
        return;
      }

      if (event.target.dataset.layerGroup === "disaster" && !state.disaster.data) {
        event.target.checked = false;
        return;
      }

      applyLayerGroupVisibility(event.target.dataset.layerGroup, event.target.checked);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (state.openPanel) {
      setOpenPanel(null);
      return;
    }

    if (state.selection) {
      clearSelection();
    }
  });
}

function togglePanel(panelId) {
  if (panelId === "disasterDrawer" && state.openPanel !== panelId) {
    ensureDisasterData();
  }

  setOpenPanel(state.openPanel === panelId ? null : panelId);
}

function setOpenPanel(panelId) {
  state.openPanel = panelId;
  document.body.dataset.activePanel = panelId || "";

  PANEL_IDS.forEach((id) => {
    const panel = elements.panels[id];
    if (!panel) {
      return;
    }
    panel.classList.toggle("is-open", id === panelId);
  });

  elements.panelButtons.forEach((button) => {
    const isActive = button.dataset.panelTarget === panelId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-expanded", isActive ? "true" : "false");
  });

  if (panelId === "searchDialog") {
    window.setTimeout(() => {
      elements.searchInput.focus();
      elements.searchInput.select();
    }, 60);
  }
}

function syncLayerToggleVisibility() {
  elements.layerInputs.forEach((input) => {
    applyLayerGroupVisibility(input.dataset.layerGroup, input.checked);
  });
}

async function loadData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
      }
      return [key, await response.json()];
    }),
  );

  return Object.fromEntries(entries);
}

function createMap() {
  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        carto: {
          type: "raster",
          tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        },
      },
      layers: [{ id: "carto", type: "raster", source: "carto" }],
    },
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
    maxPitch: 74,
    minZoom: 9,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
  return map;
}

function addSources(map) {
  map.addSource("tj-routes", { type: "geojson", data: state.data.routes });
  map.addSource("tj-stops", {
    type: "geojson",
    data: state.data.stops,
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 13,
  });
  map.addSource("rail-lines", { type: "geojson", data: state.data.railLines });
  map.addSource("mrt-line", { type: "geojson", data: state.data.mrtLine, lineMetrics: true });
  map.addSource("mrt-stations", { type: "geojson", data: state.data.mrtStations });
  map.addSource("mrt-trains", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("lrt-line", { type: "geojson", data: state.data.lrtLine, lineMetrics: true });
  map.addSource("lrt-stations", { type: "geojson", data: state.data.lrtStations });
  map.addSource("lrt-trains", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("pb-waterways", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("pb-pumps", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("pb-floodgates", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("pb-floodgauges", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("pb-reports", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("bmkg-forecast", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("selected-route", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  map.addSource("selected-point", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
}

function addLayers(map) {
  const routeColorExpression = buildRouteColorExpression(state.routeTypeColors);

  map.addLayer({
    id: "rail-lines",
    type: "line",
    source: "rail-lines",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(244, 239, 228, 0.18)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.1, 12, 2.4, 15, 3.2],
      "line-opacity": 0.78,
    },
  });

  addDisasterLayers(map);

  map.addLayer({
    id: "tj-routes-shadow",
    type: "line",
    source: "tj-routes",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(4, 8, 9, 0.9)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.4, 12, 5, 15, 10],
      "line-opacity": ["case", ["get", "isActive"], 0.72, 0.1],
    },
  });

  map.addLayer({
    id: "tj-routes-line",
    type: "line",
    source: "tj-routes",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": routeColorExpression,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 12, 3, 15, 7.4],
      "line-opacity": ["case", ["get", "isActive"], 0.8, 0.2],
    },
  });

  map.addLayer({
    id: "tj-routes-hit",
    type: "line",
    source: "tj-routes",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(0, 0, 0, 0)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 10, 12, 18, 15, 28],
    },
  });

  addRailModeLayers(map, {
    prefix: "mrt",
    lineSource: "mrt-line",
    stationSource: "mrt-stations",
    trainSource: "mrt-trains",
    color: "#2fd1c3",
    shadowColor: "rgba(3, 17, 17, 0.92)",
    haloColor: "rgba(47, 209, 195, 0.2)",
    stationStroke: "#081d1d",
  });

  addRailModeLayers(map, {
    prefix: "lrt",
    lineSource: "lrt-line",
    stationSource: "lrt-stations",
    trainSource: "lrt-trains",
    color: "#f3ca4d",
    shadowColor: "rgba(28, 22, 4, 0.94)",
    haloColor: "rgba(243, 202, 77, 0.2)",
    stationStroke: "#2b2407",
  });

  map.addLayer({
    id: "tj-stop-clusters",
    type: "circle",
    source: "tj-stops",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "rgba(47, 209, 195, 0.76)",
        20,
        "rgba(255, 122, 33, 0.78)",
        100,
        "rgba(243, 202, 77, 0.84)",
      ],
      "circle-radius": ["step", ["get", "point_count"], 16, 20, 22, 100, 29],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "rgba(255, 255, 255, 0.24)",
    },
  });

  map.addLayer({
    id: "tj-stop-cluster-count",
    type: "symbol",
    source: "tj-stops",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Open Sans Bold"],
      "text-size": 12,
    },
    paint: {
      "text-color": "#071011",
    },
  });

  map.addLayer({
    id: "tj-stops-unclustered",
    type: "circle",
    source: "tj-stops",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 5.2, 16, 8.2],
      "circle-color": ["case", ["get", "isActive"], "#f4efe4", "rgba(255,255,255,0.25)"],
      "circle-stroke-width": 1.2,
      "circle-stroke-color": ["case", ["get", "isActive"], "#2fd1c3", "rgba(255,255,255,0.18)"],
      "circle-opacity": ["case", ["get", "isActive"], 0.92, 0.32],
    },
  });

  map.addLayer({
    id: "selected-route-halo",
    type: "line",
    source: "selected-route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(255, 255, 255, 0.32)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 7, 12, 11, 15, 18],
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "selected-route-line",
    type: "line",
    source: "selected-route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ff7a21",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.8, 12, 6, 15, 10.5],
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "selected-point-halo",
    type: "circle",
    source: "selected-point",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 13, 12, 18, 15, 24],
      "circle-color": "rgba(255,255,255,0.14)",
      "circle-stroke-width": 1.4,
      "circle-stroke-color": "rgba(255,255,255,0.38)",
    },
  });

  map.addLayer({
    id: "selected-point-core",
    type: "circle",
    source: "selected-point",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5.5, 12, 8.5, 15, 11.5],
      "circle-color": "#ff7a21",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff4dd",
    },
  });
}

function addRailModeLayers(map, config) {
  const {
    prefix,
    lineSource,
    stationSource,
    trainSource,
    color,
    shadowColor,
    haloColor,
    stationStroke,
  } = config;

  map.addLayer({
    id: `${prefix}-line-shadow`,
    type: "line",
    source: lineSource,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": shadowColor,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4.8, 12, 8.2, 15, 12.5],
      "line-opacity": 0.95,
    },
  });

  map.addLayer({
    id: `${prefix}-line-glow`,
    type: "line",
    source: lineSource,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": haloColor,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6.2, 12, 10.8, 15, 16],
      "line-opacity": 0.98,
      "line-blur": 1.8,
    },
  });

  map.addLayer({
    id: `${prefix}-line`,
    type: "line",
    source: lineSource,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": color,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 12, 5.2, 15, 8.6],
      "line-opacity": 0.96,
    },
  });

  map.addLayer({
    id: `${prefix}-line-flow-forward`,
    type: "line",
    source: lineSource,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3.4, 12, 6.5, 15, 10],
      "line-opacity": 0.98,
      "line-blur": 0.5,
      "line-gradient": buildFlowGradient(color, 0.12, false),
    },
  });

  map.addLayer({
    id: `${prefix}-line-flow-reverse`,
    type: "line",
    source: lineSource,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3, 12, 5.8, 15, 9.2],
      "line-opacity": 0.86,
      "line-blur": 0.4,
      "line-gradient": buildFlowGradient(color, 0.66, true),
    },
  });

  map.addLayer({
    id: `${prefix}-stations-shadow`,
    type: "circle",
    source: stationSource,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 7, 12, 10.5, 15, 13.5],
      "circle-color": shadowColor,
      "circle-opacity": 0.9,
    },
  });

  map.addLayer({
    id: `${prefix}-stations`,
    type: "circle",
    source: stationSource,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4.5, 12, 7, 15, 9.2],
      "circle-color": color,
      "circle-stroke-width": 2,
      "circle-stroke-color": stationStroke,
    },
  });

  map.addLayer({
    id: `${prefix}-station-labels`,
    type: "symbol",
    source: stationSource,
    minzoom: 9.2,
    layout: {
      "text-field": ["coalesce", ["get", "labelName"], ["get", "name"]],
      "text-font": ["Open Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 9.2, 10, 12, 11.5, 15, 14],
      "text-anchor": "bottom",
      "text-offset": [0, -1.15],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#f5f1e7",
      "text-halo-color": "rgba(7, 12, 14, 0.96)",
      "text-halo-width": 1.4,
      "text-halo-blur": 0.4,
    },
  });

  map.addLayer({
    id: `${prefix}-train-halo`,
    type: "circle",
    source: trainSource,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 10, 12, 14, 15, 18],
      "circle-color": ["get", "color"],
      "circle-opacity": 0.16,
      "circle-blur": 0.9,
    },
  });

  map.addLayer({
    id: `${prefix}-train-core`,
    type: "circle",
    source: trainSource,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 12, 6, 15, 7.8],
      "circle-color": ["get", "color"],
      "circle-stroke-width": 1.8,
      "circle-stroke-color": "#fff5de",
    },
  });

  map.addLayer({
    id: `${prefix}-train-labels`,
    type: "symbol",
    source: trainSource,
    minzoom: 11.1,
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Open Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 11.1, 10, 14, 11.5],
      "text-anchor": "top",
      "text-offset": [0, 1.15],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#f4efe4",
      "text-halo-color": "rgba(7, 12, 14, 0.94)",
      "text-halo-width": 1.3,
    },
  });
}

function addDisasterLayers(map) {
  map.addLayer({
    id: "pb-waterways",
    type: "line",
    source: "pb-waterways",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(111, 215, 255, 0.58)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, 2.1, 15, 4.2],
      "line-opacity": 0.72,
    },
  });

  map.addLayer({
    id: "pb-waterways-hit",
    type: "line",
    source: "pb-waterways",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(0,0,0,0)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 8, 12, 14, 15, 22],
    },
  });

  map.addLayer({
    id: "pb-pumps",
    type: "circle",
    source: "pb-pumps",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.8, 12, 5.4, 15, 7.8],
      "circle-color": "#ff7a21",
      "circle-stroke-width": 1.4,
      "circle-stroke-color": "#fff1de",
      "circle-opacity": 0.96,
    },
  });

  map.addLayer({
    id: "pb-floodgates",
    type: "circle",
    source: "pb-floodgates",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4.3, 12, 6.1, 15, 8.8],
      "circle-color": "#6fd7ff",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#06202a",
      "circle-opacity": 0.96,
    },
  });

  map.addLayer({
    id: "pb-floodgauges-halo",
    type: "circle",
    source: "pb-floodgauges",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 8, 12, 11, 15, 15],
      "circle-color": ["coalesce", ["get", "color"], "#f3ca4d"],
      "circle-opacity": 0.18,
      "circle-blur": 0.7,
    },
  });

  map.addLayer({
    id: "pb-floodgauges",
    type: "circle",
    source: "pb-floodgauges",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.8, 12, 5.2, 15, 7.2],
      "circle-color": ["coalesce", ["get", "color"], "#f3ca4d"],
      "circle-stroke-width": 1.4,
      "circle-stroke-color": "#fff7df",
      "circle-opacity": 0.96,
    },
  });

  map.addLayer({
    id: "pb-reports-halo",
    type: "circle",
    source: "pb-reports",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 9, 12, 12, 15, 16],
      "circle-color": "#f75e57",
      "circle-opacity": 0.16,
      "circle-blur": 0.8,
    },
  });

  map.addLayer({
    id: "pb-reports",
    type: "circle",
    source: "pb-reports",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4.2, 12, 5.8, 15, 7.8],
      "circle-color": "#f75e57",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#fff2ef",
      "circle-opacity": 0.96,
    },
  });

  map.addLayer({
    id: "bmkg-forecast-halo",
    type: "circle",
    source: "bmkg-forecast",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 14, 12, 20, 15, 28],
      "circle-color": ["coalesce", ["get", "color"], "#f3ca4d"],
      "circle-opacity": 0.18,
      "circle-blur": 0.95,
    },
  });

  map.addLayer({
    id: "bmkg-forecast-core",
    type: "circle",
    source: "bmkg-forecast",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 12, 7, 15, 10],
      "circle-color": ["coalesce", ["get", "color"], "#f3ca4d"],
      "circle-stroke-width": 1.8,
      "circle-stroke-color": "#fff4dd",
      "circle-opacity": 0.98,
    },
  });

  map.addLayer({
    id: "bmkg-forecast-labels",
    type: "symbol",
    source: "bmkg-forecast",
    minzoom: 10,
    layout: {
      "text-field": ["coalesce", ["get", "label"], "BMKG"],
      "text-font": ["Open Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 12],
      "text-anchor": "top",
      "text-offset": [0, 1.1],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#f5f1e7",
      "text-halo-color": "rgba(7, 12, 14, 0.96)",
      "text-halo-width": 1.4,
    },
  });
}

function bindMapEvents(map) {
  bindPointerCursor(map, [
    "tj-routes-hit",
    "tj-stop-clusters",
    "tj-stops-unclustered",
    "mrt-stations",
    "lrt-stations",
    "pb-waterways-hit",
    "pb-pumps",
    "pb-floodgates",
    "pb-floodgauges",
    "pb-reports",
    "bmkg-forecast-core",
  ]);

  map.on("click", "tj-routes-hit", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectRoute(feature, true);
    }
  });

  map.on("click", "tj-stops-unclustered", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectStop(feature, true);
    }
  });

  map.on("click", "mrt-stations", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectStation(feature, true);
    }
  });

  map.on("click", "lrt-stations", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectStation(feature, true);
    }
  });

  map.on("click", "pb-waterways-hit", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectDisasterFeature(feature, true);
    }
  });

  map.on("click", "pb-pumps", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectDisasterFeature(feature, true);
    }
  });

  map.on("click", "pb-floodgates", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectDisasterFeature(feature, true);
    }
  });

  map.on("click", "pb-floodgauges", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectDisasterFeature(feature, true);
    }
  });

  map.on("click", "pb-reports", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectDisasterFeature(feature, true);
    }
  });

  map.on("click", "bmkg-forecast-core", (event) => {
    const feature = event.features?.[0];
    if (feature) {
      selectDisasterFeature(feature, true);
    }
  });

  map.on("click", "tj-stop-clusters", (event) => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }

    const source = map.getSource("tj-stops");
    source.getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
      if (error) {
        return;
      }
      map.easeTo({
        center: feature.geometry.coordinates,
        zoom,
        duration: 700,
      });
    });
  });
}

function bindPointerCursor(map, layerIds) {
  layerIds.forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

function renderStats() {
  const stats = state.data.manifest.stats;
  const cards = [
    { label: "Active routes", value: formatNumber(stats.activeRouteCount) },
    { label: "Active stops", value: formatNumber(stats.activeStopCount) },
    { label: "Rail stations", value: formatNumber(stats.mrtStationCount + stats.lrtStationCount) },
    { label: "Route previews", value: formatNumber(stats.routeSequenceCount) },
  ];

  elements.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `,
    )
    .join("");
}

function renderRouteLegend() {
  const routeTypeCounts = summarizeRouteGroups(state.data.routes.features);
  const entries = Object.entries(routeTypeCounts).sort((left, right) => right[1] - left[1]);

  elements.routeLegend.innerHTML = entries
    .map(([type, count]) => {
      const color = state.routeTypeColors[type] || "#8fa09b";
      return `
        <div class="legend-chip">
          <div class="legend-key">
            <span class="legend-swatch" style="background:${escapeHtml(color)}"></span>
            <span>${escapeHtml(type)}</span>
          </div>
          <strong>${formatNumber(count)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderSources() {
  const sources = state.data.manifest.sources || [];
  elements.sourceList.innerHTML = sources
    .map((source) => {
      const metadataBits = [];
      if (source.metadata?.lastModified) {
        metadataBits.push(`Updated ${formatDate(source.metadata.lastModified)}`);
      }
      if (source.metadata?.contentLength) {
        metadataBits.push(formatBytes(source.metadata.contentLength));
      }
      if (source.metadata?.error) {
        metadataBits.push("Metadata fetch degraded");
      }

      return `
        <article class="source-item">
          <strong><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)}</a></strong>
          ${metadataBits.length ? `<p class="source-note">${escapeHtml(metadataBits.join(" • "))}</p>` : ""}
          <p class="source-note">${escapeHtml(source.note || "")}</p>
        </article>
      `;
    })
    .join("");
}

function renderGeneratedAt() {
  const stats = state.data.manifest.stats;
  elements.generatedAt.textContent = `${formatDate(state.data.manifest.generatedAt)} • ${formatNumber(stats.activeRouteCount)} active routes`;
}

function renderFlowLegend() {
  const systems = Object.values(state.motionSystems);
  elements.lineFlowLegend.innerHTML = systems
    .map(
      (system) => `
        <article class="flow-chip">
          <span class="flow-swatch" style="color:${escapeHtml(system.color)}; background:${escapeHtml(system.color)}"></span>
          <div>
            <strong>${escapeHtml(system.mode)}</strong>
            <p>${escapeHtml(`${system.startLabel} ↔ ${system.endLabel}`)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderDisasterPanel() {
  const { status, data, error } = state.disaster;

  if (!elements.disasterStatus) {
    return;
  }

  if (status === "idle") {
    elements.disasterStatus.textContent =
      "Disaster layers are disabled. Open this panel to fetch Jakarta flood infrastructure from PetaBencana and BMKG forecast context.";
    elements.disasterStatsGrid.innerHTML = "";
    elements.disasterLegend.innerHTML = "";
    elements.disasterBmkgSummary.innerHTML = "";
    elements.disasterSourceList.innerHTML = `
      <article class="source-item">
        <strong><a href="${escapeHtml(PETABENCANA_DOCS_URL)}" target="_blank" rel="noreferrer">PetaBencana Open API</a></strong>
        <p class="source-note">Flood infrastructure, gauges, and crowd-report endpoints for Jakarta.</p>
      </article>
      <article class="source-item">
        <strong><a href="${escapeHtml(BMKG_FORECAST_SOURCE_URL)}" target="_blank" rel="noreferrer">BMKG Open Forecast Data</a></strong>
        <p class="source-note">Official BMKG forecast context for Jakarta, with fallback to the official BMKG GitHub sample when direct access is unavailable.</p>
      </article>
    `;
    return;
  }

  if (status === "loading") {
    elements.disasterStatus.textContent = "Loading live PetaBencana layers and BMKG forecast context…";
    elements.disasterStatsGrid.innerHTML = "";
    elements.disasterLegend.innerHTML = "";
    elements.disasterBmkgSummary.innerHTML = "";
    elements.disasterSourceList.innerHTML = "";
    return;
  }

  if (status === "error" || !data) {
    elements.disasterStatus.textContent = `Disaster data could not be loaded: ${error?.message || "Unknown error"}`;
    elements.disasterStatsGrid.innerHTML = "";
    elements.disasterLegend.innerHTML = "";
    elements.disasterBmkgSummary.innerHTML = "";
    elements.disasterSourceList.innerHTML = `
      <article class="source-item">
        <strong><a href="${escapeHtml(PETABENCANA_DOCS_URL)}" target="_blank" rel="noreferrer">PetaBencana Open API</a></strong>
        <p class="source-note">Retry the panel if network access becomes available again.</p>
      </article>
      <article class="source-item">
        <strong><a href="${escapeHtml(BMKG_FORECAST_SOURCE_URL)}" target="_blank" rel="noreferrer">BMKG Open Forecast Data</a></strong>
        <p class="source-note">BMKG may require a browser session before their live endpoint is reachable.</p>
      </article>
    `;
    return;
  }

  const counts = data.counts;
  const bmkg = data.bmkg;
  const issuesMarkup = data.issues?.length
    ? ` ${data.issues.map((issue) => issue.message).join(" • ")}`
    : "";
  const bmkgModeLabel =
    bmkg?.sourceMode === "live"
      ? "BMKG live API"
      : bmkg?.sourceMode === "official-github"
        ? "BMKG official GitHub fallback"
        : "Bundled BMKG fallback";

  elements.disasterStatus.textContent = `Loaded ${formatNumber(counts.totalVisible)} disaster features.${issuesMarkup}`;
  elements.disasterStatsGrid.innerHTML = [
    { label: "Waterways", value: formatNumber(counts.waterways) },
    { label: "Pumps", value: formatNumber(counts.pumps) },
    { label: "Floodgates", value: formatNumber(counts.floodgates) },
    { label: "Gauges", value: formatNumber(counts.floodgauges) },
    { label: "Reports", value: formatNumber(counts.reports) },
    { label: "BMKG point", value: bmkg ? "1" : "0" },
  ]
    .map(
      (card) => `
        <article class="stat-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `,
    )
    .join("");

  elements.disasterLegend.innerHTML = [
    { label: "PetaBencana waterways", count: counts.waterways, color: "#6fd7ff" },
    { label: "PetaBencana pumps", count: counts.pumps, color: "#ff7a21" },
    { label: "PetaBencana floodgates", count: counts.floodgates, color: "#2fd1c3" },
    { label: "Flood gauges", count: counts.floodgauges, color: "#f3ca4d" },
    { label: "Crowd reports", count: counts.reports, color: "#f75e57" },
    { label: "BMKG forecast beacon", count: bmkg ? 1 : 0, color: bmkg?.color || "#f3ca4d" },
  ]
    .map(
      (entry) => `
        <div class="legend-chip">
          <div class="legend-key">
            <span class="legend-swatch" style="background:${escapeHtml(entry.color)}"></span>
            <span>${escapeHtml(entry.label)}</span>
          </div>
          <strong>${escapeHtml(String(entry.count))}</strong>
        </div>
      `,
    )
    .join("");

  elements.disasterBmkgSummary.innerHTML = bmkg
    ? `
      <article class="source-item">
        <strong>${escapeHtml(bmkg.title)}</strong>
        <p class="source-note">${escapeHtml(`${bmkg.current?.weather_desc || "Weather unavailable"} • ${bmkg.current?.t ?? "?"}°C • peak rain ${bmkg.maxRain.toFixed(1)} mm`)}</p>
        <p class="source-note">${escapeHtml(bmkg.nextRain ? `Next rain window ${formatShortJakartaDateTime(bmkg.nextRain.local_datetime)}` : "No rain signal in the loaded forecast window")}</p>
        <p class="source-note">${escapeHtml(`${bmkgModeLabel} • ${bmkg.locationName}`)}</p>
      </article>
    `
    : `
      <article class="source-item">
        <strong>BMKG forecast unavailable</strong>
        <p class="source-note">PetaBencana layers loaded, but BMKG forecast data did not return in this session.</p>
      </article>
    `;

  elements.disasterSourceList.innerHTML = `
    <article class="source-item">
      <strong><a href="${escapeHtml(PETABENCANA_DOCS_URL)}" target="_blank" rel="noreferrer">PetaBencana Open API</a></strong>
      <p class="source-note">${escapeHtml(`${counts.pumps} pumps • ${counts.floodgates} floodgates • ${counts.waterways} waterways • ${counts.floodgauges} gauges • ${counts.reports} reports`)}</p>
    </article>
    <article class="source-item">
      <strong><a href="${escapeHtml(BMKG_FORECAST_SOURCE_URL)}" target="_blank" rel="noreferrer">BMKG forecast documentation</a></strong>
      <p class="source-note">${escapeHtml(bmkg ? `${bmkgModeLabel} for ${bmkg.locationName}` : "Forecast source unavailable in this session")}</p>
    </article>
    <article class="source-item">
      <strong><a href="${escapeHtml(bmkg?.sourceUrl || BMKG_FORECAST_REPO_URL)}" target="_blank" rel="noreferrer">BMKG data endpoint</a></strong>
      <p class="source-note">${escapeHtml(bmkg?.sourceNote || "Official BMKG sources and repository fallback are listed here.")}</p>
    </article>
  `;
}

function updateDisasterControls() {
  const isLoading = state.disaster.status === "loading";
  const isReady = state.disaster.status === "ready" && Boolean(state.disaster.data);

  if (elements.disasterLayerInput) {
    elements.disasterLayerInput.disabled = !isReady;
  }

  elements.panelButtons
    .filter((button) => button.dataset.panelTarget === "disasterDrawer")
    .forEach((button) => {
      button.textContent = isLoading ? "Loading…" : "Disaster Data";
      button.disabled = false;
    });
}

async function ensureDisasterData() {
  if (state.disaster.status === "loading") {
    return null;
  }

  if (state.disaster.data) {
    renderDisasterPanel();
    updateDisasterControls();
    return state.disaster.data;
  }

  state.disaster.status = "loading";
  state.disaster.error = null;
  renderDisasterPanel();
  updateDisasterControls();

  try {
    const data = await loadDisasterData();
    state.disaster.status = "ready";
    state.disaster.data = data;
    state.disaster.error = null;

    populateDisasterSources();

    if (elements.disasterLayerInput) {
      elements.disasterLayerInput.checked = true;
    }

    updateDisasterControls();
    renderDisasterPanel();

    if (state.map && state.map.isStyleLoaded()) {
      applyLayerGroupVisibility("disaster", true);
    }

    return data;
  } catch (error) {
    console.error(error);
    state.disaster.status = "error";
    state.disaster.data = null;
    state.disaster.error = error;
    renderDisasterPanel();
    updateDisasterControls();
    return null;
  }
}

async function loadDisasterData() {
  const [petabencanaResult, bmkgResult] = await Promise.allSettled([
    loadPetabencanaData(),
    loadBmkgForecastData(),
  ]);

  if (petabencanaResult.status === "rejected" && bmkgResult.status === "rejected") {
    throw new Error("Neither PetaBencana nor BMKG returned usable disaster data.");
  }

  const petabencana =
    petabencanaResult.status === "fulfilled"
      ? petabencanaResult.value
      : createEmptyPetabencanaData(petabencanaResult.reason);
  const bmkg = bmkgResult.status === "fulfilled" ? bmkgResult.value : null;
  const issues = [];

  if (petabencanaResult.status === "rejected") {
    issues.push({ source: "PetaBencana", message: petabencanaResult.reason?.message || "PetaBencana unavailable" });
  } else {
    issues.push(...petabencana.issues);
  }

  if (bmkgResult.status === "rejected") {
    issues.push({ source: "BMKG", message: bmkgResult.reason?.message || "BMKG unavailable" });
  }

  return {
    loadedAt: new Date().toISOString(),
    petabencana,
    bmkg,
    issues,
    counts: {
      waterways: petabencana.waterways.features.length,
      pumps: petabencana.pumps.features.length,
      floodgates: petabencana.floodgates.features.length,
      floodgauges: petabencana.floodgauges.features.length,
      reports: petabencana.reports.features.length,
      totalVisible:
        petabencana.waterways.features.length +
        petabencana.pumps.features.length +
        petabencana.floodgates.features.length +
        petabencana.floodgauges.features.length +
        petabencana.reports.features.length +
        (bmkg ? 1 : 0),
    },
  };
}

async function loadPetabencanaData() {
  const entries = await Promise.allSettled(
    Object.entries(PETABENCANA_ENDPOINTS).map(async ([key, url]) => [key, await fetchRemoteJson(url)]),
  );

  const output = {
    waterways: EMPTY_FEATURE_COLLECTION,
    pumps: EMPTY_FEATURE_COLLECTION,
    floodgates: EMPTY_FEATURE_COLLECTION,
    floodgauges: EMPTY_FEATURE_COLLECTION,
    reports: EMPTY_FEATURE_COLLECTION,
    issues: [],
  };

  entries.forEach((entry) => {
    if (entry.status !== "fulfilled") {
      output.issues.push({ source: "PetaBencana", message: entry.reason?.message || "Endpoint failed" });
      return;
    }

    const [key, payload] = entry.value;
    output[key] = normalizePetabencanaCollection(payload?.result || EMPTY_FEATURE_COLLECTION, key);
  });

  return output;
}

function createEmptyPetabencanaData(reason) {
  return {
    waterways: EMPTY_FEATURE_COLLECTION,
    pumps: EMPTY_FEATURE_COLLECTION,
    floodgates: EMPTY_FEATURE_COLLECTION,
    floodgauges: EMPTY_FEATURE_COLLECTION,
    reports: EMPTY_FEATURE_COLLECTION,
    issues: [{ source: "PetaBencana", message: reason?.message || "PetaBencana unavailable" }],
  };
}

async function loadBmkgForecastData() {
  const attempts = [
    { url: BMKG_FORECAST_URLS[0], sourceMode: "live", sourceNote: "Direct BMKG forecast API" },
    { url: BMKG_FORECAST_URLS[1], sourceMode: "official-github", sourceNote: "Official BMKG GitHub forecast sample" },
    { url: BMKG_FORECAST_URLS[2], sourceMode: "bundled-fallback", sourceNote: "Bundled BMKG fallback snapshot" },
  ];

  const failures = [];

  for (const attempt of attempts) {
    try {
      const payload = await fetchRemoteJson(attempt.url);
      return normalizeBmkgForecast(payload, attempt);
    } catch (error) {
      failures.push(`${attempt.sourceMode}: ${error.message || String(error)}`);
    }
  }

  throw new Error(`BMKG forecast fetch failed. ${failures.join(" • ")}`);
}

function populateDisasterSources() {
  if (!state.map || !state.disaster.data) {
    return;
  }

  const collections = {
    "pb-waterways": state.disaster.data.petabencana.waterways,
    "pb-pumps": state.disaster.data.petabencana.pumps,
    "pb-floodgates": state.disaster.data.petabencana.floodgates,
    "pb-floodgauges": state.disaster.data.petabencana.floodgauges,
    "pb-reports": state.disaster.data.petabencana.reports,
    "bmkg-forecast": state.disaster.data.bmkg?.featureCollection || EMPTY_FEATURE_COLLECTION,
  };

  Object.entries(collections).forEach(([sourceId, collection]) => {
    const source = state.map.getSource(sourceId);
    if (source) {
      source.setData(collection);
    }
  });
}

function normalizePetabencanaCollection(collection, key) {
  const features = Array.isArray(collection?.features) ? collection.features : [];

  return {
    type: "FeatureCollection",
    features: features.map((feature) => {
      const cloned = cloneFeature(feature);
      const props = cloned.properties || {};

      if (key === "waterways") {
        cloned.properties = {
          ...props,
          disasterKind: "waterway",
          title: props.name || "Jakarta waterway",
          description: "PetaBencana waterway infrastructure line",
          sourceName: "PetaBencana",
          sourceUrl: PETABENCANA_ENDPOINTS.waterways,
          sourceDocUrl: PETABENCANA_DOCS_URL,
        };
      }

      if (key === "pumps") {
        cloned.properties = {
          ...props,
          disasterKind: "pump",
          title: props.name || "Pump",
          description: "PetaBencana pump infrastructure point",
          sourceName: "PetaBencana",
          sourceUrl: PETABENCANA_ENDPOINTS.pumps,
          sourceDocUrl: PETABENCANA_DOCS_URL,
        };
      }

      if (key === "floodgates") {
        cloned.properties = {
          ...props,
          disasterKind: "floodgate",
          title: props.name || "Floodgate",
          description: "PetaBencana floodgate infrastructure point",
          sourceName: "PetaBencana",
          sourceUrl: PETABENCANA_ENDPOINTS.floodgates,
          sourceDocUrl: PETABENCANA_DOCS_URL,
        };
      }

      if (key === "floodgauges") {
        const latestObservation = Array.isArray(props.observations) ? props.observations.at(-1) : null;
        const severityLevel = Number(latestObservation?.f3);
        cloned.properties = {
          ...props,
          disasterKind: "floodgauge",
          title: props.gaugenameid || props.gaugeid || "Flood gauge",
          latestStatus: latestObservation?.f4?.trim() || "No recent reading",
          latestLevelCm: latestObservation?.f2 ?? null,
          latestAt: latestObservation?.f1 || null,
          color: getGaugeColor(severityLevel),
          sourceName: "PetaBencana",
          sourceUrl: PETABENCANA_ENDPOINTS.floodgauges,
          sourceDocUrl: PETABENCANA_DOCS_URL,
        };
      }

      if (key === "reports") {
        cloned.properties = {
          ...props,
          disasterKind: "report",
          title: pickFirstValue(props.text, props.title, "Flood report"),
          description: pickFirstValue(props.text, props.description, "PetaBencana crowd report"),
          createdAt: pickFirstValue(props.created_at, props.updated_at, props.time),
          sourceName: "PetaBencana",
          sourceUrl: PETABENCANA_ENDPOINTS.reports,
          sourceDocUrl: PETABENCANA_DOCS_URL,
        };
      }

      return cloned;
    }),
  };
}

function normalizeBmkgForecast(payload, attempt) {
  const rawLocation = payload.location || payload.lokasi || payload.data?.[0]?.lokasi || {};
  const rawIntervals = Array.isArray(payload.intervals)
    ? payload.intervals
    : Array.isArray(payload.data?.[0]?.cuaca)
      ? payload.data[0].cuaca.flat()
      : [];

  if (!rawIntervals.length) {
    throw new Error("BMKG returned no forecast intervals.");
  }

  const intervals = rawIntervals.slice(0, 8).map((interval) => ({
    utc_datetime: interval.utc_datetime || interval.datetime || null,
    local_datetime: interval.local_datetime || interval.datetime || null,
    analysis_date: interval.analysis_date || null,
    t: Number(interval.t ?? 0),
    hu: Number(interval.hu ?? 0),
    tp: Number(interval.tp ?? 0),
    weather: Number(interval.weather ?? 0),
    weather_desc: interval.weather_desc || interval.weather_desc_en || "Unknown",
    weather_desc_en: interval.weather_desc_en || interval.weather_desc || "Unknown",
    ws: Number(interval.ws ?? 0),
    wd: interval.wd || "",
    wd_to: interval.wd_to || "",
    image: interval.image || "",
  }));

  const current = intervals[0];
  const nextRain = intervals.find((interval) => interval.tp > 0.2 || /hujan|storm|rain/i.test(interval.weather_desc));
  const maxRain = intervals.reduce((max, interval) => Math.max(max, interval.tp), 0);
  const severity = getBmkgSeverity(maxRain, intervals);
  const color = getBmkgColor(severity);
  const locationName = [rawLocation.desa, rawLocation.kecamatan, rawLocation.kotkab].filter(Boolean).join(", ") || "Jakarta";

  return {
    sourceMode: attempt.sourceMode,
    sourceUrl: attempt.url,
    sourceNote: attempt.sourceNote,
    title: `BMKG ${rawLocation.desa || rawLocation.kecamatan || "Jakarta"} outlook`,
    locationName,
    location: rawLocation,
    intervals,
    current,
    nextRain,
    maxRain,
    severity,
    color,
    featureCollection: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(rawLocation.lon), Number(rawLocation.lat)],
          },
          properties: {
            disasterKind: "bmkg-forecast",
            title: `BMKG ${rawLocation.desa || rawLocation.kecamatan || "Jakarta"} outlook`,
            description: nextRain
              ? `Next rain window ${formatShortJakartaDateTime(nextRain.local_datetime)}`
              : `${current.weather_desc} outlook for Jakarta`,
            label: `BMKG ${rawLocation.desa || rawLocation.kecamatan || "Jakarta"}`,
            locationName,
            currentWeather: current.weather_desc,
            currentTemp: current.t,
            nextRainTime: nextRain?.local_datetime || null,
            maxRain,
            severity,
            color,
            sourceName: "BMKG",
            sourceMode: attempt.sourceMode,
            sourceUrl: attempt.url,
            sourceDocUrl: BMKG_FORECAST_SOURCE_URL,
            sourceRepoUrl: BMKG_FORECAST_REPO_URL,
            forecastIntervals: intervals,
          },
        },
      ],
    },
  };
}

async function fetchRemoteJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

function buildSearchIndex() {
  const items = [];

  state.data.routes.features.forEach((feature) => {
    const props = feature.properties;
    const title = props.KODRUTE || props.NMRUTE || "Unnamed route";
    const subtitle = [props.NMRUTE, props.routeGroup, props.TPBUS].filter(Boolean).join(" • ");
    items.push({
      kind: "route",
      title,
      subtitle,
      searchText: normalizeText([title, subtitle, props.STSOPRS].join(" ")),
      feature,
    });
  });

  state.data.stops.features.forEach((feature) => {
    const props = feature.properties;
    const subtitle = [
      "Transjakarta stop",
      props.WADMKC,
      props.WADMKK,
      `${props.routes.length || 0} routes`,
    ]
      .filter(Boolean)
      .join(" • ");
    items.push({
      kind: "stop",
      title: props.NMPRHNTIAN || "Unnamed stop",
      subtitle,
      searchText: normalizeText(
        [
          props.NMPRHNTIAN,
          props.IDSTOP,
          props.WADMKC,
          props.WADMKK,
          props.routes.join(" "),
          props.KORIDOR,
        ].join(" "),
      ),
      feature,
    });
  });

  [...state.data.mrtStations.features, ...state.data.lrtStations.features].forEach((feature) => {
    const props = feature.properties;
    items.push({
      kind: "station",
      title: props.labelName || props.name,
      subtitle: `${props.mode}${props.locationMethod === "manual" ? " • manual coordinate fallback" : ""}`,
      searchText: normalizeText([props.name, props.labelName, props.mode, props.displayName, props.query].join(" ")),
      feature,
    });
  });

  state.searchIndex = items;
}

function handleSearchInput(event) {
  const rawQuery = event.target.value.trim();
  const query = normalizeText(rawQuery);

  if (!query) {
    state.searchResults = [];
    renderSearchResults([], "");
    return;
  }

  const tokens = query.split(" ").filter(Boolean);
  const results = state.searchIndex
    .filter((item) => tokens.every((token) => item.searchText.includes(token)))
    .map((item) => ({ item, score: searchScore(item, rawQuery, query) }))
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
    .slice(0, 14)
    .map((entry) => entry.item);

  state.searchResults = results;
  renderSearchResults(results, rawQuery);
}

function renderSearchResults(results, rawQuery) {
  if (!rawQuery) {
    elements.searchResults.innerHTML = '<p class="detail-copy">Search across routes, 8k+ bus stops, and MRT/LRT stations.</p>';
    return;
  }

  if (!results.length) {
    elements.searchResults.innerHTML = '<p class="detail-copy">No matching routes, stops, or stations were found.</p>';
    return;
  }

  elements.searchResults.innerHTML = results
    .map(
      (result, index) => `
        <button type="button" class="search-result" data-index="${index}">
          <strong>${escapeHtml(result.title)}</strong>
          <span>${escapeHtml(result.subtitle)}</span>
        </button>
      `,
    )
    .join("");
}

function handleSearchResultClick(event) {
  const button = event.target.closest("[data-index]");
  if (!button) {
    return;
  }

  const result = state.searchResults[Number(button.dataset.index)];
  if (!result) {
    return;
  }

  setOpenPanel(null);

  if (result.kind === "route") {
    selectRoute(result.feature, true);
  } else if (result.kind === "stop") {
    selectStop(result.feature, true);
  } else {
    selectStation(result.feature, true);
  }
}

function clearSearch() {
  elements.searchInput.value = "";
  state.searchResults = [];
  renderSearchResults([], "");
}

function resetView() {
  if (!state.map) {
    return;
  }

  state.map.easeTo({
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
    duration: 950,
  });
}

function selectRoute(feature, focus) {
  state.selection = { kind: "route", feature };
  updateSelectionSources(feature, null);
  showRouteDetail(feature);

  if (window.innerWidth <= 820) {
    setOpenPanel(null);
  }

  if (focus) {
    fitToGeometry(feature.geometry, feature.properties.bounds);
  }
}

function selectStop(feature, focus) {
  state.selection = { kind: "stop", feature };
  updateSelectionSources(null, feature);
  showStopDetail(feature);

  if (window.innerWidth <= 820) {
    setOpenPanel(null);
  }

  if (focus) {
    flyToPoint(feature.geometry.coordinates, 14.3);
  }
}

function selectStation(feature, focus) {
  state.selection = { kind: "station", feature };
  updateSelectionSources(null, feature);
  showStationDetail(feature);

  if (window.innerWidth <= 820) {
    setOpenPanel(null);
  }

  if (focus) {
    flyToPoint(feature.geometry.coordinates, 13.8);
  }
}

function selectDisasterFeature(feature, focus) {
  const geometryType = feature.geometry?.type;
  const isLine = geometryType === "LineString" || geometryType === "MultiLineString";

  state.selection = { kind: "disaster", feature };
  updateSelectionSources(isLine ? feature : null, geometryType === "Point" ? feature : null);
  showDisasterDetail(feature);

  if (window.innerWidth <= 820) {
    setOpenPanel(null);
  }

  if (!focus) {
    return;
  }

  if (geometryType === "Point") {
    flyToPoint(feature.geometry.coordinates, 13.4);
    return;
  }

  fitToGeometry(feature.geometry, feature.properties.bounds);
}

function clearSelection() {
  state.selection = null;
  elements.detailSheet.classList.remove("is-open");
  elements.detailContent.classList.add("hidden");
  elements.detailContent.innerHTML = "";
  elements.detailEmpty.classList.remove("hidden");
  elements.closeDetailButton.classList.add("hidden");
  updateSelectionSources(null, null);
}

function updateSelectionSources(routeFeature, pointFeature) {
  if (!state.map) {
    return;
  }

  const routeSource = state.map.getSource("selected-route");
  const pointSource = state.map.getSource("selected-point");

  if (routeSource) {
    routeSource.setData(routeFeature ? { type: "FeatureCollection", features: [cloneFeature(routeFeature)] } : EMPTY_FEATURE_COLLECTION);
  }

  if (pointSource) {
    pointSource.setData(pointFeature ? { type: "FeatureCollection", features: [cloneFeature(pointFeature)] } : EMPTY_FEATURE_COLLECTION);
  }
}

function showRouteDetail(feature) {
  if (!state.routeSequences && state.routeSequencesStatus === "idle") {
    void ensureRouteSequences();
  }

  const props = feature.properties;
  const sequence = state.routeSequences?.[props.KODRUTE] || null;
  const directions = (sequence?.directions || []).slice(0, 2);
  const serviceTags = [props.routeGroup, props.TPBUS, props.isActive ? "Operational" : "Not operational"];
  const routeSequenceStatus = state.routeSequences ? "ready" : state.routeSequencesStatus;

  if (props.TPRUTE && props.TPRUTE !== props.routeGroup) {
    serviceTags.push(props.TPRUTE);
  }

  const sequenceMarkup = routeSequenceStatus === "ready"
    ? directions.length
      ? `<div class="direction-columns">${directions.map(renderDirectionCard).join("")}</div>`
      : '<p class="detail-copy">This route is present in the geometry layer, but a stop sequence preview was not available in the exported sequence file.</p>'
    : routeSequenceStatus === "error"
      ? `
        <p class="detail-copy">Stop sequence preview is temporarily unavailable. Route geometry and map interaction remain usable.</p>
        <p class="detail-copy">${escapeHtml(state.routeSequencesError?.message || "The preview request did not complete.")}</p>
      `
      : '<p class="detail-copy">Loading stop sequence preview…</p>';

  const previewSummary = routeSequenceStatus === "ready"
    ? sequence
      ? `${sequence.directions.length} direction set(s)`
      : "No sequence found"
    : routeSequenceStatus === "error"
      ? "Unavailable"
      : "Loading on demand";

  const actionButtons = ['<button type="button" class="detail-action" data-action="frame-selection">Frame route</button>'];

  if (routeSequenceStatus === "error") {
    actionButtons.push('<button type="button" class="detail-action" data-action="retry-route-preview">Retry preview</button>');
  }

  const html = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Route</p>
        <h2>${escapeHtml(props.KODRUTE || props.NMRUTE || "Transjakarta route")}</h2>
        <p class="detail-copy">${escapeHtml(props.NMRUTE || "No route title was exposed in the source layer.")}</p>
      </div>
    </div>

    <div class="detail-tag-row">
      ${serviceTags.filter(Boolean).map((tag) => renderTag(tag)).join("")}
    </div>

    <div class="detail-meta-grid">
      ${renderMetaCard("Distance", props.KM ? `${escapeHtml(String(props.KM))} km` : "Not exposed")}
      ${renderMetaCard("Route code", escapeHtml(props.KODRUTE || "N/A"))}
      ${renderMetaCard("Stop preview", escapeHtml(previewSummary))}
      ${renderMetaCard("Source status", escapeHtml(props.STSOPRS || "Unknown"))}
    </div>

    ${sequenceMarkup}

    <div class="detail-action-row">
      ${actionButtons.join("")}
    </div>
  `;

  showDetail(html);

  if (routeSequenceStatus === "loading" && state.routeSequencesPromise) {
    state.routeSequencesPromise.finally(() => {
      if (state.selection?.kind === "route" && state.selection.feature.properties.KODRUTE === props.KODRUTE) {
        showRouteDetail(state.selection.feature);
      }
    });
  }
}

function showStopDetail(feature) {
  const props = feature.properties;
  const routes = props.routes || [];
  const routeMarkup = routes.length
    ? routes.slice(0, 28).map((routeCode) => renderRouteChip(routeCode)).join("")
    : '<span class="detail-copy">No served routes were listed in the source record.</span>';
  const overflowMarkup =
    routes.length > 28 ? `<span class="detail-copy">+${routes.length - 28} more routes in source metadata.</span>` : "";

  const html = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Stop</p>
        <h2>${escapeHtml(props.NMPRHNTIAN || "Unnamed stop")}</h2>
        <p class="detail-copy">${escapeHtml([props.WADMKC, props.WADMKK].filter(Boolean).join(", ") || "Location not exposed")}</p>
      </div>
    </div>

    <div class="detail-tag-row">
      ${renderTag(props.TPPRHNTIAN || "Stop")}
      ${renderTag(props.isActive ? "Operational" : "Not operational")}
      ${props.KORIDOR ? renderTag(`Koridor ${props.KORIDOR}`) : ""}
    </div>

    <div class="detail-meta-grid">
      ${renderMetaCard("Stop ID", escapeHtml(props.IDSTOP || "N/A"))}
      ${renderMetaCard("Served routes", formatNumber(routes.length))}
      ${renderMetaCard("Stop family", escapeHtml(props.JNSPRHNTIAN || props.TPHALTEKRDR || "Not exposed"))}
      ${renderMetaCard("Status", escapeHtml(props.STSOPRS || "Unknown"))}
    </div>

    <div class="pill-list">
      ${routeMarkup}
    </div>
    ${overflowMarkup}

    <div class="detail-action-row">
      <button type="button" class="detail-action" data-action="frame-selection">Zoom to stop</button>
    </div>
  `;

  showDetail(html);
}

function showStationDetail(feature) {
  const props = feature.properties;
  const scheduleMarkup = props.schedule ? renderMrtSchedule(props.schedule) : "";
  const integrationMarkup = Array.isArray(props.integration) && props.integration.length
    ? props.integration.map((item) => renderTag(item)).join("")
    : '<span class="detail-copy">No integration metadata was exposed for this station.</span>';

  const actionButtons = [
    '<button type="button" class="detail-action" data-action="frame-selection">Zoom to station</button>',
  ];

  if (props.mapsUrl) {
    actionButtons.push(
      `<button type="button" class="detail-action" data-action="open-link" data-href="${escapeHtml(props.mapsUrl)}">Open official map</button>`,
    );
  }

  if (props.sourceUrl) {
    actionButtons.push(
      `<button type="button" class="detail-action" data-action="open-link" data-href="${escapeHtml(props.sourceUrl)}">Open source page</button>`,
    );
  }

  if (props.locationSourceUrl) {
    actionButtons.push(
      `<button type="button" class="detail-action" data-action="open-link" data-href="${escapeHtml(props.locationSourceUrl)}">Open coordinate source</button>`,
    );
  }

  const html = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(props.mode || "Station")}</p>
        <h2>${escapeHtml(props.labelName || props.name || "Unnamed station")}</h2>
        <p class="detail-copy">${escapeHtml(props.description || props.displayName || "No additional station description was exposed.")}</p>
      </div>
    </div>

    <div class="detail-tag-row">
      ${renderTag(props.mode || "Station")}
      ${renderTag(props.locationMethod === "manual" ? "Manual coordinate fallback" : "Placed from geocoded source")}
    </div>

    <div class="detail-meta-grid">
      ${renderMetaCard("Coordinate source", escapeHtml(props.query || "Unknown"))}
      ${renderMetaCard("Lat, Lng", `${feature.geometry.coordinates[1].toFixed(5)}, ${feature.geometry.coordinates[0].toFixed(5)}`)}
      ${renderMetaCard("Integration", Array.isArray(props.integration) ? formatNumber(props.integration.length) : "Not exposed")}
      ${renderMetaCard("Map label", escapeHtml(props.labelName || props.name || "Unknown"))}
    </div>

    <div class="pill-list">
      ${integrationMarkup}
    </div>

    ${scheduleMarkup}

    <div class="detail-action-row">
      ${actionButtons.join("")}
    </div>
  `;

  showDetail(html);
}

function showDisasterDetail(feature) {
  const props = feature.properties || {};
  const geometryType = feature.geometry?.type || "Unknown";

  if (props.disasterKind === "bmkg-forecast") {
    const intervals = Array.isArray(props.forecastIntervals) ? props.forecastIntervals : [];
    const timelineMarkup = intervals.length
      ? `<div class="detail-meta-grid">${intervals
          .slice(0, 6)
          .map(
            (interval) =>
              renderMetaCard(
                formatShortJakartaDateTime(interval.local_datetime),
                `${escapeHtml(interval.weather_desc)}<br>${escapeHtml(`${interval.t}°C • ${interval.tp.toFixed(1)} mm`)}`,
              ),
          )
          .join("")}</div>`
      : "";

    showDetail(`
      <div class="detail-header">
        <div>
          <p class="eyebrow">BMKG</p>
          <h2>${escapeHtml(props.title || "BMKG forecast")}</h2>
          <p class="detail-copy">${escapeHtml(props.description || "Forecast context loaded from BMKG.")}</p>
        </div>
      </div>

      <div class="detail-tag-row">
        ${renderTag("BMKG")}
        ${renderTag(props.sourceMode === "live" ? "Live API" : "Fallback snapshot")}
        ${renderTag(props.severity || "Normal")}
      </div>

      <div class="detail-meta-grid">
        ${renderMetaCard("Location", escapeHtml(props.locationName || "Jakarta"))}
        ${renderMetaCard("Current", escapeHtml(`${props.currentWeather || "Unknown"} • ${props.currentTemp ?? "?"}°C`))}
        ${renderMetaCard("Peak rain", escapeHtml(`${Number(props.maxRain || 0).toFixed(1)} mm`))}
        ${renderMetaCard("Next rain", escapeHtml(props.nextRainTime ? formatShortJakartaDateTime(props.nextRainTime) : "No rain signal in loaded window"))}
      </div>

      ${timelineMarkup}

      <div class="detail-action-row">
        <button type="button" class="detail-action" data-action="frame-selection">Zoom to BMKG point</button>
        <button type="button" class="detail-action" data-action="open-link" data-href="${escapeHtml(props.sourceDocUrl || BMKG_FORECAST_SOURCE_URL)}">Open source page</button>
      </div>
    `);
    return;
  }

  const sourceButtons = [];

  if (props.sourceUrl) {
    sourceButtons.push(
      `<button type="button" class="detail-action" data-action="open-link" data-href="${escapeHtml(props.sourceUrl)}">Open data endpoint</button>`,
    );
  }

  if (props.sourceDocUrl) {
    sourceButtons.push(
      `<button type="button" class="detail-action" data-action="open-link" data-href="${escapeHtml(props.sourceDocUrl)}">Open source docs</button>`,
    );
  }

  let extraMeta = "";
  if (props.disasterKind === "floodgauge") {
    extraMeta = `
      ${renderMetaCard("Latest status", escapeHtml(props.latestStatus || "Unknown"))}
      ${renderMetaCard("Water level", escapeHtml(props.latestLevelCm != null ? `${props.latestLevelCm} cm` : "Not exposed"))}
      ${renderMetaCard("Observed at", escapeHtml(props.latestAt ? formatShortJakartaDateTime(props.latestAt) : "Unknown"))}
    `;
  }

  if (props.disasterKind === "report") {
    extraMeta = `
      ${renderMetaCard("Reported", escapeHtml(props.createdAt ? formatShortJakartaDateTime(props.createdAt) : "Unknown"))}
      ${renderMetaCard("Source", escapeHtml(props.sourceName || "PetaBencana"))}
    `;
  }

  showDetail(`
    <div class="detail-header">
      <div>
        <p class="eyebrow">${escapeHtml((props.sourceName || "Disaster").toUpperCase())}</p>
        <h2>${escapeHtml(props.title || "Disaster feature")}</h2>
        <p class="detail-copy">${escapeHtml(props.description || "No extra description was provided for this feature.")}</p>
      </div>
    </div>

    <div class="detail-tag-row">
      ${renderTag(props.disasterKind || "disaster")}
      ${renderTag(geometryType)}
    </div>

    <div class="detail-meta-grid">
      ${renderMetaCard("Lat, Lng", feature.geometry?.type === "Point" ? `${feature.geometry.coordinates[1].toFixed(5)}, ${feature.geometry.coordinates[0].toFixed(5)}` : "Linear feature")}
      ${renderMetaCard("Source", escapeHtml(props.sourceName || "Unknown"))}
      ${renderMetaCard("Name", escapeHtml(props.name || props.title || "Unknown"))}
      ${extraMeta}
    </div>

    <div class="detail-action-row">
      <button type="button" class="detail-action" data-action="frame-selection">Frame selection</button>
      ${sourceButtons.join("")}
    </div>
  `);
}

function renderMrtSchedule(schedule) {
  const cards = [];

  if (schedule.towardsStart) {
    cards.push(
      renderMetaCard(
        `Towards ${schedule.towardsStart}`,
        buildScheduleSummary(schedule.weekdayToStart, schedule.weekendToStart),
      ),
    );
  }

  if (schedule.towardsEnd) {
    cards.push(
      renderMetaCard(
        `Towards ${schedule.towardsEnd}`,
        buildScheduleSummary(schedule.weekdayToEnd, schedule.weekendToEnd),
      ),
    );
  }

  if (schedule.firstRatanggaStart || schedule.lastRatanggaStart) {
    cards.push(
      renderMetaCard(
        "First / last to start",
        escapeHtml([schedule.firstRatanggaStart, schedule.lastRatanggaStart].filter(Boolean).join(" - ") || "Not exposed"),
      ),
    );
  }

  if (schedule.firstRatanggaEnd || schedule.lastRatanggaEnd) {
    cards.push(
      renderMetaCard(
        "First / last to end",
        escapeHtml([schedule.firstRatanggaEnd, schedule.lastRatanggaEnd].filter(Boolean).join(" - ") || "Not exposed"),
      ),
    );
  }

  if (!cards.length) {
    return "";
  }

  return `<div class="detail-meta-grid">${cards.join("")}</div>`;
}

function showDetail(html) {
  elements.detailEmpty.classList.add("hidden");
  elements.detailContent.classList.remove("hidden");
  elements.detailContent.innerHTML = html;
  elements.detailSheet.classList.add("is-open");
  elements.closeDetailButton.classList.remove("hidden");
}

function handleDetailAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !state.selection) {
    return;
  }

  const action = button.dataset.action;

  if (action === "retry-route-preview" && state.selection.kind === "route") {
    void ensureRouteSequences({ force: true }).finally(() => {
      if (state.selection?.kind === "route") {
        showRouteDetail(state.selection.feature);
      }
    });
    showRouteDetail(state.selection.feature);
    return;
  }

  if (action === "frame-selection") {
    if (state.selection.kind === "route") {
      fitToGeometry(state.selection.feature.geometry, state.selection.feature.properties.bounds);
    } else if (state.selection.kind === "disaster") {
      if (state.selection.feature.geometry?.type === "Point") {
        flyToPoint(state.selection.feature.geometry.coordinates, 13.4);
      } else {
        fitToGeometry(state.selection.feature.geometry, state.selection.feature.properties.bounds);
      }
    } else {
      flyToPoint(state.selection.feature.geometry.coordinates, state.selection.kind === "stop" ? 14.3 : 13.8);
    }
  }

  if (action === "open-link" && button.dataset.href) {
    window.open(button.dataset.href, "_blank", "noopener,noreferrer");
  }
}

function applyLayerGroupVisibility(group, visible) {
  const layerIds = LAYER_GROUPS[group] || [];
  layerIds.forEach((layerId) => {
    if (state.map.getLayer(layerId)) {
      state.map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    }
  });
}

function fitToGeometry(geometry, precomputedBounds) {
  if (!state.map) {
    return;
  }

  const bounds = precomputedBounds ? boundsArrayToFitBounds(precomputedBounds) : geometryToBounds(geometry);
  if (!bounds) {
    return;
  }

  state.map.fitBounds(bounds, {
    padding: getFramePadding(),
    duration: 950,
    bearing: state.map.getBearing(),
    pitch: Math.max(state.map.getPitch(), 42),
  });
}

function flyToPoint(coordinates, zoom) {
  if (!state.map) {
    return;
  }

  state.map.easeTo({
    center: coordinates,
    zoom,
    duration: 820,
    pitch: Math.max(state.map.getPitch(), 52),
  });
}

function geometryToBounds(geometry) {
  if (!geometry) {
    return null;
  }

  const coordinates = [];
  collectCoordinates(geometry, coordinates);

  if (!coordinates.length) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  coordinates.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function collectCoordinates(geometry, target) {
  if (geometry.type === "Point") {
    target.push(geometry.coordinates);
    return;
  }

  if (geometry.type === "LineString") {
    geometry.coordinates.forEach((coordinate) => target.push(coordinate));
    return;
  }

  if (geometry.type === "MultiLineString") {
    geometry.coordinates.forEach((line) => {
      line.forEach((coordinate) => target.push(coordinate));
    });
  }
}

function getFramePadding() {
  const isMobile = window.innerWidth <= 820;
  const searchOpen = state.openPanel === "searchDialog";
  const disasterOpen = state.openPanel === "disasterDrawer";
  const atlasOpen = state.openPanel === "atlasDrawer";
  const layersOpen = state.openPanel === "layersDrawer";
  const detailOpen = Boolean(state.selection);

  if (isMobile) {
    return {
      top: 160,
      right: 24,
      bottom: detailOpen ? Math.round(window.innerHeight * 0.42) : 136,
      left: 24,
    };
  }

  return {
    top: 120,
    right: disasterOpen ? 400 : layersOpen ? 380 : 56,
    bottom: detailOpen ? 280 : 72,
    left: searchOpen || atlasOpen ? 410 : 56,
  };
}

function buildMotionSystems() {
  return {
    mrt: createMotionSystem({
      key: "mrt",
      mode: "MRT Jakarta",
      color: "#2fd1c3",
      lineFeature: state.data.mrtLine.features[0],
      stationFeatures: state.data.mrtStations.features,
      vehiclesPerDirection: 2,
      speed: 0.032,
      flowPeriodMs: 2400,
    }),
    lrt: createMotionSystem({
      key: "lrt",
      mode: "LRT Jakarta",
      color: "#f3ca4d",
      lineFeature: state.data.lrtLine.features[0],
      stationFeatures: state.data.lrtStations.features,
      vehiclesPerDirection: 1,
      speed: 0.021,
      flowPeriodMs: 2900,
    }),
  };
}

function createMotionSystem(config) {
  const coordinates = config.lineFeature.geometry.coordinates;
  const metrics = preparePathMetrics(coordinates);
  const startLabel = config.stationFeatures[0]?.properties?.labelName || "Start";
  const endLabel = config.stationFeatures.at(-1)?.properties?.labelName || "End";
  const vehicles = [];

  for (let index = 0; index < config.vehiclesPerDirection; index += 1) {
    const forwardOffset = (index / config.vehiclesPerDirection + 0.08) % 1;
    const reverseOffset = (index / config.vehiclesPerDirection + 0.45) % 1;

    vehicles.push({
      direction: 1,
      phaseOffset: forwardOffset,
      speed: config.speed + index * 0.004,
      label: `To ${endLabel}`,
    });

    vehicles.push({
      direction: -1,
      phaseOffset: reverseOffset,
      speed: config.speed + index * 0.003,
      label: `To ${startLabel}`,
    });
  }

  return {
    key: config.key,
    mode: config.mode,
    color: config.color,
    metrics,
    startLabel,
    endLabel,
    vehicles,
    flowPeriodMs: config.flowPeriodMs,
  };
}

function startMotionAnimation() {
  if (!state.map) {
    return;
  }

  const tick = (timestamp) => {
    if (timestamp - state.lastMotionUpdate >= 80) {
      updateRailMotion(timestamp);
      state.lastMotionUpdate = timestamp;
    }
    state.motionFrame = requestAnimationFrame(tick);
  };

  state.motionFrame = requestAnimationFrame(tick);
}

function updateRailMotion(timestamp) {
  if (!state.map || !state.map.isStyleLoaded()) {
    return;
  }

  Object.values(state.motionSystems).forEach((system) => {
    const trainSource = state.map.getSource(`${system.key}-trains`);
    if (trainSource) {
      trainSource.setData(buildTrainCollection(system, timestamp));
    }

    const phase = ((timestamp % system.flowPeriodMs) / system.flowPeriodMs);
    const forwardLayer = `${system.key}-line-flow-forward`;
    const reverseLayer = `${system.key}-line-flow-reverse`;

    if (state.map.getLayer(forwardLayer)) {
      state.map.setPaintProperty(forwardLayer, "line-gradient", buildFlowGradient(system.color, phase, false));
    }

    if (state.map.getLayer(reverseLayer)) {
      state.map.setPaintProperty(reverseLayer, "line-gradient", buildFlowGradient(system.color, (phase + 0.5) % 1, true));
    }
  });
}

function buildTrainCollection(system, timestamp) {
  const features = system.vehicles.map((vehicle, index) => {
    const travel = ((timestamp / 1000) * vehicle.speed + vehicle.phaseOffset) % 1;
    const progress = vehicle.direction === 1 ? travel : 1 - travel;
    const position = interpolateAlongPath(system.metrics, progress);

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: position.coordinates,
      },
      properties: {
        id: `${system.key}-${index}`,
        color: system.color,
        label: vehicle.label,
        bearing: position.bearing,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function preparePathMetrics(coordinates) {
  const segmentLengths = [];
  let total = 0;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    segmentLengths.push(length);
    total += length;
  }

  return {
    coordinates,
    segmentLengths,
    totalLength: total,
  };
}

function interpolateAlongPath(metrics, progress) {
  const target = clamp(progress, 0, 1) * metrics.totalLength;
  let traversed = 0;

  for (let index = 0; index < metrics.segmentLengths.length; index += 1) {
    const segmentLength = metrics.segmentLengths[index];
    if (traversed + segmentLength >= target) {
      const local = segmentLength === 0 ? 0 : (target - traversed) / segmentLength;
      const start = metrics.coordinates[index];
      const end = metrics.coordinates[index + 1];
      return {
        coordinates: [
          start[0] + (end[0] - start[0]) * local,
          start[1] + (end[1] - start[1]) * local,
        ],
        bearing: Math.atan2(end[1] - start[1], end[0] - start[0]) * (180 / Math.PI),
      };
    }
    traversed += segmentLength;
  }

  const fallbackStart = metrics.coordinates.at(-2) || metrics.coordinates[0];
  const fallbackEnd = metrics.coordinates.at(-1) || metrics.coordinates[0];
  return {
    coordinates: fallbackEnd,
    bearing: Math.atan2(fallbackEnd[1] - fallbackStart[1], fallbackEnd[0] - fallbackStart[0]) * (180 / Math.PI),
  };
}

function buildFlowGradient(hexColor, phase, reverse) {
  const transparent = "rgba(255,255,255,0)";
  const glow = hexToRgba(hexColor, 0.4);
  const bright = hexToRgba(hexColor, 0.95);
  const head = clamp(reverse ? 1 - phase : phase, 0, 1);
  const start = clamp(head - 0.16, 0, 1);
  const centerA = clamp(head - 0.04, 0, 1);
  const centerB = clamp(head + 0.04, 0, 1);
  const end = clamp(head + 0.16, 0, 1);

  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    transparent,
    start,
    transparent,
    centerA,
    glow,
    head,
    bright,
    centerB,
    glow,
    end,
    transparent,
    1,
    transparent,
  ];
}

function buildRouteTypeColors(routeTypeCounts) {
  const entries = Object.keys(routeTypeCounts).sort();
  const colors = {};

  entries.forEach((type, index) => {
    const lowered = type.toLowerCase();

    if (lowered.includes("brt")) {
      colors[type] = "#ff7a21";
      return;
    }

    if (lowered.includes("mikro") || lowered.includes("feeder")) {
      colors[type] = "#2fd1c3";
      return;
    }

    if (lowered.includes("royal")) {
      colors[type] = "#f3ca4d";
      return;
    }

    if (lowered.includes("jabodetabek")) {
      colors[type] = "#78c4ff";
      return;
    }

    colors[type] = TYPE_PALETTE[index % TYPE_PALETTE.length];
  });

  return colors;
}

function buildRouteColorExpression(routeTypeColors) {
  const expression = ["match", ["coalesce", ["get", "routeGroup"], ""]];

  Object.entries(routeTypeColors).forEach(([type, color]) => {
    expression.push(type, color);
  });

  expression.push("#8fa09b");
  return expression;
}

function renderDirectionCard(direction) {
  const previewStops = direction.stops.slice(0, 8);
  const remainder = direction.stops.length - previewStops.length;

  return `
    <article class="direction-card">
      <strong>${escapeHtml(direction.direction || direction.tripName || "Direction")}</strong>
      <ol>
        ${previewStops.map((stop) => `<li>${escapeHtml(stop.name || "Unnamed stop")}</li>`).join("")}
        ${remainder > 0 ? `<li>…and ${formatNumber(remainder)} more stops</li>` : ""}
      </ol>
    </article>
  `;
}

function renderRouteChip(routeCode) {
  const route = state.routeLookup.get(routeCode);
  const title = route?.properties?.NMRUTE ? `${routeCode} · ${route.properties.NMRUTE}` : routeCode;
  return `<span class="detail-tag">${escapeHtml(title)}</span>`;
}

function renderMetaCard(label, value) {
  return `
    <article class="meta-card">
      <strong>${escapeHtml(label)}</strong>
      <div class="detail-copy">${value}</div>
    </article>
  `;
}

function renderTag(label) {
  return `<span class="detail-tag">${escapeHtml(label)}</span>`;
}

function buildScheduleSummary(weekdaySeries, weekendSeries) {
  const weekday = weekdaySeries?.first || weekdaySeries?.last
    ? `Weekday ${weekdaySeries.first || "?"} - ${weekdaySeries.last || "?"}`
    : "Weekday times unavailable";
  const weekend = weekendSeries?.first || weekendSeries?.last
    ? `Weekend ${weekendSeries.first || "?"} - ${weekendSeries.last || "?"}`
    : "Weekend times unavailable";
  return `${escapeHtml(weekday)}<br>${escapeHtml(weekend)}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchScore(item, rawQuery, normalizedQuery) {
  const normalizedTitle = normalizeText(item.title);
  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 300;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 160;
  }

  if (item.searchText.includes(normalizedQuery)) {
    score += 80;
  }

  if ((item.subtitle || "").toLowerCase().includes(rawQuery.toLowerCase())) {
    score += 20;
  }

  if (item.kind === "route") {
    score += 15;
  }

  return score;
}

function pickFirstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") || "";
}

function getGaugeColor(level) {
  if (!Number.isFinite(level)) {
    return "#f3ca4d";
  }

  if (level <= 1) {
    return "#f75e57";
  }

  if (level === 2) {
    return "#ff7a21";
  }

  if (level === 3) {
    return "#f3ca4d";
  }

  return "#6fd7ff";
}

function getBmkgSeverity(maxRain, intervals) {
  const hasStormSignal = intervals.some((interval) => interval.weather >= 95 || /petir|storm|thunder/i.test(interval.weather_desc));

  if (hasStormSignal || maxRain >= 10) {
    return "Alert";
  }

  if (maxRain >= 3) {
    return "Watch";
  }

  if (intervals.some((interval) => interval.tp > 0.2 || /hujan|rain/i.test(interval.weather_desc))) {
    return "Rain";
  }

  return "Normal";
}

function getBmkgColor(severity) {
  if (severity === "Alert") {
    return "#f75e57";
  }

  if (severity === "Watch") {
    return "#ff7a21";
  }

  if (severity === "Rain") {
    return "#f3ca4d";
  }

  return "#2fd1c3";
}

function formatShortJakartaDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const normalized = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.slice(5, 10)} ${normalized.slice(11, 16)}`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = number;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function boundsArrayToFitBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    return null;
  }

  return [
    [bounds[0], bounds[1]],
    [bounds[2], bounds[3]],
  ];
}

function cloneFeature(feature) {
  return JSON.parse(JSON.stringify(feature));
}

function warmRouteSequences() {
  window.setTimeout(() => {
    if (state.routeSequencesStatus === "idle") {
      void ensureRouteSequences();
    }
  }, 450);
}

async function ensureRouteSequences(options = {}) {
  const { force = false } = options;

  if (state.routeSequences) {
    return state.routeSequences;
  }

  if (state.routeSequencesStatus === "loading" && state.routeSequencesPromise) {
    return state.routeSequencesPromise;
  }

  if (state.routeSequencesStatus === "error" && !force) {
    return null;
  }

  state.routeSequencesStatus = "loading";
  state.routeSequencesError = null;
  state.routeSequencesPromise = fetchJsonWithTimeout(ROUTE_SEQUENCE_URL, { timeoutMs: ROUTE_SEQUENCE_TIMEOUT_MS })
      .then((data) => {
        state.routeSequences = data;
        state.routeSequencesStatus = "ready";
        return data;
      })
      .catch((error) => {
        console.error(error);
        state.routeSequences = null;
        state.routeSequencesStatus = "error";
        state.routeSequencesError = error;
        return null;
      })
      .finally(() => {
        state.routeSequencesPromise = null;
      });

  return state.routeSequencesPromise;
}

async function fetchJsonWithTimeout(url, options = {}) {
  const { timeoutMs = 8000, cache = "default" } = options;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => {
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      cache,
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timed out loading stop sequence preview after ${Math.round(timeoutMs / 1000)}s.`);
    }

    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

function decorateRouteFeatures(collection) {
  collection.features.forEach((feature) => {
    feature.properties.routeGroup = classifyRouteGroup(feature.properties);
  });
}

function decorateStationFeatures(collection) {
  collection.features.forEach((feature) => {
    feature.properties.labelName = shortenStationName(feature.properties.name);
  });
}

function summarizeRouteGroups(features) {
  const counts = {};

  features.forEach((feature) => {
    if (!feature.properties.isActive) {
      return;
    }

    const group = feature.properties.routeGroup || classifyRouteGroup(feature.properties);
    counts[group] = (counts[group] || 0) + 1;
  });

  return counts;
}

function classifyRouteGroup(props) {
  const code = String(props.KODRUTE || "").toUpperCase();
  const routeType = String(props.TPRUTE || "").trim();
  const lowered = routeType.toLowerCase();

  if (routeType === "BRT") {
    return "BRT";
  }

  if (routeType === "Mikrotrans" || code.startsWith("JAK")) {
    return "Mikrotrans";
  }

  if (routeType === "Royaltrans" || String(props.TPBUS || "").includes("RY")) {
    return "Royaltrans";
  }

  if (routeType === "Bus Wisata" || code.startsWith("BW")) {
    return "Bus Wisata";
  }

  if (routeType === "Rusun" || lowered.includes("rusun")) {
    return "Rusun";
  }

  if (routeType === "Transjabodetabek") {
    return "Transjabodetabek";
  }

  if (routeType === "Angkutan Umum Integrasi") {
    return "Angkutan Umum Integrasi";
  }

  if (routeType === "Monas Explorer" || routeType === "Pencakar Langit" || routeType === "Sejarah Jakarta") {
    return "Bus Wisata";
  }

  return "Other services";
}

function shortenStationName(name) {
  return String(name || "")
    .replace(/^Stasiun MRT\s+/i, "")
    .replace(/^Stasiun LRT\s+/i, "")
    .replace(/^Stasiun\s+/i, "")
    .replace(/^Bundaran HI Bank Jakarta$/i, "Bundaran HI")
    .replace(/^ASEAN Headquarter$/i, "ASEAN")
    .replace(/\s+Bank Syariah Indonesia$/i, "")
    .replace(/\s+Indomaret$/i, "")
    .replace(/\s+TUKU$/i, "")
    .replace(/\s+Mastercard$/i, "")
    .replace(/\s+Mandiri$/i, "")
    .replace(/\s+BNI$/i, "")
    .replace(/\s+BCA$/i, "")
    .trim();
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hideLoading() {
  elements.loadingScreen.classList.add("hidden");
}

function showLoadingError(error) {
  elements.loadingScreen.classList.remove("hidden");
  elements.loadingScreen.innerHTML = `
    <div class="loading-card">
      <p class="eyebrow">Load failed</p>
      <h2>JKT3D could not start</h2>
      <p>${escapeHtml(error.message || String(error))}</p>
    </div>
  `;
}
