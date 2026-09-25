# 程序化动画短片 · 复用手册

> 本文档用于项目复用。阅读「0 · 30 秒上手」即可开始；
> 第 8 章「踩坑手册」记录了开发过程中实际出现并已修复的问题。

---

## 0 · 30 秒上手

```bash
# 1) 复制整个项目当模板
cp -r whale-odyssey my-new-film && cd my-new-film
rm -rf out/* && mkdir -p out

# 2) 只改三个地方就能变成新片子：
#    js/odyssey.js  → KEYS(幕表) / G.LYRICS(字幕) / form()(粒子形态) / sceneProps()(幕内道具)
#    index.html     → 标题 + BPM + 小节数
#    js/char.js     → 主角

# 3) 立刻看
双击 index.html
```

**引擎不用动。** `js/core.js / char.js / props.js / audio.js / main.js / render.mjs` 是通用的，
只有 `js/odyssey.js` 是"这一部片子"。

---

## 1 · 技术栈

| 层 | 选择 | 说明 |
|---|---|---|
| 运行时 | **原生 JS + Canvas 2D** | 经典 `<script src>`，**不是 ES module**（这样才能 `file://` 双击打开） |
| 循环 | `requestAnimationFrame` | |
| 音频 | **Web Audio API** | `OfflineAudioContext` 离线合成 BGM；`MediaRecorder` 录 WebM |
| 图形 | 全程序化 | 零图片、零贴图、零网络字体 |
| 出片 | **Node + 原生 CDP + ffmpeg** | 零 npm 依赖（只用 `node:child_process/fs/path/url` + 内置 `fetch`/`WebSocket`） |

**刻意没用**：Vite、TypeScript、React、Three.js、p5.js、p5.brush、puppeteer。
理由：动画短片不需要 UI 工具链；零依赖才能"双击即开 + 离线渲染零安装"；
手绘插画质感用 Canvas2D 就够，加 3D 反而破坏统一感。

**验证环境**：Node.js v24 / Chrome（安装路径因环境而异，可用 `--chrome=<路径>` 指定）/ ffmpeg 8.x。
三者齐备即可，无需其他依赖。

---

## 2 · 架构分层

```
index.html          经典 <script> 按顺序加载，顺序不能错
  js/core.js        ← 引擎内核（数学 / 抖动 / 笔触 / 纸纹 / 相机 / 手写字 / 花样）
  js/char.js        ← 主角（依赖 core）
  js/props.js       ← 道具（依赖 core）
  js/odyssey.js     ← ★ 剧本：定义 G.drawWorld(t)（依赖 core/char/props）
  js/audio.js       ← 音频
  js/main.js        ← 播放器（最后加载，调用 G.drawWorld）
render.mjs          ← 离线渲染器，独立于浏览器代码
```

**关键设计**：把「画什么形状」和「怎么画」彻底分开。
- `odyssey.js` 只负责**形状与时间**（现在该画什么）
- `core.js` 只负责**笔触与质感**（怎么把它画出来）

所以想换材质（比如换成 p5.brush 水彩），只动 `core.js` 一层，12 幕剧本一行不改。

---

## 3 · 三条铁律

**铁律 1：每一帧都是时间 `t` 的纯函数。**
没有跨帧状态，没有 `Math.random()`。看到 `frameCount++`、`lastX = ...` 这类写法就是错的。
这么做换来两件事：帧能**并行乱序**渲染；同 `t` 永远出同一张图（可复现、可补帧、可调试）。

**铁律 2：随机分两种，别混用。**

```js
G.hash(i)          // 稳定随机：同一个物体永远长一个样（做"物体本身长这样"）
G.jit(a)           // 手抖：每 1/12 秒重新播种 → 线稿会"沸腾"（做"手在抖"）
G.hashJit(i, a)    // 稳定的"手抖"：同一个物体每次抖得一样
```

`jit` 的种子在 `G.drawWorld(t)` 开头由 `G.seedFrame(t)` 设定，
所以**绘制顺序必须固定**——所有 `G.jit()` 调用按同一顺序消耗随机数流。

**铁律 3：透明度要"乘"，不要"覆盖"。**
所有绘制辅助函数内部都是 `C.globalAlpha = C.globalAlpha * (op/255)`。
新增绘制辅助函数时须遵循同一规则，否则调用方设置的透明度会被覆盖。

