![hero](docs/hero.jpg)

# Whale Animation Base
### 小鲸鱼 · 一直在游 —— *The Long Swim*

> **一套「手绘动画」起点包**：可复用的形态混合引擎 + 45 秒程序化成片 + 配乐分析器 + 复用手册。
> 一只小鲸鱼从海里出发，穿过神经元、棱镜、双缝干涉、向日葵、太阳系、螺旋星系、黑洞与时空，
> 最后回到海里，继续游。
>
> **零运行时依赖**：纯 Canvas 2D + Web Audio，双击 `index.html` 即可播放；离线出片也不需要 `npm install`。

![license](https://img.shields.io/badge/license-MIT%20(code)-blue)
![runtime deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)
![render](https://img.shields.io/badge/render-Canvas%202D-4D6BFE)
![output](https://img.shields.io/badge/output-1920%C3%971080%20%7C%2030fps-orange)
![audio](https://img.shields.io/badge/audio-Web%20Audio-FFC24B)
![npm install](https://img.shields.io/badge/npm%20install-not%20needed-success)

---

## 它是什么

一部用代码画出来的短片：**1400 个粒子 + 一条 56 点的线 + 一只小鲸鱼**，
在 60 秒里重组成 17 种形态。全片**没有一处硬切**——每个场景都是**上一个场景形变过去的**。

剧情是一条探索线：**海里的家 → 破水面 → 一路所见（光 / 网 / 波 / 花）→ 离地 → 太阳系 →
星系 → 时空 → 黑洞 → 隧道 → 地出 → 星图 → 回到海里**。
首尾用同一套相机与配色收尾，所以片子**可以循环播放** —— 探索不结束。

| 时间 | 幕 | 字幕 |
|---|---|---|
| 0.0–4.4 | 海洋 · 家 | 海 是 第一张 纸 |
| 4.4–7.7 | **上浮**（气泡柱 / 加速摆尾） | 往 上 是 唯一 的 方向 |
| 7.7–12.1 | **破水面**（水花在弧顶变成星） | 冲 出 去 |
| 12.1–15.1 | 三棱镜色散 | 我 第一次 看见 颜色 |
| 15.1–18.2 | 神经网 | 每 一 根 线 都 在 说话 |
| 18.2–21.2 | 双缝干涉 | 两 道 波 相遇 会 唱歌 |
| 21.2–24.2 | 色彩光环 | 圆 转起来 就 开花 |
| 24.2–27.5 | 向日葵（黄金角叶序） | 连 花 都 在 数 数 |
| 27.5–31.9 | **离地**（花盘收缩成地球） | 家 只 是 一颗 球 |
| 31.9–35.2 | 太阳系（7 颗行星 + 土星环） | 谁 绕着 谁 转 |
| 35.2–38.7 | 螺旋星系 | 花心 是 另一座 星系 |
| 38.7–41.9 | 时空网格 + 引力波 | 引力 把 空间 压出 一个 坑 |
| 41.9–45.4 | 黑洞吸积盘 | 时间 在这里 变慢 |
| 45.4–48.7 | 宇宙隧道 | 穿 过 去 |
| 48.7–52.4 | 地出 | 回头看 家 是一颗 蓝色的球 |
| 52.4–56.4 | **星图航线**（走过的路连成星图） | 我 走 过 的 路 连成 了 星图 |
| 56.4–60.6 | 回到海洋 · 再出发（→ 循环） | 还 是 第一张 纸 |

![contact sheet](docs/sheet.jpg)

---

## 核心设计：没有「幕」，只有「形变」

常规做法是"一场一场画 + 硬切"。这里不是。全片只有 **3 个从头到尾都存在的"演员"**：

| 演员 | 它变成过什么 |
|---|---|
| **粒子场（1400）** | 海洋浮游 → 上浮气泡柱 → 水花炸开成星 → 光谱 → 神经网 → 干涉波前 → 同心环 → 葵花籽 → 收缩成地球 → 行星轨道 → 星系旋臂 → 时空网格 → 吸积盘 → 隧道环 → 地球云 → 星图航线 → 海洋 |
| **线（56 点）** | 海面 → 上浮螺旋 → 跃出弧 → 光束 → 树突 → 正弦波 → 圆弧 → 花茎 → 地球圆 → 椭圆轨道 → 旋臂 → 被弯折的光线 → 吸积盘缘 → 垂直光柱 → 月面地平线 → 航线 → 海面 |
| **小鲸鱼** | 全片都在：上浮时加速摆尾、破水面时**拉伸跃出**、越探索越小，最后掉头游出画面 |

每个粒子的位置是**两种形态的加权混合**：

```js
pos(i, t) = form[形态A](i, t) × (1 − k) + form[形态B](i, t) × k
```

所以粒子是**真的从花盘飞到星系轨道上**，不是叠化。位置、拖尾、粗细、颜色、透明度一起插值。

下面是"向日葵 → 太阳系 → 星系"这段的连续 6 帧（每帧间隔 0.7s，**没有剪接**）：

![morph](docs/morph.jpg)

### 三条铁律

1. **每一帧都是时间 `t` 的纯函数**——没有跨帧状态、没有 `Math.random()`。
   换来两件事：帧能**并行乱序**渲染（5 个无头 Chrome 抢帧）；同 `t` 永远出同一张图（可复现、可补帧）。
2. **随机分两种**：`hash(i)` 是"物体本身长这样"（稳定）；`jit(a)` 是"手在抖"
   （每 1/12 秒重播种 → 线稿**沸腾**，就是手绘动画的 boil）。
3. **透明度要乘不要覆盖**——所有绘制 helper 内部都是 `alpha = alpha × (op/255)`。

---

## 主角：一只小鲸鱼

角色是**纯参数化**画出来的（没有一张贴图），也是全片唯一的"实体演员"，所以造型值得单说。
设计上只守三件事：

| 原则 | 做法 |
|---|---|
| **剪影先成立** | 钝圆的大头（吻端半椭圆）+ 颈后最宽 + 收细的尾柄 + 两叶尾鳍。只看黑色剪影也必须认得出是鲸 |
| **体积靠一条渐变** | 不叠色块，而是裁进轮廓后画一条竖向渐变：背深 → 侧蓝 → 腹白（鲸式的反荫蔽） |
| **配件小而少** | 背鳍小且后置、胸鳍是窄桨不是宽叶、远侧胸鳍几乎藏在身体后面 |

其余细节都服务"可爱"而不是"写实"：大眼 + **上眼睑**（不是一个贴上去的白圈）、
眼下颊部的腮红、吻部亮块、四条喉褶、被风吹歪的喷水。

改角色只动 `js/char.js`：形体常量在文件顶部（`CAPX / CAPRY / TAILX / TOP / BOT`、尾鳍张角），
五官坐标在 `G.whale` 里，尾叶与胸鳍共用 `lobePts()` —— 一个"沿脊椎线扫出宽叶"的生成器。

```bash
node render.mjs --rig --out=out/rig.jpg     # 角色标准姿势表：铅笔稿 / 半上色 / 完成稿 / 表情
```

---

## 快速开始

```bash
git clone <this-repo> && cd WhaleAnimationBase
# 不需要 install。直接：
双击 index.html
```

| 快捷键 | 作用 |
|---|---|
| 空格 | 播放 / 暂停 |
| ← → | 前后 1 秒 |
| Shift + ← → | 前后 5 秒 |
| R | 回到开头 |
| P | 导出当前帧 PNG |
| F | 全屏 |

调试参数：`?t=22` 静帧 · `?render=1` 离线渲染模式 · `?bare=1` 只留画布 · `?rig=1` 角色标准姿势表（3×2）

> `index.html` 用的是**经典 `<script>` 而不是 ES module**，所以 `file://` 双击可用
> （module 会被 CORS 拦）。同理 `fetch` 本地文件会失败，所有数据都写在 js 里。

---

## 技术栈

| 层 | 选择 |
|---|---|
| 运行时 | **原生 JS + Canvas 2D**，经典 `<script>`，无框架无构建 |
| 循环 | `requestAnimationFrame` |
| 音频 | **Web Audio API**（`OfflineAudioContext` 离线合成 / `MediaRecorder` 录 WebM） |
| 图形 | 全程序化：粒子、贝塞尔、渐变、自写铅笔排线 `hatchFill()`。**零图片 / 零贴图 / 零网络字体** |
| 出片 | **Node + 原生 Chrome DevTools Protocol + ffmpeg**（零 npm 依赖） |

**刻意没用**：Vite、TypeScript、React、Three.js、p5.js、p5.brush、puppeteer。
理由写在 [REFERENCES.md](REFERENCES.md) §4/§7 —— 简单说：动画短片不需要 UI 工具链，
零依赖才能"双击即开 + 离线渲染零安装"，而手绘插画质感用 Canvas2D 就够。

---

## 配乐

成片用的是 **The Chainsmokers & Coldplay《Something Just Like This》**。BPM 不是猜的，是实测的：

```bash
node analyze_bgm.mjs assets/bgm.mp3 --target=60
```

| 项 | 实测值 |
|---|---|
| BPM | **103.00**（BPM × 相位联合精修） |
| 第一拍 / 小节重拍 | 0.412 s |
| 每小节（4/4） | 2.330 s |
| 切段起点 | **21.3829 s** ＝ 第 9 小节线 |
| 成片长度 | **26 小节 = 60.58 s**（取 60.6 s 是为了凑满 30fps 的整帧数：1818 帧） |

**选段原则：让片子最贵的那一幕落在副歌上，而且起点必须落在小节线上。**
本片高潮是"黑洞"（片内 41.9s），起点取第 9 小节线 21.3829 s
→ 黑洞正好落在歌曲 63.3s（副歌摔下来的那一下），片尾落在 82.0s（副歌后半）。
切完**复核过一次**：分析器给出第一拍 `0.017s` ⇒ 片内 `t=0` 就是重拍 ⇒ `G.T.off = 0` 成立。

> 上一版切在 20.5318 s（看着像小节线），复核后发现片内第一个拍点在 0.267 s —— 整片节拍网格
> 偏了将近半拍。既然起点必须是小节线，就先用分析器拿到 0.412，再算 0.412 + n × 2.3301。
>
> 用整数小节的另一个好处：结尾正好落在重拍上（上一版 19.31 小节的结尾落在小节线之后 0.73 s）。

> ⚠️ **版权**：这首歌是商业发行作品。仓库里**不包含**它（见 `.gitignore`），
> 请自行准备音乐文件。发布的成片请换成自有或已授权音乐——换歌流程见 [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md) §6.1。

---

## 导出成片

```bash
node render.mjs --selftest                          # 自检：幕数 / 音轨 / JS 错误
node render.mjs --sheet=0,6,12,20,26 --cols=4 --w=430 --out=out/sheet.jpg   # 联络表（审片用）
node render.mjs --rig --out=out/rig.jpg             # 角色标准姿势表（改了 char.js 先出这张）

# 整片（推荐）
node render.mjs --dumpdemo=out/demo.wav             # 没音乐时先导出内置合成音轨
node render.mjs --frames=0:60.6 --fps=30 --workers=4 --out=out/frames   # 逐帧，可断点续传
node render.mjs --encode --fps=30 --audio=assets/bgm-60s.m4a --out=out/video.mp4

# 只渲一小段
node render.mjs --clip=7:12 --fps=30 --audio=assets/bgm-60s.m4a --out=out/clip.mp4
```

需要本机有 **Chrome** 与 **ffmpeg**。渲染器不用 puppeteer，它用 Node 内置的 `fetch` /
`WebSocket` 直连 Chrome DevTools Protocol（`--remote-debugging-port=0` + 读 `DevToolsActivePort`）。

实测：1818 帧 @ 4 workers ≈ 4 分钟，ffmpeg 编码 ≈ 3.5 分钟。

---

## 目录结构

```text
WhaleAnimationBase/
├── index.html            # 播放器页面（经典 <script> 按顺序加载）
├── js/                   # 引擎 + 剧本
│   ├── core.js           # 内核：数学 / 确定性抖动 / 铅笔排线 / 纸纹 / 相机 / 手写字
│   ├── char.js           # ★ 主角小鲸鱼（参数化造型；paint / sketch：铅笔稿 → 上色）
│   ├── props.js          # 道具：气泡 / 音符 / 波纹 / 海草 / 数据光点
│   ├── odyssey.js        # ★ 剧本：17 幕形态系统 + 17 幕时间轴（换片子只改这个）
│   ├── audio.js          # 音频：示范 BGM 离线合成 / 外部 BGM / 节拍器 / 导出 WAV
│   └── main.js           # 播放器逻辑 + 离线渲染接口
├── render.mjs            # 离线渲染器：无头 Chrome 逐帧 → ffmpeg 编码
├── analyze_bgm.mjs       # 配乐分析器：实测 BPM / 拍点 / 段落结构 / 选段推荐
├── docs/                 # README 配图
│   ├── hero.jpg
│   ├── morph.jpg
│   └── sheet.jpg
├── assets/               # 用户自备音乐（已被 .gitignore 排除）
│   └── README.txt
├── out/                  # 渲染产物（已被 .gitignore 排除）
├── ANIMATION_GUIDE.md    # 复用手册
├── REFERENCES.md         # 参考资料 + 仓库地址
├── README.md
├── LICENSE
└── .gitignore
```

**分层原则：把"画什么形状"和"怎么画"分开。** `odyssey.js` 只管形状与时间，
`core.js` 只管笔触与质感。所以想换材质（比如换成 p5.brush 水彩）只动 `core.js` 一层，
13 幕剧本一行不改。

---

## 文档

| 文件 | 内容 |
|---|---|
| [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md) | **复用手册**：技术栈 / 引擎 API 速查 / 形态系统 / 时间轴与音频 / 出片 / **16 条踩坑记录** / 性能 / 新片检查清单 |
| [REFERENCES.md](REFERENCES.md) | **参考资料**：所有仓库与链接地址、视觉参考片分析、数学与物理公式出处、逐项标注实测/引用/存疑 |

---

## 已知取舍

- **首尾同框 ≠ 逐像素相同**：片尾的相机、配色、海面构图与开头一致，所以看上去是一段可以循环的
  结尾 —— 但浮游物、光柱、手绘抖线都还在按时间运动（抖线每 1/12 秒换一次种），
  逐像素比对并不一样。也不该一样：完全一致的末帧等于一个硬切。
- **实时播放吃性能**：1400 粒子 + 多条曲线，低端机 30fps 可能掉帧；**离线渲染不受影响**。
- **手绘质感优先于物理正确**：微波背景那一幕是多正弦叠加的**视觉近似**（真做要球谐函数）；
  引力波用指数衰减代替 `1/r`。逐条标注见 [REFERENCES.md](REFERENCES.md) §8。
- **材质是「平涂 + 抖动线条 + 铅笔排线」**，不是 p5.brush 那种水彩。想换水彩见 [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md) §11-C。
- **音画同步以 AudioContext 时钟为准**；输出延迟大时用页面上的「偏移」微调。
- **参考片的原始出处未确认**（B 站为搬运版），详见 [REFERENCES.md](REFERENCES.md) §11。

---

## 许可

- **代码**：MIT，见 [LICENSE](LICENSE)。
- **成片中的配乐**：不属于本项目，版权归原权利人，**未获授权**，请勿公开分发带该音乐的成片。
- **参考与灵感**来源见 [REFERENCES.md](REFERENCES.md)，其中 p5.brush（MIT）与 PDoomVideo（ISC）的
  代码**均未被复制进本仓库**——本项目只在架构思路层面受其启发。
