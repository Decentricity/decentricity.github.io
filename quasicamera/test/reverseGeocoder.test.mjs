import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { GpsSensor } from "../assets/context/gps.js";
import {
  calculateLocationConfidence,
  formatLocationLabel,
  haversineMeters,
  isSparseReverseGeocode,
  mergeReverseGeocodes,
  needsReverseRefresh,
  normalizeBigDataCloud,
  normalizeNominatimGeocodeJson
} from "../assets/context/reverseGeocoder.js";
import { FrameStorage } from "../assets/gallery/storage.js";
import { PromptBuilder } from "../assets/promptBuilder.js";
import { renderReadout } from "../assets/ui/readout.js";

test("Haversine distance is approximately correct at building scale", () => {
  const meters = haversineMeters(-6.372184, 106.832614, -6.372486, 106.831916);
  assert.ok(meters > 80 && meters < 90, `${meters}m should be around 84m`);
});

test("Indonesian Depok fixture preserves named feature and full locality hierarchy", () => {
  const location = normalizeNominatimGeocodeJson(depokFixture(), -6.372184, 106.832614);
  assert.equal(location.provider, "nominatim");
  assert.equal(location.feature.name, "Margo City");
  assert.equal(location.feature.type, "shopping_mall");
  assert.equal(location.feature.category, "shop");
  assert.equal(location.address.houseNumber, "358");
  assert.equal(location.address.road, "Jalan Margonda Raya");
  assert.equal(location.address.neighborhood, "Kemiri Muka");
  assert.equal(location.address.suburb, "Beji");
  assert.equal(location.address.city, "Depok");
  assert.equal(location.address.region, "West Java");
  assert.equal(location.address.country, "Indonesia");
  assert.equal(formatLocationLabel({ latitude: -6.372184, longitude: 106.832614, reverseGeocode: location }), "Margo City, Kemiri Muka, Beji, Depok, Indonesia");
});

test("feature-name selection handles named amenity, road-only, and no named building", () => {
  assert.equal(normalizeNominatimGeocodeJson(amenityFixture(), 1, 1).feature.name, "Kopi Test");
  const roadOnly = normalizeNominatimGeocodeJson(roadOnlyFixture(), 1, 1);
  assert.equal(roadOnly.feature.name, "Jalan Margonda Raya");
  assert.equal(roadOnly.feature.type, "road");
  const unnamedBuilding = normalizeNominatimGeocodeJson(unnamedBuildingFixture(), 1, 1);
  assert.equal(unnamedBuilding.feature.name, "Jalan Contoh");
  assert.equal(unnamedBuilding.feature.type, "road");
});

test("suburb, city, country result remains useful when no named building exists", () => {
  const location = normalizeBigDataCloud({
    locality: "Beji",
    city: "Depok",
    principalSubdivision: "West Java",
    countryName: "Indonesia",
    countryCode: "ID",
    postcode: "16424"
  }, -6.37, 106.83);
  assert.equal(location.feature.name, null);
  assert.equal(location.address.suburb, null);
  assert.equal(location.address.city, "Depok");
  assert.equal(location.address.region, "West Java");
  assert.equal(location.address.country, "Indonesia");
  assert.equal(formatLocationLabel({ latitude: -6.37, longitude: 106.83, reverseGeocode: location }), "Beji, Depok, Indonesia");
});

test("confidence model is transparent", () => {
  assert.equal(calculateLocationConfidence({
    gpsAccuracyMeters: 8,
    featureDistanceMeters: 17,
    hasNamedFeature: true,
    hasUsefulLocality: true,
    provider: "nominatim"
  }), "high");
  assert.equal(calculateLocationConfidence({
    gpsAccuracyMeters: 40,
    featureDistanceMeters: 70,
    hasNamedFeature: false,
    hasUsefulLocality: true,
    provider: "nominatim"
  }), "medium");
  assert.equal(calculateLocationConfidence({
    gpsAccuracyMeters: 120,
    featureDistanceMeters: 400,
    hasNamedFeature: false,
    hasUsefulLocality: true,
    provider: "bigdatacloud"
  }), "low");
});

