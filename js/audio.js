// audio.js — 音频引擎：内置示范 BGM（离线合成，随 BPM 自动对齐）、外部 BGM 载入、节拍器、导出 WAV
(function (G) {
  'use strict';
  const A = G.Audio = {};

  let ac = null, master = null, space = null, buf = null, src = null;
  let playing = false, startedAt = 0, pausedT = 0, clickOn = false, vol = 0.85, demoInfo = null;

  A.ensure = function () {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
      space = ac.createDelay(1.0);
      space.delayTime.value = 0.32;
      const fb = ac.createGain(); fb.gain.value = 0.26;
      space.connect(fb); fb.connect(space);
      space.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  A.ctx = () => ac;
  A.hasBuffer = () => !!buf;
  A.buffer = () => buf;
  A.info = () => demoInfo;

  A.setVolume = function (v) { vol = v; if (master) master.gain.value = v; };
  A.getVolume = () => vol;
  A.setClick = b => { clickOn = !!b; };
  A.clickEnabled = () => clickOn;

  // ---------- 小合成器基元 ----------
  function tone(ctx, dest, type, freq, t0, dur, g, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, t0);
    gg.gain.linearRampToValueAtTime(g, t0 + 0.010);
    gg.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.05, dur));
    o.connect(gg); gg.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.06);
  }
  let _noise = null;
  function noiseBuf(ctx) {
    if (_noise) return _noise;
    const n = Math.floor(ctx.sampleRate * 1.2), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    _noise = b; return b;
  }
  function hat(ctx, dest, t0, g) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7200;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(g, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
    s.connect(f); f.connect(gg); gg.connect(dest); s.start(t0); s.stop(t0 + 0.09);
  }
  function kick(ctx, dest, t0, g) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(44, t0 + 0.13);
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(g, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
    o.connect(gg); gg.connect(dest); o.start(t0); o.stop(t0 + 0.34);
  }
  function pad(ctx, dest, room, freq, t0, dur, g) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(700, t0);
    f.frequency.linearRampToValueAtTime(1500, t0 + dur * .5);
    f.frequency.linearRampToValueAtTime(600, t0 + dur);
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, t0);
    gg.gain.linearRampToValueAtTime(g, t0 + dur * .25);
    gg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    f.connect(gg); gg.connect(dest); if (room) gg.connect(room);
    tone(ctx, f, 'sawtooth', freq, t0, dur, 0.5, -7);
    tone(ctx, f, 'sawtooth', freq * 2, t0, dur, 0.22, 9);
  }

  // ---------- 内置示范 BGM ----------
  // A 小调五声：Am - F - C - G。段落动态与画面章节对齐。
  const ROOTS = [110.00, 87.31, 130.81, 98.00];
  const ARP = [440.00, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25];
  A.buildDemo = function (dur, bars, bpm) {
    const ctx = A.ensure();
    const sr = ctx.sampleRate, len = Math.ceil((dur + 1.2) * sr);
    const off = new OfflineAudioContext(2, len, sr);
    const out = off.createGain(); out.gain.value = 0.9;
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 3.2;
    out.connect(comp); comp.connect(off.destination);
    const room = off.createDelay(1.0); room.delayTime.value = 60 / bpm * 0.75;
    const rfb = off.createGain(); rfb.gain.value = 0.24;
    room.connect(rfb); rfb.connect(room); room.connect(out);
    const B = 60 / bpm, BAR = 4 * B;
    // 段落：0–1 前奏 / 2–4 铺底 / 5–7 完整 / 8–10 留白 / 11–13 推进 / 14–16 副歌 / 17–18 收 / 19 尾
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * BAR, sec = bar <= 1 ? 'intro' : bar <= 4 ? 'add' : bar <= 7 ? 'full' : bar <= 10 ? 'break' : bar <= 13 ? 'build' : bar <= 16 ? 'chorus' : bar <= 18 ? 'soft' : 'end';
      const root = ROOTS[bar % 4];
      // Pad
      if (sec !== 'end') pad(off, out, room, root, t0, BAR * 1.02, sec === 'chorus' ? 0.075 : 0.055);
      // Bass
      if (sec === 'add' || sec === 'full' || sec === 'build' || sec === 'chorus') {
        tone(off, out, 'triangle', root, t0, B * 1.6, 0.30);
        tone(off, out, 'triangle', root, t0 + B * 2, B * 1.6, 0.26);
        if (sec === 'chorus') { tone(off, out, 'triangle', root * 2, t0 + B * 3, B * .7, 0.16); }
      }
      // Arp
      const density = sec === 'intro' ? 2 : sec === 'break' ? 4 : sec === 'chorus' ? 8 : 8;
      for (let i = 0; i < density; i++) {
        const tt = t0 + i * (BAR / density);
        if (sec === 'break' && i % 2) continue;
        const n = ARP[(i + bar * 3) % ARP.length] * (sec === 'chorus' && i % 4 === 3 ? 2 : 1);
        tone(off, out, 'sine', n, tt, BAR / density * 0.85, sec === 'chorus' ? 0.135 : 0.10);
        if (sec === 'chorus') tone(off, room, 'sine', n * 2, tt, 0.28, 0.09);
      }
      // 鼓
      if (sec === 'add' || sec === 'full' || sec === 'build' || sec === 'chorus' || sec === 'soft') {
        kick(off, out, t0, 0.72); kick(off, out, t0 + B * 2, 0.66);
        if (sec === 'chorus' || sec === 'build') { kick(off, out, t0 + B * 3.5, 0.5); }
        for (let i = 0; i < 8; i++) { if (sec === 'soft' && i % 2) continue; hat(off, out, t0 + i * B / 2, i % 2 ? 0.10 : 0.16); }
      }
      // 副歌主旋律
      if (sec === 'chorus' && bar >= 14) {
        const mel = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440];
        for (let i = 0; i < 8; i++) tone(off, room, 'triangle', mel[(i + bar) % mel.length], t0 + i * B / 2, B * .55, 0.13);
      }
      if (sec === 'end') tone(off, out, 'sine', 440, t0, BAR * 0.9, 0.16);
    }
    return off.startRendering();
  };

  A.makeDemo = async function (dur, bars, bpm) {
    A.ensure();
    buf = await A.buildDemo(dur, bars, bpm);
    demoInfo = { dur: dur, bars: bars, bpm: bpm };
    return buf;
  };

  // ---------- 外部 BGM ----------
  A.loadFile = async function (file) {
    const ctx = A.ensure();
    const ab = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab.slice(0));
    buf = decoded; demoInfo = null;
    return decoded;
  };
  A.loadUrl = async function (url) {
    const ctx = A.ensure();
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    buf = await ctx.decodeAudioData(ab);
    demoInfo = null;
    return buf;
  };

  // ---------- 播放 ----------
  A.play = function (at) {
    A.ensure();
    if (!buf) return false;
    A.stop();
    src = ac.createBufferSource(); src.buffer = buf; src.connect(master); src.connect(space);
    const offset = Math.max(0, Math.min(at, buf.duration - 0.01));
    src.start(0, offset);
    startedAt = ac.currentTime - offset;
    playing = true; pausedT = at;
    return true;
  };
  A.stop = function () { if (src) { try { src.stop(); } catch (e) { } src.disconnect(); src = null; } playing = false; };
  A.pause = function (t) { pausedT = t; A.stop(); };
  A.isPlaying = () => playing;
  // 用音频时钟做基准，画面永远不会跑偏
  A.time = function () { return playing && ac ? (ac.currentTime - startedAt) : pausedT; };

  // ---------- 节拍器 ----------
  A.click = function (accent) {
    if (!clickOn) return;
    const ctx = A.ensure();
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = accent ? 1760 : 1180;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(accent ? 0.16 : 0.09, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.1);
  };

  // ---------- 供 MediaRecorder 抓取音频 ----------
  let _cap = null;
  A.connectCapture = function (dest) { A.ensure(); if (master) { master.connect(dest); _cap = dest; } };
  A.disconnectCapture = function () { if (master && _cap) { try { master.disconnect(_cap); } catch (e) { } } _cap = null; };

  // ---------- 导出示范音轨为 WAV ----------
  A.wavArrayBuffer = function () {
    if (!buf) return null;
    const n = buf.length, ch = Math.min(2, buf.numberOfChannels);
    const bytes = 44 + n * ch * 2;
    const ab = new ArrayBuffer(bytes), v = new DataView(ab);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wr(8, 'WAVE'); wr(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true);
    v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); wr(36, 'data');
    v.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
      let x = Math.max(-1, Math.min(1, chans[c][i]));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7FFF, true); o += 2;
    }
    return ab;
  };
  A.wavBase64 = function () {
    const ab = A.wavArrayBuffer(); if (!ab) return null;
    const bytes = new Uint8Array(ab);
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };
  A.exportWav = function (name) {
    const ab = A.wavArrayBuffer(); if (!ab) return;
    const blob = new Blob([ab], { type: 'audio/wav' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name || 'whale-odyssey-demo.wav';
    a.click();
  };
})(window.DSG);
