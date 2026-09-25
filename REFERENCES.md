# 参考资料

> 本文件记录本项目全部参考来源：视觉参考、工程架构、材质方案、规格依据、配乐数据、
> 数学与物理公式出处，以及工具链版本。
>
> 标注约定：**实测** 表示由本机命令得出的测量值 · **引用** 表示来自官方文档或仓库 · **存疑** 表示尚未核实。

---

## 0 · 输入素材

| 素材 | 形式 | 说明 |
|---|---|---|
| 参考动画 | `.mp4` 17.88 MB | 外部提供的参考片。B 站搬运版本（画面左上角含发布者水印），内容为程序化生成的科普手绘动画 |
| 规格说明 | 文本 | 外部提供的动画规格书（Vite + TypeScript + Canvas 2D，条件性引入 Three.js） |
| p5.brush | GitHub 仓库 | 材质方案候选 |
| PDoomVideo | GitHub 仓库 | 工程架构参考 |
| 配乐 | `.mp3` 7.72 MB | The Chainsmokers & Coldplay《Something Just Like This》 |

### 0.1 仓库与链接

**GitHub 仓库**

| 仓库 | 地址 | ⭐ / 协议 |
|---|---|---|
| PDoomVideo | https://github.com/JohnHeibel/PDoomVideo | 797 / ISC |
| p5.brush | https://github.com/acamposuribe/p5.brush | 925 / MIT |
| ClaudeAnimationBase | https://github.com/JohnHeibel/ClaudeAnimationBase | 236 / MIT |
| functional-emotions-video | https://github.com/ledbetterljoshua/functional-emotions-video | 37 / MIT |

> Star / Fork 数据为文档撰写时的抓取值，会随时间变化。

**p5.brush 官方资源**

- 官网：https://p5-brush.cargo.site/
- 在线调笔器 Brush Maker：https://acamposuribe.github.io/p5.brush/tools/brush-maker.html
- 在线流场生成器 Flow Field Generator：https://acamposuribe.github.io/p5.brush/tools/flowfield-maker.html
- 官方演示 sketch（p5 Web Editor）：https://editor.p5js.org/acamposuribe/sketches/bkb_CyJyi
- 官方示例合集：https://editor.p5js.org/acamposuribe/collections/PmyBeAfQP
- npm 包：https://www.npmjs.com/package/p5.brush

**成片与原始发布**

- PDoomVideo 成片（YouTube）：https://youtu.be/8j-hR4fJywU
- PDoomVideo 灵感来源（X）：https://x.com/slimer48484/status/2097752569212756134
- P(doom) 原曲出处（YouTube, 2024）：https://www.youtube.com/watch?v=uEB5E67vcPA
- Functional Emotions 发布（X）：https://x.com/eudaemonea/status/2102610626321490404

**中文技术社区讨论**

- 大佬说论坛讨论帖：https://locdd.com/t/topic/94518
- OrcaRouter 博客《Claude Opus 5.5：「规划影片」实际上会产出什么》：https://www.orcarouter.ai/zh-TW/blog/claude-opus-5-5-video-plan-one-shot
- B 站搬运示例：https://www.bilibili.com/video/BV1Dah86DE9q/

**本仓库说明**

> 商业音乐文件不随仓库分发（`.gitignore` 已排除 `assets/bgm*` 与 `out/`）。
> 渲染输出的成片仅用于内部预览；公开分发前须替换为自有或已获授权的音乐。

---

## 1 · 视觉参考片

### 1.1 技术参数（实测）

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
# 抽帧总览：每 0.5 秒一格，拼为 8×8 联络表
ffmpeg -y -i ref.mp4 -vf "fps=2,scale=240:-1,tile=8x8" -frames:v 1 overview.png

