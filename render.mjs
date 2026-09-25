#!/usr/bin/env node
// render.mjs — 离线逐帧渲染 + ffmpeg 编码（零依赖：Node 内置 fetch / WebSocket 直连 Chrome DevTools Protocol）
//
//   node render.mjs --stills=0.5,6,30 --out=out/stills        导出若干全分辨率 PNG 静帧
//   node render.mjs --sheet=0,6,12,24,36,47 --cols=3 --w=520 --out=out/sheet.jpg   联络表（快速审片）
//   node render.mjs --frames=0:48 --fps=24 --out=out/frames --workers=4            逐帧 JPEG（可断点续传）
//   node render.mjs --encode --fps=24 --audio=assets/bgm.mp3 --out=out/whale.mp4   用 ffmpeg 合成 MP4
//   node render.mjs --clip=0:8 --fps=24 --audio=assets/bgm.mp3 --out=out/clip.mp4  只渲一小段并直接出片
//
// 需要：本机装了 Chrome（或用 --chrome=<路径>），出 MP4 时需要 ffmpeg。

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v];
}));
const num = (v, d) => (v === undefined ? d : Number(v));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CHROME = args.chrome || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => existsSync(p));
if (!CHROME) { console.error('找不到 Chrome，请用 --chrome=<路径> 指定'); process.exit(1); }

const PAGE = pathToFileURL(resolve(ROOT, 'index.html')).href;
const FPS = num(args.fps, 24);

// 清掉上次运行残留的临时 Chrome 配置目录（Chrome 被杀后不一定能立刻删，所以放到下次启动时清）
try {
  const od = join(ROOT, 'out');
  if (existsSync(od)) for (const d of readdirSync(od)) {
    if (d.startsWith('.chrome-')) { try { rmSync(join(od, d), { recursive: true, force: true }); } catch (e) { } }
  }
} catch (e) { }

// ---------------- 最小 CDP 客户端 ----------------
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.wait = new Map(); }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = e => bad(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.wait.has(m.id)) { const { ok, bad } = c.wait.get(m.id); c.wait.delete(m.id); m.error ? bad(new Error(m.error.message)) : ok(m.result); }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((ok, bad) => { this.wait.set(id, { ok, bad }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : 'eval error');
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) { } }
}

const spawned = [];
let _seq = 0;
// 用 --remote-debugging-port=0，让 Chrome 自己挑一个空闲端口并写进 DevToolsActivePort，
// 这样多个工作页并行时不会抢端口。
async function openPageOnce(tag = '', query = '?render=1&bare=1') {
  const prof = join(ROOT, 'out', '.chrome-' + (++_seq));
  mkdirSync(prof, { recursive: true });
  const extra = args.soft ? ['--disable-gpu'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  const child = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
    '--window-size=1920,1080', '--allow-file-access-from-files',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    ...extra, '--remote-debugging-port=0', '--user-data-dir=' + prof,
    PAGE + query,
  ], { stdio: 'ignore' });
  spawned.push(child);
  const portFile = join(prof, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 250 && !port; i++) {
    await sleep(120);
    try { port = parseInt(readFileSync(portFile, 'utf8').split('\n')[0], 10) || 0; } catch (e) { }
  }
  if (!port) throw new Error('Chrome 没有写出 DevToolsActivePort');
  let wsUrl = null;
  for (let i = 0; i < 150 && !wsUrl; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) wsUrl = t.webSocketDebuggerUrl;
    } catch (e) { }
    if (!wsUrl) await sleep(150);
  }
  if (!wsUrl) throw new Error('无法连接 Chrome 调试端口 ' + port);
  const c = await CDP.connect(wsUrl);
  for (let i = 0; i < 300; i++) {
    try { if (await c.eval('window.ready === true')) return c; } catch (e) { }
    await sleep(200);
  }
  throw new Error('页面没有 ready');
}
// 连续多次启动 Chrome 偶尔会抢不到调试端口，这里自动重试
async function openPage(tag = '', query = '?render=1&bare=1') {
  let last;
  for (let a = 0; a < 3; a++) {
    try { return await openPageOnce(tag, query); }
    catch (e) { last = e; await sleep(900); }
  }
  throw last;
}
function shutdown() { for (const c of spawned) { try { c.kill(); } catch (e) { } } }

