// Offline cache for the PELearn reader (GitHub Pages build).
// The version placeholder below is replaced at build time with a hash of the page, so every deploy
// installs a fresh worker and clears the previous cache.
const PREFIX = 'pelearn-reader-azure-';
const CACHE = PREFIX + '8c511c924f9b';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        // This guide's older caches, plus the pre-library cache name (pelearn-reader-<hash>).
        .filter((k) => (k.startsWith(PREFIX) && k !== CACHE) || /^pelearn-reader-[0-9a-f]{12}$/.test(k))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Narration audio lives in separate pelearn-audio-* sites and is cached by the page itself.
  if (new URL(req.url).pathname.includes('/pelearn-audio-')) return;

  // The page: try the network first (revalidating past GitHub's 10-minute cache) so you get
  // the latest version when online, and fall back to the saved copy when offline or slow.
  if (req.mode === 'navigate') {
    const scopePath = new URL(self.registration.scope).pathname;
    const pathName = new URL(req.url).pathname;
    if (pathName !== scopePath && pathName !== scopePath + 'index.html') return; // not the reader page
    event.respondWith(
      withTimeout(fetch(req, { cache: 'no-cache' }), 4000)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match('./index.html'))),
    );
    return;
  }

  // Everything else (icons, manifest): cache first.
  event.respondWith(
    caches.open(CACHE)
      .then((cache) => cache.match(req, { ignoreSearch: true }))
      .then((hit) => hit || fetch(req)),
  );
});
