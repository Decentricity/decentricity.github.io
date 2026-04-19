#!/usr/bin/env python3

import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

ARCGIS_BASE = "https://jakartasatu.jakarta.go.id/server/rest/services"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
MRT_API_URL = "https://beweb-dev.jakartamrt.co.id/middleware/api/datum"
LRT_JAKARTA_SCHEDULE_URL = "https://www.lrtjakarta.co.id/jadwal.html"
KRL_SCHEDULE_URL = "https://kci.id/perjalanan-krl/jadwal-kereta"
KRL_ROUTE_MAP_URL = "https://kci.id/perjalanan-krl/peta-rute"
TRANSJAKARTA_GTFS_URL = "https://gtfs.transjakarta.co.id/files/file_gtfs.zip"
TRANSJAKARTA_REALTIME_NEWS_URL = (
    "https://transjakarta.co.id/news/real-time-transjakarta-information-now-available-on-google-maps"
)

MRT_STATION_ORDER = [
    "Stasiun MRT Lebak Bulus Bank Syariah Indonesia",
    "Stasiun MRT Fatmawati Indomaret",
    "Stasiun MRT Cipete Raya TUKU",
    "Stasiun MRT Haji Nawi",
    "Stasiun MRT Blok A",
    "Stasiun MRT Blok M BCA",
    "ASEAN Headquarter",
    "Stasiun MRT Senayan Mastercard",
    "Stasiun MRT Istora Mandiri",
    "Stasiun MRT Bendungan Hilir",
    "Stasiun MRT Setiabudi Astra",
    "Stasiun MRT Dukuh Atas BNI",
    "Bundaran HI Bank Jakarta",
]

MRT_GEOCODE_QUERIES = {
    "Bundaran HI Bank Jakarta": [
        "Bundaran HI Bank Jakarta, Jakarta, Indonesia",
    ],
    "Stasiun MRT Dukuh Atas BNI": [
        "Stasiun Dukuh Atas, Jakarta, Indonesia",
        "Dukuh Atas BNI, Jakarta, Indonesia",
    ],
    "Stasiun MRT Setiabudi Astra": [
        "Stasiun Setiabudi Astra, Jakarta, Indonesia",
        "Setiabudi Astra, Jakarta, Indonesia",
    ],
    "Stasiun MRT Istora Mandiri": [
        "Stasiun Istora Mandiri, Jakarta, Indonesia",
        "Istora Mandiri, Jakarta, Indonesia",
    ],
    "Stasiun MRT Senayan Mastercard": [
        "Stasiun Senayan, Jakarta, Indonesia",
        "Senayan Mastercard, Jakarta, Indonesia",
    ],
    "ASEAN Headquarter": [
        "ASEAN MRT, Jakarta, Indonesia",
        "Stasiun MRT ASEAN Headquarters, Jakarta, Indonesia",
    ],
    "Stasiun MRT Blok M BCA": [
        "Stasiun MRT Blok M BCA, Jakarta, Indonesia",
    ],
    "Stasiun MRT Blok A": [
        "Stasiun MRT Blok A, Jakarta, Indonesia",
    ],
    "Stasiun MRT Haji Nawi": [
        "Stasiun MRT Haji Nawi, Jakarta, Indonesia",
    ],
    "Stasiun MRT Cipete Raya TUKU": [
        "Stasiun MRT Cipete Raya TUKU, Jakarta, Indonesia",
    ],
    "Stasiun MRT Fatmawati Indomaret": [
        "Stasiun MRT Fatmawati Indomaret, Jakarta, Indonesia",
    ],
    "Stasiun MRT Lebak Bulus Bank Syariah Indonesia": [
        "Stasiun MRT Lebak Bulus, Jakarta, Indonesia",
        "Lebak Bulus MRT Station, Jakarta, Indonesia",
    ],
    "Stasiun MRT Bendungan Hilir": [
        "Stasiun Bendungan Hilir, Jakarta, Indonesia",
        "Bendungan Hilir, Jakarta, Indonesia",
    ],
}

LRT_STATION_ORDER = [
    "Stasiun Pegangsaan Dua",
    "Stasiun Boulevard Utara Summarecon Mall",
    "Stasiun Boulevard Selatan",
    "Stasiun Pulomas",
    "Stasiun Equestrian",
    "Stasiun Velodrome",
]

