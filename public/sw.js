// Service worker mínimo: existe só para permitir o "Instalar aplicação" no
// Android/Chrome. Deliberadamente NÃO guarda o HTML em cache (nunca
// mostra uma versão antiga da página) — só cacheia os ficheiros de
// build em /assets/, cujo nome muda a cada deploy (hash do Vite), por
// isso é sempre seguro.
const CACHE_VERSION = 'pinheira-v1';
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navegação (a própria página): sempre da rede. Só usa cache se
  // estiver mesmo offline. Isto garante que um deploy novo aparece
  // sempre, sem precisar de "limpar dados do site".
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })());
  }
});