---

## 4 · 引擎 API 速查

### 4.1 `core.js` —— 常量与画布

```js
G.W, G.H          1920, 1080（设计分辨率，永远不要改）
G.BOIL            12   线稿"沸腾"频率（次/秒）
G.setCtx(c) / G.getCtx()   绑定 ctx（main.js 里调用一次）
G.PAL             {paper, ink, ink2, ds, dsDk, dsMid, dsLt, dsPale, gold, goldDk,
                   coral, teal, cream, night, split[7色光], sunset[6色日落]}
```

### 4.2 数学与插值

```js
G.clamp(x, a=0, b=1)          G.lerp(a, b, x)         G.frac(x)
G.ease / easeIn / easeOut / easeIO / backOut / elasticOut     // 都是 0→1
G.kf(t, [[t0,v0],[t1,v1],...], easeFn)                        // 关键帧，值可以是数组
G.mixCol('#aabbcc', '#112233', k)                             // 颜色混合
G.hash(i)  G.jit(a)  G.jitRange(a,b)  G.hashJit(i,a)  G.rnd()
```

### 4.3 音乐时间轴（BPM 一改，全片重新踩点）

```js
G.T = { bpm, off, dur, len }   // off=拍点偏移(秒)，dur=总时长，len=小节数
G.beat()  60/bpm      G.bar()  60/bpm*4
G.bpOf(t) 拍数(浮点)  G.beatN(t) 整数拍号  G.beatT(n) 第n拍时刻  G.barT(n) 第n小节时刻
G.pulse(t, k=6)   每拍 1 → 指数衰减（k 越大衰减越快）★ 做卡拍点动画全靠它
G.pulse2(t, k)    八分音符版
G.seg(t, a, b)    t 在 [a,b] 中的进度(已 clamp)
G.wob(t, f, ph)   正弦波
```

### 4.4 点集构造（都返回 `[[x,y],...]`）

```js
G.ellPts(cx, cy, rx, ry, n=28, jitter=0, rot=0)     // 椭圆
G.rectPts(x, y, w, h, jitter)                        // 矩形
G.rrPts(x, y, w, h, r, jitter)                       // 圆角矩形
G.starPts(cx, cy, r, inner, n=5, rot)                // 星形
G.heartPts(cx, cy, r, n=30)                          // 爱心
G.blobPts(cx, cy, rx, ry, n, mod, rot)               // 有机形状，mod(angle)→半径倍数 ★做不规则形状
G.wavePts(x0, x1, y, amp, freq, phase, steps=40)     // 波浪线
```

### 4.5 绘制（这是"笔触层"，换材质就换这几个）

```js
// 闭合形状：填充 + 墨线，所有点带抖动
G.paint(pts, {fill, fillOp, ink, inkOp, sw, jitter, smooth, grad:[y0,y1,c0,c1], alpha})
        {shadow, shadowOp, shadowX, shadowY}         // 手绘投影

// 开放曲线（不做闭合）
G.stroke(pts, {ink, sw, alpha, jitter, smooth, dash:[...]})

// ★ 铅笔排线填充（本片风格签名）
G.hatchFill(pts, {d:10, a:-0.5, color, alpha:190, sw:1.5, rand:0.35, gradient:1, seed:0, wob:0.7})

G.scrawl(pts, color, op, count, seed)                // 手涂（不满的斜线）
G.tracePts(pts, smooth, close)                       // 只写路径（自己 clip 时用）
G.paint(x, y, r, col, op)                            // 画点
```

### 4.6 相机与后期

```js
G.camBegin(cx, cy, zoom, rot)   // 世界点(cx,cy) 落在屏幕中心；一个层级，必须配对
G.camEnd()   G.toScreen(x,y)    G.shakeXY(t, amt)
G.drawPaper()        // 纸底 + 径向光
G.drawGrain(t)       // 每帧微移的颗粒（叠在最后）
G.drawVignette()     // 暗角
G.multiGrad([c0,c1,...], y0, y1, op)   // 多段竖向渐变
```

### 4.7 花样（做科普/宇宙场景用的现成积木）

