// char.js — 主角：DeepSeek 小鲸鱼（钝圆脑袋 + 大尾鳍 + 喷水孔 + 腹部褶）
// 全部按"侧视、头朝 +x"的局部坐标绘制，外层用 translate/rotate/scale 摆位。
(function (G) {
  'use strict';
  const P = G.PAL;

  // 身体轮廓：钝头 + 向尾柄收窄的蛋形（|cos| 开方让吻部变钝）
  function bodyPts(breathe) {
    const N = 54, p = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * G.TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const bx = (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 0.88);
      const taper = 0.26 + 0.74 * Math.pow(0.5 + 0.5 * ca, 0.9);
      p.push([bx * 80, sa * 60 * taper * breathe]);
    }
    return p;
  }

  // 尾鳍单叶：向后上方扫出的新月形叶片
  function flukePts(ph, up, L, spread, wave) {
    const N = 15, p = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const x = -68 - L * u * (0.58 + 0.42 * u);
      const y = (up ? -1 : 1) * (spread * Math.pow(u, 1.05)) + Math.sin(ph + u * 3.2) * wave * u;
      p.push([x, y]);
    }
    for (let k = N; k >= 0; k--) {
      const u = k / N;
      const x = -68 - L * u * (0.34 + 0.30 * u);
      const y = (up ? -1 : 1) * (spread * 0.46 * Math.pow(u, 1.25)) + Math.sin(ph + u * 3.2 + 0.9) * wave * u * 0.5;
      p.push([x, y]);
    }
    return p;
  }

  // 背鳍：小号、带一点后钩
  function dorsalPts(ph) {
    return [
      [-12, -36],
      [-22, -60 + Math.sin(ph) * 3],
      [-32, -78 + Math.sin(ph + 1.1) * 3],
      [-41, -66],
      [-50, -48],
      [-50, -34],
      [-34, -44],
      [-18, -40],
    ];
  }

  // 胸鳍（鲸的短桨状鳍），back = 远侧那只
  function flipperPts(ph, back) {
    const s = back ? 0.86 : 1, off = back ? -18 : 0;
    const bx = 46 + off, by = 24 + off * 0.3;
    const L = 76 * s, w = Math.sin(ph * 1.5) * 12, p = [], N = 6;
    for (let k = 0; k <= N; k++) {          // 前缘
      const u = k / N;
      p.push([bx - L * u * 0.60, by + L * u * 0.82 + w * u]);
    }
    for (let k = N; k >= 0; k--) {          // 后缘
      const u = k / N;
      p.push([bx - L * u * 0.88, by + L * u * 0.34 + w * u * 0.5]);
    }
    return p;
  }

  // 喷水：从喷水孔喷出的水柱 + 散开的水滴 + 水雾
  function spout(t, k, x0, y0) {
    const C = G.getCtx();
    const HT = 54 + 74 * k;              // 水柱高度（局部单位，约等于一个身长）
    // 水雾
    C.save();
    C.globalAlpha = C.globalAlpha * 0.34 * k;
    for (let i = 0; i < 4; i++) {
      const u = (i + 1) / 4;
      G.paint(G.ellPts(x0 + Math.sin(t * 2 + i) * 7 * u, y0 - HT * u - 6, 9 + 17 * u, 6 + 11 * u, 14, 1.5 + u * 4),
        { fill: P.dsLt, jitter: 0 });
    }
    C.restore();
    // 细水柱，微微前倾
    for (let i = 0; i < 18; i++) {
      const u = i / 18;
      const px = x0 + Math.sin(u * 3.0 + t * 3.0) * 7 * u;
      const py = y0 - HT * u - 4 + Math.sin(u * 5 + t * 4) * 2;
      G.dot(px, py, (4.6 - 1.8 * u) * (0.6 + 0.4 * k), i % 3 === 0 ? '#ffffff' : P.dsLt, 205);
    }
    // 顶端四散的水滴
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.5 + (G.hash(i * 3.3) - 0.5) * 2.5;
      const R = 10 + 44 * G.hash(i * 7.1) * k;
      G.dot(x0 + Math.cos(a) * R, y0 - HT - 4 + Math.sin(a) * R * 0.6, 2.2 + G.hash(i * 5) * 2.6, P.dsLt, 180);
    }
  }

  // 眼睛
  function eye(t, px, py, r, mood, blink) {
    const C = G.getCtx();
    const R = r * (1 - 0.06 * Math.sin(t * 2.2));
    if (blink > .55 || mood === 'sleep') {
      G.stroke([[px - R, py - 1], [px + R, py - 1]], { ink: P.ink, sw: 3.4, jitter: .6, smooth: 0 });
      return;
    }
    if (mood === 'happy') {
      G.stroke([[px - R, py + R * .45], [px, py - R * .6], [px + R, py + R * .45]], { ink: P.ink, sw: 3.6, jitter: .8 });
      return;
    }
    G.paint(G.ellPts(px, py, R, R * (1 - blink * .85), 18, .6), { fill: P.cream, ink: P.ink, sw: 2.8 });
    C.save();
    C.beginPath(); C.arc(px, py, R * .95, 0, G.TAU); C.clip();
    if (mood === 'dizzy') {
      G.stroke([[px - R * .7, py - R * .7], [px + R * .7, py + R * .7]], { ink: P.ink, sw: 3, jitter: .8, smooth: 0 });
      G.stroke([[px + R * .7, py - R * .7], [px - R * .7, py + R * .7]], { ink: P.ink, sw: 3, jitter: .8, smooth: 0 });
    } else if (mood === 'heart') {
      G.paint(G.heartPts(px, py, R * 1.15), { fill: P.coral, ink: P.ink, sw: 2, jitter: .5 });
    } else {
      const pr = R * (mood === 'wow' ? .74 : .58);
      G.paint(G.ellPts(px + R * .12, py, pr, pr * 1.05, 14, .5), { fill: P.ink, jitter: .4 });
      G.dot(px - R * .18, py - R * .28, R * .22, '#ffffff', 235);
      // 眼睛高光的一小段弧（让眼神更有神）
      G.stroke([[px - R * .3, py - R * .55], [px + R * .25, py - R * .5]], { ink: '#ffffff', sw: 1.6, alpha: 120, jitter: .4 });
    }
    C.restore();
  }

  // 主入口：whale(t, x, y, 尺寸, 选项)
  // o: dir(+1右/-1左) tilt mood squash stretch alpha aura spout blink eyeR tailSpeed tailL tailS wave
  G.whale = function (t, x, y, s, o) {
    const C = G.getCtx(); if (!C) return;
    o = o || {};
    const dir = o.dir === -1 ? -1 : 1;
    const mood = o.mood || 'idle';
    const ph = t * (o.tailSpeed == null ? 2.6 : o.tailSpeed);
    const breathe = 1 + 0.030 * Math.sin(t * 2.2);
    const sq = o.squash == null ? 1 : o.squash;
    const st = o.stretch == null ? 1 : o.stretch;
    const tailL = o.tailL == null ? 100 : o.tailL;
    const tailS = o.tailS == null ? 80 : o.tailS;
    const wave = o.wave == null ? 18 : o.wave;
    const paint = o.paint == null ? 1 : o.paint;      // 0 = 纯铅笔稿，1 = 完成上色
    const sketch = o.sketch == null ? 0 : o.sketch;   // 起稿辅助线强度

    C.save();
    C.translate(x, y);
    if (o.tilt) C.rotate(o.tilt);
    C.scale(dir * s * sq, s * st);
    C.globalAlpha = C.globalAlpha * (o.alpha == null ? 255 : o.alpha) / 255;
    const baseA = C.globalAlpha;

    if (o.aura) {
      const g = C.createRadialGradient(0, 0, 10, 0, 0, 190);
      g.addColorStop(0, 'rgba(141,166,255,' + (0.5 * o.aura) + ')');
      g.addColorStop(1, 'rgba(141,166,255,0)');
      C.save(); C.fillStyle = g; C.beginPath(); C.arc(0, 0, 190, 0, G.TAU); C.fill(); C.restore();
    }

    // ---- 铅笔起稿辅助线 ----
    if (sketch > 0.02) {
      const sa = 115 * sketch;
      for (let i = 0; i < 4; i++) G.stroke(G.ellPts(0, 0, 96 - i * 21, 70 - i * 16, 30, 3), { ink: P.ink2, sw: 1.5, alpha: sa * 0.75, jitter: 3, smooth: 1 });
      G.stroke([[-124, 0], [116, 0]], { ink: P.ink2, sw: 1.3, alpha: sa, jitter: 3, dash: [10, 12], smooth: 0 });
      G.stroke([[0, -84], [0, 84]], { ink: P.ink2, sw: 1.3, alpha: sa * 0.7, jitter: 3, dash: [8, 10], smooth: 0 });
      for (let i = 0; i < 6; i++) { const a = G.hash(i * 3.3) * G.TAU; G.dot(Math.cos(a) * 96, Math.sin(a) * 70, 2.4, P.ink2, sa * 0.9); }
      // 铅笔轮廓：先勾线，再上色
      G.paint(bodyPts(breathe), { ink: P.ink2, sw: 2.4, jitter: 2.4, inkOp: sa });
      for (const sup of [true, false]) G.paint(flukePts(ph + 0.001, sup, tailL, tailS, wave), { ink: P.ink2, sw: 2.1, jitter: 2.4, inkOp: sa });
      G.paint(dorsalPts(ph * 0.9), { ink: P.ink2, sw: 2.1, jitter: 2.2, inkOp: sa });
      G.paint(flipperPts(ph * 1.7, false), { ink: P.ink2, sw: 2.1, jitter: 2.2, inkOp: sa });
    }
    // ---- 地面排线投影 ----
    if (o.ground) {
      const gy = 96;
      G.hatchFill([[-165, gy], [165, gy], [128, gy + 30], [-128, gy + 30]],
        { d: 5.5, a: -0.30, color: P.ink2, alpha: 130 * o.ground, sw: 1.7, rand: 0.55, seed: 11 });
    }
    // 从这里开始都是完成稿图层（paint=0 时整层隐去，只剩铅笔稿）
    C.globalAlpha = baseA * paint;

    // ---- 身体后面的部件（基地被身体盖住）----
    for (const up of [true, false]) {
      const fp = flukePts(ph, up, tailL, tailS, wave);
      G.paint(fp, { fill: P.dsMid, fillOp: 235, ink: P.ink, sw: 2.6, jitter: 1.4 });
      G.hatchFill(fp, { d: 8.5, a: up ? -1.15 : 1.15, color: P.dsDk, alpha: 110, sw: 1.3, rand: 0.35, seed: up ? 5 : 9 });
      G.stroke([fp[2], fp[6], fp[10], fp[14]], { ink: P.dsLt, sw: 8, alpha: 130, jitter: 1.6, smooth: 1 });
    }
    G.paint(flipperPts(ph * 1.7, true), { fill: P.dsDk, fillOp: 210, ink: P.ink2, sw: 2, jitter: 1.1 });
    G.paint(dorsalPts(ph * 0.9), { fill: P.dsMid, fillOp: 230, ink: P.ink, sw: 2.4, jitter: 1.1 });

    // ---- 身体 ----
    const bp = bodyPts(breathe);
    G.paint(bp, { fill: P.ds, ink: P.ink, sw: 3.5, jitter: 1.3, shadow: P.ink, shadowOp: .10, shadowY: 8 });

    // 身体内部：背部暗面 / 腹部亮面 / 腹部褶 / 嘴线（全部裁在身体里）
    C.save();
    G.tracePts(bp, 1, true);
    C.clip();
    G.paint(G.ellPts(-2, -46, 84, 44, 30, 1.4), { fill: P.dsDk, fillOp: 105, jitter: 1.2 });
    G.paint(G.blobPts(2, 40, 70, 42, 34, a => 1 + 0.05 * Math.sin(a * 3), 0), { fill: P.cream, fillOp: 215, jitter: 1.3 });
    G.paint(G.blobPts(30, 46, 46, 28, 26, a => 1 + 0.07 * Math.sin(a * 2 + 1), 0), { fill: P.dsPale, fillOp: 200, jitter: 1.1 });
    // 铅笔排线阴影（参考片的核心质感）
    const shade = [];
    for (let i = 0; i < bp.length; i++) if (bp[i][1] > -2) shade.push(bp[i]);
    if (shade.length > 3) G.hatchFill(shade, { d: 9.5, a: -1.02, color: P.dsDk, alpha: 95, sw: 1.35, rand: 0.32, seed: 7 });
    // 腹部褶（throat pleats）
    for (let i = 0; i < 4; i++) {
      const y0 = 22 + i * 10;
      G.stroke([[84, y0 - 8], [56, y0 + 5], [22, y0 + 8], [-6, y0 + 3]], { ink: P.ink2, sw: 1.8, alpha: 80, jitter: 1.1 });
    }
    // 嘴线
    G.stroke([[78, 2], [62, 18], [36, 27], [4, 25]], { ink: P.ink, sw: 3.1, alpha: 235, jitter: .9 });
    C.restore();

    // ---- 脸部 ----
    eye(t, 44, -12, o.eyeR == null ? 16 : o.eyeR, mood, o.blink || 0);
    G.paint(G.ellPts(46, 25, 14, 7.5, 14, 1), { fill: P.coral, fillOp: o.blush == null ? 105 : o.blush, jitter: 1.2 });
    // 喷水孔
    G.paint(G.ellPts(42, -42, 11, 6, 14, .8, -0.18), { fill: P.ink, jitter: .7 });
    G.paint(G.ellPts(42, -41, 6, 3, 10, .6, -0.18), { fill: '#6E86FF', jitter: .5 });

    // ---- 近侧胸鳍（盖在身体前）----
    G.paint(flipperPts(ph * 1.7 + 0.7, false), { fill: P.dsLt, fillOp: 240, ink: P.ink, sw: 2.4, jitter: 1.2 });

    // ---- 喷水 ----
    if (o.spout) spout(t, o.spout, 42, -44);

    C.restore();

    if (o.emote) G.emote(o.emote, x + dir * 96 * s, y - 86 * s, s, t, o.emoteO);
  };

  // ---------- 情绪符号 ----------
  G.emote = function (kind, x, y, s, t, o) {
    const C = G.getCtx(); if (!C) return;
    o = o || {};
    const pop = o.pop == null ? 1 : o.pop;
    const wob = o.wob == null ? 1 : o.wob;
    C.save();
    C.translate(x, y + Math.sin(t * 2.2) * 4 * wob);
    C.scale(s * pop, s * pop);
    C.globalAlpha = C.globalAlpha * (o.alpha == null ? 255 : o.alpha) / 255;
    const col = o.color || P.gold;
    if (kind === 'note') {
      G.paint(G.ellPts(0, 0, 12, 9, 14, .8, -.3), { fill: col, ink: P.ink, sw: 2.2 });
      G.stroke([[10, -2], [13, -46]], { ink: P.ink, sw: 3, jitter: .6 });
      G.paint([[-2, -46], [26, -36], [26, -26], [-2, -36]], { fill: col, ink: P.ink, sw: 2 });
    } else if (kind === 'heart') {
      G.paint(G.heartPts(0, 0, 22), { fill: P.coral, ink: P.ink, sw: 2.2, jitter: 1 });
    } else if (kind === 'spark') {
      G.paint(G.starPts(0, 0, 22, 6, 4, 0), { fill: col, ink: P.ink, sw: 2, jitter: .8 });
    } else if (kind === 'star5') {
      G.paint(G.starPts(0, 0, 22, 9, 5), { fill: col, ink: P.ink, sw: 2, jitter: .8 });
    } else if (kind === 'excl') {
      G.paint([[-7, -30], [7, -30], [4, 6], [-4, 6]], { fill: P.coral, ink: P.ink, sw: 2.4, jitter: .6 });
      G.paint(G.ellPts(0, 20, 6, 6, 12, .6), { fill: P.coral, ink: P.ink, sw: 2.2 });
    } else if (kind === 'q') {
      G.handText('?', 0, 0, { size: 54, color: P.ink, align: 'center' });
    } else if (kind === 'sweat') {
      G.paint([[0, -26], [14, 2], [12, 20], [0, 28], [-12, 20], [-14, 2]], { fill: P.dsMid, ink: P.ink, sw: 2.2, jitter: .8 });
    } else if (kind === 'zzz') {
      G.handText('z', 0, 0, { size: 34, color: P.ink2, align: 'center' });
      G.handText('z', 22, -24, { size: 24, color: P.ink2, align: 'center' });
      G.handText('z', 40, -44, { size: 17, color: P.ink2, align: 'center' });
    }
    C.restore();
  };

  G.fish = G.whale;   // 兼容旧调用名
})(window.DSG);