const framePath = (dir, i) => join(dir, 'f' + String(i).padStart(5, '0') + '.jpg');
const b64 = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' 退出码 ' + c)) : ok()); });

// ---------------- 命令 ----------------
const mode = args.encode ? 'encode' : args.sheet ? 'sheet' : args.stills ? 'stills' : args.clip ? 'clip' : args.frames ? 'frames' : args.dumpdemo ? 'dumpdemo' : args.selftest ? 'selftest' : 'help';

if (mode === 'help') {
  console.log('用法见本文件顶部注释。至少给一个：--stills= --sheet= --frames=0:48 --clip=0:8 --encode');
  process.exit(0);
}

if (mode === 'encode') {
  const dir = resolve(ROOT, args.dir || 'out/frames');
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.jpg')) : [];
  if (!files.length) { console.error('没有帧：' + dir); process.exit(1); }
  const out = resolve(ROOT, args.out || 'out/whale.mp4');
  mkdirSync(dirname(out), { recursive: true });
  const a = ['-y', '-loglevel', 'error', '-stats', '-framerate', String(FPS), '-i', join(dir, 'f%05d.jpg')];
  if (args.audio) {
    if (args['audio-offset']) a.push('-ss', String(args['audio-offset']));
    a.push('-i', resolve(ROOT, args.audio));
  }
  a.push('-map', '0:v'); if (args.audio) a.push('-map', '1:a');
  a.push('-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(num(args.crf, 17)), '-pix_fmt', 'yuv420p');
  if (args.audio) a.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  a.push('-movflags', '+faststart', out);
  console.log('编码 ' + files.length + ' 帧 → ' + out);
  await run('ffmpeg', a);
  console.log('完成 ' + out);
  process.exit(0);
}

if (mode === 'dumpdemo') {
  // 把页面里合成的示范音轨导出成 WAV，这样 --clip / --encode 就能带上声音
  const out = resolve(ROOT, String(args.dumpdemo));
  mkdirSync(dirname(out), { recursive: true });
  const c = await openPage('', '?bare=1');
  const b64 = await c.eval('window.DSG.Audio.wavBase64()');
  if (!b64) { console.error('没有可导出的音轨'); process.exit(1); }
  const bytes = Buffer.from(b64, 'base64');
  writeFileSync(out, bytes);
  console.log('示范音轨已导出 → ' + out + '  (' + (bytes.length / 1048576).toFixed(1) + ' MB)');
  c.close(); shutdown(); process.exit(0);
}

if (mode === 'selftest') {
  // 启动整页（会真正合成示范音轨），等 window.ready 后把状态文案读出来
  const c = await openPage('', '?bare=1');
  const st = await c.eval("document.getElementById('status').textContent");
  const dur = await c.eval("window.DSG ? window.DSG.T.dur : -1");
  const bt = await c.eval("window.DSG.Audio.buffer() ? window.DSG.Audio.buffer().duration : -1");
  const bl = await c.eval("window.DSG.Audio.buffer() ? window.DSG.Audio.buffer().length : -1");
  const shots = await c.eval("window.DSG.SHOTS_BARS.length");
  const errs = await c.eval("(window.__errs||[]).join(' | ')");
  console.log('shots: ' + shots + '   page errors: ' + (errs || '(none)'));
  console.log('status: ' + st);
  console.log('timeline: ' + dur + ' s    demo buffer: ' + bt + ' s / ' + bl + ' samples');
  c.close(); shutdown(); process.exit(0);
}

if (mode === 'stills') {
  const times = String(args.stills).split(',').map(Number).filter(v => isFinite(v));
  const dir = resolve(ROOT, args.out || 'out/stills');
  mkdirSync(dir, { recursive: true });
  const c = await openPage();
  console.log('GPU/页面就绪，导出 ' + times.length + ' 张静帧');
  for (const t of times) {
    const t0 = Date.now();
    const buf = b64(await c.eval('window.renderAt(' + t + ",'image/png')"));
    const f = join(dir, 't' + t.toFixed(2).replace('.', '_') + '.png');
    writeFileSync(f, buf);
    console.log('  ' + f + '  ' + (Date.now() - t0) + ' ms');
  }
  c.close(); shutdown(); process.exit(0);
}

if (mode === 'sheet') {
  const times = String(args.sheet).split(',').map(Number).filter(v => isFinite(v));
  const out = resolve(ROOT, args.out || 'out/sheet.jpg');
  mkdirSync(dirname(out), { recursive: true });
  const c = await openPage();
  const r = await c.eval('window.renderSheet(' + JSON.stringify(times) + ',' + num(args.cols, 3) + ',' + num(args.w, 520) + ')');
  writeFileSync(out, b64(r.url));
  console.log(out + '   每帧耗时(ms): ' + r.ms.join(' '));
  c.close(); shutdown(); process.exit(0);
}

async function paintRange(t0, t1, dir, workers) {
  const n = Math.max(1, Math.round((t1 - t0) * FPS));
  mkdirSync(dir, { recursive: true });
  const todo = [];
  for (let i = 0; i < n; i++) if (!existsSync(framePath(dir, i))) todo.push(i);
  console.log('共 ' + n + ' 帧，待渲染 ' + todo.length + ' 帧（' + workers + ' 个工作页）');
  let cursor = 0, done = 0;
  const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const c = await openPage('#' + w);
    for (;;) {
      const k = cursor++;
      if (k >= todo.length) break;
      const i = todo[k];
      const t = t0 + i / FPS;
      const url = await c.eval('window.renderAt(' + t.toFixed(5) + ",'image/jpeg',0.92)");
      writeFileSync(framePath(dir, i), b64(url));
      done++;
      if (done % 10 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log('  ' + done + '/' + todo.length + '  ' + (el / done).toFixed(2) + ' s/帧  预计剩余 ' + (((todo.length - done) * el / done) / 60).toFixed(1) + ' 分钟');
      }
    }
    c.close();
  }));
  return n;
}

