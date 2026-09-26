// main.js — 播放器：时钟、控件、导出（PNG / 联络表 / WebM）、离线渲染接口
(function (G) {
  'use strict';
  const W = G.W, H = G.H;
  const $ = id => document.getElementById(id);
  const canvas = $('stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  G.setCtx(ctx);

  const qs = new URLSearchParams(location.search);
  const S = {
    t: 0, playing: false, src: 'demo', rec: null, recDest: null,
    sheet: false, prev: 0, lastBeat: -999, scrubbing: false,
    still: qs.has('t'), sheetTimes: null
  };

  const setStatus = s => { const el = $('status'); if (el) el.textContent = s; };
  let _toastT = 0;
  function toast(msg) {
    const el = $('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(_toastT); _toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function dl(url, name) {
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function num(id, d) { const el = $(id); const v = el ? parseFloat(el.value) : NaN; return isFinite(v) ? v : d; }

  // ---------------- 时间与重排 ----------------
  function retime(rebuild) {
    G.T.bpm = Math.max(30, Math.min(300, num('bpm', 100)));
    G.T.off = num('off', 0);
    G.T.len = Math.max(0.25, num('bars', 20));
    G.T.dur = G.barT(G.T.len);
    const sc = $('scrub'); if (sc) { sc.max = G.T.dur.toFixed(2); sc.step = 0.01; }
    if (S.t > G.T.dur) S.t = 0;
    if (rebuild) buildDemo();
    updateTime();
  }
  async function buildDemo() {
    if (S.src !== 'demo') return;
    setStatus('正在合成示范音轨…');
    try {
      await G.Audio.makeDemo(G.T.dur, G.T.len, G.T.bpm);
      setStatus('示范音轨就绪 · ' + G.T.dur.toFixed(1) + 's @ ' + G.T.bpm + ' BPM');
    } catch (e) {
      setStatus('示范音轨合成失败：' + (e && e.message ? e.message : e));
    }
    if (S.playing) { S.t = 0; G.Audio.play(0); }
  }
  function updateTime() {
    const el = $('time');
    if (el) el.textContent = S.t.toFixed(2) + ' / ' + G.T.dur.toFixed(2) + ' s';
    const sc = $('scrub'); if (sc && !S.scrubbing) sc.value = S.t.toFixed(2);
  }

  // ---------------- 播放控制 ----------------
  function setPlaying(p) {
    S.playing = p;
    if (p) {
      if (S.src !== 'mute') G.Audio.play(S.t);
      S.lastBeat = G.beatN(S.t) - 1;
    } else {
      G.Audio.pause(S.t);
    }
    S.prev = 0;
    const b = $('play'); if (b) b.textContent = p ? '❚❚ 暂停' : '▶ 播放';
  }
  function seek(t) {
    S.t = Math.max(0, Math.min(G.T.dur - 0.0005, t));
    if (S.playing && S.src !== 'mute') G.Audio.play(S.t); else G.Audio.pause(S.t);
    S.lastBeat = G.beatN(S.t) - 1;
    updateTime();
  }
  function tickClick() {
    if (!G.Audio.clickEnabled()) { S.lastBeat = G.beatN(S.t); return; }
    const b = G.beatN(S.t);
    if (b !== S.lastBeat) {
      S.lastBeat = b;
      G.Audio.click((((b % 4) + 4) % 4) === 0);
    }
  }

  // ---------------- 绘制 ----------------
  function drawWorldAt(t) { G.drawWorld(t); }
  function drawSheetOnMain(times, cols) {
    cols = cols || 4;
    const cellW = W / cols, cellH = cellW * H / W;
    ctx.save();
    ctx.fillStyle = '#0d0f1c'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < times.length; i++) {
      const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, cellW, cellH); ctx.clip();
      ctx.translate(cx, cy); ctx.scale(cellW / W, cellH / H);
      G.drawWorld(times[i]);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx + 8, cy + 8, 150, 40);
      ctx.fillStyle = '#fff'; ctx.font = '26px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(times[i].toFixed(2) + 's', cx + 16, cy + 16);
    }
    ctx.restore();
  }
  function frame(t) {
    if (S.sheet && S.sheetTimes) drawSheetOnMain(S.sheetTimes, 4);
    else drawWorldAt(t);
  }

  // ---------------- 主循环 ----------------
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = S.prev ? Math.min(0.1, (ts - S.prev) / 1000) : 0;
    S.prev = ts;
    if (S.playing && !S.sheet) {
      if (!S.scrubbing) {
        if (S.src !== 'mute' && G.Audio.isPlaying()) S.t = G.Audio.time();
        else S.t += dt;
      }
      if (S.t >= G.T.dur) {
        if (S.rec) { S.t = G.T.dur - 0.001; stopRec(); setPlaying(false); }
        else { S.t = 0; if (S.src !== 'mute') G.Audio.play(0); }
      }
      tickClick(); updateTime();
    }
    frame(S.t);
  }

  // ---------------- 录制 ----------------
  function startRec() {
    if (!canvas.captureStream) { toast('此浏览器不支持 canvas 录制'); return; }
    if (!window.MediaRecorder) { toast('此浏览器不支持 MediaRecorder'); return; }
    const stream = canvas.captureStream(30);
    const ac = G.Audio.ctx();
    if (S.src !== 'mute' && ac && G.Audio.buffer()) {
      try {
        const dest = ac.createMediaStreamDestination();
        G.Audio.connectCapture(dest);
        S.recDest = dest;
        dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
      } catch (e) { }
    }
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mt = types.filter(t => MediaRecorder.isTypeSupported(t))[0] || '';
    const chunks = [];
    const rec = mt ? new MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: 12000000 }) : new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      const blob = new Blob(chunks, { type: mt || 'video/webm' });
      const url = URL.createObjectURL(blob);
      dl(url, 'WhaleAnimationBase.webm');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      G.Audio.disconnectCapture();
      S.recDest = null; S.rec = null;
      const b = $('rec'); if (b) b.classList.remove('on');
      toast('录制完成，已下载 WebM（' + (blob.size / 1048576).toFixed(1) + ' MB）');
    };
    rec.start();
    S.rec = rec;
    const b = $('rec'); if (b) b.classList.add('on');
    S.sheet = false;
    seek(0); setPlaying(true);
    toast('录制中… 再按一次结束');
  }
  function stopRec() { if (S.rec && S.rec.state !== 'inactive') S.rec.stop(); }

  // ---------------- 导出 ----------------
  function exportFrame() {
    const wasSheet = S.sheet; S.sheet = false;
    G.drawWorld(S.t);
    dl(canvas.toDataURL('image/png'), 'whale_t' + S.t.toFixed(2).replace('.', '_') + '.png');
    S.sheet = wasSheet;
    toast('已导出当前帧 PNG');
  }
  function toggleSheet() {
    if (S.sheet) { S.sheet = false; S.sheetTimes = null; const b = $('sheet'); if (b) b.classList.remove('on'); toast('已退出联络表'); return; }
    const times = [];
    for (let b = 0; b < G.T.len; b += 2) times.push(G.barT(b));
    times.push(G.T.dur - 0.05);
    S.sheetTimes = times; S.sheet = true;
    const b = $('sheet'); if (b) b.classList.add('on');
    toast('联络表：' + times.length + ' 帧 · 再按一次退出');
  }

  // ---------------- 绑定 ----------------
  function bind() {
    $('play').onclick = () => setPlaying(!S.playing);
    $('restart').onclick = () => { seek(0); if (!S.playing) setPlaying(true); };
    const sc = $('scrub');
    sc.addEventListener('input', () => { S.scrubbing = true; S.t = parseFloat(sc.value); if (S.playing) G.Audio.pause(S.t); updateTime(); });
    sc.addEventListener('change', () => { S.scrubbing = false; seek(parseFloat(sc.value)); });

    $('srcDemo').onclick = async () => {
      S.src = 'demo'; markSrc('srcDemo');
      if (!G.Audio.buffer() || !G.Audio.info()) await buildDemo();
      setStatus('使用内置示范音轨');
      seek(S.t);
    };
    $('srcMute').onclick = () => {
      S.src = 'mute'; markSrc('srcMute');
      G.Audio.pause(S.t); setStatus('静音播放（可开节拍器找拍点）');
    };
    $('file').onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      setStatus('正在解码 ' + f.name + ' …');
      try {
        const buf = await G.Audio.loadFile(f);
        S.src = 'file'; markSrc('file2');
        $('srcDemo').classList.remove('on'); $('srcMute').classList.remove('on');
        G.T.dur = buf.duration;
        G.T.len = Math.max(1, Math.round(G.T.dur / G.bar()));
        if ($('bars')) $('bars').value = G.T.len.toFixed(1);
        $('scrub').max = G.T.dur.toFixed(2);
        setStatus('已载入《' + f.name + '》 ' + G.T.dur.toFixed(1) + 's · 自动按 ' + G.T.bpm + ' BPM 对齐 ' + G.T.len.toFixed(1) + ' 小节');
        S.t = 0; if (S.playing) G.Audio.play(0);
        updateTime();
      } catch (err) { setStatus('解码失败：' + err.message); }
    };
    function markSrc(active) {
      ['srcDemo', 'srcMute'].forEach(id => { const el = $(id); if (el) el.classList.toggle('on', id === active); });
    }
    $('rebuild').onclick = async () => { retime(false); await buildDemo(); seek(Math.min(S.t, G.T.dur - 0.01)); toast('已按 ' + G.T.bpm + ' BPM 重新对齐'); };
    $('bpm').onchange = () => retime(true);
    $('off').onchange = () => retime(false);
    $('bars').onchange = () => retime(true);
    $('vol').oninput = () => G.Audio.setVolume(parseFloat($('vol').value));
    $('click').onclick = () => { const on = !G.Audio.clickEnabled(); G.Audio.setClick(on); $('click').classList.toggle('on', on); };
    $('cap').onclick = () => { G.CONFIG.captions = !G.CONFIG.captions; $('cap').classList.toggle('on', G.CONFIG.captions); };
    $('grain').onclick = () => { G.CONFIG.grain = !G.CONFIG.grain; $('grain').classList.toggle('on', G.CONFIG.grain); };
    $('vig').onclick = () => { G.CONFIG.vignette = !G.CONFIG.vignette; $('vig').classList.toggle('on', G.CONFIG.vignette); };
    $('png').onclick = exportFrame;
    $('sheet').onclick = toggleSheet;
    $('rec').onclick = () => { if (S.rec) stopRec(); else startRec(); };
    $('wav').onclick = () => { if (!G.Audio.buffer()) { toast('还没有可导出的音轨'); return; } G.Audio.exportWav('WhaleAnimationBase-demo-' + G.T.bpm + 'bpm.wav'); toast('已导出 WAV'); };

    window.addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); setPlaying(!S.playing); }
      else if (k === 'ArrowRight') seek(S.t + (e.shiftKey ? 5 : 1));
      else if (k === 'ArrowLeft') seek(S.t - (e.shiftKey ? 5 : 1));
      else if (k === 'r' || k === 'R') { seek(0); }
      else if (k === 'p' || k === 'P') exportFrame();
      else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
    });
  }

  // ---------------- 离线渲染接口（给 render.mjs 用）----------------
  window.renderAt = function (t, type, q) {
    S.sheet = false;
    G.drawWorld(t);
    return canvas.toDataURL(type || 'image/png', q == null ? 0.92 : q);
  };
  window.renderSheet = function (times, cols, cellW) {
    cols = cols || 3; cellW = cellW || 640;
    const cellH = cellW * H / W, rows = Math.ceil(times.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * cellW; c.height = rows * cellH;
    const x = c.getContext('2d');
    const back = G.getCtx(); G.setCtx(x);
    x.fillStyle = '#0d0f1c'; x.fillRect(0, 0, c.width, c.height);
    const ms = [];
    for (let i = 0; i < times.length; i++) {
      const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
      const t0 = Date.now();
      x.save(); x.beginPath(); x.rect(cx, cy, cellW, cellH); x.clip();
      x.translate(cx, cy); x.scale(cellW / W, cellH / H);
      G.drawWorld(times[i]);
      x.restore();
      ms.push(Date.now() - t0);
    }
    G.setCtx(back);
    return { url: c.toDataURL('image/jpeg', 0.82), ms: ms };
  };

  // ---------------- 角色标准姿势表 ----------------
  // 3 行 × 2 列：上色阶段（铅笔稿 / 半上色 / 完成稿）× 表情姿势。
  // 同一个 drawRig 同时供页面调试模式（?rig=1）与 render.mjs --rig 使用，
  // 改完 char.js 直接出图对照，不用反复手动截图。
  const RIG_SCALE = 1.40, RIG_DX = 54, RIG_DY = 8;
  const RIG = [
    { label: 'paint 0 · 铅笔稿',           o: { sketch: 1, paint: 0 } },
    { label: 'paint 0.5 · 半上色',         o: { sketch: 0.5, paint: 0.5 } },
    { label: 'paint 1 · 完成稿',           o: { paint: 1 } },
    { label: 'paint 1 · 地面投影',         o: { paint: 1, ground: 1 } },
    { label: 'happy · 喷水',               o: { paint: 1, mood: 'happy', spout: 1 } },
    { label: 'dir -1 · wow',               o: { paint: 1, dir: -1, mood: 'wow' } },
  ];
  function drawRig(x, t) {
    const cellW = W / 2, cellH = H / 3;
    x.save();
    x.fillStyle = G.PAL.paper; x.fillRect(0, 0, W, H);
    x.textAlign = 'left'; x.textBaseline = 'top';
    for (let i = 0; i < RIG.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const ox = col * cellW, oy = row * cellH;
      x.save();
      x.beginPath(); x.rect(ox, oy, cellW, cellH); x.clip();
      x.translate(ox + cellW / 2, oy + cellH / 2);
      G.setCtx(x);
      G.whale(t, RIG_DX, RIG_DY, RIG_SCALE, RIG[i].o);
      x.restore();
      x.strokeStyle = 'rgba(26,32,51,.16)'; x.lineWidth = 1;
      x.strokeRect(ox + .5, oy + .5, cellW - 1, cellH - 1);
      x.fillStyle = 'rgba(26,32,51,.55)'; x.font = '20px monospace';
      x.fillText(RIG[i].label, ox + 18, oy + 16);
    }
    x.restore();
  }
  window.renderRig = function (opts) {
    opts = opts || {};
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { alpha: false });
    const back = G.getCtx(); G.setCtx(x);
    drawRig(x, opts.t == null ? 0 : opts.t);
    G.setCtx(back);
    return { url: c.toDataURL('image/jpeg', 0.88) };
  };

  // ---------------- 启动 ----------------
  async function boot() {
    if (window.__errs && window.__errs.length) setStatus('JS 错误：' + window.__errs.join(' | '));
    if (qs.has('bare')) document.body.classList.add('bare');
    retime(false);
    bind();
    setStatus('正在准备…');
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { }
    if (qs.has('rig')) {
      const rt = parseFloat(qs.get('t')) || 0;
      drawRig(ctx, rt);
      setStatus('rig 调试模式 · 角色标准姿势表');
      window.ready = true; return;
    }
    if (qs.has('render')) {
      G.drawWorld(0);
      setStatus('离线渲染模式（不合成音轨）');
      window.ready = true; return;
    }
    if (S.still) {
      const t = parseFloat(qs.get('t')) || 0;
      S.t = t; G.drawWorld(t); setStatus('静帧模式 t=' + t.toFixed(2) + 's');
      const b = $('play'); if (b) b.textContent = '▶ 播放';
    } else {
      await buildDemo();
      if (location.protocol !== 'file:') {
        try {
          await G.Audio.loadUrl(qs.get('bgm') || 'assets/bgm-45s.m4a');
          S.src = 'file';
          const bd = $('srcDemo'); if (bd) bd.classList.remove('on');
          const bm = $('srcMute'); if (bm) bm.classList.remove('on');
          setStatus('已载入本地 BGM assets/bgm-45s.m4a · ' + Math.round(G.T.bpm) + ' BPM');
        } catch (e) { }
      }
      // 预热一帧
      G.drawWorld(0);
      G.Audio.setVolume(num('vol', 0.85));
      requestAnimationFrame(loop);
    }
    if (qs.has('sheetauto')) {
      const times = qs.get('sheetauto').split(',').map(Number).filter(v => isFinite(v));
      const r = window.renderSheet(times, 3, 640);
      window.__sheetUrl = r.url;
    }
    window.ready = true;
  }
  boot();
})(window.DSG);
