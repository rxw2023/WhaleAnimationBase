# 参考资料 · References

> 这部片子的**每一处灵感、每一条公式、每一个工具**的出处都在这里。
> 标注约定：**✅ 实测**（我跑过命令量出来的）· **📄 引用**（来自文档/仓库）· **❓存疑**（不确定）。

---

## 0 · 输入素材总表

| 素材 | 形式 | 说明 |
|---|---|---|
| 参考动画 | `.mp4` 17.88 MB | 用户提供，B 站搬运（画面左上角有 up 主水印），内容为 Claude 生成的科普手绘动画 |
| 规格提示词 | 文本 | 用户提供的"给其他 agent 的提示词"（Vite + TS + Canvas2D + 条件性 Three.js） |
| p5.brush | GitHub 仓库 | 最初的讨论对象 |
| PDoomVideo | GitHub 仓库 | MV 源码，架构参考 |
| 配乐 | `.mp3` 7.72 MB | The Chainsmokers & Coldplay《Something Just Like This》 |

### 0.1 仓库与链接

**GitHub 仓库**

| 仓库 | 地址 | ⭐ / 协议 |
|---|---|---|
| PDoomVideo | https://github.com/JohnHeibel/PDoomVideo | 797 / ISC |
| p5.brush | https://github.com/acamposuribe/p5.brush | 925 / MIT |
| ClaudeAnimationBase | https://github.com/JohnHeibel/ClaudeAnimationBase | 236 / MIT |
| functional-emotions-video | https://github.com/ledbetterljoshua/functional-emotions-video | 37 / MIT |

**p5.brush 官方**

- 官网：https://p5-brush.cargo.site/
- 在线调笔器 Brush Maker：https://acamposuribe.github.io/p5.brush/tools/brush-maker.html
- 在线流场生成器 Flow Field Generator：https://acamposuribe.github.io/p5.brush/tools/flowfield-maker.html
- 官方演示 sketch（p5 Web Editor）：https://editor.p5js.org/acamposuribe/sketches/bkb_CyJyi
- 官方示例合集：https://editor.p5js.org/acamposuribe/collections/PmyBeAfQP
- npm：https://www.npmjs.com/package/p5.brush

**成片与原始帖子**

- PDoomVideo 成片（YouTube）：https://youtu.be/8j-hR4fJywU
- PDoomVideo 灵感来源（X）：https://x.com/slimer48484/status/2097752569212756134
- P(doom) 原曲出处（YouTube, 2024）：https://www.youtube.com/watch?v=uEB5E67vcPA
- Functional Emotions 发布（X）：https://x.com/eudaemonea/status/2102610626321490404

**中文技术圈讨论**

- 大佬说论坛搬运帖：https://locdd.com/t/topic/94518
- OrcaRouter 博客《Claude Opus 5.5：「规划影片」实际上会产出什么》：https://www.orcarouter.ai/zh-TW/blog/claude-opus-5-5-video-plan-one-shot
- B 站搬运示例：https://www.bilibili.com/video/BV1Dah86DE9q/

**本项目（whale-odyssey）**

> ⚠️ **没有远程仓库。** 全部是本地文件（@@C:\Users\Rao\Desktop\学习\前端设计\whale-odyssey@@）。
> 想托管：
> ```bash
> cd whale-odyssey
> printf 'out/\nassets/bgm.mp3\n.chrome-*\n' > .gitignore   # 别把成片和商业音乐传上去
> git init && git add . && git commit -m "whale odyssey: 45s procedural short"
> git remote add origin <你的仓库地址> && git push -u origin main
> ```

---

## 1 · 视觉参考片（主要参考）

### 1.1 技术参数 ✅ 实测（ffprobe）

| 项 | 值 |
|---|---|
| 容器 / 编码 | MP4 / h264 + aac |
| 分辨率 | **1920 × 1080**（16:9） |
| 帧率 | **24 fps** |
| 总帧数 | **766** |
| 时长 | **31.978667 s** |
| 码率 | 4 473 kbps |
| 文件大小 | 17 880 092 B |

### 1.2 分析方法

