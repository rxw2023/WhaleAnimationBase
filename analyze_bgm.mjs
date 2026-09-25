// analyze_bgm.mjs — 零依赖 BGM 分析器：测 BPM、拍点相位、段落结构，并推荐配片区间
//
//   node analyze_bgm.mjs assets/bgm.mp3
//   node analyze_bgm.mjs assets/bgm.mp3 --target=45     想要多长的片子
//
// 原理：ffmpeg 解码成单声道 PCM → 逐帧对数能量的正向差分（onset 强度）
//      → 自相关求周期（BPM）→ 用 onset 打分的相位搜索求第一个拍点
//      → 再用 RMS 包络找段落边界（副歌/掉拍），据此推荐起点。
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) || 'assets/bgm.mp3';
const TARGET = Number((args.find(a => a.startsWith('--target=')) || '').split('=')[1]) || 45;
const SR = 22050, HOP = 256, WIN = 1024;
const FR = SR / HOP;                        // 帧率 ≈ 86.13 fps

const tmp = join(ROOT, 'out', '.analyze.pcm');
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(ROOT, file),
  '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-acodec', 'pcm_f32le', tmp], { stdio: 'inherit' });
const buf = readFileSync(tmp);
unlinkSync(tmp);
const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
const dur = x.length / SR;
console.log('文件: ' + file + '   时长: ' + dur.toFixed(2) + ' s   (' + x.length + ' 采样)');

// ---------- 1) onset 强度曲线 ----------
const F = Math.floor((x.length - WIN) / HOP);
const logE = new Float32Array(F);
for (let f = 0; f < F; f++) {
  let e = 0; const o = f * HOP;
  for (let i = 0; i < WIN; i++) { const v = x[o + i]; e += v * v; }
  logE[f] = Math.log(e + 1e-9);
}
const on = new Float32Array(F);
for (let f = 1; f < F; f++) on[f] = Math.max(0, logE[f] - logE[f - 1]);
// 去掉局部均值（抑制长音）
const MW = Math.round(FR * 0.4), on2 = new Float32Array(F);
for (let f = 0; f < F; f++) {
  let s = 0, n = 0;
  for (let k = Math.max(0, f - MW); k <= Math.min(F - 1, f + MW); k++) { s += on[k]; n++; }
  on2[f] = Math.max(0, on[f] - s / n);
}
let mx = 0; for (let f = 0; f < F; f++) if (on2[f] > mx) mx = on2[f];
for (let f = 0; f < F; f++) on2[f] /= (mx || 1);

// ---------- 2) 自相关求 BPM ----------
const lagMin = Math.round(FR * 60 / 200), lagMax = Math.round(FR * 60 / 60);
const ac = [];
for (let lag = lagMin; lag <= lagMax; lag++) {
  let s = 0, n = 0;
  for (let f = 0; f + lag < F; f++) { s += on2[f] * on2[f + lag]; n++; }
  ac.push({ lag, v: s / n });
}
const mean = ac.reduce((a, b) => a + b.v, 0) / ac.length;
ac.forEach(a => a.v -= mean);
const sorted = [...ac].sort((a, b) => b.v - a.v).slice(0, 12);
console.log('\n--- 自相关候选（BPM）---');
sorted.slice(0, 8).forEach(a => console.log('  ' + (FR * 60 / a.lag).toFixed(1) + ' BPM   (lag ' + a.lag + ' 帧)   score ' + a.v.toExponential(3)));