```js
G.speckle(t, n, col, op)                 // 纸屑/脏点
G.starfield(t, n, col, op)               // 会闪的星野
G.glow(x, y, r, col, op)                 // 径向光晕
G.orbit(cx, cy, rx, ry, rot, col, sw, alpha)   // 轨道圈
G.flock(t, n, {cx,cy,rx,ry,s,color,spin,inner,alpha})   // 群飞/murmuration（一次成路径，几千只也不卡）
G.phyllo(cx, cy, n, c, rot, {s, colorFn, op, buckets})  // 黄金角叶序（向日葵花盘）
G.branch(t, x, y, ang, len, depth, seed, {...})         // 递归分叉（神经元/树突）
G.prism(cx, cy, s, t, {...})             // 三棱镜色散
G.blackHole(t, cx, cy, r, {...})         // 黑洞：吸积盘+光子环+引力透镜弧
```

### 4.8 手写字

```js
G.FONT_HAND   '"KaiTi","STKaiti",...,cursive'       // 系统字体，不联网
G.FONT_SANS
G.handText(str, x, y, {size, color, align, rot, alpha, reveal:0..1, outline, bold, font, wobble})
              // reveal 是"逐字浮现"（不是硬裁剪，不会把字切一半）
G.textW(str, size, font)   // 量宽度
```

### 4.9 `char.js` —— 主角

```js
G.whale(t, x, y, 尺寸, {
  paint: 1,        // 0=纯铅笔稿  1=完成上色  中间值=正在被画出来
  sketch: 0,       // 起稿辅助线的强度（辅助椭圆+中心线+定位点）
  ground: 0,       // 地面排线投影
  dir: 1,          // +1 头朝右 / -1 头朝左（整体镜像）
  tilt: 0, mood: 'idle',   // idle|happy|sing|wow|dizzy|heart|sleep|wink
  squash: 1, stretch: 1, blink: 0,
  spout: 0, aura: 0, alpha: 255, blush: 105, eyeR: 16,
  tailSpeed: 2.6, tailL: 100, tailS: 80, wave: 18,
  emote: 'note',   // note|heart|spark|star5|excl|q|sweat|zzz
  emoteO: { pop: 1, alpha: 255, color }
})

G.emote(kind, x, y, s, t, o)   // 单独画情绪符号
```

角色是**纯参数化绘制**的（`bodyPts` 身体 / `flukePts` 尾鳍 / `dorsalPts` 背鳍 /
`flipperPts` 胸鳍 / `spout` 喷水），没有贴图。改角色就改这几个函数。
`index.html?rig=1` 可以看到标准姿势。

### 4.10 `props.js`

```js
G.bubble(t, x, y, r, {op, fill, ink, sw})
G.ripple(t, x, y, k, {r0, r1, alpha, color, flat})    // k: 0→1 扩散进度
G.weed(t, x, y, h, w, {color, op, ph})                // 海草
G.mote(t, x, y, s, {color, op, rot})                  // 数据光点
G.soundRing(x, y, k, {alpha, color})
G.sparkle(x, y, s, col, op)
G.bigNote(x, y, s, rot, col, op)
```

### 4.11 `audio.js`

```js
const A = G.Audio;
A.ensure()                      // 建 AudioContext（要在用户手势里首次调用）
A.makeDemo(dur, bars, bpm)      // 离线合成示范 BGM → AudioBuffer（async）
A.loadFile(file)                // 载入用户选的音频文件 → AudioBuffer
A.play(at)  A.pause(t)  A.stop()  A.isPlaying()  A.time()   // time 用音频时钟，画面不跑偏
A.setVolume(v)  A.setClick(bool)  A.click(accent)
A.wavArrayBuffer()  A.wavBase64()  A.exportWav(name)   // 导出示范音轨
A.connectCapture(dest) / A.disconnectCapture()          // 给 MediaRecorder 抓音频
```

示范 BGM 是**离线合成**的（`OfflineAudioContext` + 振荡器包络 + 延迟空间感），
段落动态按小节自动分配。想换曲子直接 `loadFile`。

### 4.12 `main.js` —— 播放器与离线接口

```js
window.renderAt(t, type, q)             // 渲染第 t 秒 → 返回 dataURL（离线渲染器调这个）
window.renderSheet(times, cols, cellW)  // 联络表 → {url, ms}
window.ready                            // 页面就绪标志（渲染器轮询它）
window.__errs                           // 全局错误收集（自检会打印）
```

页面 URL 参数：`?t=12.5` 静帧 · `?render=1` 离线模式 · `?bare=1` 只留画布 · `?rig=1` 角色检查

