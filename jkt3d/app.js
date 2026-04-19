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

const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

const INITIAL_VIEW = {
  center: [106.8272, -6.1754],
  zoom: 10.8,
  pitch: 54,
  bearing: -18,
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
  routes: ["tj-routes-line", "tj-routes-hit"],
  stops: ["tj-stop-clusters", "tj-stop-cluster-count", "tj-stops-unclustered"],
  rail: ["rail-lines"],
  mrt: ["mrt-line", "mrt-stations", "mrt-station-labels"],
  lrt: ["lrt-line", "lrt-stations", "lrt-station-labels"],
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
};

const elements = {};

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  cacheElements();
  bindStaticUi();
  renderSearchResults([], "");

  try {
    state.data = await loadData();
    decorateRouteFeatures(state.data.routes);
    state.routeTypeColors = buildRouteTypeColors(summarizeRouteGroups(state.data.routes.features));
    state.routeLookup = new Map(
      state.data.routes.features.map((feature) => [feature.properties.KODRUTE, feature]),
    );

    renderStats();
    renderRouteLegend();
    renderSources();
    renderGeneratedAt();
    buildSearchIndex();

    state.map = createMap();
    state.map.on("load", () => {
      addSources(state.map);
      addLayers(state.map);
      bindMapEvents(state.map);
      hideLoading();
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
  elements.resetViewButton = document.getElementById("resetViewButton");
  elements.loadingScreen = document.getElementById("loadingScreen");
  elements.detailEmpty = document.getElementById("detailEmpty");
  elements.detailContent = document.getElementById("detailContent");
}

function bindStaticUi() {
  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.clearSearchButton.addEventListener("click", clearSearch);
  elements.resetViewButton.addEventListener("click", resetView);
  elements.searchResults.addEventListener("click", handleSearchResultClick);
  elements.detailContent.addEventListener("click", handleDetailAction);

  document.querySelectorAll("[data-layer-group]").forEach((input) => {
    input.addEventListener("change", (event) => {
      if (!state.map || !state.map.isStyleLoaded()) {
        return;
      }
      applyLayerGroupVisibility(event.target.dataset.layerGroup, event.target.checked);
    });
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
    maxPitch: 70,
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
  map.addSource("mrt-line", { type: "geojson", data: state.data.mrtLine });
  map.addSource("mrt-stations", { type: "geojson", data: state.data.mrtStations });
  map.addSource("lrt-line", { type: "geojson", data: state.data.lrtLine });
  map.addSource("lrt-stations", { type: "geojson", data: state.data.lrtStations });
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
      "line-color": "rgba(244, 239, 228, 0.22)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 13, 2.4],
      "line-opacity": 0.7,
    },
  });

  map.addLayer({
    id: "tj-routes-line",
    type: "line",
    source: "tj-routes",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": routeColorExpression,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.1, 12, 3, 15, 7],
      "line-opacity": ["case", ["get", "isActive"], 0.74, 0.18],
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

  map.addLayer({
    id: "mrt-line",
    type: "line",
    source: "mrt-line",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#2fd1c3",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 5, 15, 9],
      "line-opacity": 0.95,
    },
  });

  map.addLayer({
    id: "lrt-line",
    type: "line",
    source: "lrt-line",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#f3ca4d",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.8, 12, 4.6, 15, 8],
      "line-opacity": 0.95,
    },
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
      "text-color": "#0b1112",
    },
  });

  map.addLayer({
    id: "tj-stops-unclustered",
    type: "circle",
    source: "tj-stops",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.8, 13, 5.5, 16, 8],
      "circle-color": ["case", ["get", "isActive"], "#f4efe4", "rgba(255,255,255,0.25)"],
      "circle-stroke-width": 1.2,
      "circle-stroke-color": ["case", ["get", "isActive"], "#2fd1c3", "rgba(255,255,255,0.18)"],
      "circle-opacity": ["case", ["get", "isActive"], 0.9, 0.32],
    },
  });

  map.addLayer({
    id: "mrt-stations",
    type: "circle",
    source: "mrt-stations",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 12, 6.5, 15, 8.5],
      "circle-color": "#2fd1c3",
      "circle-stroke-width": 1.8,
      "circle-stroke-color": "#072221",
    },
  });

  map.addLayer({
    id: "lrt-stations",
    type: "circle",
    source: "lrt-stations",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 12, 6.5, 15, 8.5],
      "circle-color": "#f3ca4d",
      "circle-stroke-width": 1.8,
      "circle-stroke-color": "#2a2308",
    },
  });

  map.addLayer({
    id: "mrt-station-labels",
    type: "symbol",
    source: "mrt-stations",
    minzoom: 12,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.15],
      "text-anchor": "top",
      "text-font": ["Open Sans Regular"],
    },
    paint: {
      "text-color": "#f4efe4",
      "text-halo-color": "rgba(11, 17, 18, 0.92)",
      "text-halo-width": 1,
    },
  });

  map.addLayer({
    id: "lrt-station-labels",
    type: "symbol",
    source: "lrt-stations",
    minzoom: 12,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.15],
      "text-anchor": "top",
      "text-font": ["Open Sans Regular"],
    },
    paint: {
      "text-color": "#f4efe4",
      "text-halo-color": "rgba(11, 17, 18, 0.92)",
      "text-halo-width": 1,
    },
  });

  map.addLayer({
    id: "selected-route-halo",
    type: "line",
    source: "selected-route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(255, 255, 255, 0.35)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 12, 10, 15, 16],
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
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.6, 12, 5.8, 15, 10],
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "selected-point-halo",
    type: "circle",
    source: "selected-point",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 12, 12, 16, 15, 22],
      "circle-color": "rgba(255,255,255,0.16)",
      "circle-stroke-width": 1.4,
      "circle-stroke-color": "rgba(255,255,255,0.35)",
    },
  });

  map.addLayer({
    id: "selected-point-core",
    type: "circle",
    source: "selected-point",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5.5, 12, 8.5, 15, 11],
      "circle-color": "#ff7a21",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff4dd",
    },
  });
}

