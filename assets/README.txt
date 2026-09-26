将自备的 BGM 放入本目录，命名为 bgm.mp3（mp3 / wav / m4a 均可）。

用途：

  node render.mjs --encode --fps=30 --audio=assets/bgm.mp3 --out=out/video.mp4
  node render.mjs --clip=0:8 --fps=30 --audio=assets/bgm.mp3 --out=out/clip.mp4

浏览器预览时，需通过页面上的「载入我的 BGM…」按钮手动选择该文件
（file:// 协议下浏览器禁止脚本读取本地文件）。

尚未确定曲目时，可点击页面上的「导出示范音轨 WAV」，导出引擎实时合成的
约 60 秒参考音轨，可用于 DAW 中的节奏参考。

本片的成片用的是按小节线切好的 assets/bgm-60s.m4a（26 小节 = 60.58s），
切法与复核流程见 ANIMATION_GUIDE.md §6.1。
注意：所有 assets/bgm-*.m4a 都已被 .gitignore 排除，不要提交进仓库。