LRT_GEOCODE_QUERIES = {
    "Stasiun Pegangsaan Dua": [
        "Stasiun Pegangsaan Dua, Jakarta, Indonesia",
    ],
    "Stasiun Boulevard Utara Summarecon Mall": [
        "Stasiun Boulevard Utara Summarecon Mall, Jakarta, Indonesia",
        "Stasiun Boulevard Utara, Jakarta, Indonesia",
        "Boulevard Utara LRT, Jakarta, Indonesia",
    ],
    "Stasiun Boulevard Selatan": [
        "Stasiun Boulevard Selatan, Jakarta, Indonesia",
        "Boulevard Selatan LRT, Jakarta, Indonesia",
    ],
    "Stasiun Pulomas": [
        "Stasiun Pulomas, Jakarta, Indonesia",
        "Pulomas LRT, Jakarta, Indonesia",
    ],
    "Stasiun Equestrian": [
        "Stasiun Equestrian, Jakarta, Indonesia",
        "Equestrian LRT, Jakarta, Indonesia",
    ],
    "Stasiun Velodrome": [
        "Stasiun Velodrome, Jakarta, Indonesia",
        "Velodrome LRT, Jakarta, Indonesia",
    ],
}

MANUAL_STATION_LOCATIONS = {
    "Stasiun Boulevard Selatan": {
        "lat": -6.168989988163692,
        "lon": 106.89999550580978,
        "displayName": "Boulevard Selatan LRT station",
        "query": "Wikidata Q9970006",
        "sourceUrl": "https://www.wikidata.org/wiki/Q9970006",
    },
}

session = requests.Session()
session.headers.update(
    {"User-Agent": "DecentricityJKT3D/1.0 (contact: github.com/Decentricity)"}
)


def fetch_json(url, params=None, headers=None):
    response = session.get(url, params=params, headers=headers, timeout=60)
    response.raise_for_status()
    return response.json()


