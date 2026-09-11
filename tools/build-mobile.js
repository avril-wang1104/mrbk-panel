/* ===== 打包单文件手机版 =====
   把 index.html + style.css + 所有池/数据 JS 内联成一个 HTML，
   传到手机后用浏览器打开即可离线使用（知识模块照样每天自动轮换）。
   用法：node tools/build-mobile.js  （数据更新后重跑一次） */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let html = read("index.html");

// 1) 内联 CSS
const css = read("assets/style.css");
html = html.replace(/<link rel="stylesheet" href="assets\/style\.css"[^>]*>/, () => "<style>\n" + css + "\n</style>");

// 2) 内联静态脚本（池 + 逻辑 + 日期索引）
const scripts = ["data/days.js", "assets/pool_book.js", "assets/pool_why.js",
  "assets/pool_nutrition.js", "assets/pool_quote.js", "assets/pool_health.js",
  "assets/astro_data.js", "assets/astro.js", "assets/app.js"];

let inline = "";
for (const s of scripts) {
  inline += "<script>\n" + read(s) + "\n</script>\n";
}

if (/<!-- LOADER:START -->[\s\S]*?<!-- LOADER:END -->/.test(html)) {
  // 新版：页面用 document.write 动态加载（带时间戳绕缓存），整块替换掉
  html = html.replace(/<!-- LOADER:START -->[\s\S]*?<!-- LOADER:END -->/, () => inline.trim());
} else {
  // 兼容旧版静态标签写法
  for (const s of scripts) {
    const code = read(s);
    html = html.replace(new RegExp("<script src=\"" + s.replace(/[/.]/g, "\\$&") + "\"></script>"),
      () => "<script>\n" + code + "\n</script>");
  }
}

// 3) 内联所有日期数据（从 days.js 提取日期）
const daysSrc = read("data/days.js");
const dates = [...daysSrc.matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]);
const uniq = [...new Set(dates)];
let dataCode = "window.__MOBILE_PACKED__ = true;\n";
for (const d of uniq) {
  const p = "data/" + d + ".js";
  if (fs.existsSync(path.join(root, p))) dataCode += read(p) + "\n";
  else console.warn("缺少数据文件:", p);
}
// 插在 app.js 内联块之前
const appMark = "<script>\n/* ===== 每日必看 · 面板逻辑";
if (html.includes(appMark)) {
  html = html.replace(appMark, "<script>\n" + dataCode + "\n</script>\n" + appMark);
} else {
  html = html.replace("<script>", "<script>\n" + dataCode + "\n</script>\n<script>");
}

// 4) 单文件版不需要 SW / manifest，也不需要访问门禁（文件在主人自己手机里）
html = html.replace(/<link rel="manifest"[^>]*>\s*/, "")
           .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, "")
           .replace(/<link rel="icon"[^>]*>\s*/, "")
           .replace(/<script src="assets\/lock\.js"><\/script>\s*/, "")
           .replace(/<script src="assets\/gate\.js"><\/script>\s*/, "");

const out = path.join(root, "每日必看-手机版.html");
fs.writeFileSync(out, html);
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log("已生成 每日必看-手机版.html（" + kb + " KB，内联 " + uniq.length + " 天数据）");
