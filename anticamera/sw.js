const STATIC_CACHE = "anti-camera-static-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./assets/main.js",
  "./assets/pwa.js",
  "./assets/promptBuilder.js",
  "./assets/types.js",
  "./assets/capture/captureQueue.js",
  "./assets/context/audio.js",
  "./assets/context/battery.js",
  "./assets/context/cameraPose.js",
  "./assets/context/contextCollector.js",
  "./assets/context/device.js",
  "./assets/context/gps.js",
  "./assets/context/manualSettings.js",
  "./assets/context/reverseGeocoder.js",
  "./assets/context/sensors.js",
  "./assets/context/time.js",
  "./assets/context/utils.js",
  "./assets/context/weather.js",
  "./assets/gallery/gallery.js",
  "./assets/gallery/storage.js",
  "./assets/image/endpointImageProvider.js",
  "./assets/image/imageGenerator.js",
  "./assets/image/keyStore.js",
  "./assets/image/localPrototypeProvider.js",
  "./assets/image/openAIImagesProvider.js",
  "./assets/ui/app.js",
  "./assets/ui/dialMath.js",
  "./assets/ui/fullscreenController.js",
  "./assets/ui/manualControls.js",
  "./assets/ui/readout.js",
  "./assets/ui/shutterSound.js"
];
const STATIC_PATHS = new Set(STATIC_ASSETS.map((asset) => new URL(asset, self.location.href).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== STATIC_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode !== "navigate" && !STATIC_PATHS.has(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) => {
      return fetch(request, { cache: "no-cache" }).then((response) => {
        if (!response || !response.ok || response.type !== "basic") {
          return response;
        }

        void cache.put(request, response.clone());
        return response;
      }).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }

          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return new Response("Offline and uncached", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          });
        });
      });
    })
  );
});