test("fallback merging fills null fields without overwriting detailed primary fields", () => {
  const primary = normalizeNominatimGeocodeJson(sparseFixture(), -6.37, 106.83);
  assert.equal(isSparseReverseGeocode(primary), true);
  const fallback = normalizeBigDataCloud({
    locality: "Beji",
    city: "Depok",
    principalSubdivision: "West Java",
    countryName: "Indonesia"
  }, -6.37, 106.83);
  const merged = mergeReverseGeocodes(primary, fallback);
  assert.equal(merged.provider, "nominatim+bigdatacloud");
  assert.equal(merged.address.city, "Depok");
  assert.equal(merged.address.region, "West Java");
  assert.equal(merged.address.country, "Indonesia");
});

test("distance cache refreshes at street scale, stale age, and improved accuracy", () => {
  const cached = {
    latitude: -6.372184,
    longitude: 106.832614,
    accuracy: 60,
    resolvedAt: 1_000
  };
  assert.equal(needsReverseRefresh({
    currentLatitude: -6.37219,
    currentLongitude: 106.83262,
    currentAccuracy: 60,
    cached,
    now: 2_000,
    staleMs: 60_000,
    moveThresholdMeters: 35
  }), false);
  assert.equal(needsReverseRefresh({
    currentLatitude: -6.3726,
    currentLongitude: 106.8329,
    currentAccuracy: 60,
    cached,
    now: 2_000,
    staleMs: 60_000,
    moveThresholdMeters: 35
  }), true);
  assert.equal(needsReverseRefresh({
    currentLatitude: -6.37219,
    currentLongitude: 106.83262,
    currentAccuracy: 60,
    cached,
    now: 70_000,
    staleMs: 60_000,
    moveThresholdMeters: 35
  }), true);
  assert.equal(needsReverseRefresh({
    currentLatitude: -6.37219,
    currentLongitude: 106.83262,
    currentAccuracy: 25,
    cached,
    now: 2_000,
    staleMs: 60_000,
    moveThresholdMeters: 35
  }), true);
});

test("GPS first returns coordinates, then resolves rich label and preserves it across nearby updates", async () => {
  const harness = installGpsHarness([
    normalizeNominatimGeocodeJson(depokFixture(), -6.372184, 106.832614),
    normalizeNominatimGeocodeJson(amenityFixture(), -6.373, 106.833)
  ]);
  const sensor = new GpsSensor(harness.provider, {
    reverseDebounceMs: 0,
    reverseMoveThresholdMeters: 35,
    reverseReuseDistanceMeters: 100
  });
  sensor.start();
  harness.emit(-6.372184, 106.832614, 8.4);
  assert.match((await sensor.snapshot()).label, /-6\.372184/);
  await harness.flush();
  assert.match((await sensor.snapshot()).label, /Margo City/);

  harness.emit(-6.37219, 106.83262, 8);
  assert.match((await sensor.snapshot()).label, /Margo City/);
  assert.equal(harness.provider.calls.length, 1);

  harness.emit(-6.373, 106.833, 8);
  await harness.flush();
  assert.equal(harness.provider.calls.length, 2);
});

test("failed refresh retains the last nearby successful reverse geocode", async () => {
  const harness = installGpsHarness([
    normalizeNominatimGeocodeJson(depokFixture(), -6.372184, 106.832614),
    new Error("provider failed")
  ]);
  const sensor = new GpsSensor(harness.provider, {
    reverseDebounceMs: 0,
    reverseMoveThresholdMeters: 10,
    reverseReuseDistanceMeters: 100
  });
  sensor.start();
  harness.emit(-6.372184, 106.832614, 8);
  await harness.flush();
  harness.emit(-6.3723, 106.8327, 8);
  await harness.flush();
  const snapshot = await sensor.snapshot();
  assert.match(snapshot.label, /Margo City/);
  assert.equal(snapshot.reverseGeocodeStatus, "error");
});

