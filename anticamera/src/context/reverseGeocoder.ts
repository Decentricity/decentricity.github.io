import type { GeoContext, ReverseGeocodedLocation } from "../types.js";
import { compactLabel, round, safeError } from "./utils.js";

export interface ReverseGeocoder {
  readonly id: string;
  reverse(
    latitude: number,
    longitude: number,
    options?: {
      language?: string;
      signal?: AbortSignal;
    }
  ): Promise<ReverseGeocodedLocation>;
}

interface NominatimGeocodeJson {
  features?: Array<{
    properties?: {
      geocoding?: {
        label?: string;
        name?: string;
        type?: string;
        osm_key?: string;
        osm_value?: string;
        housenumber?: string;
        street?: string;
        locality?: string;
        district?: string;
        postcode?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
        country_code?: string;
        admin?: Record<string, string>;
        extra?: Record<string, string>;
      };
    };
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
}

interface BigDataCloudResponse {
  city?: string;
  locality?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; isoName?: string; adminLevel?: number }>;
    informative?: Array<{ name?: string; description?: string; order?: number }>;
  };
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  postcode?: string;
}

export interface ReverseCacheState {
  latitude: number;
  longitude: number;
  accuracy?: number | undefined;
  resolvedAt: number;
}

const EMPTY_ADDRESS: ReverseGeocodedLocation["address"] = {
  houseNumber: null,
  road: null,
  neighborhood: null,
  suburb: null,
  district: null,
  city: null,
  municipality: null,
  county: null,
  region: null,
  postcode: null,
  country: null,
  countryCode: null
};

const EMPTY_FEATURE: ReverseGeocodedLocation["feature"] = {
  name: null,
  type: null,
  category: null,
  latitude: null,
  longitude: null,
  distanceMeters: null
};

export class NominatimReverseGeocoder implements ReverseGeocoder {
  readonly id = "nominatim";

  async reverse(latitude: number, longitude: number, options: { language?: string; signal?: AbortSignal } = {}): Promise<ReverseGeocodedLocation> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "geocodejson");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("zoom", "18");
    if (options.language) {
      url.searchParams.set("accept-language", options.language);
    }

    const response = await fetch(url, options.signal ? { signal: options.signal } : undefined);
    if (!response.ok) {
      throw new Error(`Nominatim reverse geocode ${response.status}`);
    }

    return normalizeNominatimGeocodeJson(await response.json(), latitude, longitude);
  }
}

export class BigDataCloudReverseGeocoder implements ReverseGeocoder {
  readonly id = "bigdatacloud";

  async reverse(latitude: number, longitude: number, options: { language?: string; signal?: AbortSignal } = {}): Promise<ReverseGeocodedLocation> {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", options.language || "en");

    const response = await fetch(url, options.signal ? { signal: options.signal } : undefined);
    if (!response.ok) {
      throw new Error(`BigDataCloud reverse geocode ${response.status}`);
    }

    return normalizeBigDataCloud(await response.json(), latitude, longitude);
  }
}

export class CascadingReverseGeocoder implements ReverseGeocoder {
  readonly id: string;

  constructor(
    private readonly primary: ReverseGeocoder = new NominatimReverseGeocoder(),
    private readonly fallback: ReverseGeocoder = new BigDataCloudReverseGeocoder()
  ) {
    this.id = `${primary.id}+${fallback.id}`;
  }

  async reverse(latitude: number, longitude: number, options: { language?: string; signal?: AbortSignal } = {}): Promise<ReverseGeocodedLocation> {
    try {
      const primary = await this.primary.reverse(latitude, longitude, options);
      if (!isSparseReverseGeocode(primary)) {
        return primary;
      }

      try {
        return mergeReverseGeocodes(primary, await this.fallback.reverse(latitude, longitude, options));
      } catch {
        return primary;
      }
    } catch (primaryError) {
      try {
        return await this.fallback.reverse(latitude, longitude, options);
      } catch (fallbackError) {
        throw new Error(`${safeError(primaryError)}; fallback: ${safeError(fallbackError)}`);
      }
    }
  }
}

