// char.js — 主角：DeepSeek 小鲸鱼
// 局部坐标：侧视、头朝 +x、原点在身体中心，外层用 translate/rotate/scale 摆位。
// 造型四条原则（对着 DeepSeek 标识的方向）：
//   ① 剪影敦实：头极大、身厚、尾短，整体接近一个圆
//   ② 一笔认出：下颌一道白色月牙（标识里最认得出来的那一笔）
//   ③ 眼睛小：小眼 + 一点高光，不是卡通大眼
//   ④ 尾巴上翘：两叶尾鳍带凹口，整体向上钩
(function (G) {
  'use strict';
  const P = G.PAL;
  const lerp = G.lerp, clamp = G.clamp;

  // ======================= 形体参数 =======================
  const CAPX = 52, CAPRX = 40, CAPRY = 58;      // 吻端半椭圆：又大又钝的头
  const TAILX = -80, TAILH = 8;                 // 尾柄
  // 背 / 腹缘半高，u：0 = 吻后，1 = 尾柄。峰值放在 u≈0.28，且**不比头更高**
  // —— 让头成为最宽的地方，是"敦实"的关键
  const TOP = [[0, 58], [0.12, 58], [0.28, 57], [0.44, 53], [0.60, 44], [0.74, 30], [0.88, 16], [1, 8]];
  const BOT = [[0, 58], [0.12, 60], [0.28, 61], [0.44, 58], [0.60, 49], [0.74, 33], [0.88, 18], [1, 8]];
  const uOfX = x => clamp((CAPX - x) / (CAPX - TAILX));
  const halfTop = u => G.kf(u, TOP), halfBot = u => G.kf(u, BOT);
  const backY = x => -halfTop(uOfX(x));
  const bellyY = x => halfBot(uOfX(x));
  // 身体下缘在任意 x 处的 y（x 越过吻端后走吻端半椭圆，bellyY 在那里是错的）
  function lowY(x, breathe) {
    if (x <= CAPX) return halfBot(uOfX(x)) * breathe;
    const c = clamp((x - CAPX) / CAPRX, -1, 1);
    return CAPRY * Math.sqrt(Math.max(0, 1 - c * c)) * breathe;
  }

  // 身体轮廓：背缘(额头→尾柄) → 腹缘(尾柄→下巴) → 吻端半椭圆(下巴→额头)
  function bodyPts(breathe) {
    const N = 28, p = [];
    for (let i = 0; i <= N; i++) { const u = i / N; p.push([lerp(CAPX, TAILX, u), -halfTop(u) * breathe]); }
    for (let i = N; i >= 0; i--) { const u = i / N; p.push([lerp(CAPX, TAILX, u), halfBot(u) * breathe]); }
    const NC = 14;
    for (let i = 1; i < NC; i++) {
      const a = Math.PI * 0.5 - Math.PI * i / NC;
      p.push([CAPX + Math.cos(a) * CAPRX, Math.sin(a) * CAPRY * breathe]);
    }
    return p;
  }

  // ★ 下颌白月牙：上缘 = 嘴线，下缘 = 身体腹线。这一笔是标识里最有辨识度的部分。
  const MOUTH = [[88, 6], [80, 17], [70, 26], [58, 33], [44, 37], [30, 39], [16, 44], [4, 50], [-6, 56]];
  function jawPts(breathe) {
    // 上缘 = 嘴线（从吻端一路向后下方扫到喉部），下缘 = 身体腹线。
    // 两条线在吻端和喉部各交于一点 ⇒ 两头都是尖的，才是"月牙"而不是"围裙"
    const lo = [];
    for (let k = 0; k <= 11; k++) { const x = lerp(-6, 90, k / 11); lo.push([x, lowY(x, breathe)]); }
    return MOUTH.concat(lo);
  }

  // 尾鳍单叶：沿脊椎线扫出的宽叶，前缘饱满、后缘收窄、叶尖收成一点
  function lobePts(bx, by, ang, len, wMax, bend, N) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const lead = [], trail = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = bx + dx * len * t + nx * bend * len * t * t;
      const py = by + dy * len * t + ny * bend * len * t * t;
      const w = wMax * Math.sin(Math.PI * (0.13 + 0.87 * t)) * (1 - 0.12 * t);
      lead.push([px + nx * w, py + ny * w]);
      trail.push([px - nx * w * 0.66, py - ny * w * 0.66]);
    }
    for (let i = N; i >= 0; i--) lead.push(trail[i]);
    return lead;
  }

  // ★ 尾鳍整体**向上钩**（两叶都在轴线上方），像标识那样；根部埋进身体里所以看不见中缝
  const FX = -68, FY = 6;
  const ANG_UP = Math.PI + 0.70, ANG_DN = Math.PI + 0.04;
  function flukePts(ph, up, tailL, tailS, wave) {
    const kL = tailL / 100, kW = tailS / 30;
    const len = (up ? 92 : 72) * kL, wm = (up ? 24 : 16) * kW;
    const pts = lobePts(FX, up ? -FY : FY,
      (up ? ANG_UP : ANG_DN) + Math.sin(ph + (up ? 0 : 0.35)) * 0.09,
      len, wm, up ? 0.05 : -0.05, 12);
    const rot = Math.sin(ph + (up ? 0 : 0.25)) * 0.15, cs = Math.cos(rot), sn = Math.sin(rot);
    for (const q of pts) {
      const dx = q[0] - FX, dy = q[1];
      q[0] = FX + dx * cs - dy * sn;
      q[1] = dy * cs + dx * sn;
      if (wave) q[1] += Math.sin(ph * 1.3 + q[0] * 0.03) * wave * 0.35 * clamp((FX - q[0]) / 90);
    }
    return pts;
  }

  // 背鳍：小圆钩，前置一点（标识里背上的那个小凸起）
  function dorsalPts(ph) {
    const b = Math.sin(ph) * 2.5;
    return [
      [-6, -44], [-9, -54], [-14, -63 + b], [-21, -69 + b], [-28, -64 + b], [-33, -54],
      [-37, -40], [-40, -24], [-29, -31], [-16, -38],
    ];
  }

  // 胸鳍：短、尖、向后下扫；back = 远侧那只
  function flipperPts(ph, back) {
    const swing = Math.sin(ph * 1.1 + (back ? 0.9 : 0)) * 0.13;
    return lobePts(back ? 18 : 30, back ? 28 : 46,
      Math.PI - (back ? 0.70 : 0.80) + swing,
      back ? 34 : 46, back ? 7 : 9, -0.12, 9);
  }

  // ======================= 喷水（放慢版）=======================
  // 水柱本身是稳定的，只有很慢的横向摇摆；起伏交给调用方的 o.spout 决定。
  // 原来 t×2.6 / t×1.7 那种频率看起来像在抽搐。
  function spout(t, k, x0, y0) {
    const C = G.getCtx();
    const HT = 54 + 72 * k;
    C.save();
    C.globalAlpha = C.globalAlpha * 0.28 * k;
    for (let i = 0; i < 6; i++) {
      const u = (i + 1) / 6, w = 10 + 46 * u;
      G.paint(G.ellPts(x0 + Math.sin(t * 0.55 + i * 1.3) * 10 * u, y0 - HT * u - 6, w * 0.55, w * 0.34, 16, 1.2 + u * 3),
        { fill: P.dsLt, jitter: 0 });
    }
    C.restore();
    for (let i = 0; i < 20; i++) {
      const u = i / 20;
      const px = x0 + Math.sin(u * 2.1 - 0.35) * 15 * u + Math.sin(t * 0.8) * 4 * u;
      const py = y0 - HT * u - 3;
      G.dot(px, py, (5.0 - 2.4 * u) * (0.5 + 0.5 * k), i % 4 === 0 ? '#ffffff' : P.dsLt, 190 - 60 * u);
    }
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.5 + (G.hash(i * 3.3) - 0.5) * 2.4;
      const R = 14 + 40 * G.hash(i * 7.1) * k;
      G.dot(x0 + 6 + Math.cos(a) * R + Math.sin(t * 0.7 + i) * 3,
        y0 - HT - 4 + Math.sin(a) * R * 0.55, 2.2 + G.hash(i * 5) * 2.4, P.dsLt, 170);
    }
  }

  // ======================= 眼睛（小眼）=======================
  function eye(t, px, py, r, mood, blink) {
    const C = G.getCtx();
    const R = r * (1 - 0.05 * Math.sin(t * 2.2));
    if (blink > .55 || mood === 'sleep') {
      G.stroke([[px - R, py - 1], [px + R, py - 1]], { ink: P.ink, sw: 2.8, jitter: .6, smooth: 0 });
      return;
    }
    if (mood === 'happy') {
      G.stroke([[px - R, py + R * .45], [px, py - R * .6], [px + R, py + R * .45]], { ink: P.ink, sw: 3.0, jitter: .8 });
      return;
    }
    G.paint(G.ellPts(px + R * .06, py - R * .04, R * 1.26, R * 1.30, 20, .5), { fill: P.dsDk, fillOp: 40, jitter: .8 });
    G.paint(G.ellPts(px, py, R, R * (1 - blink * .85), 20, .5), { fill: P.cream, ink: P.ink, sw: 2.3 });
    C.save();
    C.beginPath(); C.arc(px, py, R * .94, 0, G.TAU); C.clip();
    if (mood === 'dizzy') {
      G.stroke([[px - R * .7, py - R * .7], [px + R * .7, py + R * .7]], { ink: P.ink, sw: 2.6, jitter: .8, smooth: 0 });
      G.stroke([[px + R * .7, py - R * .7], [px - R * .7, py + R * .7]], { ink: P.ink, sw: 2.6, jitter: .8, smooth: 0 });
    } else if (mood === 'heart') {
      G.paint(G.heartPts(px, py, R * 1.15), { fill: P.coral, ink: P.ink, sw: 2, jitter: .5 });
    } else {
      // 瞳孔占比更大 → 眼睛整体偏暗，才像标识里那颗小眼而不是卡通大眼
      const pr = R * (mood === 'wow' ? .86 : .74);
      G.paint(G.ellPts(px + R * .08, py + R * .04, pr, pr * 1.04, 16, .4), { fill: P.ink, jitter: .35 });
      G.dot(px - R * .22, py - R * .26, R * .24, '#ffffff', 240);
      G.paint(G.ellPts(px, py - R * .80, R * 1.22, R * .46, 18, .4), { fill: P.ds, jitter: .6 });
      G.stroke([[px - R * .94, py - R * .40], [px - R * .2, py - R * .30], [px + R * .3, py - R * .32], [px + R * .94, py - R * .48]],
        { ink: P.ink, sw: 1.7, alpha: 195, jitter: .5, smooth: 1 });
    }
    C.restore();
  }

  // ======================= 主入口 =======================
  // whale(t, x, y, 尺寸, 选项)
  // o: dir(+1右/-1左) tilt mood squash stretch alpha aura spout blink eyeR
  //    tailSpeed tailL tailS wave paint sketch ground blush emote emoteO
  G.whale = function (t, x, y, s, o) {
    const C = G.getCtx(); if (!C) return;
    o = o || {};
    const dir = o.dir === -1 ? -1 : 1;
    const mood = o.mood || 'idle';
    const ph = t * (o.tailSpeed == null ? 2.6 : o.tailSpeed);
    const breathe = 1 + 0.028 * Math.sin(t * 2.2);
    const sq = o.squash == null ? 1 : o.squash;
    const st = o.stretch == null ? 1 : o.stretch;
    const tailL = o.tailL == null ? 100 : o.tailL;
    const tailS = o.tailS == null ? 30 : o.tailS;
    const wave = o.wave == null ? 18 : o.wave;
    const paint = o.paint == null ? 1 : o.paint;
    const sketch = o.sketch == null ? 0 : o.sketch;

    C.save();
    C.translate(x, y);
    if (o.tilt) C.rotate(o.tilt);
    C.scale(dir * s * sq, s * st);
    C.globalAlpha = C.globalAlpha * (o.alpha == null ? 255 : o.alpha) / 255;
    const baseA = C.globalAlpha;

    if (o.aura) {
      const g = C.createRadialGradient(0, 0, 10, 0, 0, 210);
      g.addColorStop(0, 'rgba(141,166,255,' + (0.5 * o.aura) + ')');
      g.addColorStop(1, 'rgba(141,166,255,0)');
      C.save(); C.fillStyle = g; C.beginPath(); C.arc(0, 0, 210, 0, G.TAU); C.fill(); C.restore();
    }

    // ---- 铅笔起稿辅助线 ----
    if (sketch > 0.02) {
      const sa = 115 * sketch;
      G.stroke([[-118, 0], [116, 0]], { ink: P.ink2, sw: 1.3, alpha: sa, jitter: 3, dash: [10, 12], smooth: 0 });
      G.stroke([[0, -76], [0, 76]], { ink: P.ink2, sw: 1.3, alpha: sa * 0.7, jitter: 3, dash: [8, 10], smooth: 0 });
      for (const e of [[CAPX, 0, CAPRX, CAPRY], [32, -16, 20, 20], [FX, 0, 16, 16]])
        G.stroke(G.ellPts(e[0], e[1], e[2], e[3], 26, 3), { ink: P.ink2, sw: 1.4, alpha: sa * 0.7, jitter: 3, smooth: 1 });
      for (let i = 0; i < 6; i++) { const a = G.hash(i * 3.3) * G.TAU; G.dot(Math.cos(a) * 92, Math.sin(a) * 60, 2.2, P.ink2, sa * 0.9); }
      G.paint(bodyPts(breathe), { ink: P.ink2, sw: 2.4, jitter: 2.4, inkOp: sa });
      G.paint(jawPts(breathe), { ink: P.ink2, sw: 1.8, jitter: 2.4, inkOp: sa * 0.7 });
      for (const up of [true, false]) G.paint(flukePts(ph + 0.001, up, tailL, tailS, wave), { ink: P.ink2, sw: 2.1, jitter: 2.4, inkOp: sa });
      G.paint(dorsalPts(ph * 0.9), { ink: P.ink2, sw: 2.1, jitter: 2.2, inkOp: sa });
      G.paint(flipperPts(ph * 1.7, false), { ink: P.ink2, sw: 2.1, jitter: 2.2, inkOp: sa });
    }
    if (o.ground) {
      const gy = 104;
      G.hatchFill([[-176, gy], [176, gy], [140, gy + 30], [-140, gy + 30]],
        { d: 5.5, a: -0.30, color: P.ink2, alpha: 130 * o.ground, sw: 1.7, rand: 0.55, seed: 11 });
    }
    C.globalAlpha = baseA * paint;

    // ---- 身体后面的部件 ----
    const fDn = flukePts(ph, false, tailL, tailS, wave);
    G.paint(fDn, { fill: P.dsDk, fillOp: 215, ink: P.ink, sw: 2.4, jitter: 1.3 });
    const fUp = flukePts(ph, true, tailL, tailS, wave);
    // 用身体那一支蓝：剪影才是一整块（标识的做法），只在叶尖提亮一点点
    G.paint(fUp, { fill: P.ds, fillOp: 250, ink: P.ink, sw: 2.8, jitter: 1.3 });
    G.stroke([fUp[0], fUp[4], fUp[8], fUp[12]], { ink: P.dsPale, sw: 4, alpha: 105, jitter: 1.4, smooth: 1 });
    G.paint(flipperPts(ph * 1.7, true), { fill: P.dsDk, fillOp: 205, ink: P.ink2, sw: 2, jitter: 1.1 });
    G.paint(dorsalPts(ph * 0.9), { fill: P.ds, fillOp: 245, ink: P.ink, sw: 2.4, jitter: 1.1 });

    // ---- 身体 ----
    const bp = bodyPts(breathe);
    G.paint(bp, { fill: P.ds, ink: P.ink, sw: 3.0, jitter: 1.2, shadow: P.ink, shadowOp: .09, shadowY: 9 });
    C.save();
    G.tracePts(bp, 1, true);
    C.clip();
    // ① 竖向渐变：背缘收暗，**中间一大片保持标识蓝**，腹部才转白
    const g = C.createLinearGradient(0, -62, 0, 64);
    g.addColorStop(0.00, 'rgba(38,52,143,0.74)');
    g.addColorStop(0.22, 'rgba(56,84,220,0.36)');
    g.addColorStop(0.46, 'rgba(77,107,254,0.10)');
    g.addColorStop(0.72, 'rgba(220,228,255,0.34)');
    g.addColorStop(1.00, 'rgba(255,249,236,0.72)');
    C.fillStyle = g; C.fillRect(-124, -76, 250, 162);
    // ② ★ 白月牙下颌：标识最认得出来的一笔。边缘要利落，所以用实心填充 + 描边
    G.paint(jawPts(breathe), { fill: P.cream, fillOp: 246, jitter: 1.0 });
    G.stroke(MOUTH, { ink: P.ink, sw: 2.7, alpha: 225, jitter: .8, smooth: 1 });
    // ③ 铅笔排线（只留一点点，体积主要交给渐变和白月牙）
    const upP = [], dnP = [];
    for (const q of bp) { if (q[1] < -6) upP.push(q); else if (q[1] > 6) dnP.push(q); }
    if (upP.length > 3) G.hatchFill(upP, { d: 15, a: -0.70, color: P.dsDk, alpha: 26, sw: 1.5, rand: 0.45, seed: 3 });
    if (dnP.length > 3) G.hatchFill(dnP, { d: 13, a: -1.02, color: P.dsDk, alpha: 34, sw: 1.3, rand: 0.35, seed: 7 });
    // ④ 喉褶：裁进白月牙里画（不裁的话会跑到蓝身上，看着像划痕）
    C.save();
    G.tracePts(jawPts(breathe), 1, true);
    C.clip();
    for (let i = 0; i < 4; i++) {
      const d = 6 + i * 8.0, xa = lerp(66, 34, i / 3), xb = lerp(20, 0, i / 3), pts = [];
      for (let k = 0; k <= 6; k++) { const x = lerp(xa, xb, k / 6); pts.push([x, lowY(x, 1) - d]); }
      G.stroke(pts, { ink: P.ink2, sw: 1.7, alpha: 88, jitter: 1.0, smooth: 1 });
    }
    C.restore();
    C.restore();
    G.paint(bp, { ink: P.ink, sw: 3.0, jitter: 1.2 });

    // ---- 脸 ----
    eye(t, 32, -16, o.eyeR == null ? 11 : o.eyeR, mood, o.blink || 0);
    const bA = o.blush == null ? 105 : o.blush;
    if (bA > 4) {
      for (let i = 0; i < 3; i++) {
        const k = i / 2;
        G.paint(G.ellPts(22, -4, 15 - k * 5, 9 - k * 3, 20, 1.1 + k), { fill: P.coral, fillOp: bA * 0.15, jitter: 1.3 });
      }
      for (let i = 0; i < 3; i++) {
        const bx = 15 + i * 7;
        G.stroke([[bx - 2.5, 0], [bx + 2.5, -6]], { ink: P.coral, sw: 1.8, alpha: bA * 0.40, jitter: .4, smooth: 0 });
      }
    }
    // 喷水孔：头顶偏后
    G.paint(G.ellPts(20, -53, 10, 5, 14, .8, -0.16), { fill: P.dsMid, fillOp: 130, jitter: .7 });
    G.paint(G.ellPts(20, -54, 6.5, 2.6, 12, .6, -0.16), { fill: P.ink, fillOp: 165, jitter: .5 });

    // ---- 近侧胸鳍 ----
    G.paint(flipperPts(ph * 1.7 + 0.7, false), { fill: P.dsMid, fillOp: 245, grad: [82, 26, P.dsLt, P.dsMid], gradOp: 200, ink: P.ink, sw: 2.4, jitter: 1.2 });

    // ---- 喷水 ----
    if (o.spout) spout(t, o.spout, 20, -56);

    C.restore();

    if (o.emote) G.emote(o.emote, x + dir * 104 * s, y - 104 * s, s, t, o.emoteO);
  };

  // ======================= 情绪符号 =======================
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