```bash
# 抽帧看全貌（每 0.5 秒一格，拼成 8×8 联络表）
ffmpeg -y -i ref.mp4 -vf "fps=2,scale=240:-1,tile=8x8" -frames:v 1 overview.png

# 自动找切点（scene 变化 > 0.30 的帧）
ffmpeg -hide_banner -i ref.mp4 -vf "select='gt(scene,0.30)',showinfo" -an -f null -
```

### 1.3 画面结构（抽帧读出来的）

**这是一条"尺度之旅"**：纸上的小机器人 → 设备屏幕 → 神经元/树突 → 闪电 → 白色星芒 →
**三棱镜彩虹** → **DNA 双螺旋** → 分形螺旋 → **向日葵叶序** → **椋鸟群（murmuration）** →
星系 → **黑洞吸积盘** → 引力透镜/爱因斯坦环 → 火箭发射 → 宇宙网 → **地出** → 分形 → **回到纸上同一只小机器人**。

### 1.4 关键手法（我借鉴的三条）

1. **铅笔排线做暗部**：平面上叠手绘斜排线，配粗墨线轮廓 + 纸纹斑点。不是渐变、不是水彩。
   → 对应我的 `G.hatchFill()`
2. **一个小角色贯穿全程**，越走越小、最后回到起点（首尾同一画面）。
   → 对应我的"主角小鲸鱼 + 4 个持久演员"
3. **几乎没有硬切** ✅ 实测：32 秒里只有 **11 处**场景变化事件，且集中在 9.4–10.3s / 21.25–21.33s / 28.75–28.88s；
   其余段落全靠连续形变/推拉接续。
   → 对应我的"加权形态混合，全片零切点"

### 1.5 我没有照搬的

- 它的科普素材是"百科式罗列"（神经元/闪电/DNA/火箭…），我换成了有内在因果的旅程（海→网→光→波→花→星系→时空→黑洞→隧道→地球→海）
- 它是 24fps，我按提示词要求用 30fps

---

## 2 · 架构参考：PDoomVideo

**JohnHeibel/PDoomVideo** —— 📄 描述："Source code for the Claude Opus 5.5 music video for *I'm Upping My P(doom)*"

| 项 | 值（抓取时） |
|---|---|
| ⭐ Star | **797**（我首次抓是 614，后来涨了） |
| Fork | 84 |
| 语言 / 协议 | JavaScript / ISC |
| 创建 / 最后推送 | 2026-09-22 / 2026-09-23 |
| 依赖 | `p5 ^2.3.3`、`p5.brush ^2.2.3`、`puppeteer-core ^25.11.0` |
| 成片 | 156.6 s @ 24 fps，9 章，1920×1080 |

### 我借鉴的工程模式

| 模式 | 出处 | 我怎么用 |
|---|---|---|
| **每一帧都是时间 t 的纯函数** | PDoomVideo 的 `ANIMATION_GUIDE.md` | 全片铁律，让帧可并行乱序渲染 |
| **不用 `Math.random()`**，改用 `hash()` / `jit()` | 同上 | `G.hash` / `G.jit` |
| **抖动每 8–12 帧重播种 → 线稿"沸腾"** | 同上（它叫 boil） | `G.BOIL = 12` |
| **headless Chrome 逐帧截图 + ffmpeg 编码** | `render.mjs` | 我的 `render.mjs`（但换成原生 CDP，见 §7） |
| **联络表（contact sheet）审片** | `render.mjs --sheet` | `--sheet=` 出缩略图网格 |
| **可断点续传的帧序列** | `render.mjs --frames` | 同 |

### 我没有照搬的

- 它用 **p5.js + p5.brush**，我用原生 Canvas2D（理由见 §4）
- 它用 **puppeteer-core**，我用 **原生 Chrome DevTools Protocol**（免 `npm install`）
- 它的剧本是"九个独立章节 + 硬切"，我的是"四个持久演员 + 形态混合"

---

## 3 · 衍生参考：Functional Emotions

**ledbetterljoshua/functional-emotions-video** —— 📄 描述：
"A painted music video for *Functional Emotions*, made by Claude Opus 5.5: custom GPU brushstroke renderer, storyboard, and 7 parallel chapter agents."