# 自动检测切点：画面变化量 > 0.30 的帧
ffmpeg -hide_banner -i ref.mp4 -vf "select='gt(scene,0.30)',showinfo" -an -f null -
```

### 1.3 画面结构

参考片采用**尺度递进**的单线叙事：
纸面上的小机器人 → 设备屏幕 → 神经元 / 树突 → 闪电 → 白色星芒 → **三棱镜色散** →
**DNA 双螺旋** → 分形螺旋 → **向日葵叶序** → **椋鸟群（murmuration）** → 星系 →
**黑洞吸积盘** → 引力透镜 / 爱因斯坦环 → 火箭发射 → 宇宙网 → **地出** → 分形 → **回到纸面同一只小机器人**。

### 1.4 本项目采用的三条手法

| 手法 | 参考片做法 | 本项目对应实现 |
|---|---|---|
| **铅笔排线表现暗部** | 平面色块上叠手绘斜排线，配粗墨线轮廓与纸张斑点；不使用渐变或水彩 | `G.hatchFill()` |
| **单一角色贯穿全程** | 角色随镜头推进不断变小，最终回到起点，形成首尾同构 | 主角小鲸鱼 + 3 个持久演员 |
| **几乎不使用硬切** | 实测 32 秒内仅 **11 次**场景变化事件，集中在 9.4–10.3 s / 21.25–21.33 s / 28.75–28.88 s；其余段落均为连续形变与镜头推移 | 形态加权混合，全片无切点 |

### 1.5 未采用的部分

- 参考片的素材组织方式为"百科式罗列"（神经元 / 闪电 / DNA / 火箭等互不相关）。
  本项目改为具备内在因果的旅程：海 → 网 → 光 → 波 → 花 → 星系 → 时空 → 黑洞 → 隧道 → 地球 → 海。
- 参考片为 24 fps；本项目按规格说明采用 **30 fps**。

---

## 2 · 工程架构参考：PDoomVideo

**JohnHeibel/PDoomVideo** —— 官方描述："Source code for the Claude Opus 5.5 music video for *I'm Upping My P(doom)*"

| 项 | 值（抓取时） |
|---|---|
| ⭐ Star / Fork | **797** / 84 |
| 语言 / 协议 | JavaScript / ISC |
| 创建 / 最后推送 | 2026-09-22 / 2026-09-23 |
| 依赖 | `p5 ^2.3.3`、`p5.brush ^2.2.3`、`puppeteer-core ^25.11.0` |
| 成片 | 156.6 s @ 24 fps，9 章，1920×1080 |

### 2.1 采用的工程模式

| 模式 | 出处 | 本项目实现 |
|---|---|---|
| **每一帧都是时间 `t` 的纯函数** | 该仓库的 `ANIMATION_GUIDE.md` | 全片约束条件，使帧可并行、乱序渲染 |
| **禁用 `Math.random()`**，改用 `hash()` / `jit()` | 同上 | `G.hash` / `G.jit` |
| **抖动种子每 8–12 帧重播种 → 线稿"沸腾"（boil）** | 同上 | `G.BOIL = 12` |
| **无头 Chrome 逐帧截图 + ffmpeg 编码** | 该仓库的 `render.mjs` | 本项目的 `render.mjs`（改用原生 CDP，见 §7） |
| **联络表（contact sheet）审片** | `render.mjs --sheet` | `--sheet=` 输出缩略图网格 |
| **可断点续传的帧序列** | `render.mjs --frames` | 同名参数 |

### 2.2 未采用的部分

- 渲染层：参考实现使用 **p5.js + p5.brush**；本项目使用原生 Canvas 2D（原因见 §4）。
- 浏览器驱动：参考实现使用 **puppeteer-core**；本项目使用 **原生 Chrome DevTools Protocol**（免 `npm install`）。
- 剧本结构：参考实现为"九个独立章节 + 硬切"；本项目为"持久演员 + 形态混合"。

---

## 3 · 衍生参考：Functional Emotions

**ledbetterljoshua/functional-emotions-video** —— 官方描述：
"A painted music video for *Functional Emotions*, made by Claude Opus 5.5: custom GPU brushstroke renderer, storyboard, and 7 parallel chapter agents."

- 该仓库 README 明确写明：**以 PDoomVideo 作为节奏参考**。
- 但它**未使用 p5.brush**，而是自研 **WebGL2 实例化笔触渲染器**（约 6 万条笔触 / 帧、3 个尺寸层、边缘对齐 + 流场、bloom）。
- 该实现同样坚持"每帧是 `t` 的纯函数"，并说明全片 1080p 在 M5 Pro 上渲染约 10 分钟。

**参考价值**：该案例说明 PDoomVideo 的**架构**比其**技术栈**更具复用性——同一套纯函数时间轴
可以替换为完全不同的渲染后端。这也支持了本项目"将'画什么'与'怎么画'分层"的设计取舍。

---

## 4 · 材质方案参考：p5.brush

**acamposuribe/p5.brush** —— 官方描述："Unlock custom brushes, natural fill effects and intuitive hatching in p5.js"

| 项 | 值（抓取时） |
|---|---|
| ⭐ Star / Fork | **925** / 56 |
| 协议 | MIT |
| 版本 | `p5.brush@2.2.3` |
| 依赖 | peer `p5 ^2.2`、`simplex-noise` |
| 运行要求 | **p5.js 2.x + WEBGL 画布** |

### 4.1 能力清单

11 种内置笔刷（`2B / HB / 2H / cpencil / pen / rotring / spray / marker / marker2 / charcoal / hatch_brush`）、
笔尖逐点盖戳（weight / scatter / sharpness / grain / opacity / spacing / pressure）、
自定义笔尖（`type:"custom"` 通过 `tip(_m)` 绘制形状；`type:"image"` 使用图片作为笔尖）、
**排线 hatch**（`hatch(dist, angle, {rand, continuous, gradient})`）、`mass()` 多层手涂明暗、
**水彩填充**（`fillBleed` 边缘渗色 / `fillTexture` 纸纹 / 由 spectral.js 提供光谱混色）、
矢量场（`hand / curved / zigzag / waves / seabed / spiral / columns`，可通过 `refreshField(t)` 驱动动画）。

### 4.2 未采用的原因

1. **运行要求不匹配**：该库要求 p5.js 2.x 与 WEBGL 画布，需引入 CDN 并与 p5 主循环绑定；
   本项目要求 `file://` 直接打开且离线渲染零安装。