test("reverse-geocoder timeout does not block snapshot indefinitely", async () => {
  const harness = installGpsHarness([new Promise(() => undefined)]);
  const sensor = new GpsSensor(harness.provider, {
    reverseDebounceMs: 0,
    reverseTimeoutMs: 5
  });
  sensor.start();
  harness.emit(-6.372184, 106.832614, 8);
  const before = Date.now();
  const snapshot = await sensor.snapshot({ waitForReverseGeocodeMs: 10 });
  assert.ok(Date.now() - before < 80);
  assert.match(snapshot.label, /-6\.372184/);
});

test("prompt and JSON export include normalized location fields and truth constraints", async () => {
  const location = {
    status: "granted",
    latitude: -6.372184,
    longitude: 106.832614,
    accuracy: 8.4,
    label: "Margo City, Kemiri Muka, Beji, Depok, Indonesia",
    reverseGeocodeStatus: "granted",
    reverseGeocode: normalizeNominatimGeocodeJson(depokFixture(), -6.372184, 106.832614)
  };
  const context = contextForPrompt(location);
  const prompt = new PromptBuilder().build(context);
  assert.match(prompt, /GEOGRAPHIC CONTEXT/);
  assert.match(prompt, /Nearest mapped feature: Margo City/);
  assert.match(prompt, /Suburb: Beji/);
  assert.match(prompt, /They are contextual clues, not proof that the camera is physically inside that building/);
  assert.match(prompt, /Do not place a recognizable named building prominently/);

  const storage = new FrameStorage();
  const exported = JSON.parse(await storage.exportMetadata([{
    id: "frame-location",
    timestamp: context.capturedAt,
    imageDataUrl: "data:image/jpeg;base64,test",
    provider: "test",
    prompt,
    context
  }]).text());
  assert.equal(exported[0].context.location.reverseGeocode.feature.name, "Margo City");
  assert.equal(exported[0].context.location.reverseGeocode.address.suburb, "Beji");
});

test("viewfinder readout renders rich location label and non-empty debug rows", () => {
  const { document } = parseHTML("<dl id=\"readout\"></dl>");
  globalThis.document = document;
  const location = {
    status: "granted",
    latitude: -6.372184,
    longitude: 106.832614,
    accuracy: 8.4,
    label: "Margo City, Kemiri Muka, Beji, Depok, Indonesia",
    reverseGeocodeStatus: "granted",
    reverseGeocode: normalizeNominatimGeocodeJson(depokFixture(), -6.372184, 106.832614)
  };
  const readout = document.getElementById("readout");
  renderReadout(readout, contextForPrompt(location));
  assert.match(readout.textContent, /Location:Margo City, Kemiri Muka, Beji, Depok, Indonesia/);
  assert.match(readout.textContent, /Feature:Margo City/);
  assert.match(readout.textContent, /Street:Jalan Margonda Raya/);
  assert.match(readout.textContent, /Suburb:Beji/);
  assert.match(readout.textContent, /Location confidence:(High|Medium|Low)/);
});

test("legacy location objects without reverseGeocode remain compatible", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    status: "granted",
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 12,
    city: "Jakarta",
    region: "Jakarta",
    country: "Indonesia",
    label: "Jakarta, Indonesia"
  }));
  assert.match(prompt, /Location label: Jakarta, Indonesia/);
  assert.match(prompt, /Reverse-geocoding confidence: unknown/);
});

function depokFixture() {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {
        geocoding: {
          osm_key: "shop",
          osm_value: "shopping_mall",
          type: "house",
          label: "Margo City, 358, Jalan Margonda Raya, Kemiri Muka, Beji, Depok, West Java, 16424, Indonesia",
          name: "Margo City",
          housenumber: "358",
          street: "Jalan Margonda Raya",
          locality: "Kemiri Muka",
          district: "Beji",
          city: "Depok",
          state: "West Java",
          postcode: "16424",
          country: "Indonesia",
          country_code: "id",
          admin: {
            level6: "Beji",
            level5: "Depok",
            level4: "West Java"
          }
        }
      },
      geometry: {
        type: "Point",
        coordinates: [106.8327, -6.3721]
      }
    }]
  };
}

