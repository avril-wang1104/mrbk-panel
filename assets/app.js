/* ===== 每日必看 · 面板逻辑 ===== */
(function () {
  "use strict";

  var DAYS = (window.__DAYS__ || []).slice().sort();
  var SRC = window.__DAYDATA__ = window.__DAYDATA__ || {};   // 按日期的个别数据
  var POOL = window.__POOL__ || {};                          // 知识内容池（按天自动选题）
  var OV = {};      // { date: { path: value } } 本机编辑层
  var cur = null;
  var editMode = false;
  var STORE_KEY = "mrb_override_v1";
  var LS_OK = (function () {
    try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; }
    catch (e) { return false; }
  })();

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function weekdayOf(iso) {
    var p = iso.split("-");
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
      new Date(+p[0], +p[1] - 1, +p[2]).getDay()
    ];
  }
  /* 全局唯一且跨设备一致的天序号，决定当天选出哪条池内容 */
  function dayIndex(iso) {
    var p = iso.split("-");
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function pick(name, iso) {
    var arr = POOL[name] || [];
    if (!arr.length) return null;
    return arr[((dayIndex(iso) % arr.length) + arr.length) % arr.length];
  }
  /* 每日好书快读：按「第几期」顺序推进，锚定第 1 期对应 2026-09-07（《原则》） */
  var SEQ_ANCHOR = "2026-09-07";
  function pickSeq(name, iso) {
    var arr = POOL[name] || [];
    if (!arr.length) return null;
    var i = dayIndex(iso) - dayIndex(SEQ_ANCHOR);
    return arr[((i % arr.length) + arr.length) % arr.length];
  }
  function tomorrowHint(name, iso) {
    var arr = POOL[name] || [];
    if (!arr.length) return null;
    return arr[(((dayIndex(iso) + 1) % arr.length) + arr.length) % arr.length];
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function getPath(o, p) {
    var ks = String(p).split("."), c = o;
    for (var i = 0; i < ks.length; i++) { if (c == null) return undefined; c = c[ks[i]]; }
    return c;
  }
  function setPath(o, p, v) {
    var ks = String(p).split("."), c = o;
    for (var i = 0; i < ks.length - 1; i++) {
      var k = ks[i];
      if (c[k] == null) c[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      c = c[k];
    }
    c[ks[ks.length - 1]] = v;
  }

  /* ---------- 编辑层持久化 ---------- */
  function loadOV() {
    try { OV = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { OV = {}; }
  }
  function saveOV() {
    if (!LS_OK) { toast("当前打开方式无法保存修改，请双击「启动面板.bat」打开"); return; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(OV)); } catch (e) { toast("本地存储写入失败"); }
  }
  function ovOf(date) { return OV[date] || (OV[date] = {}); }

  function merged(date) {
    var base = SRC[date] ? clone(SRC[date]) : {};
    var m = ovOf(date);
    Object.keys(m).forEach(function (p) { setPath(base, p, clone(m[p])); });
    return base;
  }
  function get(date, path) { return getPath(merged(date), path); }
  function set(date, path, val) {
    var m = ovOf(date);
    var parts = String(path).split(".");
    for (var i = 1; i < parts.length; i++) {
      var parent = parts.slice(0, i).join(".");
      if (m.hasOwnProperty(parent)) {
        var arr = m[parent];
        arr.forEach(function (_, idx) {
          Object.keys(arr[idx] || {}).forEach(function (k) {
            if (!m.hasOwnProperty(parent + "." + idx + "." + k)) m[parent + "." + idx + "." + k] = clone(arr[idx][k]);
          });
        });
        delete m[parent];
      }
    }
    m[path] = val;
    saveOV();
  }
  function setArray(date, arrPath, newArr) {
    var m = ovOf(date);
    Object.keys(m).forEach(function (k) {
      if (k === arrPath || k.indexOf(arrPath + ".") === 0) delete m[k];
    });
    m[arrPath] = clone(newArr);
    saveOV();
  }

  /* ---------- 可编辑片段 ---------- */
  function ed(k, val, ph, cls, tag) {
    var empty = (val == null || String(val).trim() === "");
    var t = tag || "span";
    return "<" + t + " class=\"ed " + (cls || "") + (empty ? " ed-ph" : "") +
      "\" data-k=\"" + esc(k) + "\" data-ph=\"" + esc(ph || "") + "\">" +
      esc(empty ? (ph || "") : val) + "</" + t + ">";
  }

  /* ---------- 长文渲染（整页版：导语 → 分节 → 要点 → 金句 → 落地动作） ---------- */
  function lf(it) {
    var o = "";
    if (it.lead) o += "<div class=\"lf-lead\">" + esc(it.lead) + "</div>";
    (it.sections || []).forEach(function (s) {
      o += (s.h ? "<div class=\"lf-h\">" + esc(s.h) + "</div>" : "") +
           "<p class=\"lf-p\">" + esc(s.p) + "</p>";
    });
    if ((it.points || []).length) {
      o += "<ul class=\"lf-ul\">" + it.points.map(function (p) {
        return "<li>" + esc(p) + "</li>";
      }).join("") + "</ul>";
    }
    if (it.bestline) o += "<div class=\"bestline\">“" + esc(it.bestline) + "”</div>";
    if (it.action) o += "<div class=\"takeaway\">🎯 " + esc(it.action) + "</div>";
    return o;
  }

  /* 当天「每日好书快读」日报同步过来的书（与专门的每日好书快读同一本） */
  function renderTodayBook(b) {
    var o = "<div class=\"book-head\">" +
        "<div class=\"book-cover\">" + esc(b.tag || "书") + "</div>" +
        "<div style=\"flex:1;min-width:0\">" +
          "<div class=\"book-no\">" + (b.no ? "第 " + esc(b.no) + " 期 · " : "") + "每日好书快读</div>" +
          "<div class=\"book-title\">" + esc(b.title) + "</div>" +
          "<div class=\"book-author\">" + esc(b.author || "") + "</div>" +
        "</div></div>";
    if (b.pub) o += "<div class=\"book-chapters\">" + esc(b.pub) + "</div>";
    if (b.why) o += "<div class=\"book-why\">🐾 <b>为什么今天读它：</b>" + esc(b.why) + "</div>";
    o += lf(b);
    if (b.verdict) o += "<div class=\"book-verdict\">📌 <b>要不要买原书：</b>" + esc(b.verdict) + "</div>";
    if (b.url) {
      o += "<a class=\"book-cta\" href=\"" + esc(b.url) + "\" target=\"_blank\" rel=\"noopener\">" +
           "读全文（约 60 分钟读完） →</a>";
    }
    o += "<div class=\"src-note\">与「每日好书快读」日报同步，每天只需读这一本。</div>";
    return o;
  }

  /* ---------- 内容更新机制 ----------
     手机装到桌面后没有地址栏、没有刷新按钮，iOS 还会直接恢复内存快照，
     所以必须主动去服务器比对日期索引，发现新一期就拉下来。 */
  var lastCheck = 0, checking = false, updText = "";

  function HHMM() {
    var d = new Date();
    return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" +
           (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
  }
  function setStatus(s) { updText = s; paintStatus(); }
  function paintStatus() {
    var el = document.getElementById("updStatus");
    if (el) el.innerHTML = updText || "";
  }
  function loadScript(url, cb) {
    var s = document.createElement("script");
    s.src = url;
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error("load fail")); };
    document.head.appendChild(s);
  }
  /* 重新拉一次日期索引（带时间戳，绕开一切缓存） */
  function probeDays(cb) {
    loadScript("data/days.js?probe=" + Date.now(), function (err) {
      cb(err ? null : (window.__DAYS__ || []).slice().sort());
    });
  }
  /* 比对服务器索引；有新日期就拉数据并重新渲染 */
  function checkUpdate(manual, cb) {
    if (window.__MOBILE_PACKED__) {
      if (manual) toast("这是离线单文件版，不会联网更新");
      cb && cb("packed"); return;
    }
    if (checking) { cb && cb("busy"); return; }
    checking = true;
    setStatus("<span class=\"upd-busy\">正在检查服务器…</span>");
    probeDays(function (serverDays) {
      lastCheck = Date.now();
      if (!serverDays || !serverDays.length) {
        checking = false;
        setStatus("<span class=\"upd-err\">检查失败：连不上服务器</span>");
        if (manual) toast("连不上服务器，请检查网络");
        cb && cb("error"); return;
      }
      var latest = serverDays[serverDays.length - 1];
      var fresh = serverDays.filter(function (d) { return DAYS.indexOf(d) < 0; });
      var toLoad = fresh.slice();
      if (latest && toLoad.indexOf(latest) < 0) toLoad.push(latest);  // 最新一期内容也可能被改写过

      var t0 = todayStr();
      var hasToday = serverDays.indexOf(t0) >= 0;
      var tail = hasToday ? "" :
        "<br><span class=\"upd-err\">今天（" + t0 + "）这一期还没生成，明早 8:00 自动更新</span>";

      if (!toLoad.length) {
        checking = false; DAYS = serverDays;
        setStatus("已是最新 · 服务器最新一期 <b>" + latest + "</b> · 检查于 " + HHMM() + tail);
        if (manual) toast(hasToday ? "已是最新：服务器最新一期就是 " + latest : "已是最新，今天这期明早 8:00 生成");
        cb && cb("noop"); return;
      }
      var left = toLoad.length, failed = 0;
      toLoad.forEach(function (d) {
        loadScript("data/" + d + ".js?probe=" + Date.now(), function (err) {
          if (err) failed++;
          if (--left) return;
          checking = false;
          DAYS = serverDays.slice();
          var t = todayStr();
          cur = DAYS.indexOf(t) >= 0 ? t : DAYS[DAYS.length - 1];
          document.getElementById("brandSub").textContent =
            "共 " + DAYS.length + " 期 ｜ " + DAYS[0] + " 起";
          render();
          setStatus((fresh.length
            ? "已更新到 <b>" + DAYS[DAYS.length - 1] + "</b> · 检查于 " + HHMM()
            : "已是最新 · 服务器最新一期 <b>" + latest + "</b> · 检查于 " + HHMM()) + tail);
          if (manual) toast(fresh.length ? "已拉取新内容：" + fresh.join("、") : "已是最新");
          cb && cb(fresh.length ? "updated" : "noop");
        });
      });
    });
  }
  /* 清掉离线缓存并重载（用于彻底解决「一直显示旧的」） */
  function hardReload() {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR" });
      setTimeout(function () { location.reload(); }, 600);
    } else if (window.caches && caches.keys) {
      caches.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) { return caches.delete(k); }));
      }).then(function () { location.reload(); })
        .catch(function () { location.reload(); });
    } else { location.reload(); }
  }

  /* ---------- 模块定义 ---------- */
  var MODULES = [
    {
      id: "news", cls: "col-7 c-blue", icon: "📰", title: "每日早报",
      render: function (d, D) {
        var n = D.news || {}; var items = n.items || [];
        var out = "";
        if (!items.length) {
          out = "<div class=\"empty\">今日早报尚未生成，将在每天早上自动更新</div>";
        } else {
          out = items.map(function (it, i) {
            var b = "news.items." + i;
            return "<div class=\"news-block rowwrap\">" +
              "<div style=\"flex:1;min-width:0\">" +
                "<div class=\"news-hd\"><span class=\"no\">" + (it.no || (i + 1)) + "</span>" +
                  ed(b + ".title", it.title, "标题", "news-title") + "</div>" +
                ed(b + ".body", it.body, "（正文，点击填写）", "news-body", "div") +
                (it.comment ? "<div class=\"comment\">🐾 " + ed(b + ".comment", it.comment, "") + "</div>" : "") +
                (it.url ? "<div class=\"news-link\"><a href=\"" + esc(it.url) + "\" target=\"_blank\">查看原文 →</a></div>" : "") +
              "</div>" +
              "<button class=\"delbtn\" data-del=\"news.items." + i + "\">✕</button>" +
            "</div>";
          }).join("");
        }
        var w = n.weather;
        if (w) {
          out += "<div class=\"weather\">" +
            "<div class=\"w-top\">🌤️ " + ed("news.weather.city", w.city, "城市", "w-city") +
            " <span class=\"w-temp\">" + ed("news.weather.temp", w.temp, "温度") + "</span></div>" +
            ed("news.weather.note", w.note, "（天气提示）", "w-note", "div") +
          "</div>";
        }
        out += "<div class=\"addrow\" data-add=\"news.items\">＋ 添加一条要闻</div>";
        return out;
      },
      tpl: { no: "⑤", title: "新要闻", body: "", comment: "", url: "" }
    },

    {
      id: "quote", cls: "col-5 c-warm", icon: "💬", title: "今日一句",
      auto: true,
      render: function (d, D) {
        var it = pick("quote", d);
        if (!it) return "<div class=\"empty\">内容池为空</div>";
        return "<blockquote class=\"quote\">" + esc(it.text) + "</blockquote>" +
          "<div class=\"quote-by\">— " + esc(it.by) + "</div>" + lf(it);
      }
    },

    {
      id: "nutrition", cls: "col-4 c-green", icon: "🥗", title: "每日营养知识早报",
      auto: true,
      render: function (d, D) {
        var it = pick("nutrition", d);
        if (!it) return "<div class=\"empty\">内容池为空</div>";
        return "<div class=\"theme-tag\">今日主题 · " + esc(it.theme) + "</div>" +
          "<div class=\"lf-title\">" + esc(it.title) + "</div>" + lf(it);
      }
    },

    {
      id: "why", cls: "col-4 c-purple", icon: "💡", title: "每日一个为什么",
      auto: true,
      render: function (d, D) {
        var it = pick("why", d);
        if (!it) return "<div class=\"empty\">内容池为空</div>";
        return "<div class=\"why-q\">" + esc(it.q) + "</div>" + lf(it) +
          "<div class=\"chips\">" + (it.tags || []).map(function (tg) {
            return "<span class=\"chip\">" + esc(tg) + "</span>";
          }).join("") + "</div>";
      }
    },

    {
      id: "book", cls: "col-4 c-gold", icon: "📚", title: "每日好书快读",
      auto: true,
      render: function (d, D) {
        /* 优先用当天同步过来的「每日好书快读」日报内容（data/<日期>.js 的 book 字段），
           与专门的每日好书快读保持同一本书；取不到才回退到固定内容池序列。 */
        var b = D.book;
        if (b && b.title) return renderTodayBook(b);

        var it = pickSeq("book", d);
        if (!it) return "<div class=\"empty\">内容池为空</div>";
        var total = (POOL.book || []).length;
        return "<div class=\"book-head\">" +
            "<div class=\"book-cover\">" + esc(it.tag || "书") + "</div>" +
            "<div style=\"flex:1;min-width:0\">" +
              "<div class=\"book-no\">第 " + esc(it.no) + " 期 · 共 " + total + " 本</div>" +
              "<div class=\"book-title\">" + esc(it.title) + "</div>" +
              "<div class=\"book-author\">" + esc(it.author) + "</div>" +
            "</div></div>" +
          (it.chapters ? "<div class=\"book-chapters\">篇幅：" + esc(it.chapters) + "</div>" : "") +
          lf(it);
      }
    },

    {
      id: "astro", cls: "col-12 c-purple", icon: "🔮", title: "今日星盘 · 十二星座",
      render: function (d, D) {
        if (window.__renderAstro) return window.__renderAstro(d);
        return "<div class=\"empty\">星盘模块未加载（缺少 assets/astro.js）</div>";
      }
    },

    {
      id: "health", cls: "col-12 c-green", icon: "🏃", title: "健康日报",
      auto: function (D) { return !((D.health || {}).metrics || []).length; },
      render: function (d, D) {
        var h = D.health || {};
        var out = "";
        if (h.note) out += "<div class=\"src-note\">" + esc(h.note) + "</div>";
        var ms = h.metrics || [];
        if (ms.length) {
          out += "<div class=\"metric-grid\">" + ms.map(function (m, i) {
            var b = "health.metrics." + i;
            return "<div class=\"metric " + esc(m.status || "") + " rowwrap\">" +
              "<div style=\"flex:1;min-width:0\">" +
                "<div class=\"lb\">" + ed(b + ".label", m.label, "指标") + "</div>" +
                "<div class=\"vl\">" + ed(b + ".value", m.value, "—") +
                  "<span class=\"un\">" + ed(b + ".unit", m.unit, "") + "</span></div>" +
              "</div>" +
              "<button class=\"delbtn\" data-del=\"health.metrics." + i + "\">✕</button>" +
            "</div>";
          }).join("") + "</div>";
        }
        if (h.summary) out += ed("health.summary", h.summary, "", "para", "div");

        out += "<div class=\"sec-split\">今日深度解读 · 内容池自动轮换</div>";
        var it = pick("health", d);
        if (it) out += "<div class=\"lf-title\">" + esc(it.title) + "</div>" + lf(it);
        else out += "<div class=\"empty\">健康解读内容池为空</div>";

        var adv = h.advice || [];
        if (adv.length) {
          out += "<div class=\"sec-split\">今日行动清单</div><ul class=\"advice\">" + adv.map(function (a, i) {
            return "<li class=\"rowwrap\"><span>" + ed("health.advice." + i, a, "建议") + "</span>" +
              "<button class=\"delbtn\" data-del=\"health.advice." + i + "\">✕</button></li>";
          }).join("") + "</ul>";
        }
        out += "<div class=\"addrow\" data-add=\"health.metrics\">＋ 添加指标</div>" +
               "<div class=\"addrow\" data-add=\"health.advice\">＋ 添加建议</div>";
        return out;
      }
    },

    {
      id: "schedule", cls: "col-12 c-orange", icon: "📅", title: "日程与待办",
      render: function (d, D) {
        var s = D.schedule || {}; var items = s.items || [];
        if (!items.length) return "<div class=\"empty\">当日暂无日程</div>" +
          "<div class=\"addrow\" data-add=\"schedule.items\">＋ 添加待办</div>";
        return "<div class=\"todo-grid\">" + items.map(function (it, i) {
          var b = "schedule.items." + i;
          return "<div class=\"todo " + (it.done ? "done" : "") + "\">" +
            "<span class=\"ck\" data-toggle=\"" + b + ".done\">" + (it.done ? "✓" : "") + "</span>" +
            "<span class=\"tm\">" + ed(b + ".time", it.time, "时间") + "</span>" +
            "<span class=\"tx\" style=\"flex:1\">" + ed(b + ".text", it.text, "事项") + "</span>" +
            "<button class=\"delbtn\" data-del=\"" + b + "\">✕</button>" +
          "</div>";
        }).join("") + "</div><div class=\"addrow\" data-add=\"schedule.items\">＋ 添加待办</div>";
      },
      tpl: { time: "待定", text: "新待办事项", done: false }
    }
  ];

  /* ---------- 主渲染 ---------- */
  function render() {
    if (!cur) return;
    var D = merged(cur);
    document.getElementById("heroDate").firstChild.nodeValue = cur;
    document.getElementById("heroWeek").textContent = (D.weekday || weekdayOf(cur));
    var g = document.querySelector("[data-k='greeting']");
    var gv = D.greeting || "";
    g.className = "hero-line ed" + (gv ? "" : " ed-ph");
    g.textContent = gv || "（点击“编辑”填写今日寄语）";

    var meta = [];
    if (D.generatedAt) meta.push("更新于 " + esc(D.generatedAt));
    var auto = MODULES.filter(function (m) { return m.auto; }).length;
    meta.push("知识类 " + auto + " 模块按日自动轮换，不重复");
    var m = ovOf(cur);
    if (Object.keys(m).length) meta.push("✎ 本机已改 " + Object.keys(m).length + " 处");
    if (!LS_OK) meta.push("<span style=\"color:#c0392b\">⚠ 当前打开方式无法保存编辑，请双击「启动面板.bat」</span>");
    document.getElementById("heroMeta").innerHTML = meta.join("<br>");
    paintStatus();

    document.getElementById("grid").innerHTML = MODULES.map(function (mo) {
      var body;
      try { body = mo.render(cur, D); } catch (e) { body = "<div class=\"empty\">渲染出错：" + esc(e.message) + "</div>"; }
      var sub = D[mo.id] || {};
      var isAuto = typeof mo.auto === "function" ? mo.auto(D) : mo.auto;
      return "<section class=\"card " + mo.cls + "\">" +
        "<div class=\"card-head\">" +
          "<div class=\"card-ico\">" + mo.icon + "</div>" +
          "<div class=\"card-title\">" + mo.title + "</div>" +
          (isAuto ? "<span class=\"badge add\">内容池·自动轮换</span>"
                  : (sub.note ? "<div class=\"card-note\">" + esc(sub.note) + "</div>" : "")) +
        "</div>" + body +
      "</section>";
    }).join("");

    var handlers = {
      "news.items": { no: "⑤", title: "新要闻", body: "", comment: "", url: "" },
      "health.metrics": { label: "指标", value: "—", unit: "", status: "mid" },
      "health.advice": "新建议（点击编辑）",
      "schedule.items": { time: "待定", text: "新待办事项", done: false }
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-add]"), function (el) {
      el.onclick = function () {
        var p = el.getAttribute("data-add"), t = handlers[p];
        if (!t) return;
        var arr = get(cur, p) || [];
        arr.push(typeof t === "string" ? t : clone(t));
        setArray(cur, p, arr);
        render(); toast("已添加，可直接编辑");
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-del]"), function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var p = el.getAttribute("data-del");
        var i = +p.split(".").pop(), arrPath = p.substring(0, p.lastIndexOf("."));
        var arr = get(cur, arrPath) || [];
        arr.splice(i, 1);
        setArray(cur, arrPath, arr);
        render(); toast("已删除");
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle]"), function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var p = el.getAttribute("data-toggle");
        set(cur, p, !get(cur, p));
        render();
      };
    });
    bindEditables();
    syncNav();
  }

  /* ---------- 就地编辑 ---------- */
  function bindEditables() {
    var els = document.querySelectorAll(".ed");
    Array.prototype.forEach.call(els, function (el) {
      el.onclick = function (e) {
        if (!editMode) return;
        e.stopPropagation();
        if (el.getAttribute("contenteditable")) return;
        if (el.classList.contains("ed-ph")) { el.textContent = ""; el.classList.remove("ed-ph"); }
        Array.prototype.forEach.call(els, function (o) { o.removeAttribute("contenteditable"); });
        el.setAttribute("contenteditable", "plaintext-only");
        if (el.getAttribute("contenteditable") !== "plaintext-only") el.setAttribute("contenteditable", "true");
        el.focus();
        document.getSelection && document.getSelection().selectAllChildren(el);
      };
      if (!el._bound) {
        el._bound = true;
        el.addEventListener("blur", function () {
          var ce = el.getAttribute("contenteditable");
          if (ce !== "true" && ce !== "plaintext-only") return;
          el.removeAttribute("contenteditable");
          var v = el.textContent.trim();
          if (!v) { el.textContent = el.getAttribute("data-ph") || ""; el.classList.add("ed-ph"); v = ""; }
          set(cur, el.getAttribute("data-k"), v);
          toast("已保存");
        });
        el.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
          if (ev.key === "Escape") { el.textContent = get(cur, el.getAttribute("data-k")) || ""; el.blur(); }
        });
      }
    });
  }

  /* ---------- 日期导航 ---------- */
  function syncNav() {
    var sel = document.getElementById("dateSel");
    sel.innerHTML = DAYS.slice().reverse().map(function (d) {
      var p = d.split("-");
      return "<option value=\"" + d + "\"" + (d === cur ? " selected" : "") + ">" +
        parseInt(p[1], 10) + "月" + parseInt(p[2], 10) + "日 " + weekdayOf(d) + "</option>";
    }).join("");
    var i = DAYS.indexOf(cur);
    document.getElementById("btnPrev").disabled = i <= 0;
    document.getElementById("btnNext").disabled = i < 0 || i >= DAYS.length - 1;
  }
  function go(d) { cur = d; render(); }

  var tt;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(tt); tt = setTimeout(function () { el.classList.remove("show"); }, 1600);
  }

  function loadAll(cb) {
    if (window.__MOBILE_PACKED__) { cb(); return; }   // 单文件手机版：数据已内联
    if (!DAYS.length) { cb(); return; }
    var left = DAYS.length, v = window.__ASSET_VER__ || Date.now();
    if (!left) { cb(); return; }
    DAYS.forEach(function (d) {
      var s = document.createElement("script");
      s.src = "data/" + d + ".js?v=" + v;
      s.onload = s.onerror = function () { if (--left === 0) cb(); };
      document.head.appendChild(s);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadOV();
    document.getElementById("footPath").textContent = "C:/Users/wangw/WorkBuddy/Claw/每日必看/data/";
    if (!window.__MOBILE_PACKED__ && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
    loadAll(function () {
      var t = todayStr();
      cur = DAYS.indexOf(t) >= 0 ? t : DAYS[DAYS.length - 1];
      document.getElementById("brandSub").textContent =
        "共 " + DAYS.length + " 期 ｜ " + DAYS[0] + " 起";
      render();
    });

    document.getElementById("dateSel").onchange = function () { go(this.value); };
    document.getElementById("btnPrev").onclick = function () {
      var i = DAYS.indexOf(cur); if (i > 0) go(DAYS[i - 1]);
    };
    document.getElementById("btnNext").onclick = function () {
      var i = DAYS.indexOf(cur); if (i < DAYS.length - 1) go(DAYS[i + 1]);
    };
    document.getElementById("btnToday").onclick = function () {
      var t = todayStr();
      if (DAYS.indexOf(t) >= 0) go(t); else toast("今天还没有生成内容，请等待早上自动更新");
    };
    document.getElementById("btnEdit").onclick = function () {
      editMode = !editMode;
      document.body.classList.toggle("editmode", editMode);
      this.classList.toggle("on", editMode);
      this.textContent = editMode ? "✓ 完成编辑" : "✎ 编辑";
      toast(editMode ? "编辑模式：点击任意文字即可修改" : "已退出编辑");
    };
    document.getElementById("btnReset").onclick = function () {
      if (!confirm("恢复 " + cur + " 的当日原始内容？本机手动修改将被清除。")) return;
      delete OV[cur]; saveOV(); render(); toast("已复原");
    };
    document.getElementById("btnPrint").onclick = function () { window.print(); };

    /* ---- 更新：手动按钮 / 自动检查 / 下拉刷新 ---- */
    document.getElementById("btnRefresh").onclick = function () {
      var longPress = this._armed;
      if (longPress) { hardReload(); return; }
      checkUpdate(true);
    };
    // 长按「更新」2 秒 = 强制清缓存重载
    (function () {
      var btn = document.getElementById("btnRefresh"), timer = null;
      btn.addEventListener("touchstart", function () {
        timer = setTimeout(function () { btn._armed = true; hardReload(); }, 2000);
      }, { passive: true });
      ["touchend", "touchcancel"].forEach(function (ev) {
        btn.addEventListener(ev, function () { clearTimeout(timer); }, { passive: true });
      });
    })();

    // 从后台切回前台、或 iOS 恢复内存快照时自动检查
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > 600000) checkUpdate(false);
    });
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && Date.now() - lastCheck > 600000) checkUpdate(false);
    });
    // 打开页面 3 秒后静默检查一次；之后每 30 分钟
    setTimeout(function () { checkUpdate(false); }, 3000);
    setInterval(function () {
      if (document.visibilityState === "visible") checkUpdate(false);
    }, 1800000);

    // 顶部下拉刷新（手机）
    var startY = 0, pulling = false;
    document.addEventListener("touchstart", function (e) {
      if (window.scrollY <= 0 && e.touches.length === 1) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!pulling) return;
      if (e.touches[0].clientY - startY > 80) { pulling = false; checkUpdate(true); }
    }, { passive: true });
    document.addEventListener("touchend", function () { pulling = false; }, { passive: true });
  });
})();
