/**
 * sw.js — Service Worker do Gestor Orion
 * Cache básico de assets estáticos para PWA offline-first
 */
const CACHE_NAME = 'orion-v1';
const STATIC_ASSETS = [
    '/dashboard/',
    '/dashboard/index.html',
    '/dashboard/style.css',
    '/dashboard/dashboard.js',
    '/dashboard/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API requests: network-first, sem cache
    if (url.pathname.startsWith('/auth') ||
        url.pathname.startsWith('/clients') ||
        url.pathname.startsWith('/resellers') ||
        url.pathname.startsWith('/report') ||
        url.pathname.startsWith('/servers') ||
        url.pathname.startsWith('/owner') ||
        url.pathname.startsWith('/tenant') ||
        url.pathname.startsWith('/master')) {
        return; // deixa o browser lidar normalmente
    }

    // Assets estáticos: cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
