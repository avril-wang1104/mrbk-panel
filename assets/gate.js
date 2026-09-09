/* ===== 每日必看 · 访问门禁 =====
   在 head 里最先执行：未通过验证前锁住页面，只显示一张输入卡。
   密码不明文存储，assets/lock.js 里只有 SHA-256 指纹。
   离线单文件版（__NO_LOCK__）与不支持 Web Crypto 的环境会自动放行。 */
(function () {
  var KEY = "mrb_unlock_v1";
  var LOCK = window.__LOCK__ || null;

  function unlocked() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || !o.t) return false;
      var days = LOCK && LOCK.rememberDays ? LOCK.rememberDays : 0;
      if (days > 0 && Date.now() - o.t > days * 86400000) return false;
      return true;
    } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now() })); } catch (e) {}
  }

  /* 无需门禁的情况：未配置、离线单文件版、环境不支持加密 */
  var secure = window.isSecureContext && window.crypto && window.crypto.subtle;
  if (!LOCK || window.__NO_LOCK__ || window.__MOBILE_PACKED__ || !secure) {
    return;
  }
  if (unlocked()) return;

  /* ---- 先锁上：html 挂类，CSS 隐藏正文防止闪现 ---- */
  var html = document.documentElement;
  html.className += " gate-locked";
  var st = document.createElement("style");
  st.textContent = "html.gate-locked body{visibility:hidden !important;}";
  (document.head || html).appendChild(st);

  /* ---- 构建门禁卡片 ---- */
  function el(tag, css) {
    var n = document.createElement(tag);
    for (var k in css) n.style[k] = css[k];
    return n;
  }
  var box = el("div", {
    position: "fixed", inset: "0", zIndex: "99999", display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg,#0f6b4a 0%,#0a4f37 100%)",
    fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
    color: "#fff", padding: "24px", textAlign: "center"
  });
  var paw = el("div", {
    fontSize: "56px", lineHeight: "1", marginBottom: "14px",
    filter: "drop-shadow(0 4px 10px rgba(0,0,0,.25))"
  });
  paw.textContent = "🐾";
  var h1 = el("div", { fontSize: "22px", fontWeight: "700", letterSpacing: "1px", marginBottom: "6px" });
  h1.textContent = "每日必看";
  var sub = el("div", { fontSize: "13px", opacity: ".78", marginBottom: "26px" });
  sub.textContent = LOCK.hint || "请输入开门密码";

  var inp = el("input", {
    width: "180px", padding: "12px 14px", fontSize: "22px", textAlign: "center",
    letterSpacing: "8px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.35)",
    background: "rgba(255,255,255,.14)", color: "#fff", outline: "none"
  });
  inp.setAttribute("inputmode", "numeric");
  inp.setAttribute("pattern", "[0-9]*");
  inp.setAttribute("maxlength", "10");
  inp.setAttribute("autocomplete", "off");

  var btn = el("button", {
    marginTop: "16px", padding: "11px 34px", fontSize: "15px", fontWeight: "600",
    borderRadius: "12px", border: "none", background: "#fff", color: "#0f6b4a", cursor: "pointer"
  });
  btn.textContent = "进 门";

  var tip = el("div", { marginTop: "16px", fontSize: "12.5px", color: "#ffd7d7", height: "18px" });

  box.appendChild(paw); box.appendChild(h1); box.appendChild(sub);
  box.appendChild(inp); box.appendChild(btn); box.appendChild(tip);
  html.appendChild(box);

  function sha256hex(s) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  function unlockOk() {
    remember();
    html.className = html.className.replace(/\s*gate-locked\s*/g, " ").trim();
    box.parentNode && box.parentNode.removeChild(box);
  }

  function submit() {
    var v = (inp.value || "").trim();
    if (!v) { tip.textContent = "请先输入密码"; return; }
    btn.disabled = true;
    sha256hex(v).then(function (h) {
      if (h === LOCK.hash) {
        unlockOk();
      } else {
        tip.textContent = "密码不对，再试一次";
        inp.value = "";
        btn.disabled = false;
        inp.focus();
      }
    }).catch(function () {
      /* 校验失败就放行，绝不把主人关在门外 */
      unlockOk();
    });
  }

  btn.onclick = submit;
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  inp.addEventListener("input", function () { tip.textContent = ""; });
  setTimeout(function () { try { inp.focus(); } catch (e) {} }, 300);
})();