function bindMapEvents(map) {
  bindPointerCursor(map, ["tj-routes-hit", "tj-stop-clusters", "tj-stops-unclustered", "mrt-stations", "lrt-stations"]);

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
    { label: "MRT + LRT stations", value: formatNumber(stats.mrtStationCount + stats.lrtStationCount) },
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
  elements.generatedAt.textContent = `Generated ${formatDate(state.data.manifest.generatedAt)}`;
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
      title: props.name,
      subtitle: `${props.mode}${props.locationMethod === "manual" ? " • manual coordinate fallback" : ""}`,
      searchText: normalizeText([props.name, props.mode, props.displayName, props.query].join(" ")),
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
    elements.searchResults.innerHTML = '<p class="detail-copy">Search across 686 routes, 8k+ stops, and MRT/LRT stations.</p>';
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
    duration: 900,
  });
}

function selectRoute(feature, focus) {
  state.selection = { kind: "route", feature };
  updateSelectionSources(feature, null);
  renderRouteDetail(feature);

  if (focus) {
    fitToGeometry(feature.geometry, feature.properties.bounds);
  }
}

function selectStop(feature, focus) {
  state.selection = { kind: "stop", feature };
  updateSelectionSources(null, feature);
  renderStopDetail(feature);

  if (focus) {
    flyToPoint(feature.geometry.coordinates, 14.2);
  }
}

function selectStation(feature, focus) {
  state.selection = { kind: "station", feature };
  updateSelectionSources(null, feature);
  renderStationDetail(feature);

  if (focus) {
    flyToPoint(feature.geometry.coordinates, 13.6);
  }
}

function updateSelectionSources(routeFeature, pointFeature) {
  if (!state.map) {
    return;
  }

  state.map
    .getSource("selected-route")
    .setData(routeFeature ? { type: "FeatureCollection", features: [cloneFeature(routeFeature)] } : EMPTY_FEATURE_COLLECTION);
  state.map
    .getSource("selected-point")
    .setData(pointFeature ? { type: "FeatureCollection", features: [cloneFeature(pointFeature)] } : EMPTY_FEATURE_COLLECTION);
}

