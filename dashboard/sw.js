/**
 * sw.js — Service Worker do Gestor Orion
 * Cache básico de assets estáticos para PWA offline-first
 */
const CACHE_NAME = 'orion-v3';
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
    self.skipWaiting(); // ativa imediatamente sem esperar aba fechar
});

// Responde ao postMessage SKIP_WAITING enviado pelo cliente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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

    // HTML, CSS e JS do painel: sempre network-first (garante atualiza\u00e7\u00f5es imediatas)
    const isAppAsset = url.pathname.endsWith('.html') ||
                       url.pathname.endsWith('.css') ||
                       url.pathname.endsWith('.js') ||
                       url.pathname === '/dashboard/' ||
                       url.pathname === '/dashboard';

    if (isAppAsset) {
        event.respondWith(
            fetch(request).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => caches.match(request)) // fallback para cache apenas se offline
        );
        return;
    }

    // Demais assets (imagens, fontes): cache-first
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