def fetch_response_metadata(url):
    try:
        response = session.head(url, allow_redirects=True, timeout=30)
        response.raise_for_status()
    except requests.RequestException:
        try:
            response = session.get(url, stream=True, timeout=30)
            response.raise_for_status()
        except requests.RequestException as error:
            return {
                "url": url,
                "error": str(error),
            }

    metadata = {
        "url": response.url,
        "contentType": response.headers.get("Content-Type"),
        "contentLength": response.headers.get("Content-Length"),
        "lastModified": response.headers.get("Last-Modified"),
        "etag": response.headers.get("ETag"),
    }
    response.close()
    return metadata


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def chunked(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def arcgis_query(base_url, layer_id, params):
    url = f"{base_url}/{layer_id}/query"
    return fetch_json(url, params=params)


def fetch_arcgis_features(base_url, layer_id, fields="*", where="1=1", geometry=True):
    object_id_data = arcgis_query(
        base_url,
        layer_id,
        {
            "where": where,
            "returnIdsOnly": "true",
            "f": "pjson",
        },
    )
    object_ids = sorted(object_id_data.get("objectIds") or [])
    features = []

    if not object_ids:
        return features

    for ids in chunked(object_ids, 200):
        page = arcgis_query(
            base_url,
            layer_id,
            {
                "objectIds": ",".join(str(object_id) for object_id in ids),
                "outFields": fields,
                "returnGeometry": "true" if geometry else "false",
                "outSR": "4326",
                "f": "pjson",
            },
        )
        features.extend(page.get("features") or [])

    return features


def is_active_status(value):
    value = (value or "").strip().lower()
    return "oper" in value


def clean_text(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = " ".join(value.split())
        return value or None
    return value


def round_coordinate_pair(coordinates, digits=5):
    return [round(coordinates[0], digits), round(coordinates[1], digits)]


def dedupe_coordinates(coordinates):
    if not coordinates:
        return []

    deduped = [round_coordinate_pair(coordinates[0])]

    for coordinates_pair in coordinates[1:]:
        rounded = round_coordinate_pair(coordinates_pair)
        if rounded != deduped[-1]:
            deduped.append(rounded)

    return deduped


def point_line_distance(point, start, end):
    if start == end:
        return ((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2) ** 0.5

    numerator = abs(
        (end[1] - start[1]) * point[0]
        - (end[0] - start[0]) * point[1]
        + end[0] * start[1]
        - end[1] * start[0]
    )
    denominator = ((end[1] - start[1]) ** 2 + (end[0] - start[0]) ** 2) ** 0.5
    return numerator / denominator


def simplify_line(coordinates, tolerance=0.00004):
    coordinates = dedupe_coordinates(coordinates)

    if len(coordinates) <= 2:
        return coordinates

    max_distance = -1
    split_index = -1

    for index in range(1, len(coordinates) - 1):
        distance = point_line_distance(coordinates[index], coordinates[0], coordinates[-1])
        if distance > max_distance:
            max_distance = distance
            split_index = index

    if max_distance <= tolerance:
        return [coordinates[0], coordinates[-1]]

    left = simplify_line(coordinates[: split_index + 1], tolerance)
    right = simplify_line(coordinates[split_index:], tolerance)
    return left[:-1] + right


def simplify_paths(paths, tolerance=0.00004):
    simplified = []

    for path in paths:
        line = simplify_line(path, tolerance)
        if len(line) >= 2:
            simplified.append(line)

    return simplified


def arcgis_point_to_geojson(feature):
    geometry = feature.get("geometry") or {}
    attributes = {key: clean_text(value) for key, value in (feature.get("attributes") or {}).items()}
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": round_coordinate_pair([geometry["x"], geometry["y"]]),
        },
        "properties": attributes,
    }


def arcgis_line_to_geojson(feature):
    geometry = feature.get("geometry") or {}
    paths = simplify_paths(geometry.get("paths") or [])
    attributes = {key: clean_text(value) for key, value in (feature.get("attributes") or {}).items()}

    if len(paths) == 1:
        geometry_data = {"type": "LineString", "coordinates": paths[0]}
    else:
        geometry_data = {"type": "MultiLineString", "coordinates": paths}

    return {
        "type": "Feature",
        "geometry": geometry_data,
        "properties": attributes,
    }


def geometry_bounds(geometry):
    if geometry["type"] == "Point":
        lon, lat = geometry["coordinates"]
        return [lon, lat, lon, lat]

    min_lon = 180.0
    min_lat = 90.0
    max_lon = -180.0
    max_lat = -90.0

    if geometry["type"] == "LineString":
        segments = [geometry["coordinates"]]
    else:
        segments = geometry["coordinates"]

    for segment in segments:
        for lon, lat in segment:
            min_lon = min(min_lon, lon)
            min_lat = min(min_lat, lat)
            max_lon = max(max_lon, lon)
            max_lat = max(max_lat, lat)

    return [min_lon, min_lat, max_lon, max_lat]


def geocode_feature(name, candidates):
    for candidate in candidates:
        response = session.get(
            NOMINATIM_URL,
            params={"q": candidate, "format": "jsonv2", "limit": 1},
            timeout=60,
        )
        response.raise_for_status()
        results = response.json()

        if results:
            match = results[0]
            return {
                "name": name,
                "lat": float(match["lat"]),
                "lon": float(match["lon"]),
                "displayName": match["display_name"],
                "query": candidate,
            }

        time.sleep(1.05)

    raise RuntimeError(f"Could not geocode station: {name}")


def locate_station(name, geocode_queries, manual_locations=None):
    candidates = geocode_queries[name]

    try:
        location = geocode_feature(name, candidates)
        location["method"] = "nominatim"
        return location
    except RuntimeError:
        fallback = (manual_locations or {}).get(name)
        if fallback:
            return {
                "name": name,
                "lat": fallback["lat"],
                "lon": fallback["lon"],
                "displayName": fallback["displayName"],
                "query": fallback["query"],
                "method": "manual",
                "sourceUrl": fallback.get("sourceUrl"),
            }
        raise


def first_and_last_from_series(series):
    times = [part.strip() for part in (series or "").split(";") if part.strip()]
    if not times:
        return {"first": None, "last": None}
    return {"first": times[0], "last": times[-1]}


def summarize_mrt_schedule(schedule):
    summary = {
        "towardsStart": schedule.get("start"),
        "towardsEnd": schedule.get("end"),
        "weekdayToStart": first_and_last_from_series(schedule.get("weekdaysStart")),
        "weekendToStart": first_and_last_from_series(schedule.get("weekendsStart")),
        "weekdayToEnd": first_and_last_from_series(schedule.get("weekdaysEnd")),
        "weekendToEnd": first_and_last_from_series(schedule.get("weekendsEnd")),
        "firstRatanggaStart": clean_text(schedule.get("firstRatanggaStart")),
        "lastRatanggaStart": clean_text(schedule.get("lastRatanggaStart")),
        "firstRatanggaEnd": clean_text(schedule.get("firstRatanggaEnd")),
        "lastRatanggaEnd": clean_text(schedule.get("lastRatanggaEnd")),
    }
    return summary


def build_transjakarta_routes():
    base_url = f"{ARCGIS_BASE}/Jaklingko/Rute_TJ/FeatureServer"
    features = fetch_arcgis_features(base_url, 3, fields="KODRUTE,NMRUTE,TPRUTE,TPBUS,STSOPRS,KM")
    geojson_features = [arcgis_line_to_geojson(feature) for feature in features]

    for feature in geojson_features:
        feature["properties"]["isActive"] = is_active_status(feature["properties"].get("STSOPRS"))
        feature["properties"]["bounds"] = geometry_bounds(feature["geometry"])

    return {"type": "FeatureCollection", "features": geojson_features}


def build_transjakarta_stops():
    base_url = f"{ARCGIS_BASE}/Jaklingko/Perhentian_TJ/FeatureServer"
    fields = (
        "IDSTOP,NMPRHNTIAN,TPPRHNTIAN,TPHALTEKRDR,WADMKC,WADMKK,"
        "OPRRUTE,KORIDOR,STSOPRS,LATITUDE,LONGITUDE,JMLRUTE,JNSPRHNTIAN"
    )
    features = fetch_arcgis_features(base_url, 0, fields=fields)
    geojson_features = [arcgis_point_to_geojson(feature) for feature in features]

    for feature in geojson_features:
        routes = [
            route.strip()
            for route in (feature["properties"].get("OPRRUTE") or "").split(",")
            if route.strip()
        ]
        feature["properties"]["routes"] = routes
        feature["properties"]["isActive"] = is_active_status(feature["properties"].get("STSOPRS"))

    return {"type": "FeatureCollection", "features": geojson_features}


def build_route_sequences():
    base_url = f"{ARCGIS_BASE}/Jaklingko/Stop_Sequence_Transjakarta/FeatureServer"
    fields = (
        "KATRUTE,KETERAGAN,KODPP,KODRUTE,KODTRIP,NMPRHNTIAN,NMRUTE,"
        "NMTRIP,STSOPRSHALTE,STSOPRSRUTE,STSOPRSTRIPGTFS,IDSTOP,TPPRHNTIAN,URUTAN"
    )
    records = fetch_arcgis_features(base_url, 1, fields=fields, geometry=False)

    trip_groups = defaultdict(list)

    for record in records:
        attributes = {key: clean_text(value) for key, value in (record.get("attributes") or {}).items()}
        trip_key = (attributes.get("KODRUTE"), attributes.get("KODPP"), attributes.get("KODTRIP"))
        trip_groups[trip_key].append(attributes)

    routes = defaultdict(list)
    route_names = {}
    route_categories = {}

    for (route_code, _, trip_id), stops in trip_groups.items():
        if not route_code:
            continue

        ordered = sorted(stops, key=lambda item: int(item.get("URUTAN") or 0))
        sample = ordered[0]

        if not (
            is_active_status(sample.get("STSOPRSRUTE"))
            and is_active_status(sample.get("STSOPRSHALTE"))
            and is_active_status(sample.get("STSOPRSTRIPGTFS"))
        ):
            continue

        direction_label = sample.get("KETERAGAN") or f"Direction {sample.get('KODPP')}"
        routes[route_code].append(
            {
                "direction": direction_label,
                "tripId": trip_id,
                "tripName": sample.get("NMTRIP"),
                "stops": [
                    {
                        "id": stop.get("IDSTOP"),
                        "name": stop.get("NMPRHNTIAN"),
                        "type": stop.get("TPPRHNTIAN"),
                        "order": stop.get("URUTAN"),
                    }
                    for stop in ordered
                ],
            }
        )
        route_names[route_code] = sample.get("NMRUTE")
        route_categories[route_code] = sample.get("KATRUTE")

    result = {}

    for route_code, directions in routes.items():
        result[route_code] = {
            "routeName": route_names.get(route_code),
            "category": route_categories.get(route_code),
            "directions": sorted(directions, key=lambda item: (item["direction"], -len(item["stops"]))),
        }

    return result


def build_jakarta_rail_lines():
    base_url = f"{ARCGIS_BASE}/JakartaSatu/Jalur_Kereta_Api/FeatureServer"
    features = fetch_arcgis_features(base_url, 0, fields="OBJECTID,Shape__Length")
    geojson_features = [arcgis_line_to_geojson(feature) for feature in features]

    for feature in geojson_features:
        feature["properties"]["bounds"] = geometry_bounds(feature["geometry"])

    return {"type": "FeatureCollection", "features": geojson_features}


def build_station_collection(mode, order, geocode_queries, station_info_lookup=None, manual_locations=None):
    features = []

    for name in order:
        geocoded = locate_station(name, geocode_queries, manual_locations)
        properties = {
            "name": name,
            "mode": mode,
            "query": geocoded["query"],
            "displayName": geocoded["displayName"],
            "locationMethod": geocoded["method"],
        }

        if geocoded.get("sourceUrl"):
            properties["locationSourceUrl"] = geocoded["sourceUrl"]

        if station_info_lookup and name in station_info_lookup:
            properties.update(station_info_lookup[name])

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [geocoded["lon"], geocoded["lat"]],
                },
                "properties": properties,
            }
        )
        time.sleep(1.05)

    return {"type": "FeatureCollection", "features": features}


