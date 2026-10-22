// ReciGrab Service Worker: hält die App offline verfügbar, speichert Vorschaubilder zwischen
// nimmt geteilte Inhalte (Links, Texte, Bilder) aus dem Android-Teilen-Menü entgegen
// und führt Rezept-Importe im Hintergrund aus, auch wenn die App nicht sichtbar ist.
const VERSION = 'rf-v13';
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

/* ---------- Import im Hintergrund ---------- */
function jobsDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('rf-jobs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('jobs', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function jobPut(job) {
  const d = await jobsDb();
  await new Promise((res, rej) => {
    const tx = d.transaction('jobs', 'readwrite');
    tx.objectStore('jobs').put(job);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function tellClients(msg) {
  const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of cs) c.postMessage(msg);
  return cs;
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'import') e.waitUntil(runJob(e.data));
});

async function runJob({ id, body, key, referer, label }) {
  await jobPut({ id, status: 'running', at: Date.now() });
  const send = () => fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': referer, 'X-Title': 'ReciGrab' },
    body: JSON.stringify(body),
  });
  let content = '', finish = '', cost = null, broken = false, lastN = -1;
  try {
    let res = await send();
    if (!res.ok && res.status === 400) {
      const t = await res.text();
      if (/response_format|json/i.test(t)) { delete body.response_format; res = await send(); }
      else if (/stream/i.test(t) && body.stream) { body.stream = false; res = await send(); }
      else return finishJob({ id, status: 'error', code: 400, text: t }, label);
    }
    if (!res.ok) return finishJob({ id, status: 'error', code: res.status, text: await res.text() }, label);
    if (!(res.headers.get('content-type') || '').includes('event-stream')) {
      const j = await res.json();
      if (j.error) return finishJob({ id, status: 'error', code: j.error.code || 500, text: JSON.stringify(j) }, label);
      let c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (Array.isArray(c)) c = c.map((x) => x.text || '').join('');
      return finishJob({ id, status: 'done', content: c || '', finish: (j.choices && j.choices[0] && j.choices[0].finish_reason) || '', cost: j.usage ? j.usage.cost : null, broken: false }, label);
    }
    tellClients({ type: 'progress', id, phase: 'read', n: 0 });
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          let j; try { j = JSON.parse(payload); } catch (_) { continue; }
          if (j.error) return finishJob({ id, status: 'error', code: j.error.code || 500, text: JSON.stringify(j) }, label);
          const ch = j.choices && j.choices[0], piece = ch && ch.delta && ch.delta.content;
          if (piece) {
            content += Array.isArray(piece) ? piece.map((c) => c.text || '').join('') : piece;
            const n = (content.match(/"title"\s*:/g) || []).length;
            if (n !== lastN) { lastN = n; tellClients({ type: 'progress', id, phase: 'write', n }); }
          }
          if (ch && ch.finish_reason) finish = ch.finish_reason;
          if (j.usage && j.usage.cost !== undefined) cost = j.usage.cost;
        }
      }
    } catch (_) { broken = true; }
  } catch (_) { broken = true; }
  return finishJob({ id, status: 'done', content, finish, cost, broken }, label);
}

async function finishJob(job, label) {
  job.at = Date.now();
  await jobPut(job);
  const cs = await tellClients({ type: 'job', id: job.id });
  const visible = cs.some((c) => c.visibilityState === 'visible');
  if (!visible && self.Notification && Notification.permission === 'granted') {
    const ok = job.status === 'done' && job.content;
    await self.registration.showNotification(ok ? 'Rezept ist fertig' : 'Import fehlgeschlagen', {
      body: ok ? `Das Rezept aus ${label === 'Video' ? 'dem Video' : label === 'Bilder' ? 'den Bildern' : label === 'Webseite' ? 'der Webseite' : 'dem Text'} liegt in ReciGrab.` : 'Öffne ReciGrab, um es noch einmal zu versuchen.',
      tag: `rf-${job.id}`, icon: 'icon-192.png', badge: 'icon-192.png',
    });
  }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs.length) return cs[0].focus();
    return self.clients.openWindow('./');
  })());
});