- 它的 README 明确写：**以 PDoomVideo 作为节奏参考**
- 但**没有用 p5.brush**，改成了自研 **WebGL2 实例化笔触渲染器**（约 6 万条笔触/帧、3 个尺寸层、边缘对齐 + 流场、bloom）
- 值得记的一条：它同样坚持"每帧是 `t` 的纯函数"，并说全片 1080p 在 M5 Pro 上渲约 10 分钟

**意义**：这条线证明了 PDoomVideo 的**架构**比它的**技术栈**更有复用价值——同一套纯函数时间轴，
换成完全不同的渲染后端照样成立。这也支撑了我"把'画什么'和'怎么画'分层"的设计。

---

## 4 · 材质参考：p5.brush

**acamposuribe/p5.brush** —— 📄 描述："Unlock custom brushes, natural fill effects and intuitive hatching in p5.js"

| 项 | 值（抓取时） |
|---|---|
| ⭐ Star | **925**（首次抓是 919） |
| Fork | 56 |
| 协议 | MIT |
| 版本 | `p5.brush@2.2.3` |
| 依赖 | peer `p5 ^2.2`，`simplex-noise` |
| 要求 | **p5.js 2.x + WEBGL 画布** |

### 它提供什么（能力清单）

11 种内置笔刷（`2B / HB / 2H / cpencil / pen / rotring / spray / marker / marker2 / charcoal / hatch_brush`）、
笔尖逐点盖戳（weight / scatter / sharpness / grain / opacity / spacing / pressure）、
自定义笔尖（`type:"custom"` 用 `tip(_m)` 画形状 / `type:"image"` 用图片当笔尖）、
**排线 hatch**（`hatch(dist, angle, {rand, continuous, gradient})`）、`mass()` 多层手涂明暗、
**水彩填充**（`fillBleed` 边缘渗色 / `fillTexture` 纸纹 / 用 spectral.js 做光谱混色）、
矢量场（`hand / curved / zigzag / waves / seabed / spiral / columns`，可 `refreshField(t)` 驱动动画）。

### 我为什么没用它

1. **它要 p5.js 2.x + WEBGL**：必须联网/走 CDN、必须跟 p5 的循环绑定，而我要 `file://` 双击即开 + 离线零安装
2. **材质语言不对**：它的强项是**水彩**（GPU 逐笔盖戳 + 渗色 + 纸纹 + 光谱混色）；
   本片要的是**手绘科普插画**（平涂色块 + 抖动墨线 + 铅笔排线）——两套材料
3. **确定性**：我要 5 个 Chromium 并行抢帧、同 `t` 出同一张图。它是着色器驱动的随性能量，跨进程 bit-exact 更难保证
4. **速度**：PDoomVideo 作者自述"大部分时间花在渲染 p5 水彩上"

### 但我借了它的"概念清单"

`hatchFill()` ↔ 它的 `hatch()` · `scrawl()` ↔ 手涂 · 形态分层 ↔ 它的 stroke/fill/hatch 三层状态机。
**接口留好了**：把 `G.paint()` 接到它的 `fill / fillBleed / fillTexture` 即可换材质，剧本一行不改。

---

## 5 · 规格参考：这份提示词

用户提供的"给其他 agent 的提示词"，逐条对照：