def build_line_from_station_collection(collection, line_name, mode):
    coordinates = [feature["geometry"]["coordinates"] for feature in collection["features"]]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {
                    "name": line_name,
                    "mode": mode,
                    "bounds": geometry_bounds({"type": "LineString", "coordinates": coordinates}),
                },
            }
        ],
    }


def build_mrt_stations():
    items = fetch_json(MRT_API_URL, params={"slug": "stasiun"}, headers={"Accept": "application/json"})
    station_info = {}

    for item in items.get("data") or []:
        obj = item.get("object") or {}
        schedule = obj.get("schedule")

        if not schedule:
            continue

        name = clean_text(item.get("name"))
        integration = obj.get("integration")

        if isinstance(integration, dict):
            integration = sorted(clean_text(key) for key in integration.keys())

        station_info[name] = {
            "slug": clean_text(item.get("slug")),
            "description": clean_text(item.get("description")),
            "mapsUrl": clean_text(obj.get("maps")),
            "integration": integration or [],
            "schedule": summarize_mrt_schedule(schedule),
        }

    return build_station_collection("MRT Jakarta", MRT_STATION_ORDER, MRT_GEOCODE_QUERIES, station_info)


def build_lrt_stations():
    station_info = {
        name: {
            "description": "Official station list from the LRT Jakarta schedule page.",
            "sourceUrl": LRT_JAKARTA_SCHEDULE_URL,
        }
        for name in LRT_STATION_ORDER
    }
    return build_station_collection(
        "LRT Jakarta",
        LRT_STATION_ORDER,
        LRT_GEOCODE_QUERIES,
        station_info,
        MANUAL_STATION_LOCATIONS,
    )


