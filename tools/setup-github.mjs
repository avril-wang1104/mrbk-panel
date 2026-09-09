/**
 * 每日必看面板 · 一键部署到 GitHub Pages
 *
 * 用法（在项目根目录执行）：
 *   GH_TOKEN=<你的 GitHub Token> node tools/setup-github.mjs
 * 可选环境变量：
 *   GH_REPO=仓库名（默认 mrbk-panel）
 *   GH_PRIVATE=1 仓库设为私有（GitHub Free 私有仓库不支持Pages，勿用）
 *
 * 会依次做：
 *   1. 读取 Token 对应的账号 → 2. 建仓库 → 3. 提交本地文件并推送
 *   → 4. 开启 Pages → 5. 轮询验证可访问，输出最终网址
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPO = process.env.GH_REPO || "mrbk-panel";
const TOKEN = process.env.GH_TOKEN;

if (!TOKEN) {
  console.error("缺少 GH_TOKEN 环境变量。用法：GH_TOKEN=ghp_xxx node tools/setup-github.mjs");
  process.exit(1);
}

const API = "https://api.github.com";
const H = {
  Authorization: "Bearer " + TOKEN,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "mrbk-deploy",
};

async function api(method, url, body) {
  const r = await fetch(API + url, {
    method,
    headers: body ? { ...H, "Content-Type": "application/json" } : H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON 保持 null */ }
  if (!r.ok) {
    throw new Error(`${method} ${url} 失败 ${r.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: "pipe", ...opts }).trim();
}

async function main() {
  // 1) 账号
  const me = await api("GET", "/user");
  const owner = me.login;
  console.log("账号:", owner);

  // 2) 建仓库（已存在则复用）
  let repo;
  try {
    repo = await api("POST", "/user/repos", {
      name: REPO,
      description: "每日必看 · 个人晨间面板",
      private: false,
      auto_init: false,
    });
    console.log("已创建仓库:", repo.full_name);
  } catch (e) {
    if (/name already exists/.test(e.message)) {
      repo = await api("GET", `/repos/${owner}/${REPO}`);
      console.log("仓库已存在，直接复用:", repo.full_name);
    } else throw e;
  }

  const remote = `https://x-access-token:${TOKEN}@github.com/${owner}/${REPO}.git`;

  // 3) 本地提交并推送
  const hasGit = (() => { try { run("git rev-parse --is-inside-work-tree"); return true; } catch { return false; } })();
  if (!hasGit) {
    run("git init -b main");
    run('git config user.email "mrbk@local.host"');
    run('git config user.name "每日必看"');
  } else {
    try { run("git config user.email"); } catch { run('git config user.email "mrbk@local.host"'); }
    try { run("git config user.name"); } catch { run('git config user.name "每日必看"'); }
  }
  try { run(`git remote remove origin`); } catch { /* 原本没有 */ }
  run(`git remote add origin "${remote}"`);
  run("git add -A");
  const status = run("git status --porcelain");
  if (status) {
    run('git commit -m "每日必看面板更新"');
  } else {
    console.log("没有变更，跳过提交");
  }
  run("git branch -M main");
  run("git push -u origin main --force");
  console.log("推送完成");

  // 4) 开启 Pages
  try {
    await api("POST", `/repos/${owner}/${REPO}/pages`, { source: { branch: "main", path: "/" } });
    console.log("Pages 已开启");
  } catch (e) {
    if (/already exists/.test(e.message)) console.log("Pages 已开启过");
    else throw e;
  }

  const URL_BASE = `https://${owner.toLowerCase()}.github.io/${REPO}/`;

  // 5) 轮询验证
  const deadline = Date.now() + 5 * 60 * 1000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(URL_BASE + "data/days.js?t=" + Date.now());
      const t = await r.text();
      if (r.ok && t.includes("__DAYS__")) {
        const today = new Date().toISOString().slice(0, 10);
        console.log("✅ 可访问:", URL_BASE);
        console.log("   今天的内容已上线:", t.includes(today));
        ok = true;
        break;
      }
      console.log("   等待 Pages 首次构建…", r.status);
    } catch (e) {
      console.log("   等待 Pages 首次构建…", e.message);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  if (!ok) console.log("⚠ 5 分钟内未就绪，Pages 首次构建可能需要更久，稍后再试");
  console.log("\n面板网址:", URL_BASE);
}

main().catch((e) => { console.error("失败:", e.message); process.exit(1); });