---

## 5 · 形态系统（本片的核心架构）

**不要一场一场画再接起来。** 搭 N 个**从头到尾都在的"演员"**，让它们在时间里**重组成不同形态**。

本片用了 3 个演员（外加主角）：

| 演员 | 构成 | 在时间上变形为 |
|---|---|---|
| 粒子场 | 1400 个 | 浮游 → 神经节点 → 光谱 → 波前 → 圆环 → 葵花籽 → 轨道 → 星系 → 网格 → 吸积盘 → 隧道 → 地球云 |
| 形状 | 一个多边形 | 光点 → 三棱镜 → 缝栅 → 圆环 → 花瓣环 → 轨道 → 光子环 → 圆面 |
| 线 | 一条折线 | 海面 → 光束 → 圆弧 → 花茎 → 旋臂 → 网格线 → 光柱 → 地平线 |
| 主角 | 小鲸鱼 | 全片都在，只是越走越小再游回来 |

### 5.1 时间轴 = 一串锚点

```js
const KEYS = [ [0.0, F_SEA], [2.6, F_SEA], [4.6, F_NEURON], ... ];
// 每段之间：保持 30% → 形变 40% → 保持 30%
let _wa, _wb, _wk;   // 当前形态 / 下一形态 / 混合系数
function weightsAt(t) { ... _wa = a; _wb = b; _wk = ease(clamp((u-0.30)/0.40)); ... }
const WTS = new Array(NF);   // 每一幕的权重（幕内道具按它决定画不画、多亮）
```

### 5.2 混合 = 真的飞过去，不是叠化

```js
form(_wa, i, t, A9);              // 当前形态
form(_wb, i, t, B9);              // 下一形态
for (let j = 0; j < 9; j++) O9[j] = A9[j] + (B9[j] - A9[j]) * _wk;   // 逐个分量插值
```

因为**位置、拖尾、粗细、颜色、透明度都一起插值**，所以粒子是"真的从花盘飞到星系轨道上"。

### 5.3 加一幕的完整步骤（照抄这个清单）

1. **起名编号**：`const F_MYSCENE = 12, NF = 14;`（记得改 `NF`，`WTS` 靠它分配）
2. **加锚点**：在 `KEYS` 里插 `[t_in, F_MYSCENE], [t_out, F_MYSCENE],`（前后各留一段做形变）
3. **写粒子形态**：在 `form(k, i, t, o)` 里加 `case F_MYSCENE:`
   - `o[0],o[1]` = 位置
   - `o[2],o[3]` = 拖尾半向量（切线方向拖丝；不拖尾写 0.02/0）
   - `o[4]` = 粗细；`o[5..7]` = rgb；`o[8]` = 透明度 0~1
   - **不要在此处乘背景色**；绘制循环会以局部背景色进行预乘（这样批量绘制无需逐个设置 alpha）
4. **（可选）加形状**：`shape(k, j, t, out)` 里加 `case`
5. **（可选）加线**：`beam(k, j, t, out)` 里加 `case`
6. **（可选）加幕内道具**：`sceneProps(t)` 里写 `if (WTS[F_MYSCENE] > 0.02) { ... }`
7. **加字幕**：`G.LYRICS` 里插 `[起始秒, '文本', 持续秒]`
8. **调相机/色阶**：`CAMK` / `BGK` 插关键帧（颜色要**连续流动**，别瞬变）
9. **自检**：`node render.mjs --selftest`（会打印 `page errors` 和幕数）
10. **看图**：`node render.mjs --sheet=...` 出联络表，肉眼审

> ⚠️ `WTS[F_XXX] ` 是幕内道具的唯一开关。**忘了加就什么都看不见**，这是最常见的"改了没反应"原因。

---

## 6 · 时间轴与音频约定

```js
G.T.bpm = 100;  G.T.len = 21;          // 21 小节
G.T.dur = G.barT(G.T.len);             // = 21 × (60/100×4) = 50.4 秒
```

- **画面总时长由 `bars × bar` 决定**，`index.html` 里的"小节"输入框改的就是它
- 换歌流程：载入 BGM → 填 BPM → 开节拍器拖"偏移"对齐鼓点 → 点"重新对齐"
- 卡拍点做动画：`G.pulse(t, k)`。k 越大越短促（4~7 比较自然）
- **重音拍**：`if (G.beatN(t) % 4 === 0)`（每小节第一拍加 1.4 倍幅度）
- 画面时钟以 `AudioContext.currentTime` 为准，避免音画漂移

