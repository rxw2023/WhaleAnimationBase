// core.js — 手书动画引擎内核：数学、确定性抖动、手绘笔触、纸纹、相机、手写字
// 铁律：每一帧都是时间 t 的纯函数；不使用 Math.random（用 hash / jit），不保存跨帧状态。
// 这样才能让帧被并行、乱序地离线渲染。
window.DSG = window.DSG || {};
(function (G) {
  'use strict';

  // ======================= 画布与常量 =======================
  G.W = 1920;
  G.H = 1080;
  G.BOIL = 12;                 // 线稿每秒"沸腾"次数（手绘动画的呼吸感）
  let CTX = null;
  G.setCtx = c => { CTX = c; };
  G.getCtx = () => CTX;

  // DeepSeek 金鱼 · 调色板
  G.PAL = {
    paper:  '#F6F2E7',
    paper2: '#E9E2D0',
    ink:    '#1A2033',
    ink2:   '#39456E',
    ds:     '#4D6BFE',   // DeepSeek 蓝
    dsDk:   '#26348F',
    dsMid:  '#6E86FF',
    dsLt:   '#A9BCFF',
    dsPale: '#DCE4FF',
    gold:   '#FFC24B',
    goldDk: '#DE9A1E',
    coral:  '#FF6F5E',
    teal:   '#3FB6A8',
    cream:  '#FFF9EC',
    night:  '#141C3A',
    split:  ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#4D6BFE', '#AF52DE'],
    sunset: ['#241748', '#4A2468', '#8C3A78', '#CE4E7A', '#F08A6B', '#FFC98A'],
  };

  // ======================= 数学 =======================
  const clamp  = G.clamp  = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp   = G.lerp   = (a, b, x) => a + (b - a) * x;
  const frac   = G.frac   = x => x - Math.floor(x);
  const ease   = G.ease   = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const easeIn = G.easeIn = x => Math.pow(clamp(x), 3);
  const easeOut= G.easeOut= x => 1 - Math.pow(1 - clamp(x), 3);
  const easeIO = G.easeIO = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const backOut= G.backOut= x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const elasticOut = G.elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (Math.PI * 2 / 3)) + 1; };
  const TAU = G.TAU = Math.PI * 2;

  // 稳定哈希：给定整数 → [0,1)
  const hash = G.hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  // 颜色混合
  G.mixCol = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
    return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
  };
  // 关键帧：kf(t, [[t0,v0],[t1,v1],...], easeFn)，值可以是数字或数字数组
  G.kf = (t, keys, e = ease) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
        return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
      }
    }
    return keys[keys.length - 1][1];
  };

  // ======================= 音乐时间 =======================
  G.T = { bpm: 100, off: 0, dur: 48, len: 20 };        // bpm / 拍点偏移 / 总时长 / 小节数
  G.beat  = () => 60 / G.T.bpm;
  G.bar   = () => 60 / G.T.bpm * 4;
  G.bpOf  = t => (t - G.T.off) / G.beat();             // 拍数（浮点）
  G.beatN = t => Math.floor(G.bpOf(t));                // 整数拍号
  G.beatT = n => G.T.off + n * G.beat();               // 第 n 拍的时刻
  G.barT  = n => G.T.off + n * G.bar();                // 第 n 小节的时刻
  G.pulse  = (t, k = 6) => Math.exp(-frac(G.bpOf(t)) * k);          // 每拍 1 → 衰减
  G.pulse2 = (t, k = 6) => Math.exp(-frac(G.bpOf(t) * 2) * k);      // 八分音符
  G.seg   = (t, a, b) => clamp((t - a) / (b - a));     // t 在 [a,b] 中的进度 0..1
  G.wob   = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);

  // ======================= 确定性抖动 =======================
  // 每帧按 BOIL 频率重新播种：同一 t 永远得到同一结果，可并行渲染、可复现。
  let _rs = 1;
  G.seedFrame = t => { _rs = (Math.floor(t * G.BOIL) * 2654435761 ^ 0x9E3779B9) >>> 0; if (!_rs) _rs = 1; };
  G.rnd = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
  G.jit = a => (G.rnd() * 2 - 1) * a;
  G.jitRange = (a, b) => a + G.rnd() * (b - a);
  // 与帧无关的稳定抖动（用于"物体本身长这样"而不是"手在抖"）
  G.hashJit = (i, a) => (hash(i) * 2 - 1) * a;

  // ======================= 几何点集 =======================
  G.ellPts = (cx, cy, rx, ry, n = 28, j = 0, rot = 0) => {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      p.push([cx + x * Math.cos(rot) - y * Math.sin(rot) + (j ? G.jit(j) : 0),
              cy + x * Math.sin(rot) + y * Math.cos(rot) + (j ? G.jit(j) : 0)]);
    }
    return p;
  };
  G.rectPts = (x, y, w, h, j = 0) => [
    [x + (j ? G.jit(j) : 0), y + (j ? G.jit(j) : 0)],
    [x + w + (j ? G.jit(j) : 0), y + (j ? G.jit(j) : 0)],
    [x + w + (j ? G.jit(j) : 0), y + h + (j ? G.jit(j) : 0)],
    [x + (j ? G.jit(j) : 0), y + h + (j ? G.jit(j) : 0)],
  ];
  G.rrPts = (x, y, w, h, r, j = 0) => {
    r = Math.min(r, w / 2, h / 2);
    const p = [], seg = 5, add = (px, py) => p.push([px + (j ? G.jit(j) : 0), py + (j ? G.jit(j) : 0)]);
    for (let i = 0; i <= seg; i++) add(x + r + (w - 2 * r) * i / seg, y);
    for (let i = 1; i <= seg; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / seg; add(x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r); }
    for (let i = 1; i <= seg; i++) add(x + w - (w - 2 * r) * i / seg, y + h);
    for (let i = 1; i <= seg; i++) { const a = Math.PI / 2 + Math.PI / 2 * i / seg; add(x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r); }
    for (let i = 1; i <= seg; i++) { const a = Math.PI + Math.PI / 2 * i / seg; add(x + r + Math.cos(a) * r, y + r + Math.sin(a) * r); }
    return p;
  };
  G.starPts = (cx, cy, r, inner, n = 5, rot = -Math.PI / 2) => {
    const p = [];
    for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * TAU, rr = i % 2 ? inner : r; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    return p;
  };
  G.heartPts = (cx, cy, r, n = 30) => {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const x = 16 * Math.pow(Math.sin(a), 3);
      const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      p.push([cx + x * r / 16, cy + y * r / 16]);
    }
    return p;
  };
  G.blobPts = (cx, cy, rx, ry, n, mod, rot = 0) => {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, m = mod ? mod(a) : 1;
      const x = Math.cos(a) * rx * m, y = Math.sin(a) * ry * m;
      p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return p;
  };
  // 波浪线（用于海面、声音波）
  G.wavePts = (x0, x1, y, amp, freq, phase, steps = 40) => {
    const p = [];
    for (let i = 0; i <= steps; i++) { const k = i / steps; p.push([lerp(x0, x1, k), y + Math.sin(k * freq * TAU + phase) * amp]); }
    return p;
  };

  // ======================= 手绘笔触 =======================
  function tracePath(pts, smooth, close) {
    const C = CTX, n = pts.length;
    C.beginPath();
    if (n < 2) return;
    if (smooth <= 0) {
      C.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) C.lineTo(pts[i][0], pts[i][1]);
      if (close) C.closePath();
      return;
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (close) {
      const m0 = mid(pts[n - 1], pts[0]);
      C.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); C.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      C.closePath();
    } else {
      C.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const m = mid(pts[i], pts[i + 1]); C.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      C.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }

  // 把点集写入当前路径（供 clip / 复杂合成使用）
  G.tracePts = function (pts, smooth, close) { tracePath(pts, smooth == null ? 1 : smooth, close !== false); };

  // 主绘制入口：paint(pts, {fill, ink, sw, jitter, smooth, alpha})
  G.paint = function (pts, o) {
    const C = CTX; if (!C || !pts || pts.length < 2) return;
    o = o || {};
    const j = o.jitter == null ? 1 : o.jitter;
    const P = j > 0 ? pts.map(p => [p[0] + G.jit(j), p[1] + G.jit(j)]) : pts;
    C.save();
    const _ba = C.globalAlpha;
    if (o.shadow) {
      C.globalAlpha = _ba * (o.shadowOp == null ? .16 : o.shadowOp);
      C.fillStyle = o.shadow === true ? G.PAL.ink : o.shadow;
      C.translate(o.shadowX == null ? 4 : o.shadowX, o.shadowY == null ? 6 : o.shadowY);
      tracePath(P, o.smooth == null ? 1 : o.smooth, true);
      C.fill();
      C.translate(-(o.shadowX == null ? 4 : o.shadowX), -(o.shadowY == null ? 6 : o.shadowY));
      C.globalAlpha = _ba;
    }
    tracePath(P, o.smooth == null ? 1 : o.smooth, true);
    if (o.fill) {
      C.globalAlpha = _ba * (o.fillOp == null ? 255 : o.fillOp) / 255;
      C.fillStyle = o.fill;
      C.fill();
      if (o.grad) { // 竖向渐变覆盖（同一条路径）
        const g = C.createLinearGradient(0, o.grad[0], 0, o.grad[1]);
        g.addColorStop(0, o.grad[2]); g.addColorStop(1, o.grad[3]);
        C.globalAlpha = _ba * (o.gradOp == null ? 200 : o.gradOp) / 255;
        C.fillStyle = g; C.fill();
      }
    }
    if (o.ink) {
      C.globalAlpha = _ba * (o.inkOp == null ? 255 : o.inkOp) / 255;
      C.strokeStyle = o.ink;
      C.lineWidth = o.sw == null ? 2.4 : o.sw;
      C.lineJoin = 'round'; C.lineCap = 'round';
      C.stroke();
    }
    C.restore();
  };

  // 开放折线 / 曲线（用于水波、速度线、胡须）
  G.stroke = function (pts, o) {
    const C = CTX; if (!C || !pts || pts.length < 2) return;
    o = o || {};
    const j = o.jitter == null ? 1 : o.jitter;
    const P = j > 0 ? pts.map(p => [p[0] + G.jit(j), p[1] + G.jit(j)]) : pts;
    C.save();
    C.globalAlpha = C.globalAlpha * (o.alpha == null ? 255 : o.alpha) / 255;
    C.strokeStyle = o.ink || G.PAL.ink;
    C.lineWidth = o.sw == null ? 2.2 : o.sw;
    C.lineJoin = 'round'; C.lineCap = 'round';
    if (o.dash) C.setLineDash(o.dash);
    tracePath(P, o.smooth == null ? 1 : o.smooth, false);
    C.stroke();
    C.restore();
  };

  // 涂鸦式填充（内部几笔粗斜线，模拟手涂不满）
  G.scrawl = function (pts, color, op, count, seed) {
    const C = CTX; if (!C) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    C.save();
    C.beginPath(); tracePath(pts, 1, true); C.clip();
    for (let i = 0; i < count; i++) {
      const k = (i + .5) / count, y = lerp(y0, y1, k);
      G.stroke([[x0 - 20, y + G.hashJit(seed + i, 14)], [x1 + 20, y + G.hashJit(seed + i * 3, 14)]],
        { ink: color, sw: (y1 - y0) / count * G.jitRange(.9, 1.6), alpha: op, smooth: 0 });
    }
    C.restore();
  };

  // ======================= 相机 =======================
  let CAM = null;
  G.camBegin = function (cx, cy, zoom, rot) {
    cx = cx == null ? G.W / 2 : cx; cy = cy == null ? G.H / 2 : cy;
    zoom = zoom == null ? 1 : zoom; rot = rot || 0;
    CTX.save(); CTX.translate(G.W / 2, G.H / 2); CTX.rotate(rot); CTX.scale(zoom, zoom); CTX.translate(-cx, -cy);
    CAM = { cx, cy, zoom, rot };
  };
  G.camEnd = function () { if (CAM) { CTX.restore(); CAM = null; } };
  G.camGet = () => CAM;
  G.toScreen = function (x, y) {
    if (!CAM) return [x, y];
    const c = Math.cos(CAM.rot), s = Math.sin(CAM.rot);
    const dx = (x - CAM.cx) * CAM.zoom, dy = (y - CAM.cy) * CAM.zoom;
    return [G.W / 2 + dx * c - dy * s, G.H / 2 + dx * s + dy * c];
  };
  G.shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

  // ======================= 纸张 · 颗粒 · 暗角 =======================
  let _paper = null;
  function buildPaper() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 512);
    let _s = 987654321;
    const R = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
    const img = x.getImageData(0, 0, 512, 512), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = 232 + R() * 23;
      d[i] = d[i + 1] = d[i + 2] = n; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    x.globalAlpha = .07; x.strokeStyle = '#8a8270';
    for (let i = 0; i < 90; i++) {
      x.beginPath(); const y = R() * 512;
      x.moveTo(0, y); x.bezierCurveTo(170, y + (R() - .5) * 26, 340, y + (R() - .5) * 26, 512, y + (R() - .5) * 18); x.stroke();
    }
    return c;
  }
  G.drawPaper = function () {
    const C = CTX; if (!C) return;
    if (!_paper) _paper = buildPaper();
    C.save();
    C.fillStyle = G.PAL.paper; C.fillRect(0, 0, G.W, G.H);
    const g = C.createRadialGradient(G.W * .5, G.H * .42, 60, G.W * .5, G.H * .5, G.W * .78);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(120,108,86,.22)');
    C.fillStyle = g; C.fillRect(0, 0, G.W, G.H);
    C.globalCompositeOperation = 'multiply'; C.globalAlpha = .5;
    for (let y = 0; y < G.H; y += 512) for (let x = 0; x < G.W; x += 512) C.drawImage(_paper, x, y);
    C.restore();
  };
  G.drawGrain = function (t) {
    const C = CTX; if (!C) return;
    if (!_paper) _paper = buildPaper();
    C.save();
    C.globalCompositeOperation = 'multiply';
    C.globalAlpha = .10;
    const ox = Math.floor(G.hash(Math.floor(t * G.BOIL)) * 512), oy = Math.floor(G.hash(Math.floor(t * G.BOIL) + 77) * 512);
    for (let y = -oy; y < G.H; y += 512) for (let x = -ox; x < G.W; x += 512) C.drawImage(_paper, x, y);
    C.restore();
  };
  G.drawVignette = function () {
    const C = CTX; if (!C) return;
    C.save();
    const g = C.createRadialGradient(G.W / 2, G.H / 2, G.H * .32, G.W / 2, G.H / 2, G.W * .66);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(24,20,10,.30)');
    C.fillStyle = g; C.fillRect(0, 0, G.W, G.H);
    C.restore();
  };

  // ======================= 手写字 =======================
  G.FONT_HAND = '"KaiTi","STKaiti","Kaiti SC","楷体","DFKai-SB","Segoe Script","Comic Sans MS",cursive';
  G.FONT_SANS = '"Shantell Sans","Segoe UI",system-ui,sans-serif';
  // o: { font, size, align, rot, alpha, reveal(0..1 从左往右露出), inkWidth 描边, spacing }
  G.handText = function (str, x, y, o) {
    const C = CTX; if (!C || !str) return;
    o = o || {};
    const size = o.size == null ? 64 : o.size;
    C.save();
    C.font = (o.bold ? '800 ' : '') + size + 'px ' + (o.font || G.FONT_HAND);
    C.textAlign = 'left';
    C.textBaseline = o.baseline || 'middle';
    C.translate(x, y);
    if (o.rot) C.rotate(o.rot);
    const base = C.globalAlpha * ((o.alpha == null ? 255 : o.alpha) / 255);
    const chars = String(str).split('');
    const ws = chars.map(c => C.measureText(c).width);
    let total = 0; for (let i = 0; i < ws.length; i++) total += ws[i];
    let cx = o.align === 'right' ? -total : (o.align === 'center' ? -total / 2 : 0);
    const rev = o.reveal == null ? 1 : clamp(o.reveal);
    for (let i = 0; i < chars.length; i++) {
      const w = ws[i];
      const k = rev >= 1 ? 1 : clamp(rev * chars.length - i);
      if (k > 0.02) {
        C.save();
        C.translate(cx + w / 2, 0);
        if (o.wobble !== false) {
          C.rotate(G.hashJit(i * 7 + chars.length, .028));
          C.translate(0, G.hashJit(i * 13 + 3, size * .035) + (1 - k) * size * .12);
        } else {
          C.translate(0, (1 - k) * size * .10);
        }
        C.globalAlpha = base * k;
        if (o.outline) { C.lineWidth = o.outlineW || Math.max(2, size * .06); C.strokeStyle = o.outline; C.lineJoin = 'round'; C.strokeText(chars[i], -w / 2, 0); }
        C.fillStyle = o.color || G.PAL.ink;
        C.fillText(chars[i], -w / 2, 0);
        C.restore();
      }
      cx += w;
    }
    C.restore();
  };
  // 手写字的宽度测量（不带抖动）
  G.textW = function (str, size, font) {
    const C = CTX; if (!C) return 0;
    C.save(); C.font = (size || 64) + 'px ' + (font || G.FONT_HAND);
    const w = C.measureText(str).width; C.restore(); return w;
  };


  // ===================================================================
  //  参考片风格追加：铅笔排线 / 纸屑 / 星野 / 群飞 / 叶序 / 神经元 / 黑洞 / 棱镜
  // ===================================================================

  // 多段渐变（日落、深空）
  G.multiGrad = function (stops, y0, y1, op) {
    const C = CTX;
    const g = C.createLinearGradient(0, y0 == null ? 0 : y0, 0, y1 == null ? G.H : y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
    C.save(); C.globalAlpha = C.globalAlpha * ((op == null ? 255 : op) / 255);
    C.fillStyle = g; C.fillRect(0, 0, G.W, G.H); C.restore();
  };

  // ★ 铅笔排线填充：整个片子的风格签名
  //   pts 是闭合轮廓；d 线距；a 角度；rand 随机抖动；gradient 疏密渐变
  G.hatchFill = function (pts, o) {
    const C = CTX; if (!C || !pts || pts.length < 3) return;
    o = o || {};
    const d = Math.max(1.2, o.d == null ? 10 : o.d);
    const a = o.a == null ? -0.5 : o.a;
    const seed = o.seed || 0;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const R = Math.hypot(x1 - x0, y1 - y0) / 2 + d * 2;
    const n = Math.ceil(2 * R / d);
    const ca = Math.cos(a), sa = Math.sin(a);
    C.save();
    C.beginPath(); tracePath(pts, o.smooth == null ? 1 : o.smooth, true); C.clip();
    C.globalAlpha = C.globalAlpha * ((o.alpha == null ? 190 : o.alpha) / 255);
    C.strokeStyle = o.color || G.PAL.ink;
    C.lineCap = 'round';
    for (let i = 0; i <= n; i++) {
      let off = -R + i * d;
      if (o.rand) off += G.hashJit(i * 7.3 + seed, d * 0.55 * o.rand);
      let L = R;
      if (o.gradient) L = R * (0.45 + 0.95 * (i / n));
      const ox = -sa * off, oy = ca * off;
      C.lineWidth = (o.sw == null ? 1.5 : o.sw) * (o.rand ? 0.65 + 0.7 * G.hash(i * 3.3 + seed) : 1);
      C.beginPath();
      C.moveTo(cx + ox - ca * L + G.jit(o.wob == null ? 0.7 : o.wob), cy + oy - sa * L + G.jit(o.wob == null ? 0.7 : o.wob));
      C.lineTo(cx + ox + ca * L + G.jit(o.wob == null ? 0.7 : o.wob), cy + oy + sa * L + G.jit(o.wob == null ? 0.7 : o.wob));
      C.stroke();
    }
    C.restore();
  };

  // 纸屑 / 脏点（参考片里纸上那些小斑点）
  G.speckle = function (t, n, col, op) {
    for (let i = 0; i < n; i++) {
      const x = G.hash(i * 1.77) * G.W, y = G.hash(i * 3.13) * G.H;
      const r = 0.5 + G.hash(i * 5.31) * 1.7;
      G.dot(x, y, r, col || G.PAL.ink, (op == null ? 52 : op) * (0.35 + 0.65 * G.hash(i * 7.7)));
    }
  };

  // 星野（会闪）
  G.starfield = function (t, n, col, op) {
    for (let i = 0; i < n; i++) {
      const x = G.hash(i * 2.31) * G.W, y = G.hash(i * 5.11) * G.H;
      const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.1);
      const r = 0.7 + G.hash(i * 7.77) * 1.9;
      G.dot(x, y, r * (0.7 + 0.7 * tw), col || '#ffffff', (op == null ? 200 : op) * (0.35 + 0.65 * tw));
    }
  };

  // 光点光晕
  G.glow = function (x, y, r, col, op) {
    const C = CTX;
    const g = C.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    C.save(); C.globalAlpha = C.globalAlpha * ((op == null ? 255 : op) / 255);
    C.fillStyle = g; C.beginPath(); C.arc(x, y, r, 0, G.TAU); C.fill(); C.restore();
  };

  // 环形轨道
  G.orbit = function (cx, cy, rx, ry, rot, col, sw, alpha) {
    G.stroke(G.ellPts(cx, cy, rx, ry, 44, 0, rot), { ink: col, sw: sw == null ? 2 : sw, alpha: alpha == null ? 200 : alpha, jitter: 1.2, smooth: 1 });
  };

  // ★ 群飞（椋鸟群 / 鱼群）：一次成路径，性能与数量无关
  G.flock = function (t, n, o) {
    o = o || {};
    const C = CTX;
    const cx = o.cx == null ? G.W / 2 : o.cx, cy = o.cy == null ? G.H * 0.45 : o.cy;
    const rx = o.rx == null ? 560 : o.rx, ry = o.ry == null ? 200 : o.ry;
    const base = o.s == null ? 3.4 : o.s;
    const col = o.color || '#241B33';
    for (let pass = 0; pass < 2; pass++) {
      C.save();
      C.globalAlpha = C.globalAlpha * ((o.alpha == null ? 255 : o.alpha) / 255) * (pass ? 0.55 : 1);
      C.strokeStyle = col;
      C.lineCap = 'round';
      C.lineWidth = base * (pass ? 2.2 : 1.1);
      C.beginPath();
      for (let i = 0; i < n; i++) {
        if ((i % 3 === 0) !== (pass === 0)) continue;
        const u = G.hash(i * 1.7), v = G.hash(i * 3.9), w = G.hash(i * 5.3);
        const ang = (o.spin == null ? 0.34 : o.spin) * t + u * Math.PI * 2;
        const wob = Math.sin(t * 1.6 + i * 0.73) * (o.wob == null ? 0.15 : o.wob);
        const rr = (o.inner == null ? 0.28 : o.inner) + (1 - (o.inner == null ? 0.28 : o.inner)) * v;
        const x = cx + Math.cos(ang + wob) * rx * rr + Math.sin(t * 2.1 + i) * 14;
        const y = cy + Math.sin(ang * 1.07 + wob) * ry * rr * 0.8 + Math.cos(t * 1.9 + i * 1.3) * 12;
        const sz = base * (0.6 + 1.0 * w);
        const dx = Math.cos(ang + 1.5) * sz * 1.5, dy = Math.sin(ang + 1.5) * sz * 1.5;
        C.moveTo(x - dx, y - dy); C.lineTo(x + dx, y + dy);
      }
      C.stroke();
      C.restore();
    }
  };

  // ★ 叶序（黄金角螺旋）：向日葵花盘
  G.phyllo = function (cx, cy, n, c, rot, o) {
    o = o || {};
    const C = CTX;
    const GA = 2.399963229728653;
    const B = o.buckets || 3;
    const paths = []; for (let b = 0; b < B; b++) paths.push([]);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const a = i * GA + (rot || 0);
      const r = c * Math.sqrt(k);
      const rr = (o.s == null ? 5 : o.s) * (0.45 + 0.75 * Math.pow(k, 0.35));
      paths[Math.min(B - 1, Math.floor(k * B))].push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, rr]);
    }
    C.save();
    C.globalAlpha = C.globalAlpha * ((o.op == null ? 235 : o.op) / 255);
    for (let b = 0; b < B; b++) {
      const arr = paths[b]; if (!arr.length) continue;
      C.fillStyle = o.colorFn ? o.colorFn((b + 0.5) / B) : (o.color || G.PAL.gold);
      C.beginPath();
      for (let j = 0; j < arr.length; j++) { const p = arr[j]; C.moveTo(p[0] + p[2], p[1]); C.arc(p[0], p[1], p[2], 0, G.TAU); }
      C.fill();
    }
    C.restore();
  };

  // ★ 分叉树（神经元 / 树突 / 连线的网络）
  G.branch = function (t, x, y, ang, len, depth, seed, o) {
    o = o || {};
    const col = o.color || '#8FA6FF';
    const sw = (o.sw == null ? 2.2 : o.sw) * (0.45 + depth * 0.22);
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    G.stroke([[x, y], [ex, ey]], { ink: col, sw: sw, alpha: o.alpha == null ? 210 : o.alpha, jitter: 1.2, smooth: 0 });
    if (depth <= 0) {
      const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 + seed));
      G.glow(ex, ey, 16 + 16 * pulse, 'rgba(160,200,255,0.55)', 220 * pulse);
      G.dot(ex, ey, 3.4 + 2.4 * pulse, o.tip || '#DCEEFF', 240);
      return;
    }
    const n = 2 + (G.hash(seed * 3.7) < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const k = (i / (n - 1 || 1)) - 0.5;
      const na = ang + k * (o.spread == null ? 0.9 : o.spread) + G.hashJit(seed * 7.7 + i, 0.22);
      const nl = len * (o.shrink == null ? 0.74 : o.shrink) * (0.82 + 0.36 * G.hash(seed * 11.3 + i));
      G.branch(t, ex, ey, na, nl, depth - 1, seed * 2.13 + i * 3.7, o);
    }
  };

  // ★ 棱镜：一束白光折射成光谱
  G.prism = function (cx, cy, s, t, o) {
    o = o || {};
    const C = CTX;
    const tri = [[cx, cy - s], [cx - s * 0.92, cy + s * 0.72], [cx + s * 0.92, cy + s * 0.72]];
    // 入射白光
    G.stroke([[cx - s * 3.4, cy - s * 0.10], [cx - s * 0.30, cy + s * 0.16]], { ink: '#FFFFFF', sw: 7, alpha: 235, jitter: 1.4 });
    G.glow(cx - s * 2.2, cy - s * 0.06, s * 1.1, 'rgba(255,255,255,0.35)', 255);
    // 出射光谱
    const SP = G.PAL.split;
    for (let i = 0; i < SP.length; i++) {
      const k = (i / (SP.length - 1)) - 0.5;
      const ang = 0.30 + k * 0.46;
      const x0 = cx + s * 0.30, y0 = cy + s * 0.16;
      const x1 = x0 + Math.cos(ang) * s * (3.6 + 0.5 * Math.cos(k * 3)), y1 = y0 + Math.sin(ang) * s * 3.6;
      G.stroke([[x0, y0], [x1, y1]], { ink: SP[i], sw: 5.5, alpha: 225, jitter: 1.3, smooth: 0 });
      G.stroke([[x0, y0], [x1, y1]], { ink: SP[i], sw: 14, alpha: 60, jitter: 2.4, smooth: 0 });
    }
    // 玻璃体
    G.paint(tri, { fill: 'rgba(200,225,255,0.30)', ink: '#E8F1FF', sw: 3, jitter: 1.2, fillOp: 120 });
    return tri;
  };

  // ★ 黑洞：吸积盘 + 光子环 + 引力透镜弧
  G.blackHole = function (t, cx, cy, r, o) {
    o = o || {};
    const C = CTX;
    const spin = t * 0.55;
    // 外发光
    G.glow(cx, cy, r * 3.1, 'rgba(255,170,80,0.30)', 255);
    // 吸积盘（被压扁的椭圆，前后两半）
    for (let pass = 0; pass < 2; pass++) {
      const back = pass === 0;
      const tilt = 0.30, rx = r * 2.9, ry = r * 0.62;
      const p = [], N = 60;
      const a0 = back ? Math.PI : 0, a1 = back ? Math.PI * 2 : Math.PI;
      for (let i = 0; i <= N; i++) {
        const a = G.lerp(a0, a1, i / N);
        p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * (1 + 0.1 * Math.sin(a * 3 + spin))]);
      }
      C.save();
      C.globalAlpha = (o.alpha == null ? 235 : o.alpha) / 255 * (back ? 0.7 : 1);
      for (let w = 0; w < 3; w++) {
        G.stroke(p, { ink: w === 1 ? '#FFF2C8' : (w === 0 ? '#FFC24B' : '#FF7A3C'), sw: 13 - w * 4, alpha: 200 - w * 45, jitter: 2.4, smooth: 1 });
      }
      C.restore();
    }
    // 光子环
    G.orbit(cx, cy, r * 1.06, r * 1.06, 0, '#FFE7A8', 3.4, 240);
    // 事件视界
    G.paint(G.ellPts(cx, cy, r, r, 40, 1.4), { fill: '#05060E', jitter: 1 });
    if (o.relativistic !== false) G.orbit(cx, cy, r * 1.42, r * 1.42, 0, 'rgba(255,220,160,0.75)', 6, 130);
  };

  // ======================= 便利绘制 =======================
  G.dot = (x, y, r, col, op) => { const C = CTX; C.save(); C.globalAlpha = C.globalAlpha * (op == null ? 255 : op) / 255; C.fillStyle = col; C.beginPath(); C.arc(x, y, r, 0, TAU); C.fill(); C.restore(); };
  G.line2 = (x0, y0, x1, y1, o) => G.stroke([[x0, y0], [x1, y1]], o);
})(window.DSG);
