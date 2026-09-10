# 鳄鱼拔牙（网页版）

用浏览器打开即可玩的免费双人同屏小游戏：鳄鱼嘴里只有一颗机关牙，上下两排牙齿都能按，想按几颗按几颗，按到机关牙的人被鳄鱼咬住出局。

- 在线地址：https://xyyyddd.github.io/crocodile-teeth/
- 技术：原生 HTML + CSS + JavaScript（SVG 绘制鳄鱼，无任何第三方依赖，无图片素材）
- 玩法：两个人共用一台设备轮流点牙；无回合提示、无玩家编号；每局机关牙随机

## 本地运行

直接双击 `index.html` 即可；或起一个本地静态服务器：

```bash
npx serve .
```

## 文件说明

```
index.html     页面结构 + 内联 SVG 鳄鱼
styles.css     样式（奶油底色 / 圆角 / 动效）
game.js        玩法逻辑（建牙、机关牙、咬合动画、音效）
favicon.svg    站点图标
robots.txt     SEO 抓取配置
sitemap.xml    SEO 站点地图
assets/og.png  社交分享预览图
```

## 部署

仓库推送到 GitHub 后，在仓库 Settings → Pages 中选择 `main` 分支根目录即可发布。