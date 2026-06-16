const CACHE_NAME = 'falk-tracker-v4-pro-cache-v1';

// Daftar file statis lokal yang wajib langsung di-cache saat instalasi
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Event INSTALL: Menyimpan file inti ke dalam Cache Storage
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch(err => console.error('Gagal meng-cache aset:', err))
  );
});

// Event ACTIVATE: Menghapus cache versi lama jika ada pembaruan
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Event FETCH: Strategi Dynamic Caching agar library eksternal tetap jalan saat offline
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // MENCEGAH CACHING UNTUK PROSES UPLOAD KE GOOGLE SHEETS
  // Agar API POST tidak diblokir oleh Service Worker
  if (event.request.method === 'POST' || requestUrl.hostname === 'script.google.com') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Jika ada di cache, langsung gunakan cache (Offline Ready)
      if (cachedResponse) {
        // Melakukan update cache secara diam-diam di background (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* Abaikan jika offline */ });
        
        return cachedResponse;
      }

      // 2. Jika tidak ada di cache, ambil dari internet lalu simpan ke cache
      return fetch(event.request).then(networkResponse => {
        // Jangan simpan file jika response gagal/error
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(error => {
        console.error('Fetch gagal (mode offline dan tidak ada di cache):', event.request.url);
      });
    })
  );
});
