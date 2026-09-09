/**
 * 每日必看面板 · 一键推送到 GitHub（Pages 自动生效）
 *
 * 用法：node tools/push.mjs [提交说明]
 * 依赖：tools/.gh_token 存放 GitHub Token（已在 .gitignore 中排除）
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const tokenFile = path.join(ROOT, "tools", ".gh_token");
if (!fs.existsSync(tokenFile)) {
  console.error("缺少 tools/.gh_token，请先写入 GitHub Token");
  process.exit(1);
}
const TOKEN = fs.readFileSync(tokenFile, "utf-8").trim();
const REPO = "avril-wang1104/mrbk-panel";
const URL_BASE = "https://avril-wang1104.github.io/mrbk-panel/";

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: "pipe", ...opts }).trim();
}

// 1) 提交
run("git add -A");
const status = run("git status --porcelain");
const msg = process.argv[2] || `每日必看面板更新 ${new Date().toISOString().slice(0, 10)}`;
if (status) {
  run(`git commit -m "${msg}"`);
  console.log("已提交:", msg);
} else {
  console.log("没有变更，跳过提交");
}

// 2) 推送（token 仅在本行使用，不写入 .git/config）
const remote = `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
run(`git push ${remote} main --force`);
console.log("推送完成 →", URL_BASE);

// 3) 验证线上是否包含今天日期（Pages 有 1~2 分钟构建延迟）
const today = new Date(
  Date.now() + 8 * 3600 * 1000 - new Date().getTimezoneOffset() * 60000
)
  .toISOString()
  .slice(0, 10);

const deadline = Date.now() + 4 * 60 * 1000;
let ok = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch(URL_BASE + "data/days.js?t=" + Date.now());
    const t = await r.text();
    if (r.ok && t.includes(today)) {
      console.log("✅ 线上已更新，含", today);
      ok = true;
      break;
    }
    console.log("   等待 Pages 构建…", r.status);
  } catch (e) {
    console.log("   等待 Pages 构建…", e.message);
  }
  await new Promise((r) => setTimeout(r, 20000));
}
if (!ok) console.log("⚠ 4 分钟内未就绪，Pages 构建较慢，稍后手动复查:", URL_BASE);