export function normalizeNominatimGeocodeJson(data: unknown, latitude: number, longitude: number): ReverseGeocodedLocation {
  const feature = (data as NominatimGeocodeJson).features?.[0];
  const geocoding = feature?.properties?.geocoding || {};
  const coordinates = feature?.geometry?.coordinates;
  const featureLatitude = numberOrNull(coordinates?.[1]);
  const featureLongitude = numberOrNull(coordinates?.[0]);
  const admin = geocoding.admin || {};
  const extra = geocoding.extra || {};
  const category = textOrNull(geocoding.osm_key);
  const type = textOrNull(geocoding.osm_value || geocoding.type);
  const address: ReverseGeocodedLocation["address"] = {
    ...EMPTY_ADDRESS,
    houseNumber: textOrNull(geocoding.housenumber),
    road: textOrNull(geocoding.street),
    neighborhood: textOrNull(geocoding.locality || admin.level8 || admin.level7),
    suburb: textOrNull(admin.level6 || geocoding.district),
    district: textOrNull(geocoding.district),
    city: textOrNull(geocoding.city || admin.level5),
    county: textOrNull(geocoding.county),
    region: textOrNull(geocoding.state || admin.level4),
    postcode: textOrNull(geocoding.postcode),
    country: textOrNull(geocoding.country),
    countryCode: textOrNull(geocoding.country_code)
  };
  const featureName = selectFeatureName({
    name: geocoding.name,
    category,
    type,
    road: address.road,
    displayName: geocoding.label,
    extra
  });
  const distanceMeters = featureLatitude === null || featureLongitude === null
    ? null
    : round(haversineMeters(latitude, longitude, featureLatitude, featureLongitude)) ?? null;

  return {
    provider: "nominatim",
    displayName: textOrNull(geocoding.label),
    feature: {
      ...EMPTY_FEATURE,
      name: featureName.name,
      type: featureName.type,
      category,
      latitude: featureLatitude,
      longitude: featureLongitude,
      distanceMeters
    },
    address,
    confidence: calculateLocationConfidence({
      gpsAccuracyMeters: undefined,
      featureDistanceMeters: distanceMeters,
      hasNamedFeature: Boolean(featureName.name && featureName.source !== "road" && featureName.source !== "display"),
      hasUsefulLocality: hasUsefulLocality(address),
      provider: "nominatim"
    }),
    resolvedAt: new Date().toISOString()
  };
}

export function normalizeBigDataCloud(data: unknown, latitude: number, longitude: number): ReverseGeocodedLocation {
  const response = data as BigDataCloudResponse;
  const administrative = response.localityInfo?.administrative || [];
  const informative = response.localityInfo?.informative || [];
  const neighborhood = informative.find((item) => item.description?.toLowerCase().includes("neighbourhood"))?.name
    || informative.find((item) => item.description?.toLowerCase().includes("neighborhood"))?.name
    || response.locality;
  const suburb = administrative.find((item) => item.adminLevel === 9)?.name
    || administrative.find((item) => item.adminLevel === 8)?.name;
  const city = response.city || response.locality || administrative.find((item) => item.adminLevel === 6)?.name;
  const region = response.principalSubdivision || administrative.find((item) => item.adminLevel === 4)?.name;
  const country = response.countryName || administrative.find((item) => item.adminLevel === 2)?.name;
  const address: ReverseGeocodedLocation["address"] = {
    ...EMPTY_ADDRESS,
    neighborhood: textOrNull(neighborhood),
    suburb: textOrNull(suburb),
    city: textOrNull(city),
    region: textOrNull(region),
    postcode: textOrNull(response.postcode),
    country: textOrNull(country),
    countryCode: textOrNull(response.countryCode)
  };

  return {
    provider: "bigdatacloud",
    displayName: compactLabel([address.neighborhood, address.suburb, address.city, address.region, address.country]) || null,
    feature: {
      ...EMPTY_FEATURE,
      latitude: latitude,
      longitude: longitude,
      distanceMeters: null
    },
    address,
    confidence: "low",
    resolvedAt: new Date().toISOString()
  };
}

export function mergeReverseGeocodes(primary: ReverseGeocodedLocation, fallback: ReverseGeocodedLocation): ReverseGeocodedLocation {
  const address = { ...primary.address };
  for (const key of Object.keys(address) as Array<keyof ReverseGeocodedLocation["address"]>) {
    address[key] = address[key] || fallback.address[key];
  }

  return {
    provider: `${primary.provider}+${fallback.provider}`,
    displayName: primary.displayName || fallback.displayName,
    feature: {
      name: primary.feature.name || fallback.feature.name,
      type: primary.feature.type || fallback.feature.type,
      category: primary.feature.category || fallback.feature.category,
      latitude: primary.feature.latitude ?? fallback.feature.latitude,
      longitude: primary.feature.longitude ?? fallback.feature.longitude,
      distanceMeters: primary.feature.distanceMeters ?? fallback.feature.distanceMeters
    },
    address,
    confidence: primary.confidence === "low" ? fallback.confidence : primary.confidence,
    resolvedAt: primary.resolvedAt
  };
}

export function isSparseReverseGeocode(location: ReverseGeocodedLocation): boolean {
  const address = location.address;
  return !address.road
    && !address.neighborhood
    && !address.suburb
    && !address.district
    && !address.city
    && Boolean(address.region || address.country);
}