2. **材质语言不匹配**：该库的核心能力是**水彩**（GPU 逐笔盖戳 + 渗色 + 纸纹 + 光谱混色）；
   本片目标为**手绘科普插画**风格（平涂色块 + 抖动墨线 + 铅笔排线）。
3. **确定性要求**：本项目需在多进程并行渲染下保证同一 `t` 输出完全一致；
   该库的笔触由着色器驱动，跨进程 bit-exact 复现较难保证。
4. **渲染成本**：PDoomVideo 作者自述"大部分时间消耗在渲染 p5 水彩上"。

### 4.3 概念层面的沿用

`hatchFill()` 对应其 `hatch()`；`scrawl()` 对应手涂；形态分层对应其 stroke / fill / hatch 三层状态机。
**接口已预留**：将 `G.paint()` 对接其 `fill / fillBleed / fillTexture` 即可替换材质，剧本无需改动。

---

## 5 · 规格依据

外部提供的动画规格书，逐条对照如下：

| 规格要求 | 本项目处理 |
|---|---|
| 25–30 s 程序化动画短片 | 实际为 **45 s / 13 幕**（后续需求变更：增加场景数量） |
| 技术栈 Vite + TypeScript + Canvas 2D + rAF | **仅使用 Canvas 2D + rAF**，无构建步骤 |
| 仅在对星系 / 黑洞 / 地球 / 景深有实质帮助时引入 Three.js | **未引入**；2D 粒子 + 渐变 + 排线已达到目标质感 |
| 避免 React | 未使用 |
| 1920×1080 / 30 FPS / 16:9 / 正确处理 devicePixelRatio | 全部满足 |
| **不得为割裂的幻灯片，必须形变过渡** | 采用**持久演员 + 形态加权混合**，涵盖形变、粒子过渡、缩放、镜头推进、径向展开、溶解、实体形变、色彩连续、运动动量延续 |
| 暖奶油 `#F2E8CF` 打底 + 深海蓝 / 暗紫 / 近黑 + 橙黄紫青洋红点缀 | 满足 |
| 程序化纸纹，禁止大型贴图资源 | 确定性 LCG 生成 512 px 纸纹 + 纤维 + 逐帧位移颗粒 |
| 时间轴分段（角色 → 神经元 → 棱镜 → 色彩几何 → 向日葵 → 星系 → 黑洞 → 隧道 → 地出 → 回归） | 基本遵循，并增加海洋开场、双缝干涉、太阳系、时空网格、微波背景 |
| 角色为圆角矩形橙色小生物，具备行走与 squash / stretch | **改为小鲸鱼**（按项目主题）；保留 squash / stretch、眨眼、喷水与情绪符号 |
| 地出为程序化渲染，禁用 NASA 贴图 | 径向渐变球体 + 7 块确定性陆地轮廓 + 贝塞尔云带 + 暗面 + 大气辉光 |
| 固定随机种子，每次播放一致 | 未使用 `Math.random()`，全流程确定性 |

