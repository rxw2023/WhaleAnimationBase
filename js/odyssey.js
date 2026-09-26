// odyssey.js — 《小鲸鱼 · 一直在游》60.6 秒全程序化动画（17 幕 / 26 小节）
//
// 剧情线：从海里出发 → 破水面 → 一路所见（光 / 网 / 波 / 花）→ 离地 → 太阳系 → 星系
//         → 时空 → 黑洞 → 隧道 → 地出 → 星图 → 回到海里（首尾同框，可以循环）
//
// 结构：不做"一场一场画"，而是让同一批粒子在时间里重组成不同形态。
//   A 粒子场(1400) : 海洋浮游 → 上升气泡柱 → 水花炸开成星 → 光谱扇 → 神经元 → 双缝波前
//                    → 同心环 → 葵花籽 → 花盘收缩成地球 → 行星轨道 → 星系 → 时空网格
//                    → 吸积盘 → 隧道环 → 地球云 → 星图航线 → 回到海洋
//   B 线(56点)     : 海面 → 上浮的螺旋 → 跃出弧 → 光束 → 树突 → 正弦波 → 圆弧 → 花茎
//                    → 地球圆 → 椭圆轨道 → 旋臂 → 被弯折的光线 → 吸积盘缘 → 垂直光柱
//                    → 月面地平线 → 航线 → 海面
//   C 小鲸鱼       : 全片都在。上浮时加速摆尾、破水面时拉伸跃出、越游越小、
//                    最后掉头游出画面 —— 而首尾的相机与配色完全一致，所以它可以重新开始
// 粒子的位置是两种形态的加权混合，所以粒子是真的"飞"过去，不是叠化；全片没有切点。
(function (G) {
  'use strict';
  const P = G.PAL, W = G.W, H = G.H, TAU = G.TAU;
  const clamp = G.clamp, lerp = G.lerp, ease = G.ease, easeOut = G.easeOut, easeIO = G.easeIO;

  G.CONFIG = { captions: true, grain: true, vignette: true };
  // 字幕时间已按幕表对齐（每句都落在对应那一幕上）
  // 字幕：除首尾两句书挡外，全部改成第一人称（它想去哪 / 它看见了什么）
  G.LYRICS = [
    [0.60, '海 是 第一张 纸', 2.1],
    [4.85, '往 上 是 唯一 的 方向', 1.4],
    [8.90, '冲 出 去', 1.5],
    [12.35, '我 第一次 看见 颜色', 1.3],
    [15.40, '每 一 根 线 都 在 说话', 1.3],
    [18.40, '两 道 波 相遇 会 唱歌', 1.3],
    [21.45, '圆 转起来 就 开花', 1.3],
    [24.50, '连 花 都 在 数 数', 1.5],
    [27.90, '家 只 是 一颗 球', 1.9],
    [32.15, '谁 绕着 谁 转', 1.4],
    [35.45, '花心 是 另一座 星系', 1.6],
    [38.90, '引力 把 空间 压出 一个 坑', 1.5],
    [42.20, '时间 在这里 变慢', 1.6],
    [45.70, '穿 过 去', 1.4],
    [48.95, '回头看 家 是一颗 蓝色的球', 1.9],
    [52.70, '我 走 过 的 路 连成 了 星图', 2.0],
    [56.70, '还 是 第一张 纸', 2.4],
  ];
  const DUR = 26 * 60 / 103 * 4;      // 26 小节 × 2.3301 s ≈ 60.5825 s

  const N = 1400, NBEAM = 56;
  const r1 = (i, s) => G.hash(i * 1.70 + s);
  const r2 = (i, s) => G.hash(i * 3.13 + s * 7.31);
  const r3 = (i, s) => G.hash(i * 5.77 + s * 13.13);

  const F_SEA = 0, F_NEURON = 1, F_SPECTRUM = 2, F_WAVE = 3, F_RINGS = 4, F_FLOWER = 5,
        F_ORBIT = 6, F_GALAXY = 7, F_SPACETIME = 8, F_BH = 9, F_TUNNEL = 10, F_EARTH = 11,
        F_UPWELL = 12, F_BREACH = 13, F_LIFTOFF = 14, F_TRAIL = 15, NF = 16;

  // 17 幕 / 26 小节。每对 = [进入, 保持结束]；两对之间是形变窗口（30% 保持 / 40% 变形 / 30% 保持）。
  // 按"小节"排（×2.3301 s），这样每次形变都尽量落在拍上。
  const KEYS = [
    [0.0000, F_SEA],       [2.9126, F_SEA],
    [4.4272, F_UPWELL],    [6.1748, F_UPWELL],
    [7.6893, F_BREACH],    [10.3689, F_BREACH],      // ★ 破水面
    [12.1165, F_SPECTRUM], [13.6311, F_SPECTRUM],
    [15.1456, F_NEURON],   [16.6602, F_NEURON],
    [18.1748, F_WAVE],     [19.6893, F_WAVE],
    [21.2039, F_RINGS],    [22.7184, F_RINGS],
    [24.2330, F_FLOWER],   [25.9806, F_FLOWER],
    [27.4951, F_LIFTOFF],  [30.1748, F_LIFTOFF],     // ★ 离地（花盘收缩成地球）
    [31.9223, F_ORBIT],    [33.6699, F_ORBIT],
    [35.1845, F_GALAXY],   [37.1650, F_GALAXY],
    [38.6796, F_SPACETIME], [40.4272, F_SPACETIME],
    [41.9417, F_BH],       [43.9223, F_BH],
    [45.4369, F_TUNNEL],   [47.1845, F_TUNNEL],
    [48.6990, F_EARTH],    [50.9126, F_EARTH],
    [52.4272, F_TRAIL],    [54.8738, F_TRAIL],       // ★ 星图航线
    [56.3884, F_SEA],      [60.5825, F_SEA],
  ];
  G.SHOTS_BARS = KEYS.map(k => [k[0], null]);

  const WTS = new Array(NF);
  let _wa = F_SEA, _wb = F_SEA, _wk = 0;
  function weightsAt(t) {
    for (let i = 0; i < NF; i++) WTS[i] = 0;
    let a = F_SEA, b = F_SEA, k = 0;
    if (t >= KEYS[KEYS.length - 1][0]) { a = b = KEYS[KEYS.length - 1][1]; }
    else {
      for (let i = 1; i < KEYS.length; i++) {
        if (t < KEYS[i][0]) {
          const t0 = KEYS[i - 1][0], t1 = KEYS[i][0];
          a = KEYS[i - 1][1]; b = KEYS[i][1];
          const u = (t - t0) / Math.max(0.001, t1 - t0);
          const HOLD = 0.30;
          k = ease(clamp((u - HOLD) / (1 - 2 * HOLD)));
          break;
        }
      }
    }
    _wa = a; _wb = b; _wk = k;
    WTS[a] += 1 - k; WTS[b] += k;
    return WTS;
  }

  // 相机：破水面时跟着向上甩一下、离地时大幅拉远；最后回到首帧的取景（首尾同框）
  const CAMK = [
    [0.00, 960, 600, 0.94, -0.010], [4.20, 1000, 580, 1.06, 0.005],
    [7.60, 960, 620, 1.12, -0.015], [9.20, 940, 470, 1.20, -0.020],
    [12.00, 960, 560, 1.08, 0.010], [15.10, 960, 550, 1.16, -0.010],
    [18.10, 960, 540, 1.22, 0.010], [21.20, 960, 545, 1.10, -0.010],
    [24.20, 960, 540, 1.14, 0.005], [27.50, 960, 540, 1.36, 0.000],
    [31.90, 960, 540, 1.00, 0.005], [35.20, 960, 540, 1.30, 0.000],
    [38.70, 960, 545, 1.14, -0.010], [41.90, 960, 540, 1.42, 0.010],
    [45.40, 960, 540, 1.26, 0.000], [48.70, 960, 545, 1.06, -0.010],
    [52.40, 900, 600, 0.96, -0.005], [56.40, 960, 580, 0.98, 0.005],
    [60.5825, 960, 600, 0.94, -0.010],
  ];
  function camAt(t) {
    if (t <= CAMK[0][0]) { const c = CAMK[0]; return { cx: c[1], cy: c[2], zoom: c[3], rot: c[4] }; }
    for (let i = 1; i < CAMK.length; i++) {
      if (t < CAMK[i][0]) {
        const a = CAMK[i - 1], b = CAMK[i], k = easeIO((t - a[0]) / (b[0] - a[0]));
        return { cx: lerp(a[1], b[1], k), cy: lerp(a[2], b[2], k), zoom: lerp(a[3], b[3], k), rot: lerp(a[4], b[4], k) };
      }
    }
    const c = CAMK[CAMK.length - 1];
    return { cx: c[1], cy: c[2], zoom: c[3], rot: c[4] };
  }

  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // 背景：青绿的海 → 上浮更亮 → 破水面的水面霞光 → 深空 → 金黄的花 → 地球蓝 → 黑洞 → 回到海
  const BGK = [
    [0.00, '#BEE7E2', '#0E3F70'], [2.30, '#B2E0E4', '#0C3866'],
    [4.43, '#8FD8DC', '#0A2E5C'], [7.69, '#FFD2A0', '#2A4A86'],
    [9.60, '#4C6FB0', '#0A1430'], [12.12, '#FFFFFF', '#E6EDFF'],
    [13.30, '#171038', '#070512'], [15.15, '#0D1A3C', '#05070F'],
    [18.17, '#101A44', '#070A1E'], [21.20, '#2A1B4A', '#120A22'],
    [24.23, '#E8B845', '#C1701F'], [27.50, '#7BA8D8', '#0E2A50'],
    [31.92, '#3A1E52', '#140B28'], [35.18, '#3A1E52', '#0B1030'],
    [38.68, '#05070F', '#000104'], [41.94, '#05060E', '#000000'],
    [45.44, '#04040C', '#000000'], [47.60, '#06121F', '#000000'],
    [48.70, '#05070F', '#0B1226'], [52.43, '#05070F', '#0A1024'],
    [54.90, '#0E2440', '#07182E'], [56.39, '#101A30', '#061428'],
    [58.20, '#BEE7E2', '#0E3F70'], [60.5825, '#BEE7E2', '#0E3F70'],
  ];
  const _bg = { top: [190, 231, 226], bot: [14, 63, 112] };
  function bgAt(t) {
    let a = BGK[0], b = BGK[0];
    if (t <= BGK[0][0]) { a = b = BGK[0]; }
    else if (t >= BGK[BGK.length - 1][0]) { a = b = BGK[BGK.length - 1]; }
    else for (let i = 1; i < BGK.length; i++) if (t < BGK[i][0]) { a = BGK[i - 1]; b = BGK[i]; break; }
    const k = a === b ? 0 : ease(clamp((t - a[0]) / (b[0] - a[0])));
    const A0 = hx(a[1]), A1 = hx(a[2]), B0 = hx(b[1]), B1 = hx(b[2]);
    for (let i = 0; i < 3; i++) { _bg.top[i] = lerp(A0[i], B0[i], k); _bg.bot[i] = lerp(A1[i], B1[i], k); }
    return _bg;
  }
  function bgFill() {
    const C = G.getCtx();
    const g = C.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + (_bg.top[0] | 0) + ',' + (_bg.top[1] | 0) + ',' + (_bg.top[2] | 0) + ')');
    g.addColorStop(1, 'rgb(' + (_bg.bot[0] | 0) + ',' + (_bg.bot[1] | 0) + ',' + (_bg.bot[2] | 0) + ')');
    C.save(); C.fillStyle = g; C.fillRect(0, 0, W, H); C.restore();
  }

  const SEGS = [];
  (function () {
    let s = 20260925;
    const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    function grow(x, y, a, len, d) {
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
      SEGS.push([x, y, x1, y1, d]);
      if (d <= 0) return;
      const n = 2 + (R() < 0.42 ? 1 : 0);
      for (let i = 0; i < n; i++) grow(x1, y1, a + (i / (n - 1 || 1) - 0.5) * 1.08 + (R() - 0.5) * 0.36, len * (0.70 + R() * 0.15), d - 1);
    }
    for (let k = 0; k < 5; k++) grow(W * (0.12 + k * 0.19), H * 1.04, -Math.PI / 2 + (k - 2) * 0.36, 118, 5);
    grow(W * 0.05, H * 0.50, -0.14, 108, 4);
    grow(W * 0.95, H * 0.50, Math.PI + 0.14, 108, 4);
  })();

  // ---------- 星图航线：把"去过的每一幕"连成一条折线 ----------
  // 每个路标 = [x, y, 颜色]，颜色取自它代表的那一幕
  const TRAIL_WP = [
    [70, 770, '#7FD0FF'], [200, 715, '#9FD8FF'], [340, 655, '#DCEAFF'],
    [480, 600, '#FF6F5E'], [620, 545, '#8FA8FF'], [760, 495, '#6EDCFF'],
    [900, 460, '#FFC24B'], [1040, 445, '#F5C84E'], [1180, 460, '#5FB6E8'],
    [1320, 500, '#FFE0A0'], [1460, 555, '#C8D8FF'], [1600, 610, '#9FD4FF'],
    [1740, 660, '#FF9E5A'], [1855, 715, '#BCD8FF'],
  ];
  const TRAIL_SEG = [];
  (function () {
    const hx2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const M = TRAIL_WP.length, NS = 320;
    const P = j => TRAIL_WP[Math.max(0, Math.min(M - 1, j))];
    const cr = (p0, p1, p2, p3, k) => {
      const k2 = k * k, k3 = k2 * k;
      return 0.5 * (2 * p1 + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3);
    };
    for (let i = 0; i <= NS; i++) {
      const u = i / NS * (M - 1);
      const j = Math.min(M - 2, Math.floor(u)), k = clamp(u - j);
      const A = P(j - 1), B = P(j), C2 = P(j + 1), D2 = P(j + 2);
      const ca = hx2(B[2]), cb = hx2(C2[2]);
      TRAIL_SEG.push([
        cr(A[0], B[0], C2[0], D2[0], k), cr(A[1], B[1], C2[1], D2[1], k),
        lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k),
      ]);
    }
  })();
  const trailGrow = t => ease(clamp((t - 52.40) / 3.40));   // 航线"画到哪"：0 → 1
  function trailSample(u) {
    const idx = clamp(u) * (TRAIL_SEG.length - 1);
    const j0 = idx | 0, fj = idx - j0;
    const s0 = TRAIL_SEG[j0], s1 = TRAIL_SEG[j0 + 1 < TRAIL_SEG.length ? j0 + 1 : j0];
    return [lerp(s0[0], s1[0], fj), lerp(s0[1], s1[1], fj), s0[2], s0[3], s0[4]];
  }

  const GRID = 36, GN = GRID * GRID;

  const A9 = new Float32Array(9), B9 = new Float32Array(9), O9 = new Float32Array(9);
  function form(k, i, t, o) {
    switch (k) {
      case F_SEA: {
        const deep = r1(i, 5);
        // 取余绕回：浮游物的密度必须恒定。否则漂了 60 秒之后海会明显变空，
        // 片尾回到海时和开头不是同一个密度，首尾同框就露馅了。
        const y0 = G.frac(r3(i, 11) - t * (5 + 13 * deep) / (H * 1.10));
        o[0] = r2(i, 7) * W + Math.sin(t * 0.5 + i * 0.7) * 14;
        o[1] = H * 0.02 + y0 * H * 1.10;
        o[2] = 0.02; o[3] = 0;
        o[4] = 1.3 + 3.4 * deep;
        o[5] = 190 + 55 * deep; o[6] = 226 + 26 * deep; o[7] = 255;
        o[8] = 0.16 + 0.52 * deep;
        return;
      }
      case F_NEURON: {
        const s = SEGS[i % SEGS.length];
        const u = r1(i, 11), tip = s[4] === 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.4 - u * 7 - (i % 41) * 0.55);
        o[0] = s[0] + (s[2] - s[0]) * u + G.hashJit(i, 3.5);
        o[1] = s[1] + (s[3] - s[1]) * u + G.hashJit(i + 91, 3.5);
        o[2] = 0.02; o[3] = 0;
        o[4] = tip ? 5.0 + 3.0 * pulse : 2.1 + 1.6 * pulse;
        const c = tip ? 0.95 : 0.5 + 0.4 * pulse;
        o[5] = 120 + 130 * c; o[6] = 180 + 75 * c; o[7] = 255;
        o[8] = tip ? 0.95 : 0.30 + 0.55 * pulse;
        return;
      }
      case F_SPECTRUM: {
        const ray = i % 7, u = 0.06 + r1(i, 13) * 0.94;
        const Ox = W * 0.485, Oy = H * 0.565;
        const a = 0.02 + (ray - 3) * 0.078 + Math.sin(t * 1.6 + i) * 0.012;
        const c = [[255, 62, 26], [255, 150, 20], [252, 211, 0], [52, 199, 89], [0, 199, 190], [77, 107, 254], [175, 82, 222]][ray];
        o[0] = Ox + Math.cos(a) * 1750 * u; o[1] = Oy + Math.sin(a) * 1750 * u;
        o[2] = 0.02; o[3] = 0;
        o[4] = 2.2 + 2.4 * r2(i, 17);
        o[5] = c[0]; o[6] = c[1]; o[7] = c[2];
        o[8] = 0.35 + 0.5 * (1 - u) + 0.15 * r3(i, 19);
        return;
      }
      case F_WAVE: {
        const half = i % 2;
        const Sx = half ? W * 0.645 : W * 0.355, Sy = H * 0.50;
        const kk = Math.floor(i / 2) % 10;
        const ph = G.frac(t * 0.20 + kk / 10);
        const R = ph * 1000;
        const ang = r2(i, 41) * TAU;
        o[0] = Sx + Math.cos(ang) * R;
        o[1] = Sy + Math.sin(ang) * R * 0.94;
        o[2] = 0.02; o[3] = 0;
        o[4] = 2.0 + 2.6 * (1 - ph);
        if (half) { o[5] = 255; o[6] = 120; o[7] = 200; }
        else { o[5] = 110; o[6] = 220; o[7] = 255; }
        o[8] = (0.20 + 0.70 * (1 - ph)) * 0.9;
        return;
      }
      case F_RINGS: {
        const ring = i % 9, u = r1(i, 23);
        const R = 110 + ring * 92 + Math.sin(t * 1.1 + ring) * 14;
        const dir = ring % 2 ? 1 : -1;
        const ang = u * TAU + t * 0.34 * dir + ring * 0.7;
        const wob = 1 + 0.03 * Math.sin(ang * 3 + t * 1.7 + ring);
        o[0] = W * 0.5 + Math.cos(ang) * R * wob;
        o[1] = H * 0.5 + Math.sin(ang) * R * wob * 0.92;
        o[2] = 0.02; o[3] = 0;
        o[4] = 2.4 + 2.0 * r2(i, 29);
        const c = [[255, 194, 75], [77, 107, 254], [255, 111, 94], [63, 182, 168], [175, 82, 222]][ring % 5];
        o[5] = c[0]; o[6] = c[1]; o[7] = c[2];
        o[8] = 0.45 + 0.4 * r3(i, 31);
        return;
      }
      case F_FLOWER: {
        const kk = (i + 1) / N, GA = 2.399963229728653;
        const ang = i * GA + t * 0.16;
        const R = 470 * Math.sqrt(kk) * (0.96 + 0.04 * Math.sin(t * 1.4));
        o[0] = W * 0.5 + Math.cos(ang) * R; o[1] = H * 0.52 + Math.sin(ang) * R;
        o[2] = 0.02; o[3] = 0;
        o[4] = 5.0 + 3.4 * kk;
        if (kk < 0.5) { o[5] = 160; o[6] = 106; o[7] = 30; } else { o[5] = 74; o[6] = 53; o[7] = 24; }
        o[8] = 0.85;
        return;
      }
      case F_ORBIT: {
        const kk = i % 8;
        const a = 150 + kk * 96;
        const sp = 1.05 / Math.pow(a / 150, 1.5);
        const ang = r1(i, 37) * TAU + t * sp;
        const ecc = 0.07 + 0.05 * (kk % 3);
        o[0] = W * 0.5 + Math.cos(ang) * a * (1 - ecc * Math.cos(ang));
        o[1] = H * 0.50 + Math.sin(ang) * a * 0.42;
        o[2] = 0.02; o[3] = 0;
        o[4] = 3.6 - 0.22 * kk;
        if (kk === 0) { o[5] = 255; o[6] = 240; o[7] = 200; }
        else if (kk < 3) { o[5] = 255; o[6] = 196; o[7] = 110; }
        else if (kk < 6) { o[5] = 170; o[6] = 200; o[7] = 255; }
        else { o[5] = 130; o[6] = 130; o[7] = 235; }
        o[8] = 0.80 - 0.05 * kk;
        return;
      }
      case F_GALAXY: {
        const arm = i % 3, u = Math.pow(r1(i, 37), 0.75);
        const R = 40 + Math.exp(u * 3.35) * 16;
        const ang = arm * TAU / 3 + u * 2.75 + t * (0.16 + 0.30 * (0.3 + u)) + r2(i, 41) * 0.34;
        o[0] = W * 0.5 + Math.cos(ang) * R;
        o[1] = H * 0.5 + Math.sin(ang) * R * 0.40;
        o[2] = 0.02; o[3] = 0;
        o[4] = 4.2 - 3.0 * u;
        if (u < 0.14) { o[5] = 255; o[6] = 246; o[7] = 214; }
        else if (u < 0.42) { o[5] = 190; o[6] = 210; o[7] = 255; }
        else if (u < 0.70) { o[5] = 120; o[6] = 140; o[7] = 240; }
        else { o[5] = 66; o[6] = 78; o[7] = 170; }
        o[8] = 0.9 - 0.35 * u;
        return;
      }
      case F_SPACETIME: {
        if (i >= GN) {
          o[0] = r1(i, 61) * W; o[1] = r2(i, 67) * H;
          o[2] = 0.02; o[3] = 0; o[4] = 1.6; o[5] = 220; o[6] = 235; o[7] = 255;
          o[8] = 0.20 + 0.5 * r3(i, 71);
          return;
        }
        const col = i % GRID, row = (i / GRID) | 0;
        const gx = (col - (GRID - 1) / 2) * 84;
        const gy = (row - (GRID - 1) / 2) * 47;
        const d = Math.hypot(gx, gy * 1.6) + 1;
        const beat = G.pulse(t, 4.6);                     // 每拍 1 → 迅速衰减
        const z = -56000 / (d + 250) + 74 * Math.sin(d * 0.020 - t * 3.0) * Math.exp(-d / 1100) * (0.30 + 1.40 * beat);
        o[0] = W * 0.5 + gx;
        o[1] = H * 0.46 + gy * 0.44 + z * 0.60 - beat * 15 * Math.exp(-d / 900);
        o[2] = 0.02; o[3] = 0;
        o[4] = 2.0 + 2.4 * clamp(-z / 200);
        const w = clamp(-z / 190) * (0.58 + 0.72 * beat);
        o[5] = 120 + 135 * w; o[6] = 170 + 70 * w; o[7] = 255;
        o[8] = (0.18 + 0.70 * w) * (0.74 + 0.48 * beat);
        return;
      }
      case F_BH: {
        const u = Math.pow(r1(i, 43), 0.62);
        const R = 150 + 750 * u;
        const ang = r2(i, 47) * TAU + t * (9.0 / Math.pow(R / 150, 1.45));
        o[0] = W * 0.5 + Math.cos(ang) * R;
        o[1] = H * 0.5 + Math.sin(ang) * R * 0.26;
        o[2] = u < 0.55 ? -Math.sin(ang) * R * 0.10 : 0.03;
        o[3] = u < 0.55 ? Math.cos(ang) * R * 0.26 * 0.10 : 0;
        o[4] = 5.5 - 3.4 * u;
        if (u < 0.16) { o[5] = 255; o[6] = 250; o[7] = 230; }
        else if (u < 0.42) { o[5] = 255; o[6] = 198; o[7] = 96; }
        else if (u < 0.72) { o[5] = 255; o[6] = 126; o[7] = 54; }
        else { o[5] = 150; o[6] = 60; o[7] = 150; }
        o[8] = 0.95 - 0.4 * u;
        return;
      }
      case F_TUNNEL: {
        const ring = i % 14, u = r1(i, 53);
        const z = G.frac(u + t * 0.30 + ring * 0.09);
        const R = 70 + 1500 * Math.pow(z, 2.6);
        const ang = r2(i, 59) * TAU + t * 0.22;
        o[0] = W * 0.5 + Math.cos(ang) * R;
        o[1] = H * 0.5 + Math.sin(ang) * R;
        o[2] = 0.02; o[3] = 0;
        o[4] = 2.0 + 4.0 * (1 - z);
        const warm = 1 - z;
        o[5] = 120 + 135 * warm; o[6] = 170 + 70 * warm; o[7] = 255;
        o[8] = 0.30 + 0.65 * warm;
        return;
      }
      case F_UPWELL: {
        // 上升气流：螺旋往上，柱越往上越细、越亮、越稀
        const u = G.frac(r1(i, 5) + t * 0.055);
        const ang = r2(i, 7) * TAU + u * 3.6 + t * 0.5;
        const R = (150 + 330 * G.hash(i * 2.7)) * (1 - 0.58 * u);
        o[0] = W * 0.5 + Math.cos(ang) * R + Math.sin(u * 7 + i * 0.3) * 14;
        o[1] = H * 1.06 - u * H * 1.10;
        o[2] = 0.02; o[3] = 0;
        o[4] = 1.5 + 3.0 * (1 - u) + 1.2 * G.hash(i * 5.9);
        const c = 0.30 + 0.70 * u;
        o[5] = 140 + 115 * c; o[6] = 205 + 50 * c; o[7] = 255;
        o[8] = (0.14 + 0.66 * c) * Math.min(1, u * 7) * (1 - 0.85 * u * u);
        return;
      }
      case F_BREACH: {
        // 破水面：水花沿抛物线炸开 → 在弧顶停住 → 变成星星（一个动作同时完成"出海"和"入宙"）
        const dt = Math.max(0, t - 7.70);
        const life = clamp(dt / 0.85);
        const settle = ease(clamp((dt - 0.85) / 1.25));
        const a = -Math.PI * 0.5 + (r2(i, 11) - 0.5) * 2.05;
        const v = 420 + 620 * r3(i, 13);
        const sx = W * 0.5 + Math.cos(a) * v * life * 0.95;
        const sy = H * 0.72 + Math.sin(a) * v * life + 450 * life * life;
        o[0] = lerp(sx, W * 0.05 + r1(i, 17) * W * 0.90, settle);
        o[1] = lerp(sy, H * 0.03 + r2(i, 19) * H * 0.82, settle);
        const sp = 1 - settle;
        o[2] = Math.cos(a) * 13 * sp; o[3] = Math.sin(a) * 13 * sp;
        const tw = 0.60 + 0.40 * G.hash(i * 3.1);
        o[4] = lerp(1.9 + 3.2 * (1 - life) + 1.3 * G.hash(i * 5.3), 1.6 + 3.0 * G.hash(i * 7.7), settle);
        o[5] = lerp(196, 235 + 20 * tw, settle);
        o[6] = lerp(238, 240 + 15 * tw, settle);
        o[7] = 255;
        o[8] = lerp(0.88, 0.38 + 0.72 * tw, settle);
        return;
      }
      case F_LIFTOFF: {
        // 离地：葵花盘收缩成一颗球（地球），球再缩小 —— 我们退远了
        const lift = ease(clamp((t - 27.60) / 1.25));
        const outk = ease(clamp((t - 29.45) / 1.05));
        const kk = (i + 1) / N, GA = 2.399963229728653;
        const fang = i * GA + t * 0.16, fR = 470 * Math.sqrt(kk);
        const lat = (r1(i, 61) - 0.5) * 1.9, lon = r2(i, 67) * TAU + t * 0.16;
        const cs = Math.cos(lat);
        const X = Math.cos(lon) * cs, Y = Math.sin(lat), Z = Math.sin(lon) * cs;
        const R0 = 320 * (1 - 0.72 * outk);
        o[0] = lerp(W * 0.5 + Math.cos(fang) * fR, W * 0.5 + X * R0, lift);
        o[1] = lerp(H * 0.52 + Math.sin(fang) * fR, H * 0.50 + Y * R0, lift);
        o[2] = 0.02; o[3] = 0;
        o[4] = lerp(5.0 + 3.4 * kk, 1.8 + 2.6 * G.hash(i * 3.7), lift) * (1 - 0.30 * outk);
        const near = clamp(Z * 0.5 + 0.5);
        o[5] = lerp(255, 120, lift); o[6] = lerp(200, 190, lift); o[7] = lerp(120, 255, lift);
        o[8] = lerp(0.85, (0.22 + 0.78 * near) * (1 - 0.55 * outk), lift);
        return;
      }
      case F_TRAIL: {
        // 星图航线：粒子沿着"走过的路"铺开，本身就把探索过程画出来了
        const s = trailSample(r1(i, 31) * trailGrow(t));
        o[0] = s[0] + G.hashJit(i, 15);
        o[1] = s[1] + G.hashJit(i + 31, 15);
        o[2] = 0.02; o[3] = 0;
        o[4] = 1.8 + 2.6 * G.hash(i * 5.1);
        o[5] = s[2]; o[6] = s[3]; o[7] = s[4];
        o[8] = (0.30 + 0.62 * G.hash(i * 7.3)) * (0.45 + 0.55 * trailGrow(t));
        return;
      }
      default: {
        const lat = (r1(i, 61) - 0.5) * 1.9, lon = r2(i, 67) * TAU + t * 0.16;
        const cs = Math.cos(lat);
        const X = Math.cos(lon) * cs, Y = Math.sin(lat), Z = Math.sin(lon) * cs;
        if (Z < 0.02) { o[0] = -9999; o[1] = -9999; o[2] = 0; o[3] = 0; o[4] = 0; o[8] = 0; return; }
        const R = 330, cx = W * 0.56, cy = H * 0.50;
        const cloud = r3(i, 71) < 0.42;
        o[0] = cx + X * R; o[1] = cy + Y * R;
        o[2] = 0.02; o[3] = 0;
        o[4] = cloud ? 8 + 6 * r1(i, 73) : 3.0;
        if (cloud) { o[5] = 255; o[6] = 255; o[7] = 255; o[8] = 0.55 * Z; }
        else { o[5] = 90; o[6] = 160; o[7] = 235; o[8] = 0.30 * Z; }
        return;
      }
    }
  }

  const COLQ = new Array(256);
  (function () {
    for (let r = 0; r < 8; r++) for (let g = 0; g < 8; g++) for (let b = 0; b < 4; b++) {
      COLQ[(r << 5) | (g << 2) | b] =
        'rgb(' + Math.min(255, r * 36 + 18) + ',' + Math.min(255, g * 36 + 18) + ',' + (b * 85 + 42) + ')';
    }
  })();

  function drawParticles(t) {
    const C = G.getCtx();
    C.save(); C.lineCap = 'round';
    const topR = _bg.top[0], topG = _bg.top[1], topB = _bg.top[2];
    for (let i = 0; i < N; i++) {
      form(_wa, i, t, A9);
      if (_wk > 0.001) {
        form(_wb, i, t, B9);
        for (let j = 0; j < 9; j++) O9[j] = A9[j] + (B9[j] - A9[j]) * _wk;
      } else for (let j = 0; j < 9; j++) O9[j] = A9[j];
      let a = O9[8]; if (a <= 0.012) continue;
      if (a > 1) a = 1;
      const yy = clamp(O9[1] / H);
      const br = lerp(topR, _bg.bot[0], yy), bg_ = lerp(topG, _bg.bot[1], yy), bb = lerp(topB, _bg.bot[2], yy);
      const r = (br + (O9[5] - br) * a) | 0, g = (bg_ + (O9[6] - bg_) * a) | 0, bl = (bb + (O9[7] - bb) * a) | 0;
      const col = COLQ[((r >> 5) << 5) | ((g >> 5) << 2) | (bl >> 6)];
      const dx = O9[2], dy = O9[3];
      if (dx > 0.25 || dx < -0.25 || dy > 0.25 || dy < -0.25) {
        C.strokeStyle = col;
        C.lineWidth = Math.max(1.4, O9[4]);
        C.beginPath(); C.moveTo(O9[0] - dx, O9[1] - dy); C.lineTo(O9[0] + dx, O9[1] + dy); C.stroke();
      } else {
        const s = O9[4] < 1.7 ? 1.7 : O9[4];
        C.fillStyle = col;
        C.fillRect(O9[0] - s * 0.5, O9[1] - s * 0.5, s, s);
      }
    }
    C.restore();
  }

  function beam(k, j, t, out) {
    const u = j / (NBEAM - 1);
    switch (k) {
      case F_SEA: { const a = u * TAU * 1.6; out[0] = -40 + u * (W + 80); out[1] = H * 0.115 + Math.sin(a + t * 1.3) * 16 + Math.sin(a * 2.3 - t * 0.7) * 7; return; }
      case F_NEURON: { out[0] = -60 + u * (W + 120); out[1] = H * 0.50 + Math.sin(u * 3.1 + t * 1.4) * 70 * (1 - u) + G.hashJit(j, 8); return; }
      case F_SPECTRUM: { out[0] = -60 + u * (W + 120); out[1] = H * 0.556; return; }
      case F_WAVE: { out[0] = -40 + u * (W + 80); out[1] = H * 0.50 + Math.sin(u * 9.5 - t * 2.6) * 120 * Math.sin(u * Math.PI); return; }
      case F_RINGS: { const a = u * TAU + t * 0.3; out[0] = W * 0.5 + Math.cos(a) * 300; out[1] = H * 0.5 + Math.sin(a) * 300; return; }
      case F_FLOWER: { out[0] = W * 0.5 + Math.sin(u * 1.4 + t * 0.5) * 30; out[1] = H * 0.56 + u * H * 0.62; return; }
      case F_ORBIT: { const a = u * Math.PI * 2 + t * 0.22; out[0] = W * 0.5 + Math.cos(a) * 560; out[1] = H * 0.50 + Math.sin(a) * 560 * 0.42; return; }
      case F_GALAXY: { const uu = u * 2.6; out[0] = W * 0.5 + Math.cos(uu + t * 0.3) * (40 + Math.exp(u * 3.1) * 14); out[1] = H * 0.5 + Math.sin(uu + t * 0.3) * (40 + Math.exp(u * 3.1) * 14) * 0.40; return; }
      case F_SPACETIME: { const gx = (u - 0.5) * 1700; const d = Math.abs(gx) + 1; const bend = 260 * Math.exp(-d / 420); out[0] = W * 0.5 + gx; out[1] = H * 0.46 + bend - 30; return; }
      case F_BH: { const a = u * Math.PI * 0.92 + Math.PI * 0.04; out[0] = W * 0.5 + Math.cos(a) * 430; out[1] = H * 0.5 + Math.sin(a) * 430 * 0.26; return; }
      case F_TUNNEL: { out[0] = W * 0.5 + G.jit(1.4); out[1] = -40 + u * (H + 80); return; }
      case F_EARTH: { out[0] = -60 + u * (W + 120); out[1] = H * 0.72 + Math.cos(u * Math.PI) * -34; return; }
      case F_UPWELL: { const a = u * 3.4 + t * 0.7; out[0] = W * 0.5 + Math.cos(a) * 190 * (1 - u * 0.5); out[1] = H * 1.06 - u * H * 1.12; return; }
      case F_BREACH: { out[0] = -40 + u * (W + 80); out[1] = H * 0.80 - Math.sin(u * Math.PI) * H * 0.40 + Math.sin(u * 21 + t * 2.1) * 7; return; }
      case F_LIFTOFF: {
        const lift = ease(clamp((t - 27.60) / 1.25));
        const outk = ease(clamp((t - 29.45) / 1.05));
        const R = lerp(400, 320 * (1 - 0.72 * outk), lift), a = u * TAU;
        out[0] = W * 0.5 + Math.cos(a) * R; out[1] = H * 0.51 + Math.sin(a) * R; return;
      }
      case F_TRAIL: { const s = trailSample(u * trailGrow(t)); out[0] = s[0]; out[1] = s[1]; return; }
      default: { out[0] = -60 + u * (W + 120); out[1] = H * 0.70; return; }
    }
  }
  const BA = new Float32Array(2), BB = new Float32Array(2), BO = new Float32Array(2), beamPts = [];
  for (let j = 0; j < NBEAM; j++) beamPts.push([0, 0]);
  function drawBeam(t) {
    for (let j = 0; j < NBEAM; j++) {
      beam(_wa, j, t, BA);
      if (_wk > 0.001) { beam(_wb, j, t, BB); BO[0] = BA[0] + (BB[0] - BA[0]) * _wk; BO[1] = BA[1] + (BB[1] - BA[1]) * _wk; }
      else { BO[0] = BA[0]; BO[1] = BA[1]; }
      beamPts[j][0] = BO[0] + G.jit(1.2); beamPts[j][1] = BO[1] + G.jit(1.2);
    }
    const lum = 1 - clamp((_bg.top[0] + _bg.top[1] + _bg.top[2]) / 765);
    const wCol = lum > 0.45 ? '#FFF6DC' : 'rgba(150,180,220,0.65)';
    G.stroke(beamPts, { ink: wCol, sw: 4.6, alpha: 110 + 140 * lum, jitter: 0, smooth: 1 });
    G.stroke(beamPts, { ink: lum > 0.45 ? 'rgba(180,205,255,0.55)' : 'rgba(120,130,190,0.35)', sw: 17, alpha: 45, jitter: 0, smooth: 1 });
  }

  // ---------- 海洋：光柱 / 焦散 / 海底 ----------
  function seaProps(t, w) {
    const C = G.getCtx();
    C.save(); C.globalAlpha = C.globalAlpha * w;
    for (let i = 0; i < 7; i++) {
      const x = 120 + i * 270 + Math.sin(t * 0.35 + i) * 22;
      const wid = 60 + 40 * G.hash(i * 3.1);
      const a = 0.10 + 0.10 * Math.sin(t * 0.9 + i * 1.7);
      const g = C.createLinearGradient(x, 0, x - 260, H);
      g.addColorStop(0, 'rgba(255,244,205,' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,244,205,0)');
      C.fillStyle = g;
      C.beginPath();
      C.moveTo(x - wid / 2, -10); C.lineTo(x + wid / 2, -10);
      C.lineTo(x - 250 + wid, H + 10); C.lineTo(x - 250 - wid, H + 10);
      C.closePath(); C.fill();
    }
    for (let i = 0; i < 22; i++) {
      const x = G.hash(i * 2.7) * W;
      const y = H * 0.09 + Math.sin(t * 0.9 + i) * 22 + G.hash(i * 5.1) * 40;
      G.stroke([[x, y], [x + 60 + 40 * Math.sin(t * 1.4 + i), y + 10]], { ink: 'rgba(255,255,235,0.6)', sw: 3 + 3 * G.hash(i * 7), alpha: 120, jitter: 3 });
    }
    C.save();
    const sg = C.createLinearGradient(0, H * 0.86, 0, H);
    sg.addColorStop(0, 'rgba(8,26,48,0)'); sg.addColorStop(1, 'rgba(4,14,30,0.95)');
    C.fillStyle = sg;
    C.beginPath(); C.moveTo(-20, H + 20);
    for (let i = 0; i <= 30; i++) { const x = -20 + i * (W + 40) / 30; C.lineTo(x, H * 0.90 + Math.sin(x * 0.004 + 1.2) * 34 + G.jit(5)); }
    C.lineTo(W + 20, H + 20); C.closePath(); C.fill();
    C.restore();
    for (let i = 0; i < 9; i++) {
      const x = 90 + i * 215 + G.hash(i * 3.3) * 60;
      G.weed(t, x, H * 0.97, 180 + G.hash(i * 5.7) * 240, 46, { color: '#0A2A44', op: 190, ph: i * 1.3 });
    }
    C.restore();
  }

  function waveProps(t, w) {
    const C = G.getCtx();
    C.save(); C.globalAlpha = C.globalAlpha * w;
    for (let s = 0; s < 2; s++) {
      const Sx = s ? W * 0.645 : W * 0.355;
      G.glow(Sx, H * 0.50, 150, s ? 'rgba(255,120,200,0.75)' : 'rgba(110,220,255,0.75)', 255);
      G.dot(Sx, H * 0.50, 12, s ? '#FF78C8' : '#6EDCFF', 255);
      for (let k = 0; k < 4; k++) {
        const ph = G.frac(t * 0.20 + k / 4);
        G.stroke(G.ellPts(Sx, H * 0.50, ph * 1000, ph * 940, 44, 3.5), { ink: s ? '#FF78C8' : '#6EDCFF', sw: 2.2, alpha: 110 * (1 - ph), jitter: 2.4 });
      }
    }
    C.restore();
  }

  // 与粒子尘埃环完全一致的轨道半径（见 form() 的 F_ORBIT：a = 150 + kk*96）
  const ORB_A = [150, 246, 342, 438, 534, 630, 726, 822];
  const ORB_FLAT = 0.42;
  // 行星：全部落在尘埃环上，尺寸/配色拉开层次；第 5 颗带环（土星），并配一颗卫星
  const ORB_PLANETS = [
    { k: 1, r: 11, c: '#C6B49A' },
    { k: 2, r: 17, c: '#7FD0FF' },
    { k: 3, r: 23, c: '#8FD98A' },
    { k: 4, r: 19, c: '#FF9E7A' },
    { k: 5, r: 35, c: '#E8C98A', ring: true, moon: true },
    { k: 6, r: 12, c: '#C79BFF' },
    { k: 7, r: 15, c: '#9FD4FF' },
  ];
  function orbitProps(t, w) {
    const C = G.getCtx();
    C.save(); C.globalAlpha = C.globalAlpha * w;
    const cx = W * 0.5, cy = H * 0.50;
    // 轨道线：用与尘埃相同的半径，行星才"在轨道上"
    for (let k = 0; k < ORB_A.length; k++) {
      const a = ORB_A[k];
      G.stroke(G.ellPts(cx, cy, a, a * ORB_FLAT, 60, 2.2), { ink: 'rgba(185,208,255,0.45)', sw: 1.8, alpha: 115, jitter: 2.4 });
    }
    // 太阳 + 日冕
    G.glow(cx, cy, 1200, 'rgba(255,180,90,0.18)', 255);
    G.glow(cx, cy, 330, 'rgba(255,226,150,0.85)', 255);
    G.glow(cx, cy, 150, 'rgba(255,246,210,0.75)', 255);
    G.paint(G.ellPts(cx, cy, 62, 62, 36, 2.6), { fill: '#FFF0C0', ink: '#FFC24B', sw: 3, jitter: 2 });
    // 行星
    for (let j = 0; j < ORB_PLANETS.length; j++) {
      const P = ORB_PLANETS[j];
      const a = ORB_A[P.k];
      const sp = 1.05 / Math.pow(a / 150, 1.5);
      const ang = j * 2.39996 + t * sp;                       // 黄金角铺开，不会挤在一起
      const px = cx + Math.cos(ang) * a, py = cy + Math.sin(ang) * a * ORB_FLAT;
      const rot = 0.34;
      const arc = (a0, a1, rx, ry) => {
        const q = [];
        for (let i = 0; i <= 26; i++) {
          const aa = G.lerp(a0, a1, i / 26), ex = Math.cos(aa) * rx, ey = Math.sin(aa) * ry;
          q.push([px + ex * Math.cos(rot) - ey * Math.sin(rot), py + ex * Math.sin(rot) + ey * Math.cos(rot)]);
        }
        return q;
      };
      if (P.ring) G.stroke(arc(Math.PI, TAU, P.r * 2.45, P.r * 0.78), { ink: 'rgba(255,238,196,0.8)', sw: 7, alpha: 205, jitter: 1.8 });
      G.glow(px, py, P.r * 2.6, 'rgba(255,255,255,0.16)', 255);
      G.paint(G.ellPts(px, py, P.r, P.r, 22, 2), { fill: P.c, ink: 'rgba(10,14,30,0.62)', sw: 2.2, jitter: 2 });
      if (P.ring) G.stroke(arc(0, Math.PI, P.r * 2.45, P.r * 0.78), { ink: 'rgba(255,244,214,0.95)', sw: 7, alpha: 235, jitter: 1.8 });
      if (P.moon) {
        const ma = ang * 5.2 + 1.1;
        const mx = px + Math.cos(ma) * (P.r + 34), my = py + Math.sin(ma) * (P.r + 34) * 0.5;
        G.paint(G.ellPts(mx, my, 6.5, 6.5, 14, 1.4), { fill: '#EDE6D6', ink: 'rgba(10,14,30,0.55)', sw: 1.8, jitter: 1.4 });
      }
    }
    C.restore();
  }

  function spacetimeProps(t, w) {
    const C = G.getCtx();
    C.save(); C.globalAlpha = C.globalAlpha * w;
    const cx = W * 0.5, cy = H * 0.46 + 46;
    const bp = G.pulse(t, 4.6);                            // 拍点强度
    G.glow(cx, cy, 230 + 170 * bp, 'rgba(255,214,140,' + (0.45 + 0.35 * bp).toFixed(3) + ')', 255);
    G.paint(G.ellPts(cx, cy, 30 * (1 + 0.16 * bp), 30 * (1 + 0.16 * bp), 26, 2), { fill: '#0A0B14', ink: '#FFD98A', sw: 2.6 + 2.4 * bp, jitter: 1.6 });
    G.orbit(cx, cy, 46 + 12 * bp, 46 + 12 * bp, 0, 'rgba(255,230,175,' + (0.6 + 0.4 * bp).toFixed(3) + ')', 3 + 3 * bp, 200 + 55 * bp);
    // 时空网格线：把节点连起来，坑的形变才看得出来
    const disp = (gx, gy) => {
      const d = Math.hypot(gx, gy * 1.6) + 1;
      const z = -56000 / (d + 250) + 74 * Math.sin(d * 0.020 - t * 3.0) * Math.exp(-d / 1100) * (0.30 + 1.40 * bp);
      return [W * 0.5 + gx, H * 0.46 + gy * 0.44 + z * 0.60 - bp * 15 * Math.exp(-d / 900)];
    };
    C.lineCap = 'round';
    for (let row = 0; row < GRID; row++) {
      const gy = (row - (GRID - 1) / 2) * 47, pts = [];
      for (let col = 0; col <= GRID; col += 2) pts.push(disp((col - (GRID - 1) / 2) * 84, gy));
      G.stroke(pts, { ink: 'rgba(140,195,255,0.60)', sw: 1.4, alpha: 110, jitter: 1.6, smooth: 1 });
    }
    for (let col = 0; col < GRID; col++) {
      const gx = (col - (GRID - 1) / 2) * 84, pts = [];
      for (let row = 0; row <= GRID; row += 2) pts.push(disp(gx, (row - (GRID - 1) / 2) * 47));
      G.stroke(pts, { ink: 'rgba(140,195,255,0.55)', sw: 1.4, alpha: 100, jitter: 1.6, smooth: 1 });
    }
    // 卡拍点的引力波：每一拍从中心甩出一圈，每小节第一拍更重
    const bn = G.beatN(t);
    for (let b = Math.max(0, bn - 10); b <= bn; b++) {
      const age = t - G.beatT(b);
      if (age < 0 || age > 1.9) continue;
      const Rw = 110 + age * 360;
      const a = Math.pow(1 - age / 1.9, 1.4);
      const acc = (b % 4 === 0) ? 1.45 : 1;
      G.stroke(G.ellPts(cx, cy, Rw, Rw * 0.44, 48, 3 + 3 * (1 - a)), { ink: 'rgba(228,244,255,0.95)', sw: (2.2 + 5.5 * a) * acc, alpha: 235 * a * acc, jitter: 3 });
      G.stroke(G.ellPts(cx, cy, Rw, Rw * 0.44, 48, 3), { ink: 'rgba(150,205,255,0.65)', sw: 20 * acc, alpha: 80 * a * acc, jitter: 5 });
    }
    C.restore();
  }

  // ---------- 上浮：向上的光柱 + 气泡 ----------
  function upwellProps(t, w) {
    const C = G.getCtx();
    C.save(); C.globalAlpha = C.globalAlpha * w;
    for (let i = 0; i < 6; i++) {
      const x = 260 + i * 280 + Math.sin(t * 0.4 + i) * 18;
      const a = 0.09 + 0.07 * Math.sin(t * 0.7 + i * 1.3);
      const g = C.createLinearGradient(x, H, x, 0);
      g.addColorStop(0, 'rgba(200,245,255,0)');
      g.addColorStop(1, 'rgba(224,250,255,' + a.toFixed(3) + ')');
      C.fillStyle = g;
      C.beginPath();
      C.moveTo(x - 84 + i * 6, H + 10); C.lineTo(x + 84 - i * 6, H + 10);
      C.lineTo(x + 24, -10); C.lineTo(x - 24, -10);
      C.closePath(); C.fill();
    }
    for (let i = 0; i < 22; i++) {
      const ph = G.frac(G.hash(i * 3.7) + t * 0.10);
      const x = W * 0.5 + Math.cos(i * 2.4 + ph * 3.2) * (110 + 320 * G.hash(i * 7.1)) * (1 - 0.6 * ph);
      G.bubble(t, x, H * 1.04 - ph * H * 1.08, 3 + 9 * G.hash(i * 5.3), { op: 150 * (1 - ph * 0.7), ink: '#EAF8FF' });
    }
    C.restore();
  }

  // ---------- 破水面：水面 + 浪花 → 星星 ----------
  function breachProps(t, w) {
    const C = G.getCtx();
    const dt = Math.max(0, t - 7.70);
    const settle = ease(clamp((dt - 0.85) / 1.25));
    const surf = 1 - settle;
    C.save(); C.globalAlpha = C.globalAlpha * w * surf;
    const g = C.createLinearGradient(0, H * 0.72, 0, H);
    g.addColorStop(0, 'rgba(150,220,240,0.50)'); g.addColorStop(1, 'rgba(6,26,52,0.92)');
    C.fillStyle = g;
    C.beginPath(); C.moveTo(-20, H + 20); C.lineTo(-20, H * 0.74);
    for (let i = 0; i <= 44; i++) {
      const x = -20 + i * (W + 40) / 44;
      C.lineTo(x, H * 0.72 + Math.sin(x * 0.012 + t * 1.6) * 9 + G.jit(3));
    }
    C.lineTo(W + 20, H + 20); C.closePath(); C.fill();
    C.restore();
    const life = clamp(dt / 0.85);
    for (let i = 0; i < 30; i++) {
      const a = -Math.PI * 0.5 + (G.hash(i * 2.9) - 0.5) * 1.9;
      const v = 400 + 520 * G.hash(i * 4.3);
      const x = W * 0.5 + Math.cos(a) * v * life * 0.9;
      const y = H * 0.72 + Math.sin(a) * v * life + 450 * life * life;
      G.dot(x, y, (3 + 7 * G.hash(i * 6.1)) * (1 - 0.45 * settle), '#F2FBFF', 195 * surf * w);
    }
    G.starfield(t, 200, '#EAF2FF', 175 * settle * w);
  }

  // ---------- 离地：地球缩小（与片尾"地出"共用同一个 drawEarth）----------
  function liftoffProps(t, w) {
    const lift = ease(clamp((t - 27.60) / 1.25));
    const outk = ease(clamp((t - 29.45) / 1.05));
    const R = lerp(300, 320 * (1 - 0.72 * outk), lift);
    G.starfield(t, 200, '#DCE8FF', 110 * w);
    drawEarth(W * 0.5, H * 0.50, R, t, w * (0.30 + 0.70 * lift));
  }

  // ---------- 星图航线：航线 + 每一幕留下的路标 ----------
  function trailProps(t, w) {
    const C = G.getCtx();
    const grow = trailGrow(t);
    const n = Math.max(2, Math.round((TRAIL_SEG.length - 1) * grow));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([TRAIL_SEG[i][0], TRAIL_SEG[i][1]]);
    C.save(); C.globalAlpha = C.globalAlpha * w;
    G.stroke(pts, { ink: 'rgba(120,180,255,0.55)', sw: 16, alpha: 55, jitter: 2.6, smooth: 1 });
    G.stroke(pts, { ink: 'rgba(232,244,255,0.98)', sw: 3.0, alpha: 205, jitter: 1.8, smooth: 1 });
    C.restore();
    for (let i = 0; i < TRAIL_WP.length; i++) {
      if (i / (TRAIL_WP.length - 1) > grow + 0.02) break;
      markAt(TRAIL_WP[i][0], TRAIL_WP[i][1], i, t, w);
    }
  }
  function markAt(x, y, i, t, w) {
    const C = G.getCtx();
    const col = TRAIL_WP[i][2];
    const pop = (0.78 + 0.22 * Math.sin(t * 2 + i)) * 1.55;
    C.save(); C.translate(x, y); C.scale(pop, pop);
    C.globalAlpha = C.globalAlpha * w;
    G.glow(0, 0, 40, 'rgba(180,215,255,0.55)', 255);
    G.orbit(0, 0, 13, 13, 0, col, 2.6, 235);
    switch (i) {
      case 0: G.stroke([[-9, 3], [0, -3], [9, 3]], { ink: col, sw: 2.4, alpha: 230 }); break;
      case 1: G.stroke([[0, 7], [0, -7]], { ink: col, sw: 2.4, alpha: 230 }); G.stroke([[-5, -2], [0, -8], [5, -2]], { ink: col, sw: 2.2, alpha: 230 }); break;
      case 2: for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; G.dot(Math.cos(a) * 7, Math.sin(a) * 7, 1.8, '#FFFFFF', 230); } break;
      case 3: G.paint([[-6, 6], [6, 6], [0, -7]], { fill: 'rgba(220,235,255,0.5)', ink: col, sw: 2 }); break;
      case 4: G.dot(0, 0, 3, col, 240); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; G.stroke([[0, 0], [Math.cos(a) * 8, Math.sin(a) * 8]], { ink: col, sw: 1.8, alpha: 190 }); } break;
      case 5: G.stroke([[-3, -7], [-3, 7]], { ink: col, sw: 2.4, alpha: 230 }); G.stroke([[3, -7], [3, 7]], { ink: col, sw: 2.4, alpha: 230 }); break;
      case 6: G.orbit(0, 0, 6, 6, 0, col, 2.4, 230); break;
      case 7: for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; G.paint(G.ellPts(Math.cos(a) * 7, Math.sin(a) * 7, 3.6, 1.8, 10, 0, a), { fill: col, fillOp: 235 }); } break;
      case 8: G.paint(G.ellPts(0, 0, 6, 6, 16, 0), { fill: '#5FB6E8', ink: '#DCE8FF', sw: 1.6 }); break;
      case 9: G.orbit(0, 0, 8, 4, 0, col, 1.8, 220); G.dot(0, 0, 2.6, '#FFE0A0', 250); break;
      case 10: for (let k = 0; k < 3; k++) { const q = []; for (let s = 0; s <= 8; s++) { const u2 = s / 8, a = k / 3 * TAU + u2 * 2.4; q.push([Math.cos(a) * u2 * 8, Math.sin(a) * u2 * 8 * 0.6]); } G.stroke(q, { ink: col, sw: 1.6, alpha: 210 }); } break;
      case 11: G.stroke([[-8, 0], [8, 0]], { ink: col, sw: 1.6, alpha: 190 }); G.stroke([[0, -6], [0, 6]], { ink: col, sw: 1.6, alpha: 190 }); break;
      case 12: G.paint(G.ellPts(0, 0, 6, 6, 18, 0), { fill: '#05060E' }); G.orbit(0, 0, 8, 8, 0, '#FFC24B', 2, 240); break;
      case 13: G.orbit(0, 0, 4, 4, 0, col, 1.6, 190); G.orbit(0, 0, 7, 7, 0, col, 1.4, 150); break;
      default: G.paint(G.ellPts(0, 0, 6, 6, 16, 0), { fill: 'rgba(150,215,255,0.35)', ink: '#DCE8FF', sw: 1.6 }); G.stroke([[-8, 2], [8, 2]], { ink: '#DCE8FF', sw: 1.6, alpha: 220 }); break;
    }
    C.restore();
  }

  function backProps(t) {
    const C = G.getCtx();
    // 海洋的水下层先画（在粒子后面）
    const wsea = WTS[F_SEA];
    if (wsea > 0.02) seaProps(t, wsea);
    const wup = WTS[F_UPWELL];
    if (wup > 0.02) upwellProps(t, wup);
    const wbr = WTS[F_BREACH];
    if (wbr > 0.02) breachProps(t, wbr);
    const wlf = WTS[F_LIFTOFF];
    if (wlf > 0.02) liftoffProps(t, wlf);
    const wfl = WTS[F_FLOWER];
    if (wfl > 0.02) {
      C.save(); C.globalAlpha = C.globalAlpha * wfl;
      const cx = W * 0.5, cy = H * 0.52;
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + t * 0.10;
        G.paint(G.ellPts(cx + Math.cos(a) * 560, cy + Math.sin(a) * 560, 165, 58, 20, 3.4, a),
          { fill: '#F5C84E', fillOp: 245, ink: '#D89A22', sw: 3, jitter: 3.4 });
      }
      G.glow(cx, cy, 600, 'rgba(255,214,130,0.35)', 255);
      C.restore();
    }
    const wg = WTS[F_GALAXY];
    if (wg > 0.02) G.glow(W * 0.5, H * 0.5, 300, 'rgba(255,240,205,0.55)', 255 * wg);
    const wt = WTS[F_TUNNEL];
    if (wt > 0.02) G.glow(W * 0.5, H * 0.5, 260, 'rgba(190,220,255,0.5)', 255 * wt);
  }

  function sceneProps(t) {
    const C = G.getCtx();
    const wfl = WTS[F_FLOWER];
    if (wfl > 0.02) {
      const cx = W * 0.5, cy = H * 0.52;
      G.stroke([[cx, cy + 380], [cx + Math.sin(t * 0.5) * 24, H + 40]], { ink: '#6E9F58', sw: 12, alpha: 180 * wfl, jitter: 3, smooth: 1 });
      G.paint(G.ellPts(cx - 80, cy + 560, 90, 34, 20, 3, -0.5), { fill: '#7BB05E', fillOp: 200 * wfl, ink: '#5C8A45', sw: 2.6, jitter: 3 });
    }
    if (WTS[F_NEURON] > 0.01) {
      const a0 = WTS[F_NEURON];
      C.save(); C.lineCap = 'round';
      for (let d = 0; d <= 5; d++) {
        C.strokeStyle = 'rgba(150,190,255,' + ((0.16 + 0.09 * (5 - d)) * a0).toFixed(3) + ')';
        C.lineWidth = 0.9 + (5 - d) * 0.85;
        C.beginPath();
        for (let s = 0; s < SEGS.length; s++) {
          if (SEGS[s][4] !== d) continue;
          const q = SEGS[s];
          C.moveTo(q[0] + G.jit(1.4), q[1] + G.jit(1.4));
          C.lineTo(q[2] + G.jit(1.4), q[3] + G.jit(1.4));
        }
        C.stroke();
      }
      C.restore();
    }
    // 三棱镜：实体玻璃三角（不再是一条多余的大弧线）
    const wsp = WTS[F_SPECTRUM];
    if (wsp > 0.02) {
      const cx = W * 0.42, cy = H * 0.50, s = 132;
      const tri = [[cx, cy - s], [cx - s * 0.95, cy + s * 0.78], [cx + s * 0.95, cy + s * 0.78]];
      G.glow(cx, cy, 320, 'rgba(180,220,255,0.55)', 235 * wsp);
      G.paint(tri, { fill: '#CFE4FF', fillOp: 120, ink: '#EAF3FF', sw: 3.6, jitter: 1.4, inkOp: 240 });
      G.paint([[cx - s * 0.4, cy + s * 0.2], [cx, cy - s * 0.55], [cx + s * 0.2, cy + s * 0.3]],
        { fill: '#FFFFFF', fillOp: 90, jitter: 2.4 });
      const O = [W * 0.485, H * 0.565], SP = P.split;
      for (let q = 0; q < 7; q++) {
        const a = 0.02 + (q - 3) * 0.078, L = 1750, pts = [];
        for (let k = 0; k <= 22; k++) {
          const u = k / 22;
          pts.push([O[0] + Math.cos(a) * L * u, O[1] + Math.sin(a) * L * u + Math.sin(u * 7 + t * 1.3 + q) * 6 * u]);
        }
        G.stroke(pts, { ink: SP[q], sw: 5.5, alpha: 235 * wsp, jitter: 1.4, smooth: 1 });
        G.stroke(pts, { ink: SP[q], sw: 24, alpha: 60 * wsp, jitter: 3, smooth: 1 });
      }
      G.glow(O[0], O[1], 280, 'rgba(255,255,255,0.55)', 230 * wsp);
    }
    const ww = WTS[F_WAVE];
    if (ww > 0.02) waveProps(t, ww);
    const wo = WTS[F_ORBIT];
    if (wo > 0.02) orbitProps(t, wo);
    const wst = WTS[F_SPACETIME];
    if (wst > 0.02) spacetimeProps(t, wst);
    const wbh = WTS[F_BH];
    if (wbh > 0.01) {
      const cx = W * 0.5, cy = H * 0.5, R = 150;
      G.glow(cx, cy, R * 3.2, 'rgba(255,170,80,0.30)', 255 * wbh);
      G.orbit(cx, cy, R * 1.06, R * 1.06, 0, '#FFE7A8', 3.6, 245 * wbh);
      G.paint(G.ellPts(cx, cy, R, R, 44, 1.4), { fill: '#03040A', jitter: 1 });
      G.orbit(cx, cy, R * 1.44, R * 1.44, 0, 'rgba(255,220,160,0.75)', 7, 150 * wbh);
    }
    const wt = WTS[F_TUNNEL];
    if (wt > 0.02) {
      C.save(); C.globalAlpha = C.globalAlpha * wt;
      for (let k = 0; k < 13; k++) {
        const z = G.frac(k / 13 + t * 0.30);
        const R = 40 + 1700 * Math.pow(z, 2.2);
        const a = 1 - z;
        G.stroke(G.ellPts(W * 0.5, H * 0.5, R, R, 40, 2.6 + 4 * z), {
          ink: 'rgb(' + ((150 + 105 * a) | 0) + ',' + ((190 + 65 * a) | 0) + ',255)', sw: 2.6 + 5 * a, alpha: 40 + 200 * a, jitter: 2.4
        });
      }
      C.restore();
    }
    const we = WTS[F_EARTH];
    if (we > 0.01) {
      G.starfield(t, 260, '#DCE8FF', 210 * we);
      drawEarth(W * 0.56, H * 0.50, 330, t, we);
      C.save(); C.globalAlpha = C.globalAlpha * we;
      const g = C.createLinearGradient(0, H * 0.74, 0, H);
      g.addColorStop(0, '#15161F'); g.addColorStop(1, '#07070C');
      C.fillStyle = g;
      C.beginPath(); C.moveTo(-20, H + 20);
      for (let i = 0; i <= 40; i++) { const x = -20 + i * (W + 40) / 40; C.lineTo(x, H * 0.78 + Math.cos((x / W - 0.5) * 1.4) * -46 + G.jit(2.5)); }
      C.lineTo(W + 20, H + 20); C.closePath(); C.fill();
      C.restore();
      for (let i = 0; i < 14; i++) {
        const x = G.hash(i * 3.7) * W, r = 20 + G.hash(i * 7.1) * 60;
        const y = H * 0.80 + G.hash(i * 5.3) * 130 + Math.cos((x / W - 0.5) * 1.4) * -46;
        G.paint(G.ellPts(x, y, r, r * 0.42, 18, 3), { fill: 'rgba(255,255,255,0.05)', ink: 'rgba(255,255,255,0.16)', sw: 2, inkOp: 200 * we });
      }
    }
    const wtr = WTS[F_TRAIL];
    if (wtr > 0.02) trailProps(t, wtr);
  }

  const CONT = [];
  (function () {
    let s = 4242;
    const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 7; i++) CONT.push([R() * 2 - 1, R() * 1.7 - 0.85, 0.22 + R() * 0.34, 0.13 + R() * 0.2, R() * 6.28]);
  })();
  function drawEarth(cx, cy, R, t, w) {
    const C = G.getCtx();
    C.save(); C.globalAlpha = C.globalAlpha * w;
    G.glow(cx, cy, R * 1.75, 'rgba(90,170,255,0.42)', 255);
    C.save();
    C.beginPath(); C.arc(cx, cy, R, 0, TAU); C.clip();
    const g = C.createRadialGradient(cx - R * 0.34, cy - R * 0.36, R * 0.1, cx, cy, R * 1.05);
    g.addColorStop(0, '#5FB6E8'); g.addColorStop(0.55, '#1E6FB8'); g.addColorStop(1, '#0A2A52');
    C.fillStyle = g; C.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (let i = 0; i < CONT.length; i++) {
      const c = CONT[i];
      const px = cx + c[0] * R * 0.7 + Math.sin(t * 0.16 + i) * R * 0.06;
      const py = cy + c[1] * R * 0.72;
      const w2 = c[2] * R, h2 = c[3] * R;
      if (Math.abs(px - cx) > R * 1.2) continue;
      G.paint(G.ellPts(px, py, w2, h2, 22, 4, c[4]), { fill: i % 3 ? '#6FA35A' : '#C8B98A', fillOp: 235, jitter: 4 });
      G.paint(G.ellPts(px + w2 * 0.5, py - h2 * 0.4, w2 * 0.55, h2 * 0.6, 18, 4), { fill: '#8FBF6E', fillOp: 190, jitter: 4 });
    }
    C.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y = cy - R * 0.72 + (i / 8) * R * 1.44 + Math.sin(t * 0.2 + i * 1.7) * 6;
      const hw = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / R, 2))) * R;
      C.strokeStyle = 'rgba(255,255,255,' + (0.10 + 0.12 * G.hash(i * 3.1)).toFixed(3) + ')';
      C.lineWidth = 12 + 22 * G.hash(i * 5.7);
      C.beginPath();
      C.moveTo(cx - hw * 0.92, y);
      C.bezierCurveTo(cx - hw * 0.3, y - 22, cx + hw * 0.3, y + 22, cx + hw * 0.92, y);
      C.stroke();
    }
    const tg = C.createLinearGradient(cx - R, cy, cx + R, cy);
    tg.addColorStop(0, 'rgba(0,0,0,0.34)'); tg.addColorStop(0.45, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,0.42)');
    C.fillStyle = tg; C.fillRect(cx - R, cy - R, R * 2, R * 2);
    C.restore();
    G.orbit(cx, cy, R * 1.012, R * 1.012, 0, 'rgba(150,215,255,0.85)', 4, 200);
    G.orbit(cx, cy, R * 1.09, R * 1.09, 0, 'rgba(110,180,255,0.5)', 14, 90);
    C.restore();
  }

  // 破水面（7.35–11.35 s）：入水蓄力 → 出水拉伸 → 空中 → 拍水落下。
  // squash / stretch 这两个参数在此之前全片一次没用过，这一幕是它们的首秀。
  function breachDeform(t) {
    const u = G.seg(t, 7.35, 11.35);
    if (u <= 0 || u >= 1) return [1, 1];
    const sq = G.kf(u, [[0, 1], [0.11, 1.16], [0.23, 0.84], [0.39, 0.98], [0.61, 0.92], [0.78, 1.24], [0.94, 1.04], [1, 1]]);
    const st = G.kf(u, [[0, 1], [0.11, 0.80], [0.23, 1.28], [0.39, 1.04], [0.61, 1.10], [0.78, 0.72], [0.94, 0.98], [1, 1]]);
    return [sq, st];
  }

  function whaleAt(t) {
    const K = [
      [0.0, -300, 640, 1.75, 1, 0.00, 'idle'],
      [1.8, 520, 640, 1.75, 1, 0.00, 'idle'],
      [3.0, 640, 650, 1.72, 1, -0.06, 'wow'],
      // 上浮：抬头、加速摆尾
      [4.4, 700, 690, 1.66, 1, -0.52, 'wow'],
      [6.2, 780, 570, 1.60, 1, -0.95, 'wow'],
      // 破水面：入水 → 跃起 → 弧顶 → 拍水
      [7.7, 830, 700, 1.52, 1, 0.30, 'wow'],
      [8.2, 890, 620, 1.48, 1, -0.80, 'wow'],
      [8.9, 950, 250, 1.40, 1, -1.18, 'wow'],
      [9.8, 1090, 450, 1.30, 1, -0.40, 'happy'],
      [10.5, 1180, 700, 1.24, 1, 0.24, 'happy'],
      [12.0, 1010, 600, 1.16, -1, 0.16, 'happy'],
      [14.6, 1240, 560, 1.06, -1, 0.10, 'happy'],
      [16.6, 780, 500, 1.00, 1, 0.26, 'happy'],
      [18.8, 1080, 470, 0.96, 1, 0.30, 'happy'],
      [21.4, 1380, 560, 0.90, -1, 0.16, 'happy'],
      [24.2, 1320, 620, 0.86, -1, 0.10, 'happy'],
      // 离地：从地球边上离开，越游越小
      [26.2, 900, 620, 0.92, 1, -0.20, 'wow'],
      [27.6, 640, 600, 0.88, 1, -0.48, 'wow'],
      [29.4, 1180, 460, 0.66, 1, -0.22, 'wow'],
      [31.9, 1390, 620, 0.56, -1, 0.10, 'wow'],
      [35.2, 700, 560, 0.52, 1, -0.18, 'wow'],
      [38.7, 1160, 660, 0.48, -1, 0.14, 'wow'],
      [41.9, 1240, 800, 0.44, -1, -0.10, 'wow'],
      [45.4, 620, 720, 0.50, 1, -0.30, 'wow'],
      [47.2, 900, 640, 0.72, 1, 0.80, 'dizzy'],
      [48.7, 1000, 660, 0.74, 1, 0.18, 'happy'],
      [51.0, 780, 740, 0.58, 1, 0.00, 'happy'],
      // 星图：位置由航线曲线决定（见下面的 trailSample），这里只是兜底
      [52.4, 110, 720, 0.62, 1, -0.05, 'happy'],
      [54.9, 1500, 780, 0.56, 1, -0.06, 'wow'],
      // 回海：掉头、加速游出画面 —— 末帧与首帧一致，所以片子可以无缝循环
      [56.4, 700, 664, 0.90, -1, 0.00, 'happy'],
      [57.6, 520, 656, 1.18, -1, -0.08, 'happy'],
      [58.9, 180, 650, 1.48, -1, -0.06, 'wow'],
      [59.9, -300, 646, 1.66, -1, 0.00, 'idle'],
      [60.5825, -520, 644, 1.72, -1, 0.00, 'idle'],
    ];
    let a = K[0], b = K[0];
    if (t <= K[0][0]) a = b = K[0];
    else if (t >= K[K.length - 1][0]) a = b = K[K.length - 1];
    else for (let i = 1; i < K.length; i++) if (t < K[i][0]) { a = K[i - 1]; b = K[i]; break; }
    const k = a === b ? 0 : easeIO((t - a[0]) / (b[0] - a[0]));
    const bob = Math.sin(t * 2.6) * 8;
    let wx = lerp(a[1], b[1], k), wy = lerp(a[2], b[2], k) + bob;
    // 星图那一段：让它真的沿航线飞（采样同一条曲线，不是手写坐标）
    const tw = clamp(Math.min(G.seg(t, 52.15, 52.75), 1 - G.seg(t, 55.75, 56.35)));
    if (tw > 0.001) {
      const s = trailSample(trailGrow(t));
      wx = lerp(wx, s[0] + 24, tw); wy = lerp(wy, s[1] - 30, tw);
    }
    let spout = 0;
    if (t > 1.2 && t < 3.4) spout = Math.max(0, G.pulse(t, 5) - 0.4) * 1.3;
    else if (t > 8.6 && t < 9.9) spout = 0.55 * Math.sin(G.seg(t, 8.6, 9.9) * Math.PI);   // 弧顶喷一口
    const def = breachDeform(t);
    // 上浮段摆尾加速（用平滑斜坡，尾相位才连续；直接跳会看到尾巴瞬移）
    const tailFast = 2.6 + 1.1 * Math.min(G.seg(t, 4.0, 4.8), 1 - G.seg(t, 7.6, 8.4));
    G.whale(t, wx, wy, lerp(a[3], b[3], k), {
      dir: k < 0.5 ? a[4] : b[4],
      tilt: lerp(a[5], b[5], k),
      mood: k < 0.5 ? a[6] : b[6],
      blush: 130,
      squash: def[0], stretch: def[1],
      tailSpeed: tailFast,
      spout: spout,
      emote: (t > 56.9 && t < 57.9) ? 'heart' : null,
      emoteO: { pop: G.backOut(G.seg(t, 56.9, 57.4)) }
    });
  }

  function caption(t) {
    if (!G.CONFIG.captions) return;
    const C = G.getCtx();
    for (let i = 0; i < G.LYRICS.length; i++) {
      const L = G.LYRICS[i], t0 = L[0], t1 = t0 + L[2];
      if (t < t0 || t >= t1) continue;
      const k = easeOut(G.seg(t, t0, t0 + 0.30)) * (1 - ease(G.seg(t, t1 - 0.24, t1)));
      if (k < 0.02) continue;
      const y = H - 132, tw = G.textW(L[1], 62), w = (tw + 130) * k;
      C.save(); C.translate(W / 2, y);
      G.paint([
        [-w / 2 + G.jit(9), -34 + G.jit(4)], [-w * 0.22, -44 + G.jit(4)], [w * 0.25, -38 + G.jit(4)], [w / 2 + G.jit(9), -30 + G.jit(4)],
        [w / 2 + 16 + G.jit(9), 6], [w * 0.3, 4 + G.jit(4)], [-w * 0.28, 8 + G.jit(4)], [-w / 2 - 14 + G.jit(9), 2],
        [w / 2 + 12 + G.jit(9), 44], [w * 0.2, 38 + G.jit(4)], [-w * 0.25, 46 + G.jit(4)], [-w / 2 - 10 + G.jit(9), 40],
      ], { fill: 'rgba(26,32,51,0.80)', ink: P.gold, sw: 3, jitter: 1.6 });
      G.handText(L[1], 0, 4, { size: 62, color: P.cream, align: 'center', alpha: 255 * k });
      C.restore();
      break;
    }
  }

  G.drawWorld = function (t) {
    const C = G.getCtx(); if (!C) return;
    G.seedFrame(t);
    C.save(); C.clearRect(0, 0, W, H); C.restore();

    weightsAt(t);
    bgAt(t);
    bgFill();

    const wPaper = WTS[F_SEA] * 0.55 + WTS[F_FLOWER] * 0.25 + WTS[F_UPWELL] * 0.55;
    if (wPaper > 0.02) G.speckle(t, Math.round(110 * wPaper), P.ink, 22 * wPaper + 4);
    const wDeep = WTS[F_GALAXY] + WTS[F_BH] + WTS[F_TUNNEL] + WTS[F_SPACETIME] + WTS[F_ORBIT];
    if (wDeep > 0.15) G.starfield(t, 300, '#DCE8FF', 180 * clamp(wDeep));
    const wDeep2 = WTS[F_LIFTOFF] + WTS[F_TRAIL] * 0.85;
    if (wDeep2 > 0.05) G.starfield(t, 240, '#DCE8FF', 150 * clamp(wDeep2));

    const cam = camAt(t);
    G.camBegin(cam.cx, cam.cy, cam.zoom, cam.rot);
    backProps(t);
    drawParticles(t);
    drawBeam(t);
    sceneProps(t);
    whaleAt(t);
    G.camEnd();

    caption(t);
    if (G.CONFIG.grain) G.drawGrain(t);
    if (G.CONFIG.vignette) G.drawVignette();
  };
  G.odysseyDuration = DUR;
})(window.DSG);