export function formatLocationLabel(location: Pick<GeoContext, "latitude" | "longitude" | "reverseGeocode">): string {
  const reverse = location.reverseGeocode;
  if (reverse) {
    const address = reverse.address;
    const label = compactLabel([
      reverse.feature.name,
      address.neighborhood,
      address.suburb,
      address.city || address.municipality,
      address.country
    ]) || compactLabel([
      address.neighborhood,
      address.suburb,
      address.city || address.municipality,
      address.region,
      address.country
    ]);

    if (label) {
      return label;
    }
  }

  if (location.latitude !== undefined && location.longitude !== undefined) {
    return `${round(location.latitude, 6)}, ${round(location.longitude, 6)}`;
  }

  return "Waiting for GPS";
}

export function calculateLocationConfidence(input: {
  gpsAccuracyMeters?: number | undefined;
  featureDistanceMeters: number | null;
  hasNamedFeature: boolean;
  hasUsefulLocality: boolean;
  provider: string;
  stale?: boolean | undefined;
}): ReverseGeocodedLocation["confidence"] {
  if (input.stale || input.provider.includes("bigdatacloud")) {
    return input.hasUsefulLocality && (input.gpsAccuracyMeters ?? Infinity) <= 50 ? "medium" : "low";
  }

  const accuracy = input.gpsAccuracyMeters ?? Infinity;
  const distance = input.featureDistanceMeters ?? Infinity;
  if (accuracy <= 15 && input.hasNamedFeature && distance <= 25) {
    return "high";
  }

  if (accuracy <= 50 && (input.hasUsefulLocality || distance <= 80)) {
    return "medium";
  }

  return "low";
}

export function needsReverseRefresh(input: {
  currentLatitude: number;
  currentLongitude: number;
  currentAccuracy?: number | undefined;
  cached: ReverseCacheState | null;
  now: number;
  staleMs: number;
  moveThresholdMeters: number;
}): boolean {
  if (!input.cached) {
    return true;
  }

  if (input.now - input.cached.resolvedAt >= input.staleMs) {
    return true;
  }

  const distance = haversineMeters(
    input.currentLatitude,
    input.currentLongitude,
    input.cached.latitude,
    input.cached.longitude
  );
  if (distance >= input.moveThresholdMeters) {
    return true;
  }

  const cachedAccuracy = input.cached.accuracy;
  const currentAccuracy = input.currentAccuracy;
  return cachedAccuracy !== undefined
    && currentAccuracy !== undefined
    && cachedAccuracy > 25
    && currentAccuracy <= cachedAccuracy * 0.65;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radiusMeters = 6_371_000;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function cloneReverseGeocode(location: ReverseGeocodedLocation): ReverseGeocodedLocation {
  return {
    provider: location.provider,
    displayName: location.displayName,
    feature: { ...location.feature },
    address: { ...location.address },
    confidence: location.confidence,
    resolvedAt: location.resolvedAt
  };
}

export function applyAccuracyToReverseGeocode(
  location: ReverseGeocodedLocation,
  gpsAccuracyMeters: number | undefined
): ReverseGeocodedLocation {
  const copy = cloneReverseGeocode(location);
  copy.confidence = calculateLocationConfidence({
    gpsAccuracyMeters,
    featureDistanceMeters: copy.feature.distanceMeters,
    hasNamedFeature: Boolean(copy.feature.name && copy.feature.type !== "road"),
    hasUsefulLocality: hasUsefulLocality(copy.address),
    provider: copy.provider
  });
  return copy;
}

function selectFeatureName(input: {
  name?: string | undefined;
  category: string | null;
  type: string | null;
  road: string | null;
  displayName?: string | undefined;
  extra: Record<string, string>;
}): { name: string | null; type: string | null; source: "named" | "road" | "display" | "none" } {
  const name = textOrNull(input.name || input.extra.name || input.extra.brand || input.extra.operator);
  const preferredCategories = ["building", "amenity", "shop", "office", "tourism", "railway", "public_transport", "place"];
  if (name && input.category && preferredCategories.includes(input.category)) {
    return { name, type: input.type, source: "named" };
  }

  if (name && input.category !== "highway") {
    return { name, type: input.type, source: "named" };
  }

  if (input.road) {
    return { name: input.road, type: "road", source: "road" };
  }

  return {
    name: textOrNull(input.displayName),
    type: input.type,
    source: input.displayName ? "display" : "none"
  };
}

function hasUsefulLocality(address: ReverseGeocodedLocation["address"]): boolean {
  return Boolean(address.road || address.neighborhood || address.suburb || address.district || address.city || address.region || address.country);
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}