if (mode === 'frames') {
  const [a, b] = String(args.frames).split(':');
  const dir = resolve(ROOT, args.out || 'out/frames');
  await paintRange(Number(a) || 0, b === undefined ? Number(a) + 10 : Number(b), dir, num(args.workers, 4));
  console.log('帧序列已写好：' + dir + '   （接着跑：node render.mjs --encode --audio=<你的BGM>）');
  shutdown(); process.exit(0);
}

if (mode === 'clip') {
  const [a, b] = String(args.clip).split(':');
  const dir = resolve(ROOT, 'out/.clip-' + String(a).replace('.', '_') + '-' + String(b).replace('.', '_'));
  rmSync(dir, { recursive: true, force: true });
  await paintRange(Number(a) || 0, Number(b) || (Number(a) || 0) + 8, dir, num(args.workers, 4));
  const out = resolve(ROOT, args.out || 'out/clip.mp4');
  const fa = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%05d.jpg')];
  if (args.audio) fa.push('-ss', String(Number(a) || 0), '-i', resolve(ROOT, args.audio));
  fa.push('-map', '0:v'); if (args.audio) fa.push('-map', '1:a');
  fa.push('-c:v', 'libx264', '-crf', String(num(args.crf, 18)), '-pix_fmt', 'yuv420p');
  if (args.audio) fa.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  fa.push('-movflags', '+faststart', out);
  console.log('编码 → ' + out);
  await run('ffmpeg', fa);
  console.log('完成 ' + out);
  shutdown(); process.exit(0);
}