| 它的要求 | 我的处理 |
|---|---|
| 25–30 s 程序化动画短片 | 做成 **45 s / 13 幕**（你后来要求"加多点场景"） |
| 技术栈 Vite + TypeScript + Canvas2D + rAF | **只用 Canvas2D + rAF**（你说"技术栈就用现在"）；无构建 |
| 仅在对星系/黑洞/地球/景深有实质帮助时才引 Three.js | **不引**；2D 粒子 + 渐变 + 排线已达目标质感 |
| 避免 React | ✅ 没有 |
| 1920×1080 / 30 FPS / 16:9 / devicePixelRatio | ✅ 全部满足 |
| **绝不做成割裂的幻灯片；必须形变过渡** | ✅ **4 个持久演员 + 形态加权混合**（morph / 粒子过渡 / 缩放 / 镜头推进 / 径向展开 / 溶解 / 实体形变 / 色彩连续 / 运动动量延续） |
| 暖奶油 `#F2E8CF` 打底 + 深海蓝/暗紫/近黑 + 橙黄紫青洋红 | ✅ |
| 程序化纸纹，禁止大贴图 | ✅ 确定性 LCG 生成 512px 纸纹 + 纤维 + 帧移颗粒 |
| 时间轴分段（角色→神经元→棱镜→色彩几何→向日葵→星系→黑洞→隧道→地出→回归） | ✅ 基本照单（另加海洋开场、双缝、太阳系、时空网格、微波背景） |
| 角色：圆角矩形橙色小生物、走、squash/stretch | ❌ 改成**小鲸鱼**（你的主题要求）；squash/stretch、眨眼、喷水、情绪符号都保留 |
| 地出：程序化、禁用 NASA 贴图 | ✅ 径向渐变球体 + 7 块确定性陆地 + 贝塞尔云带 + 暗面 + 大气辉光 |
| 固定种子、每次播放一致 | ✅ 无 `Math.random()`，全确定性 |

---

## 6 · 配乐参考

**The Chainsmokers & Coldplay《Something Just Like This》**（你提供）

### 6.1 实测数据 ✅ 用本项目的 `analyze-bgm.mjs`

| 项 | 值 |
|---|---|
| 时长 | 247.338667 s |
| 编码 / 采样率 / 声道 | MP3 / 48 kHz / 2 |
| 码率 | 261 kbps |
| **BPM** | **103.00**（BPM × 相位联合精修，拟合分比噪声高约 1000 倍） |
| 第一拍 / 小节重拍 | **0.412 s** |
| 每小节（4/4） | **2.330 s** |

### 6.2 选段

原则：**让片子最贵的那一幕落在副歌上**。本片高潮是"黑洞"（片内 30.5 s），
所以起点取原曲小节线 **20.5318 s** → 黑洞落在副歌、片尾落在副歌高潮。

```bash
ffmpeg -y -ss 20.5318 -i assets/bgm.mp3 -t 45 \
  -af "afade=t=out:st=43.4:d=1.6" -c:a aac -b:a 256k assets/bgm-45s.m4a
```

切点在小节线上 ⇒ 片内 `t=0` 就是重拍 ⇒ `G.T.off = 0`。端到端复核误差 **约 7 ms**。

> ⚠️ **版权提示**：这首歌是商业发行作品。用它的成片（`out/whale-odyssey.mp4`）
> 请只作**个人学习 / 内部预览**，不要公开分发或商用。要发布请换成自有或已授权的音乐
> ——换歌流程见 `HANDBOOK.md` 第 6.1 节，一条命令的事。

---

## 7 · 工具链参考

| 工具 | 版本 ✅ | 用到的能力 |
|---|---|---|
| Node.js | v24.13.1 | 内置 `fetch` / 全局 `WebSocket`（Node 22+）/ `node:child_process` / `fs` |
| Chrome | 本机安装 | `--headless=new`、`--remote-debugging-port=0`、`DevToolsActivePort` 文件 |
| ffmpeg | 8.1.1 | `-ss` 输入定位、`afade`、`libx264 -crf`、`aac`、`tile` 联络表、`select='gt(scene,…)'` 找切点、`f32le` 解 PCM |
| 浏览器 API | — | Canvas 2D、`requestAnimationFrame`、Web Audio（`OfflineAudioContext` / `AudioBufferSourceNode` / `MediaStreamAudioDestinationNode`）、`MediaRecorder`、`canvas.toDataURL()` |

**关于 CDP**：我不用 puppeteer，直接用 Node 内置 WebSocket 说 Chrome DevTools Protocol
（`Runtime.evaluate` + `awaitPromise` + `returnByValue`）。这是 PDoomVideo 用 puppeteer 那一步的零依赖替代。

---

## 8 · 数学与物理公式来源

