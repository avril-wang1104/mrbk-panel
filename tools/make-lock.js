/**
 * 生成 / 更新面板访问密码
 * 用法：node tools/make-lock.js <四位或多位数字>
 * 产物：assets/lock.js —— 里面只存密码的 SHA-256 指纹和记住时长，不存明文
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CODE = process.argv[2];
const DAYS = process.argv[3] ? parseInt(process.argv[3], 10) : 0; // 0 = 永久

if (!CODE || !/^\d{4,}$/.test(CODE)) {
  console.error("用法: node tools/make-lock.js <至少4位数字> [记住天数, 0或省略=永久]");
  process.exit(1);
}

const hash = crypto.createHash("sha256").update(CODE).digest("hex");
const out = `/* ===== 每日必看 · 访问门禁 =====
   本文件只保存密码的 SHA-256 指纹，不含明文。
   修改密码：node tools/make-lock.js 新密码 [记住天数]
   指纹生成时间：${new Date().toISOString().slice(0, 19).replace("T", " ")}
*/
window.__LOCK__ = {
  hash: "${hash}",
  rememberDays: ${DAYS},      // 0 = 在这台设备上永久记住
  hint: "请输入开门密码"
};
`;
fs.writeFileSync(path.join(ROOT, "assets", "lock.js"), out, "utf-8");
console.log("已写入 assets/lock.js");
console.log("  指纹:", hash.slice(0, 16) + "…");
console.log("  记住时长:", DAYS === 0 ? "永久" : DAYS + " 天");