// ---------- 3) BPM × 相位 联合精修（比整数 lag 精确得多）----------
const coarse = sorted.filter(a => { const b = FR * 60 / a.lag; return b >= 85 && b <= 132; })[0] || sorted[0];
const cBPM = FR * 60 / coarse.lag;
const sample = f => { const i = Math.floor(f), t = f - i; return (i + 1 < F) ? on2[i] * (1 - t) + on2[i + 1] * t : on2[i] || 0; };
const top = [];
let best = { sc: -1, bpm: cBPM, ph: 0 };
for (let bpm = Math.max(70, cBPM - 8); bpm <= Math.min(160, cBPM + 8); bpm += 0.01) {
  const Pf = 60 / bpm * FR;
  for (let ph = 0; ph < Pf; ph += 0.5) {
    let s = 0, n = 0;
    for (let f = ph; f < F; f += Pf) { s += sample(f); n++; }
    const sc = s / n;
    top.push({ sc, bpm, ph });
    if (sc > best.sc) best = { sc, bpm, ph };
  }
}
top.sort((a, b) => b.sc - a.sc);
console.log('  top3: ' + top.slice(0, 3).map(x => x.bpm.toFixed(2) + '@' + (x.ph / FR).toFixed(3) + 's(' + x.sc.toExponential(2) + ')').join('  '));
const BPM = best.bpm, beat = 60 / BPM;
const P = beat * FR;
const offSec = best.ph / FR;
console.log('\n联合精修: ' + BPM.toFixed(3) + ' BPM   拟合分 ' + best.sc.toExponential(3));
// 小节相位（4/4）：找哪一拍是重拍
let bo = 0, bs = -1;
for (let k = 0; k < 4; k++) {
  let s = 0, n = 0;
  for (let j = k; ; j += 4) { const f = best.ph + j * P; if (f >= F) break; s += sample(f); n++; }
  if (s / n > bs) { bs = s / n; bo = k; }
}
const barOffset = (best.ph + bo * P) / FR;
console.log('第一个拍点: ' + offSec.toFixed(3) + ' s   → index.html 偏移 = ' + offSec.toFixed(3));
console.log('小节重拍  : ' + barOffset.toFixed(3) + ' s   (每小节 ' + (beat * 4).toFixed(3) + ' s)');
console.log('→ index.html:  BPM = ' + BPM.toFixed(2));

// ---------- 4) RMS 包络 + 段落边界 ----------
const SEC = 0.5, sn = Math.floor(dur / SEC);
const rms = new Float32Array(sn);
for (let s = 0; s < sn; s++) {
  const a = s * SEC * SR, b = Math.min(x.length, (s + 1) * SEC * SR);
  let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i];
  rms[s] = Math.sqrt(e / Math.max(1, b - a));
}
let rm = 0; for (let s = 0; s < sn; s++) if (rms[s] > rm) rm = rms[s];
for (let s = 0; s < sn; s++) rms[s] /= rm;
// 每 4 秒一个格子画条形图
console.log('\n--- 响度结构（每格 4s，块高=响度）---');
const CH = ' .:-=+*#%@';
let line = '';
for (let s = 0; s < sn; s++) {
  let m = 0; for (let k = s; k < Math.min(sn, s + 8); k++) m = Math.max(m, rms[k]);
  line += CH[Math.min(9, Math.floor(m * 10))];
  if ((s + 1) % 8 === 0) { console.log('  ' + ((s - 7) * SEC).toFixed(0).padStart(4) + 's |' + line + '|'); line = ''; }
}
if (line) console.log('  ' + ((sn - line.length) * SEC).toFixed(0).padStart(4) + 's |' + line + '|');
// 段落边界：响度跳升 > 0.18 的位置
const marks = [];
for (let s = 4; s < sn - 4; s++) {
  const before = (rms[s - 4] + rms[s - 3] + rms[s - 2] + rms[s - 1]) / 4;
  const after = (rms[s] + rms[s + 1] + rms[s + 2] + rms[s + 3]) / 4;
  if (after - before > 0.18) marks.push({ t: s * SEC, jump: after - before });
}
marks.sort((a, b) => b.jump - a.jump);
console.log('\n--- 候选起点（响度明显跳升 = 掉拍 / 副歌）---');
marks.slice(0, 8).forEach(m => {
  const b = Math.round((m.t - offSec) / beat);
  console.log('  ' + m.t.toFixed(1) + 's   跳升 ' + m.jump.toFixed(2) + '   对到第 ' + b + ' 拍');
});

// ---------- 5) 推荐配片区间 ----------
const cand = marks.slice(0, 6).map(m => m.t).filter(t => t + TARGET <= dur);
let pick = cand[0];
for (const c of cand) if (c >= 25 && c <= 70) { pick = c; break; }
if (pick == null) pick = Math.max(0, Math.min(dur - TARGET, 30));
// 对齐到最近的小节线
const aligned = Math.max(0, barOffset + Math.round((pick - barOffset) / (beat * 4)) * beat * 4);
console.log('\n=== 推荐 ===');
console.log('从 ' + aligned.toFixed(3) + 's 开始，取 ' + TARGET + 's（到 ' + (aligned + TARGET).toFixed(2) + 's）');
console.log('ffmpeg 音频参数:  -ss ' + aligned.toFixed(3));
console.log('index.html:      BPM = ' + BPM.toFixed(2) + '   偏移 = 0（因为已经从拍点切了）');
console.log('\n可用片段:');
for (const c of cand) console.log('   ' + c.toFixed(1) + 's → ' + (c + TARGET).toFixed(1) + 's');