function amenityFixture() {
  return {
    features: [{
      properties: {
        geocoding: {
          osm_key: "amenity",
          osm_value: "cafe",
          type: "house",
          label: "Kopi Test, Jalan Contoh, Depok, Indonesia",
          name: "Kopi Test",
          street: "Jalan Contoh",
          city: "Depok",
          country: "Indonesia"
        }
      },
      geometry: { coordinates: [1, 1] }
    }]
  };
}

function roadOnlyFixture() {
  return {
    features: [{
      properties: {
        geocoding: {
          osm_key: "highway",
          osm_value: "primary",
          type: "street",
          label: "Jalan Margonda Raya, Depok, Indonesia",
          street: "Jalan Margonda Raya",
          city: "Depok",
          country: "Indonesia"
        }
      },
      geometry: { coordinates: [1, 1] }
    }]
  };
}

function unnamedBuildingFixture() {
  return {
    features: [{
      properties: {
        geocoding: {
          osm_key: "building",
          osm_value: "yes",
          type: "house",
          label: "Jalan Contoh, Depok, Indonesia",
          street: "Jalan Contoh",
          city: "Depok",
          country: "Indonesia"
        }
      },
      geometry: { coordinates: [1, 1] }
    }]
  };
}

function sparseFixture() {
  return {
    features: [{
      properties: {
        geocoding: {
          type: "city",
          label: "West Java, Indonesia",
          state: "West Java",
          country: "Indonesia"
        }
      },
      geometry: { coordinates: [106.83, -6.37] }
    }]
  };
}

function installGpsHarness(results) {
  let callback;
  const provider = {
    id: "fake-reverse",
    calls: [],
    async reverse(latitude, longitude) {
      this.calls.push({ latitude, longitude });
      const result = results.shift();
      if (result instanceof Error) {
        throw result;
      }

      if (result && typeof result.then === "function") {
        return await result;
      }

      return result;
    }
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
      geolocation: {
        watchPosition(success) {
          callback = success;
          return 1;
        }
      }
    }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout,
      clearTimeout
    }
  });

  return {
    provider,
    emit(latitude, longitude, accuracy) {
      callback({
        coords: {
          latitude,
          longitude,
          accuracy,
          altitude: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });
    },
    async flush() {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
}

function contextForPrompt(location) {
  return {
    capturedAt: "2026-07-17T00:00:02.000Z",
    mode: "outdoor",
    time: {
      iso: "2026-07-17T00:00:02.000Z",
      date: "Jul 17, 2026",
      time: "07:00",
      timezone: "Asia/Jakarta",
      hour: 7,
      dayPeriod: "morning"
    },
    location,
    weather: {
      status: "granted",
      temperatureC: 28,
      humidityPercent: 80,
      cloudCoverPercent: 70,
      rainMm: 0,
      windKph: 8,
      description: "Cloudy"
    },
    cameraPose: {
      azimuthDeg: 237,
      pitchDeg: 3,
      rollDeg: -2,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: 2_000
    },
    manualSettings: {
      focusStyle: "deep-focus",
      exposureCompensationEv: 0,
      subjectMode: "landscape",
      flashMode: "off",
      iso: 200
    },
    orientation: {
      status: "granted",
      alpha: 0,
      beta: 90,
      gamma: 0,
      aim: "Near horizon"
    },
    motion: {
      status: "granted",
      movement: "Handheld",
      accelerationMagnitude: 0.2,
      rotationRate: 0.1
    },
    audio: {
      status: "granted",
      averageVolume: 0.02,
      noisiness: 0.2,
      speechProbability: 0.1,
      descriptor: "Quiet"
    },
    battery: {
      status: "granted",
      levelPercent: 84,
      charging: false
    },
    device: {
      language: "en-US",
      languages: ["en-US"],
      deviceType: "phone",
      viewport: {
        width: 390,
        height: 844,
        pixelRatio: 3,
        orientation: "portrait"
      },
      screen: {
        width: 390,
        height: 844,
        colorDepth: 24
      },
      screenBrightness: "unavailable",
      userAgent: "test"
    }
  };
}
