# -*- coding: utf-8 -*-
"""
生成 assets/astro_data.js —— 每日真实星盘数据（瑞士星历精度，pyephem 实现）

用法：
  python tools/gen_astro.py [起始日期 YYYY-MM-DD] [结束日期 YYYY-MM-DD]
默认：2026-09-01 ~ 2027-12-31

口径：
  - 所有时间均为北京时间（UTC+8）
  - 行星位置取当日 12:00 的黄经（含太阳、月亮、水金火木土）
  - 逆行：当日 12:00 与次日 12:00 黄经比较，退行即为逆行
  - 月亮换座：当日 00:00~24:00 内首次换座时间
  - 月空亡：月亮进入下一星座前、最后一个主要相位之后的时间窗
  - 主要相位：0/60/90/120/180，取当日北京时间内的精确时刻
"""
import sys, os, json, datetime

import ephem

TZ = 8  # 北京时间
PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]
# 参与相位计算的星体索引：0日 1月 2水 3金 4火 5木 6土
ASPECTS = [0, 60, 90, 120, 180, -60, -90, -120]


def to_utc(dt):
    """北京时间 datetime → UTC datetime"""
    return dt - datetime.timedelta(hours=TZ)


def lons(dt):
    """返回七颗星在给定北京时间的黄经（度）"""
    d = ephem.Date(to_utc(dt).strftime("%Y/%m/%d %H:%M:%S"))
    out = []
    for name in PLANETS:
        b = getattr(ephem, name)(d)
        out.append(float(ephem.Ecliptic(b).lon) * 180.0 / ephem.pi % 360)
    return out


def sep(a, b):
    d = (a - b) % 360
    return d - 360 if d > 180 else d


def wrap(x):
    """把角度归一到 (-180, 180]，用于相位过零检测（避免 ±180 翻转造成假相位）"""
    return (x + 180) % 360 - 180


def aspect_times(day_start, hours=30, step_min=30):
    """扫描时间窗内的精确相位时刻；返回 [(p1, asp, p2, datetime)]"""
    steps = int(hours * 60 / step_min)
    t0 = day_start
    ts = [t0 + datetime.timedelta(minutes=step_min * i) for i in range(steps + 1)]
    cache = [lons(t) for t in ts]
    hits = []
    for i in range(1, len(ts)):
        prev, cur = cache[i - 1], cache[i]
        for a in range(len(PLANETS)):
            for b in range(a + 1, len(PLANETS)):
                s0 = sep(prev[a], prev[b])
                s1 = sep(cur[a], cur[b])
                # 只保留与月亮相关的快速相位 + 行星间慢速相位，用 wrap 避免跨 ±180 假相位
                for ang in ASPECTS:
                    f0, f1 = wrap(s0 - ang), wrap(s1 - ang)
                    if f0 == 0 or (f0 < 0) == (f1 < 0):
                        continue
                    # 二分细化到 1 分钟内
                    lo, hi = ts[i - 1], ts[i]
                    for _ in range(8):
                        mid = lo + (hi - lo) / 2
                        fm = wrap(sep(lons(mid)[a], lons(mid)[b]) - ang)
                        if (fm < 0) == (f0 < 0):
                            lo = mid
                        else:
                            hi = mid
                    exact = lo + (hi - lo) / 2
                    # 复核：精确时刻的偏差必须在 0.05° 内（滤掉数值抖动）
                    if abs(wrap(sep(lons(exact)[a], lons(exact)[b]) - ang)) > 0.05:
                        continue
                    hits.append((a, ang, b, exact))
    # 去重（同一对星体同一相位只取最早）
    seen, uniq = set(), []
    for h in sorted(hits, key=lambda x: x[3]):
        key = (h[0], h[1], h[2])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(h)
    return uniq


