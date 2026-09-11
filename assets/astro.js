/* ===== 今日星盘 · 十二星座影响 =====
   数据来自 assets/astro_data.js（真实星历计算，北京时间口径）
   生成脚本：tools/gen_astro.py
   本文件只负责「读数据 → 生成图与文案」，不改动任何面板数据文件。
   如需突出主人的星座，把下面 FAVORITE 改成星座名，例如 "处女座"。 */
(function () {
  "use strict";

  var FAVORITE = "";   // 例："处女座" —— 留空则不特别标注

  var SIGNS = [
    { n: "白羊座", g: "♈", r: "3.21-4.19", e: "火", m: "基本", c: "正红", p: "头·眼·脑部" },
    { n: "金牛座", g: "♉", r: "4.20-5.20", e: "土", m: "固定", c: "墨绿", p: "颈·喉·甲状腺" },
    { n: "双子座", g: "♊", r: "5.21-6.21", e: "风", m: "变动", c: "明黄", p: "肺·手臂·神经" },
    { n: "巨蟹座", g: "♋", r: "6.22-7.22", e: "水", m: "基本", c: "银白", p: "胃·胸腔·消化" },
    { n: "狮子座", g: "♌", r: "7.23-8.22", e: "火", m: "固定", c: "金橙", p: "心脏·脊椎·血压" },
    { n: "处女座", g: "♍", r: "8.23-9.22", e: "土", m: "变动", c: "藏青", p: "肠道·吸收·脾" },
    { n: "天秤座", g: "♎", r: "9.23-10.23", e: "风", m: "基本", c: "藕粉", p: "肾·腰·皮肤" },
    { n: "天蝎座", g: "♏", r: "10.24-11.22", e: "水", m: "固定", c: "深酒红", p: "泌尿生殖·代谢" },
    { n: "射手座", g: "♐", r: "11.23-12.21", e: "火", m: "变动", c: "宝蓝", p: "肝·大腿·坐骨神经" },
    { n: "摩羯座", g: "♑", r: "12.22-1.19", e: "土", m: "基本", c: "深棕", p: "骨骼·关节·牙齿" },
    { n: "水瓶座", g: "♒", r: "1.20-2.18", e: "风", m: "固定", c: "天青", p: "小腿·踝·循环" },
    { n: "双鱼座", g: "♓", r: "2.19-3.20", e: "水", m: "变动", c: "雾紫", p: "足·淋巴·免疫" }
  ];
  var PLANETS = [
    { n: "太阳", g: "☉" }, { n: "月亮", g: "☽" }, { n: "水星", g: "☿" }, { n: "金星", g: "♀" },
    { n: "火星", g: "♂" }, { n: "木星", g: "♃" }, { n: "土星", g: "♄" }
  ];
  var ASP_NAME = { "0": "合", "60": "六分", "90": "刑", "120": "拱", "180": "冲", "-60": "六分", "-90": "刑", "-120": "拱" };

  /* 月亮所在星座对应的身体部位提示（营养师口吻） */
  var MOON_HEALTH = [
    "月亮在白羊：头部与血压容易上头，安排 10 分钟闭目或深呼吸，咖啡减半。",
    "月亮在金牛：颈喉与甲状腺敏感，别吃过烫食物，说话多时含温水润喉。",
    "月亮在双子：神经处于高频，信息过载会头痛，午间留 15 分钟不看屏幕。",
    "月亮在巨蟹：胃最先感知情绪，三餐定时、晚餐七分饱，别用零食压情绪。",
    "月亮在狮子：心脏与血压是今天的重点，强度训练别超 40 分钟，盯住心率区间。",
    "月亮在处女：肠道与吸收敏感，加可溶性膳食纤维（燕麦、苹果、奇亚籽），少生冷。",
    "月亮在天秤：肾与腰部承压，久坐每小时起身 3 分钟，饮水 1,800ml 以上。",
    "月亮在天蝎：代谢与泌尿系统要多关照，晚餐清淡、睡前 2 小时少饮水。",
    "月亮在射手：肝与大腿是重点，酒精今天最伤，拉伸 10 分钟放松髋部。",
    "月亮在摩羯：关节与牙齿敏感，注意保暖与钙摄入（牛奶 300ml 或等量）。",
    "月亮在水瓶：循环与小腿容易发沉，抬腿 10 分钟 + 快走 20 分钟最有效。",
    "月亮在双鱼：淋巴与免疫偏低敏，早睡加温热饮食，避开冷饮与生食。"
  ];

  /* 文案库：按「月亮/行星与本命太阳的星座相位」取用，每种 3 个变体 */
  var BANK = {
    overall: {
      har: ["今天你的节奏与月亮同频，情绪顺、判断准，适合把重要的事往前推。",
        "能量流动顺畅，想法一说就有人接，别把这份顺手气浪费在杂事上。",
        "月亮给你托底，遇到分歧也能自然化解，是本周最适合表态的一天。"],
      easy: ["今天是那种「只要开口就有回应」的日子，别等着别人先迈一步。",
        "小机会藏在细节里，多问一句、多看一眼就能捡到。",
        "气氛友好但不喧闹，适合谈条件、谈合作，慢慢推进反而更快。"],
      strong: ["月亮与你的太阳重合，情绪被放大——你想要的，今天就该说出口。",
        "今天你的存在感很强，但也要留意情绪过载，先安顿自己再处理别人。",
        "日月能量叠加，适合立一个 30 天的小目标，此刻的启动成本最低。"],
      tense: ["今天有股拧着来的劲儿，别硬顶，先承认不舒服再想办法。",
        "摩擦点多半在节奏上——你想快、环境偏慢，把标准降一档事就顺了。",
        "容易在细节上较真，先分清「必须」和「最好」，你会轻松很多。"],
      opp: ["今天是照镜子的一天：别人的反应就是你的盲区，接受反馈比辩解有用。",
        "拉扯感明显，工作与生活都想抓，结果都抓不紧；先定优先级。",
        "对立带来张力也带来信息，把对方的反对当成一份免费的风险提示。"],
      plain: ["没有大起大落，适合把手上的事收口、清账、补漏洞。",
        "今天属于「稳住就是赢」，别开新战场，把旧账结清。",
        "能量平稳，适合做需要耐心的事：整理、复盘、写计划。"]
    },
    career: {
      har: ["行动力到位，谈单与推进都顺，把最难的电话安排在下午。",
        "火星给你助力，适合拍板——犹豫的事今天就定下来。",
        "投入产出比高的一天，重点客户优先安排。"],
      easy: ["小步快跑有回报，先做那 20% 最关键的动作。",
        "适合打磨细节与流程，比冲量更有价值。",
        "他人配合度高，跨部门协调今天最省力。"],
      strong: ["干劲很足，但要控制节奏，别把一天的事压进两小时。",
        "魄力在线，适合处理积压已久的硬骨头。",
        "注意用力过猛：今天容易把话说太满，留三分余地。"],
      tense: ["容易急躁，重要沟通前先写要点，避免带情绪开口。",
        "外部阻力偏大，先把手能控制的部分做扎实。",
        "预算与进度容易超，加一道复核再提交。"],
      opp: ["推进受阻多半卡在人上，先找到对方真正在意的东西。",
        "别同时开两条战线，今天只保一个主战场。",
        "有竞争压力是好事，逼你把手艺练到更细。"],
      plain: ["常规推进即可，把精力留给下一个关键节点。",
        "适合整理客户档案与数据，为下一轮冲刺备料。",
        "别追新目标，今天的价值在于把流程跑顺。"]
    },
    love: {
      har: ["关系里暖意足，一句具体的感谢胜过任何大动作。",
        "适合约重要的人吃饭，气氛自然不冷场。",
        "对伴侣多一点耐心，你会收到超出预期的回应。"],
      easy: ["小细节加分：记住对方提过的一件小事。",
        "单身者今天适合通过朋友介绍认识新的人。",
        "沟通顺畅，误会说开就好。"],
      strong: ["感情浓度高，但别让亲密变成黏腻，留点空间更舒服。",
        "吸引力强，注意别让好感变成冲动承诺。",
        "适合表达，不适合谈判；把结论留到明天。"],
      tense: ["容易因小事起摩擦，先听完再回应。",
        "金钱话题是今天的雷区，尽量避开或延后。",
        "别用冷战处理分歧，直接说需求更有效。"],
      opp: ["一进一退的节奏明显，与其争对错，不如先给台阶。",
        "对方今天可能比平时敏感，少点评、多倾听。",
        "关系里的张力其实是提醒：有些话早该说清楚。"],
      plain: ["关系平稳，适合一起做点日常小事。",
        "没有大波澜，把关心放在行动上就好。",
        "单身者不必强求，先把自己的生活过得有滋味。"]
    }
  };
  var HEALTH_LINE = [
    "{M} 你（{N}）本命的高敏区是{P}，今天就别给它加码。",
    "今日身体主题：{M} 而你的{P}同样需要关照，别硬撑。",
    "{M} 对你而言，{P}是长期要盯的部位，今天尤其经不起折腾。"
  ];
  var TIME_SLOT = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00", "19:00-21:00", "21:00-23:00"];

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function dayIndex(iso) {
    var p = iso.split("-");
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function pick(arr, seed) { var n = arr.length; if (!n) return ""; var i = ((seed % n) + n) % n; return arr[i]; }
  function signIdx(lon) { return Math.floor(((lon % 360) + 360) % 360 / 30); }
  function degIn(lon) { return (((lon % 30) + 30) % 30); }
  /* 星座相位：按星座单位判断，只取主要相位 */
  function signAspect(a, b) {
    var d = (a - b + 12) % 12;
    if (d === 0) return "strong";
    if (d === 6) return "opp";
    if (d === 2 || d === 10) return "easy";
    if (d === 3 || d === 9) return "tense";
    if (d === 4 || d === 8) return "har";
    return "plain";
  }
  function stars(t, seed) {
    var base = { har: 5, easy: 4, strong: 4, tense: 2, opp: 2, plain: 3 }[t] || 3;
    var v = base + (seed % 3) - 1;
    if (v > 5) v = 5; if (v < 1) v = 1;
    var s = "";
    for (var i = 0; i < v; i++) s += "★";
    for (var j = v; j < 5; j++) s += "☆";
    return s;
  }
  function phaseName(illum, wax) {
    if (illum <= 2) return "新月";
    if (illum >= 98) return "满月";
    if (illum <= 45) return wax ? "娥眉月" : "残月";
    if (illum <= 55) return wax ? "上弦月" : "下弦月";
    return wax ? "盈凸月" : "亏凸月";
  }
  function nextDay(iso) {
    var d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- 星盘图（SVG） ---------- */
  function chartSVG(day, px) {
    var cx = 120, cy = 120, R = 112, R1 = 88, Rp = 56;
    var o = "<svg viewBox=\"0 0 240 240\" class=\"astro-svg\" role=\"img\" aria-label=\"今日星盘\">";
    o += "<circle cx=\"" + cx + "\" cy=\"" + cy + "\" r=\"" + R + "\" fill=\"#fbf9f5\" stroke=\"#d9d4ca\"/>";
    o += "<circle cx=\"" + cx + "\" cy=\"" + cy + "\" r=\"" + R1 + "\" fill=\"#ffffff\" stroke=\"#e9e5de\"/>";
    o += "<circle cx=\"" + cx + "\" cy=\"" + cy + "\" r=\"26\" fill=\"#fdfaf6\" stroke=\"#ece7de\"/>";
    o += "<circle cx=\"" + cx + "\" cy=\"" + cy + "\" r=\"3\" fill=\"#c9c2b6\"/>";
    function pt(lon, r) {
      var a = (180 + lon) * Math.PI / 180;
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    }
    /* 12 星座扇区 */
    for (var i = 0; i < 12; i++) {
      var a0 = (180 + i * 30) * Math.PI / 180, a1 = (180 + (i + 1) * 30) * Math.PI / 180;
      var x0 = cx + R * Math.cos(a0), y0 = cy - R * Math.sin(a0);
      var x1 = cx + R * Math.cos(a1), y1 = cy - R * Math.sin(a1);
      var x2 = cx + R1 * Math.cos(a1), y2 = cy - R1 * Math.sin(a1);
      var x3 = cx + R1 * Math.cos(a0), y3 = cy - R1 * Math.sin(a0);
      o += "<path d=\"M" + x0.toFixed(1) + "," + y0.toFixed(1) + " A" + R + "," + R + " 0 0 0 " + x1.toFixed(1) + "," + y1.toFixed(1) +
        " L" + x2.toFixed(1) + "," + y2.toFixed(1) + " A" + R1 + "," + R1 + " 0 0 1 " + x3.toFixed(1) + "," + y3.toFixed(1) + " Z\" " +
        "fill=\"" + (i % 2 ? "#f3efe8" : "#fdfbf7") + "\" stroke=\"#e9e5de\" stroke-width=\".6\"/>";
      var gm = pt(i * 30 + 15, (R + R1) / 2);
      o += "<text x=\"" + gm[0].toFixed(1) + "\" y=\"" + (gm[1] + 4).toFixed(1) +
        "\" text-anchor=\"middle\" font-size=\"12\" fill=\"" + (i % 2 ? "#8a8175" : "#a855f7") + "\">" + SIGNS[i].g + "</text>";
    }
    /* 相位连线 */
    (day.a || []).forEach(function (ax) {
      var p1 = pt(px[ax[0]], Rp), p2 = pt(px[ax[2]], Rp);
      var ang = Math.abs(ax[1]);
      var col = (ang === 90 || ang === 180) ? "#e07a5f" : (ang === 0 ? "#7a828e" : "#12805c");
      o += "<line x1=\"" + p1[0].toFixed(1) + "\" y1=\"" + p1[1].toFixed(1) + "\" x2=\"" + p2[0].toFixed(1) +
        "\" y2=\"" + p2[1].toFixed(1) + "\" stroke=\"" + col + "\" stroke-width=\"1\" opacity=\".55\"/>";
    });
    /* 行星落点 */
    px.forEach(function (lon, i) {
      var q = pt(lon, Rp + (i % 3) * 9);
      o += "<circle cx=\"" + q[0].toFixed(1) + "\" cy=\"" + q[1].toFixed(1) + "\" r=\"9\" fill=\"#fff\" stroke=\"#d9d4ca\"/>";
      o += "<text x=\"" + q[0].toFixed(1) + "\" y=\"" + (q[1] + 4.5).toFixed(1) +
        "\" text-anchor=\"middle\" font-size=\"11\" fill=\"#3d4450\">" + PLANETS[i].g + "</text>";
    });
    o += "</svg>";
    return o;
  }

  /* ---------- 主渲染 ---------- */
  function render(iso) {
    var DATA = window.__ASTRO_DATA__ || {};
    var day = DATA[iso];
    if (!day) {
      var ks = Object.keys(DATA).sort();
      var tip = ks.length ? "现有数据覆盖 " + ks[0] + " ~ " + ks[ks.length - 1] : "尚无星盘数据";
      return "<div class=\"empty\">今日星盘数据尚未生成（" + tip + "）。<br>" +
        "运行 <code>python tools/gen_astro.py</code> 可续期。</div>";
    }
    var px = day.p;
    var sSun = signIdx(px[0]), sMoon = signIdx(px[1]);
    var retro = (day.r || []).map(function (v, i) { return v ? PLANETS[i + 2].n : null; }).filter(Boolean);
    var di = dayIndex(iso);

    /* 速览 */
    var o = "<div class=\"src-note\">真实星历计算 · 北京时间口径 · 位置取当日 12:00</div>";
    o += "<div class=\"astro-top\">";
    o += "<div class=\"astro-chart\">" + chartSVG(day, px) +
      "<div class=\"astro-chart-cap\">外圈为黄道十二宫，连线为当日主要相位（<span style=\"color:#e07a5f\">红＝刑冲</span> · <span style=\"color:#12805c\">绿＝拱六分</span> · <span style=\"color:#7a828e\">灰＝合</span>）</div></div>";
    o += "<div class=\"astro-facts\">";
    o += "<div class=\"astro-pt\">" + PLANETS.map(function (p, i) {
      var s = signIdx(px[i]);
      var tag = (day.r && day.r[i - 2]) ? " <span class=\"rx\">逆行</span>" : "";
      return "<span class=\"ap\"><i>" + p.g + "</i>" + p.n + " · " + SIGNS[s].n + " " + degIn(px[i]).toFixed(1) + "°" + tag + "</span>";
    }).join("") + "</div>";

    var phName = phaseName(day.m, day.w);
    o += "<div class=\"astro-ln\">🌙 <b>月相</b>：" + phName + "（照明 " + day.m + "%，" + (day.w ? "渐盈" : "渐亏") + "）</div>";
    o += "<div class=\"astro-ln\">🔴 <b>逆行</b>：" + (retro.length ? retro.join("、") + " —— 相关事务宜复核、留缓冲" : "无行星逆行，推进节奏顺畅") + "</div>";
    if (day.mi) o += "<div class=\"astro-ln\">🌗 <b>月亮换座</b>：" + day.mi[0] + " 进入 " + SIGNS[day.mi[1]].n + "，情绪基调随之切换</div>";
    else o += "<div class=\"astro-ln\">🌗 <b>月亮换座</b>：今日整日在 " + SIGNS[sMoon].n + " 内穿行，情绪底色稳定</div>";
    if (day.vd) {
      o += "<div class=\"astro-ln\">⏳ <b>月空亡</b>：" + day.vd[0] + " → " + (day.vd[1] < day.vd[0] ? "次日 " + day.vd[1] : day.vd[1]) +
        "，此间宜收尾复盘，不宜启动新事与重大签约</div>";
    } else {
      o += "<div class=\"astro-ln\">⏳ <b>月空亡</b>：今日无空亡窗口，凡事可正常推进</div>";
    }
    o += "<div class=\"astro-ln\">✳️ <b>主要相位</b>：" + ((day.a && day.a.length)
      ? day.a.map(function (ax) {
        return PLANETS[ax[0]].n + ASP_NAME[String(ax[1])] + PLANETS[ax[2]].n + " " + ax[3];
      }).join(" ｜ ")
      : "今日无精确主要相位，属于平稳过渡的一天") + "</div>";
    o += "</div></div>";

    /* 关键词 */
    var kws = [SIGNS[sMoon].n + "月亮", phName, SIGNS[sSun].n + "太阳"];
    if (retro.length) kws.push(retro[0] + "逆行");
    (day.a || []).slice(0, 2).forEach(function (ax) {
      kws.push(PLANETS[ax[0]].n + ASP_NAME[String(ax[1])] + PLANETS[ax[2]].n);
    });
    if (day.vd) kws.push("月空亡");
    o += "<div class=\"sec-split\">今日能量关键词</div><div class=\"chips\">" +
      kws.map(function (k) { return "<span class=\"chip\">" + esc(k) + "</span>"; }).join("") + "</div>";

    /* 十二星座 */
    o += "<div class=\"sec-split\">今日星盘与十二星座 · 逐个看影响</div>";
    o += "<div class=\"sign-grid\">";
    for (var i = 0; i < 12; i++) {
      var S = SIGNS[i], sd = hash(iso + "|" + S.n);
      var tOverall = signAspect(sMoon, i);
      var tCareer = signAspect(signIdx(px[4]), i);   // 火星
      var tLove = signAspect(signIdx(px[3]), i);     // 金星
      var favo = (FAVORITE && FAVORITE === S.n);
      o += "<div class=\"sign-card" + (favo ? " favo" : "") + "\">" +
        "<div class=\"sg-head\"><span class=\"sg-g\">" + S.g + "</span>" +
        "<span class=\"sg-n\">" + S.n + "</span>" +
        (favo ? "<span class=\"sg-fav\">主人星座</span>" : "") +
        "<span class=\"sg-r\">" + S.r + "</span>" +
        "<span class=\"sg-star\">" + stars(tOverall, sd) + "</span></div>" +
        "<div class=\"sg-l\"><b>整体</b>" + esc(pick(BANK.overall[tOverall], sd)) + "</div>" +
        "<div class=\"sg-l\"><b>事业财运</b>" + esc(pick(BANK.career[tCareer], (sd >>> 3))) + "</div>" +
        "<div class=\"sg-l\"><b>感情人际</b>" + esc(pick(BANK.love[tLove], (sd >>> 6))) + "</div>" +
        "<div class=\"sg-l\"><b>健康</b>" + esc(pick(HEALTH_LINE, (sd >>> 9))
          .replace("{M}", MOON_HEALTH[sMoon]).replace("{N}", S.n).replace("{P}", S.p)) + "</div>" +
        "<div class=\"sg-lucky\">幸运色 " + esc(S.c) + " ｜ 幸运数字 " + ((di * 7 + i * 13) % 9 + 1) +
        " ｜ 吉时 " + pick(TIME_SLOT, (sd >>> 11)) + "</div>" +
        "</div>";
    }
    o += "</div>";
    o += "<div class=\"astro-foot\">口径说明：星座按太阳回归黄道（3.21 起白羊）划分；运势依据当日月亮、火星、金星与你太阳星座的星座相位推导，仅供调节节奏与情绪参考。</div>";
    return o;
  }

  window.__renderAstro = render;
})();