### 6.1 用真实歌曲当 BGM（实测流程，已自动化）

**不要凭感觉填 BPM。** 用内置分析器实测：

```bash
node analyze-bgm.mjs assets/bgm.mp3 --target=45
```

输出：**BPM（BPM×相位联合精修到 0.01）** · **第一拍时刻** · **小节重拍** ·
**每 4 秒响度条形图**（看段落结构）· **响度跳升点**（掉拍 / 副歌）· **推荐配片区间**（自动对齐小节线）。

> 两个坑已修：① 自相关用整数 lag 分辨率太粗（±2 BPM）→ 改 BPM×相位联合搜索；
> ② 浮点下标访问 `Float32Array` 得到 `undefined` → NaN，必须线性插值采样。

实测《Something Just Like This》：`103.00 BPM`，第一拍 `0.412s`，每小节 `2.330s`。

**选段原则：让片子最贵的那一幕落在副歌上。**
本片高潮是「黑洞」（片内 30.5s），起点取 **第 8 小节线 = 19.0528s**
→ 黑洞落在歌曲 49.55s（副歌起点），片尾落在 64.05s（副歌高潮）。

```bash
# 按小节线切一段；起点是小节线 ⇒ 片内 t=0 就是重拍 ⇒ G.T.off = 0
ffmpeg -y -ss 19.0528 -i assets/bgm.mp3 -t 45 \
  -af "afade=t=out:st=43.4:d=1.6" -c:a aac -b:a 256k assets/bgm-45s.m4a
```

小节数 = `时长 / (60/BPM×4)`，**可以是小数**（main.js 已支持）。
浏览器端 `file://` 读不了本地音频：要通过 http 打开才会自动载入 `assets/bgm-45s.m4a`，
否则手动点「载入我的 BGM…」。

---

## 7 · 离线出片速查

```bash
node render.mjs --selftest                       # 自检：幕数 / 音轨 / JS 错误
node render.mjs --dumpdemo=out/demo.wav          # 导出内置音轨（出片带声音）
node render.mjs --stills=25.8,30.8 --out=out/s  # 全分辨率静帧
node render.mjs --sheet=0,6,12,20,26 --cols=4 --w=430 --out=out/sheet.jpg   # 联络表（审片）

node render.mjs --clip=25:32 --fps=30 --audio=out/demo.wav --workers=4 --out=out/clip.mp4

# ★ 整片（推荐流程）
node render.mjs --frames=0:45 --fps=30 --workers=5 --out=out/frames   # 逐帧，可断点续传
node render.mjs --encode --fps=30 --audio=out/demo.wav --out=out/film.mp4
node render.mjs --encode --fps=30 --audio=assets/bgm.mp3 --audio-offset=19.0528 --out=out/film.mp4   # 不切文件也能从指定位置取音
```

- `--workers=5` 开 5 个无头 Chrome 抢帧；渲染中途断了直接重跑，会**跳过已存在的帧**
- 加 `--soft` 用软件渲染（慢但兼容性好）
- 想换 Chrome：`--chrome=<路径>`
- **出片前先 `--selftest`**，它能抓到"页面静默报错导致整段重播"这类致命问题

---

## 8 · 踩坑手册（均为开发过程中实际出现并已修复的问题）

### ⚠️ 坑 1：IIFE 里的异常会**静默**杀掉整个剧本

`shot()` 最初的实现为 `(bar, fn) => G.SHOTS_BARS.push([bar, fn])`，
而 `Array.push()` 返回的是**长度（数字）**。随后的 `noFlash(shot(...))` 会对数字设置属性，
在 `'use strict'` 下**抛出 TypeError** → 整个 `scenes.js` 自第二个镜头起全部未注册，
但页面仍能正常启动 —— 现象表现为"**第 2 幕之后全部在重复第 2 幕**"。

**修复**：令 `shot` 返回 `fn`。
**更重要的修复**：在 `index.html` 中加入全局错误收集，使静默失败可见：

```html
<script>window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String((e&&e.message)||e));});</script>
```
并在 `render.mjs --selftest` 中打印 `page errors` 与 `SHOTS_BARS.length`。
该检查成本极低，但可显著缩短排查时间。

