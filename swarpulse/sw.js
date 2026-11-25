const BUILD = "github-pages-v1";
const SHELL = ["app.webmanifest","assets/geist-cyrillic-wght-normal-CHSlOQsW.woff2","assets/geist-latin-ext-wght-normal-DMtmJ5ZE.woff2","assets/geist-latin-wght-normal-Dm3htQBi.woff2","assets/index-C-5I-q1z.js","assets/index-DqFPYyM4.css","audio/percussion/manifest.json","audio/tanpura/manifest.json","favicon.svg","icon-192.png","icon-512.png","icons.svg","index.html"];
const scope = new URL(self.registration.scope);
const shellCache = "swarpulse-shell:" + scope.pathname + ":" + BUILD;
const recordingsCache = "swarpulse-recordings-v1";
const absolute = path => new URL(path, scope).href;
const shellUrls = new Set(SHELL.map(absolute));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(shellCache).then(cache => cache.addAll([...shellUrls])));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const prefix = "swarpulse-shell:" + scope.pathname + ":";
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== shellCache).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function serveRecording(request) {
  const cache = await caches.open(recordingsCache);
  const cached = await cache.match(request.url);
  if (!cached) {
    const range = request.headers.get("Range");
    const remote = new URL(request.url.slice(scope.href.length), "https://raw.githubusercontent.com/pankhurirk/swarpulse-demo1/f16ad3cb1e0b88a7d61131f0759b26a7601d6e75/public/");
    const response = await fetch(remote, { headers: range ? { Range: range } : {} });
    const headers = new Headers(response.headers);
    if (response.status === 206 && !headers.has("Content-Range")) {
      const blob = await response.blob();
      const total = await fetch(remote, { method: "HEAD" });
      const size = total.headers.get("Content-Length");
      const start = Number(/^bytes=(\d+)-/.exec(range)?.[1]);
      if (!size || !Number.isInteger(start)) return new Response(null, { status: 502 });
      headers.set("Content-Range", "bytes " + start + "-" + (start + blob.size - 1) + "/" + size);
      headers.set("Content-Length", String(blob.size));
      return new Response(blob, { status: 206, headers });
    }
    return new Response(response.body, { status: response.status, headers });
  }

  const range = request.headers.get("Range");
  if (!range) return cached;
  const blob = await cached.blob();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (!match || (!match[1] && !match[2]) || start > end || start >= blob.size) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + blob.size } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": "bytes " + start + "-" + end + "/" + blob.size,
      "Content-Length": String(end - start + 1),
      "Content-Type": "audio/mpeg"
    }
  });
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(scope.href)) return;
  const relative = request.url.slice(scope.href.length);
  if (/^audio\/[^/]+\/[^/?]+\.mp3(?:\?|$)/.test(relative)) {
    event.respondWith(serveRecording(request));
  } else if (request.mode === "navigate") {
    event.respondWith(caches.open(shellCache).then(async cache => await cache.match(absolute("index.html")) || fetch(request)));
  } else if (shellUrls.has(request.url)) {
    event.respondWith(caches.open(shellCache).then(async cache => await cache.match(request) || fetch(request)));
  }
});
