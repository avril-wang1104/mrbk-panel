// 冒烟测试：用 jsdom 真实执行页面，检查渲染结果
const { JSDOM, VirtualConsole } = require("jsdom");
const path = require("path");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e && e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const urlArg = process.argv[2];
const opts = {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole: vc
};
(urlArg
  ? JSDOM.fromURL(urlArg, opts)
  : JSDOM.fromFile(path.join(__dirname, "..", "index.html"), opts)
).then((dom) => {
  // 等脚本全部加载完再断言；jsdom 并发加载较慢，2.5 秒前断言会误判为 0 卡片
  setTimeout(() => {
    const doc = dom.window.document;
    const err = errors.filter(e => !/Could not load|Not implemented|css/i.test(e));
    console.log("=== 运行时错误 ===");
    console.log(err.length ? err.join("\n") : "无");

    console.log("\n=== 顶部信息 ===");
    console.log("日期:", doc.getElementById("heroDate") && doc.getElementById("heroDate").textContent.trim());
    console.log("副标题:", doc.getElementById("brandSub").textContent);
    console.log("寄语:", doc.querySelector("[data-k='greeting']").textContent.slice(0, 40) + "...");

    console.log("\n=== 卡片数量 ===");
    const cards = doc.querySelectorAll(".card");
    console.log("卡片数:", cards.length);
    cards.forEach(c => {
      const title = c.querySelector(".card-title").textContent;
      const items = c.querySelectorAll(".news-block, .metric, .todo, .chip, .lf-ul li").length;
      const isEmpty = !!c.querySelector(".empty");
      const txt = c.textContent.replace(/\s+/g, "");
      console.log(`  - ${title}: 条目 ${items}${isEmpty ? " [空态]" : ""} 正文字数 ${txt.length}`);
    });
    var bt = doc.querySelector(".book-title"), bn = doc.querySelector(".book-no");
    console.log("  >> 好书快读:", bn ? bn.textContent : "-", bt ? bt.textContent : "-");

    console.log("\n=== 日期下拉 ===");
    console.log(Array.from(doc.querySelectorAll("#dateSel option")).map(o => o.textContent).join(" | "));

    console.log("\n=== 可编辑节点数 ===");
    console.log(doc.querySelectorAll(".ed").length);

    // 切换到历史日期
    const sel = doc.getElementById("dateSel");
    sel.value = "2026-09-07";
    sel.dispatchEvent(new dom.window.Event("change"));
    const cards2 = doc.querySelectorAll(".card");
    console.log("\n=== 切到 2026-09-07 后 ===");
    console.log("日期:", doc.getElementById("heroDate").textContent.trim());
    console.log("寄语:", doc.querySelector("[data-k='greeting']").textContent.slice(0, 30) + "...");
    cards2.forEach(c => {
      const title = c.querySelector(".card-title").textContent;
      const items = c.querySelectorAll(".news-block, .metric, .todo, .chip, .book-points li").length;
      console.log(`  - ${title}: 条目 ${items}`);
    });
    var bt2 = doc.querySelector(".book-title"), bn2 = doc.querySelector(".book-no");
    console.log("  >> 好书快读:", bn2 ? bn2.textContent : "-", bt2 ? bt2.textContent : "-");

    // 模拟一次完整的就地编辑流程
    console.log("\n=== 编辑保存测试 ===");
    try {
      doc.getElementById("btnEdit").click();
      const target = doc.querySelector("[data-k='schedule.items.1.text']");
      console.log("进入编辑，原值:", target.textContent);
      target.click();
      console.log("contenteditable =", target.getAttribute("contenteditable"));
      target.textContent = "【已改】起身走动 15 分钟";
      target.dispatchEvent(new dom.window.Event("blur"));
      const after = JSON.parse(dom.window.localStorage.getItem("mrb_override_v1") || "{}");
      console.log("localStorage 记录:", JSON.stringify(after).slice(0, 160));
      console.log("重渲染后显示:", doc.querySelector("[data-k='schedule.items.1.text']").textContent);
    } catch (e) {
      console.log("编辑流程异常:", e.message);
    }
    process.exit(0);
  }, 4000);
}).catch(e => { console.error("加载失败", e); process.exit(1); });