---

## 6 · 配乐

**The Chainsmokers & Coldplay《Something Just Like This》**（外部提供）

### 6.1 实测数据（由本项目的 `analyze_bgm.mjs` 得出）

| 项 | 值 |
|---|---|
| 时长 | 247.338667 s |
| 编码 / 采样率 / 声道 | MP3 / 48 kHz / 2 |
| 码率 | 261 kbps |
| **BPM** | **103.00**（BPM × 相位联合精修，拟合分高于噪声约 1000 倍） |
| 第一拍 / 小节重拍 | **0.412 s** |
| 每小节（4/4） | **2.330 s** |

### 6.2 选段依据

选段原则为**让全片视觉高潮落在副歌区间**。本片高潮为"黑洞"一幕（片内 30.5 s），
因此起点取原曲小节线 **20.5318 s**，使该幕落在副歌内，片尾落在副歌高潮。

```bash
ffmpeg -y -ss 20.5318 -i assets/bgm.mp3 -t 45 \
  -af "afade=t=out:st=43.4:d=1.6" -c:a aac -b:a 256k assets/bgm-45s.m4a
```

切点位于小节线上，因此片内 `t=0` 即为重拍，`G.T.off = 0`。端到端复核误差约 **7 ms**。

> **版权声明**：该曲目为商业发行作品。包含该曲目的渲染成片（`out/video.mp4`）
> 仅供个人学习与内部预览，不得公开分发或用于商业用途。正式发布前须替换为自有或已获授权的音乐；
> 换曲流程见 `ANIMATION_GUIDE.md` 第 6.1 节。

---

## 7 · 工具链

| 工具 | 版本（实测） | 使用的能力 |
|---|---|---|
| Node.js | v24.13.1 | 内置 `fetch` / 全局 `WebSocket`（Node 22+）/ `node:child_process` / `fs` |
| Chrome | 本机安装（路径因环境而异） | `--headless=new`、`--remote-debugging-port=0`、`DevToolsActivePort` 文件 |
| ffmpeg | 8.1.1 | `-ss` 输入定位、`afade`、`libx264 -crf`、`aac`、`tile` 联络表、`select='gt(scene,…)'` 切点检测、`f32le` PCM 解码 |
| 浏览器 API | — | Canvas 2D、`requestAnimationFrame`、Web Audio（`OfflineAudioContext` / `AudioBufferSourceNode` / `MediaStreamAudioDestinationNode`）、`MediaRecorder`、`canvas.toDataURL()` |

**关于浏览器驱动**：本项目未使用 puppeteer，而是通过 Node 内置 WebSocket 直接使用 Chrome DevTools Protocol
（`Runtime.evaluate` + `awaitPromise` + `returnByValue`），作为 puppeteer 方案的零依赖替代。

---

## 8 · 数学与物理公式来源