### ⚠️ 坑 2：透明度被"覆盖"而不是"乘"

`G.paint()` 里写 `C.globalAlpha = (o.fillOp ?? 255)/255`，
调用方先设的 `C.globalAlpha = 0.3`（水雾）就被吞了 → 水雾变成实心色块。
**修**：所有 helper 统一改成 `C.globalAlpha = C.globalAlpha * (op/255)`。自己写 helper 也要遵守。

### ⚠️ 坑 3：纸纹用了 `Math.random()`

纸纹缓存是懒加载的，每个渲染 worker 各建一份 → **并行渲染时帧与帧之间纹理跳变**。
**修**：换成确定性 LCG。
**规则**：任何会进入画面的随机，都必须是 `hash()` / 确定性 LCG，绝对不能用 `Math.random()`。

### ⚠️ 坑 4：AudioContext 跨上下文连线

离线合成时，效果器节点（delay）如果是**模块级变量**、建在在线 `AudioContext` 上，
而振荡器建在 `OfflineAudioContext` 上 → `connect` 直接抛
`cannot connect to an AudioNode belonging to a different audio context` → 音轨合成失败。
**修**：离线合成时所有节点都建在 `off` 上；需要复用的效果器**当参数传进去**，不要用模块级节点。

### ⚠️ 坑 5：粒子批量绘制的桶越界

以 `ci = (r>>5)*4 + (g>>5)*2 + (bl>>6)` 计算桶索引，值域为 0..45，
但仅分配了 12 个桶 → `bkt[183]` 为 `undefined` → 每帧抛出异常。
**修复**：放弃分桶方案，改为**逐粒子 `fillRect` + 预生成 256 条颜色字符串**（`COLQ`）。
既修了 bug 又更快：设置 `fillStyle` 是字符串赋值，预生成表就没有每帧拼字符串的开销。

### ⚠️ 坑 6：连续启动 Chrome 抢端口

一次 shell 里连跑两条 `node render.mjs` → 第二个报"无法连接调试端口"，因为第一个的 Chrome 还没退干净。
**修**：用 `--remote-debugging-port=0` 让 Chrome 自己挑空闲端口，然后读它写出的
`<profile>/DevToolsActivePort` 文件拿到真实端口；再给 `openPage()` 加 3 次重试。
**此外**：每个工作页使用**独立的 profile 目录**，并在启动时清除上次残留的 `.chrome-*`。

### ⚠️ 坑 7：`--clip` 复用帧目录

两次 `--clip` 用同一个临时帧目录，第二次会"续传"第一次的帧 → 出错误片段。
**修**：帧目录名带上区间（`.clip-25-32`），并且每次开始前清空。

### ⚠️ 坑 8：ffmpeg 的 `-ss` 位置

把 `-ss` 写在 `-map` 之后 → 它变成**输出选项**，会把视频一起裁掉。
**修**：`-ss` 放在音频的 `-i` **之前**（输入定位）：`['-ss', String(t0), '-i', audio]`。

### ⚠️ 坑 9：相机没跟住角色 → 角色飞出画面

俯冲镜头最初使用固定的 `camBegin(W/2, H/2, zoom)`，导致角色被推出画面、仅余一角。
**修复**：改用 `camBegin(fx, fy, zoom)`，使角色始终位于画面中心而**背景流动**，从而形成"镜头跟随"的效果。

### ⚠️ 坑 10：尾迹写死方向

尾迹气泡最初使用固定偏移 `x - 92`，角色转向后气泡会出现在朝向的前方。
**修复**：改用**路径滞后**（取 `t - lag` 时刻的路径位置）替代固定偏移，方向自动跟随朝向。

### ⚠️ 坑 11：硬切的第一帧是空的

新场景入口元素是"从画外进来"的，切过去的那一帧等于什么都没画。
**修**：要么给 0.2 秒纸面闪白把切点盖住，要么让入口元素**提前 0.4 秒**出发。
（注意：闪白用纸色时，在纸底场景里等于看不见——要挑对比色。）

### ⚠️ 坑 12：形状演员画了多余的轮廓

即前述"多余的半圆"——一个 72 点闭合形状在每一幕都被描边，但在星系一幕中并无意义。
**修**：按幕给开关，**只在"它本身就是一个物体"的时候才描边**：

