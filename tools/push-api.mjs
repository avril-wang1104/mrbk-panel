/**
 * 每日必看面板 · 通过 GitHub REST API 推送（git 智能 HTTP 不可用时的兜底方案）
 *
 * 用法：node tools/push-api.mjs [提交说明]
 * 依赖：tools/.gh_token 存放 GitHub Token（已在 .gitignore 中排除）
 */
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
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "mrbk-panel-push",
};

async function gh(p, opts = {}) {
  const r = await fetch(`https://api.github.com${p}`, {
    ...opts,
    headers: { ...H, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

// 需要提交的文件（相对仓库根目录）
const FILES = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const MSG = process.env.COMMIT_MSG || `每日必看面板更新 ${new Date().toISOString().slice(0, 10)}`;

if (!FILES.length) {
  console.error("用法: node tools/push-api.mjs <文件1> [文件2...]");
  process.exit(1);
}

// 1) 当前 main 指向的 commit 与 tree
const ref = await gh(`/repos/${REPO}/git/ref/heads/main`);
const base = await gh(`/repos/${REPO}/git/commits/${ref.object.sha}`);
console.log("基准提交:", base.sha.slice(0, 8), "|", base.message.split("\n")[0]);

// 2) 为每个文件创建 blob
const treeEntries = [];
for (const f of FILES) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) {
    console.error("文件不存在:", f);
    process.exit(1);
  }
  const content = fs.readFileSync(abs, "utf-8");
  const blob = await gh(`/repos/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  treeEntries.push({ path: f.replace(/\\/g, "/"), mode: "100644", type: "blob", sha: blob.sha });
  console.log("  已创建 blob:", f, blob.sha.slice(0, 8));
}

// 3) 建树 + 建提交 + 更新引用
const tree = await gh(`/repos/${REPO}/git/trees`, {
  method: "POST",
  body: JSON.stringify({ base_tree: base.tree.sha, tree: treeEntries }),
});
const commit = await gh(`/repos/${REPO}/git/commits`, {
  method: "POST",
  body: JSON.stringify({ message: MSG, tree: tree.sha, parents: [base.sha] }),
});
await gh(`/repos/${REPO}/git/refs/heads/main`, {
  method: "PATCH",
  body: JSON.stringify({ sha: commit.sha }),
});
console.log("已推送:", commit.sha.slice(0, 8), "|", MSG);

// 4) 验证 Pages 是否包含今天日期
const today = new Date(Date.now() + 8 * 3600 * 1000 - new Date().getTimezoneOffset() * 60000)
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