def moon_ingress(day_start, hours=36, step_min=10):
    """月亮换座时刻（返回 (time, sign_idx) 或 None）"""
    m0 = lons(day_start)[1]
    s0 = int(m0 // 30)
    t = day_start
    end = day_start + datetime.timedelta(hours=hours)
    while t <= end:
        t += datetime.timedelta(minutes=step_min)
        s1 = int(lons(t)[1] // 30)
        if s1 != s0:
            return t, s1
    return None


def last_moon_aspect(day_start, until, step_min=20):
    """until 之前月亮最后一个主要相位时刻"""
    hits = [h for h in aspect_times(day_start, hours=int((until - day_start).total_seconds() / 3600) + 1, step_min=step_min)
            if 1 in (h[0], h[2])]
    return hits[-1][3] if hits else None


def gen(d0, d1):
    out = {}
    d = d0
    while d <= d1:
        noon = datetime.datetime(d.year, d.month, d.day, 12, 0)
        day_start = datetime.datetime(d.year, d.month, d.day, 0, 0)
        cur = lons(noon)
        nxt = lons(noon + datetime.timedelta(days=1))
        retro = []
        for i in range(2, 7):
            delta = (nxt[i] - cur[i] + 180) % 360 - 180
            retro.append(1 if delta < 0 else 0)

        # 月相（照明度 + 盈/亏）
        mu = ephem.Moon(ephem.Date(to_utc(noon).strftime("%Y/%m/%d %H:%M:%S")))
        illum = int(round(mu.phase))
        su = ephem.Sun(ephem.Date(to_utc(noon).strftime("%Y/%m/%d %H:%M:%S")))
        wax = 1 if (float(ephem.Ecliptic(mu).lon) - float(ephem.Ecliptic(su).lon)) % 360 < 180 else 0

        # 月亮换座
        ing = moon_ingress(day_start)
        mi = None
        if ing and ing[0].date() == d.date():
            mi = [ing[0].strftime("%H:%M"), ing[1]]

        # 月空亡
        vd = None
        if ing:
            la = last_moon_aspect(day_start, ing[0])
            if la and la < ing[0] and la.date() == d.date():
                vd = [la.strftime("%H:%M"), ing[0].strftime("%H:%M")]

        # 当日主要相位（取前 5 个）
        ax = []
        for h in aspect_times(day_start, hours=24, step_min=30):
            t = h[3]
            if t.date() != d.date():
                continue
            ax.append([h[0], h[1], h[2], t.strftime("%H:%M")])
            if len(ax) >= 5:
                break

        out[d.strftime("%Y-%m-%d")] = {
            "p": [round(x, 2) for x in cur],
            "r": retro,
            "m": illum,
            "w": wax,
            "mi": mi,
            "vd": vd,
            "a": ax,
        }
        d += datetime.timedelta(days=1)
    return out


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "2026-09-01"
    b = sys.argv[2] if len(sys.argv) > 2 else "2027-12-31"
    d0 = datetime.datetime.strptime(a, "%Y-%m-%d")
    d1 = datetime.datetime.strptime(b, "%Y-%m-%d")
    print("生成星盘数据", a, "→", b)
    data = gen(d0, d1)
    here = os.path.dirname(os.path.abspath(__file__))
    dst = os.path.join(here, "..", "assets", "astro_data.js")
    body = ",\n".join('  "%s": %s' % (k, json.dumps(v, ensure_ascii=False, separators=(",", ":")))
                      for k, v in sorted(data.items()))
    txt = ("/* 每日真实星盘数据（北京时间口径）\n"
           "   生成脚本：tools/gen_astro.py ｜ 生成时间：%s\n"
           "   覆盖区间：%s ~ %s ｜ 请勿手工编辑 */\n"
           "window.__ASTRO__ = window.__ASTRO__ || {};\n"
           "window.__ASTRO_DATA__ = Object.assign(window.__ASTRO_DATA__ || {}, {\n%s\n});\n"
           % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), a, b, body))
    with open(dst, "w", encoding="utf-8") as f:
        f.write(txt)
    print("已写入", os.path.abspath(dst), "共", len(data), "天，", os.path.getsize(dst), "字节")
