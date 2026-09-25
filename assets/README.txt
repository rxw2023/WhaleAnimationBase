把你自己选的 BGM 放在这个目录里，命名为 bgm.mp3（或 mp3/wav/m4a 任意名字）。

它会被用于：

  node render.mjs --encode --fps=24 --audio=assets/bgm.mp3 --out=out/whale.mp4
  node render.mjs --clip=0:8  --fps=24 --audio=assets/bgm.mp3 --out=out/clip.mp4

浏览器里预览时请用页面上的「载入我的 BGM…」按钮选这个文件
（file:// 下浏览器不允许脚本自己去读本地文件，必须手动选一次）。

还没想好歌？点页面上的「导出示范音轨 WAV」，会下载引擎实时合成的 48 秒参考音轨，
丢进 DAW 当节奏参考正好。
