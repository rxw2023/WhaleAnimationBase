// char.js — 主角：DeepSeek 小鲸鱼
// 局部坐标：侧视、头朝 +x、原点在身体中心，外层用 translate/rotate/scale 摆位。
// 造型三原则：① 剪影先成立（大头 / 细尾柄 / 两叶尾鳍）② 体积靠一条明暗渐变，不靠糊椭圆
//             ③ 配件小而少，每条线都要有理由
(function (G) {
  'use strict';
  const P = G.PAL;
  const lerp = G.lerp, clamp = G.clamp;

  // ======================= 形体参数 =======================
  const CAPX = 58, CAPRX = 31, CAPRY = 51;      // 吻端半椭圆（钝头的关键）
  const TAILX = -90, TAILH = 7;                 // 尾柄位置与半高
  // 背 / 腹缘的半高关键帧，u：0 = 吻后，1 = 尾柄。最高点落在 u≈0.26（头后一点）
  const TOP = [[0, 51], [0.10, 53], [0.26, 55], [0.42, 52], [0.58, 42], [0.72, 28], [0.86, 15], [1, 7]];
  const BOT = [[0, 51], [0.10, 54], [0.26, 58], [0.42, 55], [0.58, 45], [0.72, 29], [0.86, 16], [1, 7]];
  const uOfX = x => clamp((CAPX - x) / (CAPX - TAILX));
  const halfTop = u => G.kf(u, TOP), halfBot = u => G.kf(u, BOT);
  const backY = x => -halfTop(uOfX(x));         // 轮廓上某 x 处的背缘 y
  const bellyY = x => halfBot(uOfX(x));         // 腹缘 y

  // 身体轮廓：背缘(额头→尾柄) → 腹缘(尾柄→下巴) → 吻端半椭圆(下巴→额头)
  // 整条环的角度是单调的，所以按 y 取子集就是一段连续弧，可以直接喂给 hatchFill。
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

  // 尾鳍单叶：沿脊椎线扫出的宽叶 —— 前缘饱满、后缘收窄、叶尖收成一点
  // bend 让叶面向一方微微弯，避免两片尾叶看起来像两根直棍
  function lobePts(bx, by, ang, len, wMax, bend, N) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const spine = [], lead = [], trail = [];
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

  const FX = -76, FY = 6;                        // 尾鳍根部（藏在身体里，所以中缝看不见）
  const ANG_UP = Math.PI + 0.44, ANG_DN = Math.PI - 0.44;
  // tailL / tailS / wave 是留给调用方的比例旋钮，默认值就是标准造型
  function flukePts(ph, up, tailL, tailS, wave) {
    const kL = tailL / 100, kW = tailS / 30;
    const len = (up ? 94 : 68) * kL, wm = (up ? 20 : 12) * kW;
    const pts = lobePts(FX, up ? -FY : FY,
      (up ? ANG_UP : ANG_DN) + Math.sin(ph + (up ? 0 : 0.35)) * 0.10,
      len, wm, up ? 0.06 : -0.06, 12);
    // 整片尾叶绕尾柄摆动（这是"在游"的主要信号）+ 叶面自身的涟漪
    const rot = Math.sin(ph + (up ? 0 : 0.25)) * 0.16, cs = Math.cos(rot), sn = Math.sin(rot);
    for (const q of pts) {
      const dx = q[0] - FX, dy = q[1];
      q[0] = FX + dx * cs - dy * sn;
      q[1] = dy * cs + dx * sn;
      if (wave) q[1] += Math.sin(ph * 1.3 + q[0] * 0.03) * wave * 0.35 * clamp((FX - q[0]) / 90);
    }
    return pts;
  }

  // 背鳍：小、后置、带一点后钩；根部埋在背线以下，让身体把它接住
  function dorsalPts(ph) {
    const b = Math.sin(ph) * 2.5;
    return [
      [-34, -35], [-37, -44], [-41, -51], [-46, -56 + b], [-52, -52 + b], [-56, -45],
      [-60, -34], [-64, -15], [-53, -23], [-42, -29],
    ];
  }

  // 胸鳍：贴在头后下方的短桨，向后下方扫；back = 远侧那只（更小更暗，压在身体后面）
  function flipperPts(ph, back) {
    const swing = Math.sin(ph * 1.1 + (back ? 0.9 : 0)) * 0.15;
    return lobePts(back ? 16 : 34, back ? 26 : 40,
      Math.PI - (back ? 0.78 : 0.85) + swing,
      back ? 34 : 52, back ? 7 : 11, -0.14, 9);
  }

  // ======================= 喷水 =======================
  function spout(t, k, x0, y0) {
    const C = G.getCtx();
    const HT = 58 + 78 * k;
    // 上端散开的水雾
    C.save();
    C.globalAlpha = C.globalAlpha * 0.30 * k;
    for (let i = 0; i < 6; i++) {
      const u = (i + 1) / 6, w = 10 + 48 * u;
      G.paint(G.ellPts(x0 + Math.sin(t * 1.7 + i * 1.3) * 9 * u, y0 - HT * u - 6, w * 0.55, w * 0.34, 16, 1.2 + u * 3),
        { fill: P.dsLt, jitter: 0 });
    }
    C.restore();
    // 被风吹歪、向上收细的水柱
    for (let i = 0; i < 22; i++) {
      const u = i / 22;
      const px = x0 + Math.sin(u * 2.1 - 0.35) * 15 * u + Math.sin(t * 2.6) * 3 * u;
      const py = y0 - HT * u - 3;
      G.dot(px, py, (5.0 - 2.4 * u) * (0.5 + 0.5 * k), i % 4 === 0 ? '#ffffff' : P.dsLt, 200 - 70 * u);
    }
    // 顶端四散的水滴
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.5 + (G.hash(i * 3.3) - 0.5) * 2.4;
      const R = 14 + 40 * G.hash(i * 7.1) * k;
      G.dot(x0 + 6 + Math.cos(a) * R, y0 - HT - 4 + Math.sin(a) * R * 0.55, 2.2 + G.hash(i * 5) * 2.4, P.dsLt, 175);
    }
  }

  // ======================= 眼睛 =======================
  function eye(t, px, py, r, mood, blink) {
    const C = G.getCtx();
    const R = r * (1 - 0.05 * Math.sin(t * 2.2));
    if (blink > .55 || mood === 'sleep') {
      G.stroke([[px - R, py - 1], [px + R, py - 1]], { ink: P.ink, sw: 3.4, jitter: .6, smooth: 0 });
      return;
    }
    if (mood === 'happy') {
      G.stroke([[px - R, py + R * .45], [px, py - R * .6], [px + R, py + R * .45]], { ink: P.ink, sw: 3.6, jitter: .8 });
      return;
    }
    // 眼窝：一层很淡的暗色，把眼睛"按"进头里，免得像贴上去的贴纸
    G.paint(G.ellPts(px + R * .06, py - R * .04, R * 1.30, R * 1.36, 20, .5), { fill: P.dsDk, fillOp: 46, jitter: .8 });
    G.paint(G.ellPts(px, py, R, R * (1 - blink * .85), 20, .5), { fill: P.cream, ink: P.ink, sw: 2.7 });
    C.save();
    C.beginPath(); C.arc(px, py, R * .94, 0, G.TAU); C.clip();
    if (mood === 'dizzy') {
      G.stroke([[px - R * .7, py - R * .7], [px + R * .7, py + R * .7]], { ink: P.ink, sw: 3, jitter: .8, smooth: 0 });
      G.stroke([[px + R * .7, py - R * .7], [px - R * .7, py + R * .7]], { ink: P.ink, sw: 3, jitter: .8, smooth: 0 });
    } else if (mood === 'heart') {
      G.paint(G.heartPts(px, py, R * 1.15), { fill: P.coral, ink: P.ink, sw: 2, jitter: .5 });
    } else {
      const pr = R * (mood === 'wow' ? .76 : .60);
      G.paint(G.ellPts(px + R * .10, py + R * .04, pr, pr * 1.05, 16, .45), { fill: P.ink, jitter: .35 });
      G.dot(px - R * .20, py - R * .26, R * .24, '#ffffff', 240);
      G.dot(px + R * .34, py + R * .30, R * .12, '#ffffff', 190);
      // 上眼睑：压住眼球顶部，眼神从"贴纸"变成"活的"
      G.paint(G.ellPts(px, py - R * .78, R * 1.24, R * .48, 18, .4), { fill: P.ds, jitter: .6 });
      G.stroke([[px - R * .96, py - R * .38], [px - R * .2, py - R * .28], [px + R * .3, py - R * .30], [px + R * .96, py - R * .46]],
        { ink: P.ink, sw: 1.9, alpha: 200, jitter: .5, smooth: 1 });
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
    const paint = o.paint == null ? 1 : o.paint;      // 0 = 纯铅笔稿，1 = 完成上色
    const sketch = o.sketch == null ? 0 : o.sketch;   // 起稿辅助线强度

    C.save();
    C.translate(x, y);
    if (o.tilt) C.rotate(o.tilt);
    C.scale(dir * s * sq, s * st);
    C.globalAlpha = C.globalAlpha * (o.alpha == null ? 255 : o.alpha) / 255;
    const baseA = C.globalAlpha;

    if (o.aura) {
      const g = C.createRadialGradient(0, 0, 10, 0, 0, 200);
      g.addColorStop(0, 'rgba(141,166,255,' + (0.5 * o.aura) + ')');
      g.addColorStop(1, 'rgba(141,166,255,0)');
      C.save(); C.fillStyle = g; C.beginPath(); C.arc(0, 0, 200, 0, G.TAU); C.fill(); C.restore();
    }

    // ---- 铅笔起稿辅助线 ----
    if (sketch > 0.02) {
      const sa = 115 * sketch;
      G.stroke([[-118, 0], [112, 0]], { ink: P.ink2, sw: 1.3, alpha: sa, jitter: 3, dash: [10, 12], smooth: 0 });
      G.stroke([[0, -72], [0, 72]], { ink: P.ink2, sw: 1.3, alpha: sa * 0.7, jitter: 3, dash: [8, 10], smooth: 0 });
      // 吻 / 眼 / 尾柄三条定位弧
      for (const e of [[CAPX, 0, CAPRX, CAPRY], [30, -14, 22, 22], [FX, 0, 16, 16]])
        G.stroke(G.ellPts(e[0], e[1], e[2], e[3], 26, 3), { ink: P.ink2, sw: 1.4, alpha: sa * 0.7, jitter: 3, smooth: 1 });
      for (let i = 0; i < 6; i++) { const a = G.hash(i * 3.3) * G.TAU; G.dot(Math.cos(a) * 88, Math.sin(a) * 56, 2.2, P.ink2, sa * 0.9); }
      // 铅笔轮廓：先勾线，再上色
      G.paint(bodyPts(breathe), { ink: P.ink2, sw: 2.4, jitter: 2.4, inkOp: sa });
      for (const up of [true, false]) G.paint(flukePts(ph + 0.001, up, tailL, tailS, wave), { ink: P.ink2, sw: 2.1, jitter: 2.4, inkOp: sa });
      G.paint(dorsalPts(ph * 0.9), { ink: P.ink2, sw: 2.1, jitter: 2.2, inkOp: sa });
      G.paint(flipperPts(ph * 1.7, false), { ink: P.ink2, sw: 2.1, jitter: 2.2, inkOp: sa });
    }
    // ---- 地面排线投影 ----
    if (o.ground) {
      const gy = 98;
      G.hatchFill([[-172, gy], [172, gy], [136, gy + 30], [-136, gy + 30]],
        { d: 5.5, a: -0.30, color: P.ink2, alpha: 130 * o.ground, sw: 1.7, rand: 0.55, seed: 11 });
    }
    // 从这里开始是完成稿图层（paint=0 时整层隐去，只剩铅笔稿）
    C.globalAlpha = baseA * paint;

    // ---- 身体后面的部件（根部被身体盖住）----
    const fDn = flukePts(ph, false, tailL, tailS, wave);
    G.paint(fDn, { fill: P.dsDk, fillOp: 172, ink: P.ink, sw: 2.4, jitter: 1.3 });
    const fUp = flukePts(ph, true, tailL, tailS, wave);
    G.paint(fUp, { fill: P.dsMid, fillOp: 238, grad: [-46, 4, P.dsLt, P.dsMid], gradOp: 215, ink: P.ink, sw: 2.8, jitter: 1.3 });
    G.stroke([fUp[0], fUp[4], fUp[8], fUp[12]], { ink: P.dsPale, sw: 5, alpha: 130, jitter: 1.4, smooth: 1 });
    G.paint(flipperPts(ph * 1.7, true), { fill: P.dsDk, fillOp: 205, ink: P.ink2, sw: 2, jitter: 1.1 });
    G.paint(dorsalPts(ph * 0.9), { fill: P.ds, fillOp: 240, ink: P.ink, sw: 2.5, jitter: 1.1 });

    // ---- 身体 ----
    const bp = bodyPts(breathe);
    G.paint(bp, { fill: P.ds, ink: P.ink, sw: 3.4, jitter: 1.25, shadow: P.ink, shadowOp: .09, shadowY: 9 });
    C.save();
    G.tracePts(bp, 1, true);
    C.clip();
    // ① 一条竖向渐变解决体积：背深 → 侧蓝 → 腹白（不要用两块椭圆糊出硬边）
    const g = C.createLinearGradient(0, -58, 0, 60);
    g.addColorStop(0.00, 'rgba(38,52,143,0.86)');
    g.addColorStop(0.30, 'rgba(77,107,254,0.34)');
    g.addColorStop(0.54, 'rgba(220,228,255,0.40)');
    g.addColorStop(1.00, 'rgba(255,249,236,0.86)');
    C.fillStyle = g; C.fillRect(-118, -72, 240, 155);
    // ② 腹部的奶油亮面（前端厚一点，符合鲸的体形）
    G.paint(G.ellPts(26, 40, 64, 28, 24, 1.1), { fill: P.cream, fillOp: 112, jitter: 1 });
    // ③ 铅笔排线：背脊 / 腹部 —— 参考片的质感签名
    const upP = [], dnP = [];
    for (const q of bp) { if (q[1] < -4) upP.push(q); else if (q[1] > 4) dnP.push(q); }
    if (upP.length > 3) G.hatchFill(upP, { d: 14, a: -0.70, color: P.dsDk, alpha: 30, sw: 1.5, rand: 0.45, seed: 3 });
    if (dnP.length > 3) G.hatchFill(dnP, { d: 12.5, a: -1.02, color: P.dsDk, alpha: 48, sw: 1.3, rand: 0.35, seed: 7 });
    // ④ 腹部褶（喉褶）：越往里的越短，向吻端收拢
    for (let i = 0; i < 4; i++) {
      const d = 8 + i * 7.7, xa = lerp(56, 26, i / 3), xb = lerp(6, -16, i / 3), pts = [];
      for (let k = 0; k <= 6; k++) { const x = lerp(xa, xb, k / 6); pts.push([x, bellyY(x) - d]); }
      G.stroke(pts, { ink: P.ink2, sw: 1.9, alpha: 76, jitter: 1.1, smooth: 1 });
    }
    // ⑤ 吻部亮块 + 嘴线（收在身体埋进去，不要拉成一道横贯身体的裂口）
    G.paint(G.ellPts(60, 26, 24, 15, 20, 1), { fill: P.dsPale, fillOp: 120, jitter: 1.1 });
    G.stroke([[80, 7], [66, 16], [48, 22], [31, 21], [21, 14]], { ink: P.ink, sw: 3.0, alpha: 228, jitter: .9, smooth: 1 });
    C.restore();
    // ⑥ 轮廓线最后画，保证不被明暗糊掉
    G.paint(bp, { ink: P.ink, sw: 3.4, jitter: 1.25 });

    // ---- 脸 ----
    eye(t, 30, -14, o.eyeR == null ? 15.5 : o.eyeR, mood, o.blink || 0);
    // 腮红：挪到眼下的颊部，先两片软色块晕开，再压三道斜线（一眼认得出是腮红而不是淤青）
    const bA = o.blush == null ? 105 : o.blush;
    if (bA > 4) {
      for (let i = 0; i < 3; i++) {
        const k = i / 2;                                   // 三层同心色块 → 边缘自然衰减
        G.paint(G.ellPts(18, 1, 17 - k * 5, 10 - k * 3, 20, 1.1 + k), { fill: P.coral, fillOp: bA * 0.16, jitter: 1.3 });
      }
      for (let i = 0; i < 3; i++) {
        const bx = 11 + i * 7;
        G.stroke([[bx - 2.5, 5], [bx + 2.5, -1]], { ink: P.coral, sw: 1.9, alpha: bA * 0.42, jitter: .4, smooth: 0 });
      }
    }
    // 喷水孔：头顶偏后，先一块浅色隆起再压一条暗缝
    G.paint(G.ellPts(21, -47, 10, 5, 14, .8, -0.16), { fill: P.dsMid, fillOp: 130, jitter: .7 });
    G.paint(G.ellPts(21, -48, 6.5, 2.6, 12, .6, -0.16), { fill: P.ink, fillOp: 165, jitter: .5 });

    // ---- 近侧胸鳍（盖在身体前）----
    G.paint(flipperPts(ph * 1.7 + 0.7, false), { fill: P.dsMid, fillOp: 242, grad: [74, 20, P.dsLt, P.dsMid], gradOp: 210, ink: P.ink, sw: 2.5, jitter: 1.2 });

    // ---- 喷水 ----
    if (o.spout) spout(t, o.spout, 20, -50);

    C.restore();

    if (o.emote) G.emote(o.emote, x + dir * 108 * s, y - 96 * s, s, t, o.emoteO);
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