```js
const showOutline = WTS[F_SPECTRUM] + WTS[F_RINGS] + WTS[F_FLOWER] + WTS[F_BH] + ...;
if (showOutline > 0.02) G.paint(polyPts, { ink: ..., inkOp: 170 * clamp(showOutline) });
```

### ⚠️ 坑 13：`file://` 下不能用 ES module

`<script type="module">` 会被 CORS 拦掉，双击打不开。
**修**：全部用经典 `<script src>` + IIFE（`(function(G){ ... })(window.DSG)`）。
同理，`fetch()` 本地 json 也会失败，所有数据直接写在 js 里。

### ⚠️ 坑 14：文件被别的进程改过，编辑匹配失败

多会话并行时很容易撞上：`old_string` 找不到 / "file changed since it was read"。
**处置**：先 `read` 再修改；若文件中原有的特征标识（如已写入的函数名）消失，**应首先怀疑文件被替换**，
确认现状后再操作，不要强行覆盖。

---

## 9 · 性能与参数速查

| 项 | 值 |
|---|---|
| 粒子数 | 1400（`N`）。想更快降到 800，画质损失很小 |
| 网格幕 | `GRID = 36` → 1296 个节点 + 72 条网线 |
| 群飞 | 一次成路径，1500~2200 只几乎不掉帧 |
| 叶序 | 900 点批量 `fill`（3 次 fill，不是 900 次） |
| 单帧渲染 | 全分辨率 JPEG 约 0.25–0.45 s/帧/worker |
| 整片 | 1350 帧 @ 5 workers ≈ 7 分钟；ffmpeg 编码 ≈ 2 分钟 |
| 联络表 | 缩略图尺寸下每帧只要 2–10 ms（审片用它，别用 stills） |

**优化顺序**：先降 `N` → 再降 `GRID` → 最后才考虑降分辨率。

---

## 10 · 起一部新片子的检查清单

- [ ] 复制项目、清空 `out/@
- [ ] 定 **BPM + 小节数**（= 总时长），改 `index.html`
- [ ] 写 **KEYS 幕表**（每幕给一段"保持"区间）
- [ ] 给每幕写 **`form()` 粒子形态**（本片最出效果的部分）
- [ ] 需要实体道具的幕写 **`sceneProps()`**
- [ ] 调 **`CAMK`**（相机推拉要连续，别切）和 **`BGK`**（颜色要流动）
- [ ] 写 **`G.LYRICS`** 字幕
- [ ] `--selftest` → 必须 `page errors: (none)` 且幕数对
- [ ] `--sheet` 出联络表，**逐帧看图改**（这一步最重要，不能省）
- [ ] 检查每一处转场：**前一幕的元素是不是"变形"成了下一幕的**，而不是消失+出现
- [ ] `--frames` 出整片 → `--encode` 带音频合成
- [ ] 清理 `out/frames` 和 `.chrome-*`

---

## 11 · 复用的三种姿势

**A. 只换剧本（最常用）**
保留全部引擎，重写 `odyssey.js`。10 分钟就能起一部新片。

**B. 只换角色**
重写 `char.js` 里的 `bodyPts/flukePts/dorsalPts/flipperPts/spout` 五个函数，
外形随便换（鱼、鸟、飞船都行），剧本不用动。用 `?rig=1` 检查姿势。

**C. 换笔触材质（比如换成 p5.brush 水彩）**
只动 `core.js` 的 `paint() / stroke() / hatchFill()` 三处，把它们接到
p5.brush 的 `fill / fillBleed / fillTexture / hatch` 上。
**剧本、时间轴、形态系统一行都不用改** —— 这就是把"画什么"和"怎么画"分开的回报。

---

## 12 · 文件清单

```
whale-odyssey/
  HANDBOOK.md      ← 本文档
  README.md        ← 这一部片子的说明（镜头表 / 剧情）
  index.html       播放器页面
  js/core.js       引擎内核（通用，不要改）
  js/char.js       主角（换角色时改）
  js/props.js      道具（通用）
  js/odyssey.js    ★ 剧本（换片子时改）
  js/audio.js      音频（通用）
  js/main.js       播放器（通用）
  render.mjs       离线渲染器（通用）
  assets/          放 bgm.mp3
  out/             渲染产物
```