| 应用位置 | 公式 | 出处 / 性质 |
|---|---|---|
| 向日葵花盘 | `θ = i × 137.507764°`（黄金角 2.399963 rad），`r = c√i` | **Vogel 模型**（H. Vogel, 1979），叶序的标准描述 |
| 星系旋臂 | 对数螺旋 `r = a·e^{bθ}` | 经典形式；密度波理论的常见近似 |
| 行星与尘埃公转速度 | `ω ∝ a^{-3/2}` | **开普勒第三定律** `T² ∝ a³` 的直接结果；代码中使用 `1.05/(a/150)^1.5` |
| 双缝干涉明暗条纹 | `I(y) = cos²(π d y / (λ L))` | **杨氏双缝**远场近似；实现位于 `F_WAVE` 与接收屏 |
| 引力势阱 | `z = -k/(d + c)` | 牛顿引力势 ∝ `-1/r`，引入软化常数 `c` 避免奇点 |
| 引力波涟漪 | `A·sin(kr - ωt)·e^{-r/L}` | 外向衰减波；物理上对应 `1/r` 衰减，实现采用指数衰减以便控制视觉范围 |
| 吸积盘差分旋转 | `ω ∝ r^{-3/2}`，内快外慢并产生切向拉丝 | 开普勒盘；"拉丝"为运动模糊的手绘等价形式 |
| 宇宙微波背景斑块 | 多正弦叠加 `sin(a·3.1) + sin(b·4.6) + sin((a+b)·6.2)` | 非物理模型，仅为斑块纹理的**视觉替代**（真实 CMB 需球谐函数） |
| 地球粒子分布 | 经纬度 → 球面 → 正交投影，仅绘制 `Z > 0` 的部分以隐藏背面 | 标准正交投影 |
| 确定性哈希 | `frac(sin(i·127.1 + 311.7)·43758.5453)` | GLSL / JS 社区常用的整数哈希 |
| 确定性伪随机 | LCG `s ← (1664525s + 1013904223) mod 2³²` | **Numerical Recipes** 的 LCG 常数 |
| 缓动函数 | smoothstep `3x²-2x³`、`1-(1-x)³`、backOut、elasticOut | Robert Penner 缓动族的常见形式 |
| 线稿"沸腾" | 抖动种子每 1/12 秒重播种 | 手绘动画的 boil 技巧；PDoomVideo 的 `jit()` |

---

## 9 · 相关社区线索

- 中文技术社区对该 MV 的讨论提到：将歌词与音频输入 Claude Code、xhigh 推理档、
  45 分钟完成、消耗 Max 5x 周额度的 10%、派发 7 个子代理并行编写 JS、大部分时间用于渲染 p5 水彩效果
  ——该描述与 PDoomVideo 的 README 自述一致。
- PDoomVideo 的 README 提到其灵感来自 X 上的一条帖子，曲目来自一个 2024 年的 YouTube 视频。
- 本文档所依据的参考片为 B 站搬运版本（画面左上角含发布者水印），**并非原始出处**。

---

## 10 · 引用格式

```text
动画 / 代码：WhaleAnimationBase —— 基于以下参考独立实现：
  · 视觉语言：参考片（手绘科普动画，32 s / 24 fps / 1920×1080）
  · 工程架构：JohnHeibel/PDoomVideo（每帧纯函数 + 无头 Chrome 逐帧 + ffmpeg）
  · 材质概念：acamposuribe/p5.brush（笔刷 / 排线 / 水彩的能力清单；本项目未使用其代码）
  · 数学基础：开普勒第三定律、杨氏双缝、Vogel 叶序模型等（见 §8）
配乐：The Chainsmokers & Coldplay《Something Just Like This》（仅限个人预览，未获授权）
```

---

## 11 · 待核实事项

- 参考片的**原始出处**尚未确认（B 站为搬运版本）。如需正式引用，建议回溯至原发布者。
- 参考片是否使用了 p5.brush 或 p5.js **未做核实**（画风与 PDoomVideo 同源，但仅进行了视觉比对）。
- §8 中的微波背景实现为**视觉近似**，非物理模拟。
- 各仓库的 Star / Fork 数为抓取当时的数值，会随时间变化。