| 用在哪 | 公式 | 出处 / 性质 |
|---|---|---|
| 向日葵花盘 | `θ = i × 137.507764°`（黄金角 2.399963 rad），`r = c√i` | **Vogel 模型**（H. Vogel, 1979），叶序的标准描述 📄 |
| 星系旋臂 | 对数螺旋 `r = a·e^{bθ}` | 经典；对数螺旋是密度波理论的常见近似 📄 |
| 行星/尘埃公转速度 | `ω ∝ a^{-3/2}` | **开普勒第三定律** `T² ∝ a³` 的直接结果 ✅ 实现里用 `1.05/(a/150)^1.5` |
| 双缝干涉明暗条纹 | `I(y) = cos²(π d y / (λ L))` | **杨氏双缝**，远场近似 📄（我实现在 `F_WAVE` 和接收屏） |
| 引力势阱 | `z = -k/(d + c)` | 牛顿引力势 ∝ `-1/r`，加软化常数 `c` 防止奇点 📄 |
| 引力波涟漪 | `A·sin(kr - ωt)·e^{-r/L}` | 外向衰减波，物理上对应 `1/r` 衰减；我用指数衰减换取视觉可控 📄 |
| 吸积盘差分旋转 | `ω ∝ r^{-3/2}` → 内快外慢、切向拉丝 | 开普勒盘；"拉丝"是运动模糊的手绘等价物 📄 |
| 宇宙微波背景斑块 | 多个正弦叠加 `sin(a·3.1) + sin(b·4.6) + sin((a+b)·6.2)` | ❓ 不是物理模型，只是**造斑块的视觉替代**（真 CMB 需要球谐函数） |
| 地球粒子 | 经纬 → 球面 → 正交投影，`Z > 0` 才画（隐藏背面） | 标准正交投影 📄 |
| 确定性哈希 | `frac(sin(i·127.1 + 311.7)·43758.5453)` | GLSL/JS 社区常用的整数哈希 ✅ |
| 确定性伪随机 | LCG `s ← (1664525s + 1013904223) mod 2³²` | **Numerical Recipes** 的 LCG 常数 📄 |
| 缓动 | smoothstep `3x²-2x³`、`1-(1-x)³`、backOut、elasticOut | Robert Penner 缓动族的常见形式 📄 |
| 线稿"沸腾" | 抖动种子每 1/12 秒重播种 | 手绘动画的 boil 技巧；PDoomVideo 的 `jit()` 📄 |

---

## 9 · 相关社区线索

- 中文技术圈把这部 MV 讨论得很热：其中提到"把歌词+音频丢给 Claude Code、xhigh 推理、
  45 分钟出片、消耗 Max 5x 周额度 10%、派 7 个子代理并行写 JS、大部分时间花在渲染 p5 水彩上"
  —— 与 PDoomVideo 的 README 自述一致 📄
- PDoomVideo 的 README 提到灵感来自 X 上的一条帖子，曲子来自一个 2024 年的 YouTube 视频 📄
- 你给的参考片是 B 站搬运版（画面左上角有 up 主水印），**不是我优先采用的原始出处**

---

## 10 · 怎么引用这份作品

```text
动画/代码：whale-odyssey —— 基于以下参考独立实现：
  · 视觉语言：参考片（手绘科普动画，32s / 24fps / 1920×1080）
  · 工程架构：JohnHeibel/PDoomVideo（每帧纯函数 + 无头 Chrome 逐帧 + ffmpeg）
  · 材质概念：acamposuribe/p5.brush（笔刷/排线/水彩的能力清单；本片未使用其代码）
  · 数学：开普勒第三定律、杨氏双缝、Vogel 叶序模型等（见 §8）
配乐：The Chainsmokers & Coldplay《Something Just Like This》（仅个人预览，未获授权）
```

---

## 11 · 存疑与待补

- ❓ 参考片的**原始出处**未确认（B 站为搬运）。若要正式引用，建议回溯原发布者。
- ❓ 参考片是否也用了 p5.brush / p5.js，我**没有查证**（画风与 PDoomVideo 同源，但我只做了视觉比对）。
- ❓ CMB 那一幕是**视觉近似**，不是物理模拟（见 §8）。
- ❓ 各仓库的 star/fork 数会变，本文记录的是抓取当时的值。
