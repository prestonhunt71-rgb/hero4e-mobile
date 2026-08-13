const CACHE = "hero4e-mobile-v3";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./src/app.js", "./src/rules.js", "./src/hdc.js", "./src/store.js", "./src/styles.css", "./icons/hero4e.svg", "./icons/hero4e-180.png", "./icons/hero4e-512.png", "./samples/The%20Iron%20Wolf.hdc"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)));
});


self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));
