/* ===== 每日必看 · Service Worker (v3) =====
   v3 加固：发布平台走沙箱通道，休眠时会返回「工作空间已停止」拦截页。
   本版增加响应体检：
   - 只有"确认是我们自己的页面/资源"才允许进缓存，拦截页一律视为失败
   - 网络失败或响应可疑时，回退到缓存里的最后一份完好内容
   其余策略沿用 v2：全部请求强制回源（no-store），缓存仅作兜底；
   缓存 key 剥离 ?v= 时间戳；保留 CLEAR 强制清缓存指令。 */
var CACHE = "mrb-v3";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 页面可发送 {type:"CLEAR"} 清空缓存并重载 */
self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (d.type !== "CLEAR") return;
  caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return caches.delete(k); }));
  }).then(function () {
    return self.clients.matchAll({ type: "window" });
  }).then(function (list) {
    list.forEach(function (c) { c.navigate(c.url); });
  });
});

/* 去掉 ?v=123 之类时间戳，用作稳定缓存键 */
function keyOf(req) {
  try {
    var u = new URL(req.url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch (e) { return req.url; }
}

/* 响应体检：拦截页/异网内容不得入缓存，也不得返回给页面 */
function inspect(resp, req) {
  if (!resp || !resp.ok) return Promise.resolve(false);
  var ct = "";
  try { ct = (resp.headers.get("content-type") || "").toLowerCase(); } catch (e) {}
  var isNav = req.mode === "navigate";
  // 本该是 JS/CSS/图片/JSON 的请求，返回了 HTML → 一定是拦截页
  if (!isNav && ct.indexOf("text/html") !== -1) return Promise.resolve(false);
  // HTML（页面导航）：必须带有自家标记
  if (ct.indexOf("text/html") !== -1 || isNav) {
    return resp.clone().text().then(function (t) {
      return t.indexOf("每日必看") !== -1 || t.indexOf("mrb-app") !== -1;
    }).catch(function () { return false; });
  }
  return Promise.resolve(true);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // 新闻外链等跨域请求不接管

  e.respondWith(
    fetch(req, { cache: "no-store", redirect: "follow" }).then(function (resp) {
      return inspect(resp, req).then(function (good) {
        if (!good) {
          // 拦截页或可疑响应 → 当作网络失败，走缓存兜底
          return caches.match(keyOf(req)).then(function (r) {
            if (r) return r;
            if (req.mode === "navigate") {
              return caches.match(keyOf(new Request("./index.html"))).then(function (h) {
                return h || resp;
              });
            }
            return resp;
          });
        }
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(keyOf(req), copy); });
        return resp;
      });
    }).catch(function () {
      return caches.match(keyOf(req)).then(function (r) {
        if (r) return r;
        if (req.mode === "navigate") {
          return caches.match(keyOf(new Request("./index.html")))
            .then(function (h) { return h || new Response("离线，且无缓存", { status: 503 }); });
        }
        return new Response("", { status: 504, statusText: "offline" });
      });
    })
  );
});