function renderRouteDetail(feature) {
  const props = feature.properties;
  const sequence = state.routeSequences?.[props.KODRUTE] || null;
  const directions = (sequence?.directions || []).slice(0, 2);
  const sequenceMarkup = state.routeSequences
    ? directions.length
      ? `<div class="direction-columns">${directions.map(renderDirectionCard).join("")}</div>`
      : '<p class="detail-copy">This route is present in the geometry layer, but a stop sequence preview was not available in the exported sequence file.</p>'
    : '<p class="detail-copy">Loading stop sequence preview…</p>';
  const serviceTags = [props.routeGroup, props.TPBUS, props.isActive ? "Operational" : "Not operational"];
  if (props.TPRUTE && props.TPRUTE !== props.routeGroup) {
    serviceTags.push(props.TPRUTE);
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
      ${renderMetaCard("Stop preview", state.routeSequences ? (sequence ? `${sequence.directions.length} direction set(s)` : "No sequence found") : "Loading on demand")}
      ${renderMetaCard("Source status", escapeHtml(props.STSOPRS || "Unknown"))}
    </div>

    ${sequenceMarkup}

    <div class="detail-action-row">
      <button type="button" class="detail-action" data-action="frame-selection">Frame route</button>
    </div>
  `;

  showDetail(html);
  ensureRouteSequences().then(() => {
    if (state.selection?.kind === "route" && state.selection.feature.properties.KODRUTE === props.KODRUTE) {
      renderRouteDetail(state.selection.feature);
    }
  });
}

function renderStopDetail(feature) {
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

function renderStationDetail(feature) {
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
        <h2>${escapeHtml(props.name || "Unnamed station")}</h2>
        <p class="detail-copy">${escapeHtml(props.description || props.displayName || "No additional station description was exposed.")}</p>
      </div>
    </div>

    <div class="detail-tag-row">
      ${renderTag(props.mode || "Station")}
      ${renderTag(props.locationMethod === "manual" ? "Manual coordinate fallback" : "Geocoded station point")}
    </div>

    <div class="detail-meta-grid">
      ${renderMetaCard("Coordinate source", escapeHtml(props.query || "Unknown"))}
      ${renderMetaCard("Lat, Lng", `${feature.geometry.coordinates[1].toFixed(5)}, ${feature.geometry.coordinates[0].toFixed(5)}`)}
      ${renderMetaCard("Integration", Array.isArray(props.integration) ? formatNumber(props.integration.length) : "Not exposed")}
      ${renderMetaCard("Station mode", escapeHtml(props.mode || "Unknown"))}
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
        [schedule.firstRatanggaStart, schedule.lastRatanggaStart].filter(Boolean).join(" - ") || "Not exposed",
      ),
    );
  }

  if (schedule.firstRatanggaEnd || schedule.lastRatanggaEnd) {
    cards.push(
      renderMetaCard(
        "First / last to end",
        [schedule.firstRatanggaEnd, schedule.lastRatanggaEnd].filter(Boolean).join(" - ") || "Not exposed",
      ),
    );
  }

  if (!cards.length) {
    return "";
  }

  return `
    <div class="detail-meta-grid">
      ${cards.join("")}
    </div>
  `;
}

function showDetail(html) {
  elements.detailEmpty.classList.add("hidden");
  elements.detailContent.classList.remove("hidden");
  elements.detailContent.innerHTML = html;
}

function handleDetailAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !state.selection) {
    return;
  }

  const action = button.dataset.action;

  if (action === "frame-selection") {
    if (state.selection.kind === "route") {
      fitToGeometry(state.selection.feature.geometry, state.selection.feature.properties.bounds);
    } else {
      flyToPoint(state.selection.feature.geometry.coordinates, state.selection.kind === "stop" ? 14.2 : 13.6);
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
    duration: 900,
    bearing: state.map.getBearing(),
    pitch: Math.max(state.map.getPitch(), 38),
  });
}

function flyToPoint(coordinates, zoom) {
  if (!state.map) {
    return;
  }

  state.map.easeTo({
    center: coordinates,
    zoom,
    duration: 800,
    pitch: Math.max(state.map.getPitch(), 50),
  });
}

function geometryToBounds(geometry) {
  if (!geometry) {
    return null;
  }

  const coords = [];
  collectCoordinates(geometry, coords);

  if (!coords.length) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  coords.forEach(([lng, lat]) => {
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
  if (window.innerWidth <= 1024) {
    return 42;
  }

  return {
    top: 42,
    bottom: 42,
    left: 400,
    right: 400,
  };
}

function buildRouteTypeColors(routeTypeCounts) {
  const entries = Object.keys(routeTypeCounts).sort();
  const map = {};

  entries.forEach((type, index) => {
    const lowered = type.toLowerCase();

    if (lowered.includes("brt")) {
      map[type] = "#ff7a21";
      return;
    }
    if (lowered.includes("mikro") || lowered.includes("feeder")) {
      map[type] = "#2fd1c3";
      return;
    }
    if (lowered.includes("royal")) {
      map[type] = "#f3ca4d";
      return;
    }

    map[type] = TYPE_PALETTE[index % TYPE_PALETTE.length];
  });

  return map;
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
  return `${weekday}<br>${weekend}`;
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

async function ensureRouteSequences() {
  if (state.routeSequences) {
    return state.routeSequences;
  }

  if (!state.routeSequencesPromise) {
    state.routeSequencesPromise = fetch(ROUTE_SEQUENCE_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${ROUTE_SEQUENCE_URL}: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        state.routeSequences = data;
        return data;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
  }

  return state.routeSequencesPromise;
}

function decorateRouteFeatures(collection) {
  collection.features.forEach((feature) => {
    feature.properties.routeGroup = classifyRouteGroup(feature.properties);
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