def build_manifest(routes, stops, rail_lines, mrt_stations, lrt_stations, route_sequences):
    route_type_counts = defaultdict(int)
    bus_type_counts = defaultdict(int)

    for feature in routes["features"]:
        props = feature["properties"]
        if props.get("isActive"):
            route_type_counts[props.get("TPRUTE") or "Unknown"] += 1
            bus_type_counts[props.get("TPBUS") or "Unknown"] += 1

    active_stops = sum(1 for feature in stops["features"] if feature["properties"].get("isActive"))

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {
                "name": "Transjakarta GTFS",
                "url": TRANSJAKARTA_GTFS_URL,
                "metadata": fetch_response_metadata(TRANSJAKARTA_GTFS_URL),
                "note": "Official static GTFS feed. Used here as a verified source reference.",
            },
            {
                "name": "Transjakarta realtime announcement",
                "url": TRANSJAKARTA_REALTIME_NEWS_URL,
                "note": "Official statement that realtime bus information is available in Google Maps. No public GTFS-RT URL was found during implementation.",
            },
            {
                "name": "Jaklingko Rute_TJ",
                "url": f"{ARCGIS_BASE}/Jaklingko/Rute_TJ/MapServer",
                "note": "Official Jaklingko ArcGIS route geometry and metadata for Transjakarta and related services.",
            },
            {
                "name": "Jaklingko Perhentian_TJ",
                "url": f"{ARCGIS_BASE}/Jaklingko/Perhentian_TJ/MapServer",
                "note": "Official Jaklingko ArcGIS stop layer with stop ids, served routes, and status.",
            },
            {
                "name": "Jaklingko Stop_Sequence_Transjakarta",
                "url": f"{ARCGIS_BASE}/Jaklingko/Stop_Sequence_Transjakarta/MapServer",
                "note": "Official Jaklingko stop sequence layer used to build per-route stop previews.",
            },
            {
                "name": "JakartaSatu Jalur Kereta Api",
                "url": f"{ARCGIS_BASE}/JakartaSatu/Jalur_Kereta_Api/MapServer",
                "note": "Official JakartaSatu rail geometry. It provides line geometry but almost no naming metadata.",
            },
            {
                "name": "MRT Jakarta station data API",
                "url": f"{MRT_API_URL}?slug=stasiun",
                "note": "Official MRT Jakarta web API used here for station schedules and integration metadata.",
            },
            {
                "name": "LRT Jakarta schedule page",
                "url": LRT_JAKARTA_SCHEDULE_URL,
                "note": "Official source used for the LRT Jakarta station list.",
            },
            {
                "name": "KAI Commuter schedule page",
                "url": KRL_SCHEDULE_URL,
                "note": "Official KRL timetable page. A public machine-readable API was not found during implementation.",
            },
            {
                "name": "KAI Commuter route map page",
                "url": KRL_ROUTE_MAP_URL,
                "note": "Official KRL route map page referenced in the source panel.",
            },
            {
                "name": "OpenStreetMap Nominatim",
                "url": "https://nominatim.openstreetmap.org/",
                "note": "Used only as a fallback geocoder for MRT and LRT station coordinates where official machine-readable coordinates were not exposed.",
            },
            {
                "name": "Wikidata station coordinate fallback",
                "url": "https://www.wikidata.org/wiki/Q9970006",
                "note": "Used only where the public geocoder did not resolve a station name consistently during the build.",
            },
        ],
        "stats": {
            "activeRouteCount": sum(1 for feature in routes["features"] if feature["properties"].get("isActive")),
            "totalRouteCount": len(routes["features"]),
            "activeStopCount": active_stops,
            "totalStopCount": len(stops["features"]),
            "railGeometryCount": len(rail_lines["features"]),
            "mrtStationCount": len(mrt_stations["features"]),
            "lrtStationCount": len(lrt_stations["features"]),
            "routeTypeCounts": dict(sorted(route_type_counts.items())),
            "busTypeCounts": dict(sorted(bus_type_counts.items())),
            "routeSequenceCount": len(route_sequences),
        },
    }


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching Transjakarta routes...")
    routes = build_transjakarta_routes()
    print("Fetching Transjakarta stops...")
    stops = build_transjakarta_stops()
    print("Building route sequences...")
    route_sequences = build_route_sequences()
    print("Fetching Jakarta rail geometry...")
    rail_lines = build_jakarta_rail_lines()
    print("Building MRT station dataset...")
    mrt_stations = build_mrt_stations()
    mrt_line = build_line_from_station_collection(mrt_stations, "MRT Jakarta North-South Line", "MRT Jakarta")
    print("Building LRT Jakarta station dataset...")
    lrt_stations = build_lrt_stations()
    lrt_line = build_line_from_station_collection(lrt_stations, "LRT Jakarta Line 1", "LRT Jakarta")
    print("Writing manifest...")
    manifest = build_manifest(routes, stops, rail_lines, mrt_stations, lrt_stations, route_sequences)

    write_json(DATA_DIR / "transjakarta-routes.geojson", routes)
    write_json(DATA_DIR / "transjakarta-stops.geojson", stops)
    write_json(DATA_DIR / "transjakarta-route-sequences.json", route_sequences)
    write_json(DATA_DIR / "jakarta-rail-lines.geojson", rail_lines)
    write_json(DATA_DIR / "mrt-stations.geojson", mrt_stations)
    write_json(DATA_DIR / "mrt-line.geojson", mrt_line)
    write_json(DATA_DIR / "lrtj-stations.geojson", lrt_stations)
    write_json(DATA_DIR / "lrtj-line.geojson", lrt_line)
    write_json(DATA_DIR / "source-manifest.json", manifest)

    print("Generated JKT3D data files in", DATA_DIR)


if __name__ == "__main__":
    main()
