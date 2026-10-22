// Rezeptfang Service Worker: hält die App offline verfügbar, speichert Vorschaubilder zwischen
// und nimmt geteilte Inhalte (Links, Texte, Bilder) aus dem Android-Teilen-Menü entgegen.
const VERSION = 'rf-v7';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'rf-img').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function inboxPut(item) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('rf-inbox', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('items', { autoIncrement: true });
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('items', 'readwrite');
      tx.objectStore('items').add(item);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    };
  });
}

async function handleShare(req) {
  try {
    const fd = await req.formData();
    const files = fd.getAll('images').filter((f) => f && typeof f === 'object' && f.size);
    const text = [fd.get('url'), fd.get('text'), fd.get('title')].filter(Boolean).join(' ');
    await inboxPut({ text, files, at: Date.now() });
  } catch (_) {}
  return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) { e.respondWith(handleShare(req)); return; }
  if (req.method !== 'GET') return;

  // Seitenaufrufe: zuerst Netz, sonst Cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); }
          return res.ok ? res : caches.match('./index.html').then((hit) => hit || res);
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // YouTube-Vorschaubilder und Schriften: aus dem Cache, im Hintergrund nachladen
  if (url.hostname === 'i.ytimg.com' || url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(
      caches.open('rf-img').then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Eigene Dateien: Cache zuerst
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
