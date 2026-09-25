// props.js — 道具：气泡、音符、波纹、海草、数据光点、声波、小星星
(function (G) {
  'use strict';
  const P = G.PAL;

  G.bubble = function (t, x, y, r, o) {
    o = o || {};
    const C = G.getCtx();
    G.paint(G.ellPts(x, y, r, r * (1 + .04 * Math.sin(t * 3 + x)), 16, o.jitter == null ? 1 : o.jitter),
      { fill: o.fill || 'rgba(255,255,255,0.55)', fillOp: o.op == null ? 200 : o.op, ink: o.ink || P.ink2, sw: o.sw == null ? 2 : o.sw });
    G.dot(x - r * .3, y - r * .3, r * .2, '#ffffff', 230);
    G.stroke([[x + r * .35, y + r * .3], [x + r * .5, y + r * .05]], { ink: '#ffffff', sw: Math.max(1.4, r * .16), alpha: 190, jitter: .4 });
  };

  G.ripple = function (t, x, y, k, o) {
    o = o || {};
    const r = (o.r0 == null ? 20 : o.r0) + k * (o.r1 == null ? 260 : o.r1);
    const a = (o.alpha == null ? 170 : o.alpha) * (1 - k);
    G.stroke(G.ellPts(x, y, r, r * (o.flat == null ? .32 : o.flat), 26, 2 + k * 5),
      { ink: o.color || P.dsMid, sw: 3, alpha: Math.max(0, a), jitter: 1.5 });
  };

  // 水草 / 珊瑚剪影
  G.weed = function (t, x, y, h, w, o) {
    o = o || {};
    const p = [], N = 12;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      p.push([x + Math.sin(t * 1.3 + u * 2.6 + (o.ph || 0)) * w * u, y - h * u]);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      p.push([x + w * .42 + Math.sin(t * 1.3 + u * 2.6 + (o.ph || 0)) * w * u, y - h * u * .96]);
    }
    G.paint(p, { fill: o.color || P.teal, fillOp: o.op == null ? 210 : o.op, ink: o.ink || P.ink2, sw: 2, jitter: 1.1 });
  };

  // 数据光点（代表 token）
  G.mote = function (t, x, y, s, o) {
    o = o || {};
    const C = G.getCtx();
    C.save(); C.translate(x, y); C.rotate(o.rot || 0); C.globalAlpha = C.globalAlpha * (o.op == null ? 200 : o.op) / 255;
    G.paint(G.rectPts(-s / 2, -s / 2, s, s, s * .12), { fill: o.color || P.ds, jitter: s * .1 });
    C.restore();
  };

  // 声波环（每拍扩散）
  G.soundRing = function (x, y, k, o) {
    o = o || {};
    const r = 40 + k * 300, a = (o.alpha == null ? 120 : o.alpha) * (1 - k);
    G.stroke(G.ellPts(x, y, r, r, 32, 3), { ink: o.color || P.gold, sw: 3.4, alpha: a, jitter: 2 });
  };

  // 手绘小星星
  G.sparkle = function (x, y, s, col, op) {
    G.paint(G.starPts(x, y, s, s * .26, 4, 0), { fill: col || P.gold, ink: P.ink, sw: 1.6, alpha: op == null ? 235 : op, jitter: s * .08 });
  };

  // 音符（大号，用于副歌）
  G.bigNote = function (x, y, s, rot, col, op) {
    const C = G.getCtx();
    C.save(); C.translate(x, y); C.rotate(rot); C.scale(s, s); C.globalAlpha = C.globalAlpha * (op == null ? 255 : op) / 255;
    G.paint(G.ellPts(-14, 22, 16, 12, 16, 1, -.3), { fill: col || P.dsMid, ink: P.ink, sw: 2.4 });
    G.stroke([[2, 18], [6, -46]], { ink: P.ink, sw: 3.4, jitter: .6 });
    G.paint([[-4, -46], [34, -34], [34, -22], [-4, -34]], { fill: col || P.gold, ink: P.ink, sw: 2.2 });
    C.restore();
  };
})(window.DSG);
