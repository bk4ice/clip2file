<p align="center">
  <img src="assets/banner.png" alt="Clip2File banner" width="100%" />
</p>

<h1 align="center">Clip2File</h1>

<p align="center">
  把剪贴板内容，直接变成文件。<br/>
  <strong>Save clipboard content as the right file, instantly.</strong>
</p>

<p align="center">
  <a href="https://github.com/bk4ice/clip2file/releases">Releases</a> •
  <a href="#install">安装</a> •
  <a href="#features">功能</a> •
  <a href="https://bk4ice.github.io/clip2file/">隐私政策</a>
</p>

---

## 简介

Clip2File 把剪贴板或网页选区内容直接存成对的文件。复制代码按 `Alt + S`，或者右键选中内容，扩展会自动判断该存成什么格式：

- Python / JavaScript / JSON / Markdown 等代码 → `.py` / `.js` / `.json` / `.md`
- 多段代码 → 项目 ZIP
- 图文选区 → `.html` 或 `.zip`
- 纯文本 → `.txt`

所有内容只在本地浏览器处理，不上传到任何服务器。

## 功能

- 🚀 按 `Alt + S`、点扩展图标，或右键 → 直接生成文件
- 🧠 自动识别 15+ 种语言和文件类型
- 📦 多段代码自动打包成 ZIP
- 🖼️ 支持剪贴板图片、网页图片、图文混排
- ⚡ `Alt + S` 快速保存，`Alt + Y` 打开面板
- 🖱️ 右键菜单：网页选区文字 / 图片 → 另存为文件
- 🎨 简洁界面，支持浅色 / 深色模式

## 安装

### 方式一：Chrome Web Store（上架后）

访问 [Chrome Web Store 页面](#)（即将上架），点击“添加至 Chrome”。

### 方式二：本地加载（开发者模式）

```bash
git clone https://github.com/bk4ice/clip2file.git
cd clip2file
npm install
npm run build
```

1. 打开 Chrome 的 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目的 `dist/` 目录

## 开发

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建扩展
npm test         # 运行测试
```

## 项目结构

```
clip2file/
├── src/            # 扩展源码
│   ├── background  # Service worker（右键菜单、快捷键、跨域下载）
│   ├── core        # 检测、解析、文件名构造、打包
│   ├── popup       # 扩展面板 UI
│   ├── options     # 设置页面 UI
│   └── utils       # 工具函数
├── public/         # 静态资源（manifest、icons）
├── tests/          # 单元测试
├── scripts/        # 构建脚本
├── docs/           # GitHub Pages 公开隐私政策页
├── PRIVACY.md      # 隐私政策文档
└── README.md       # 本文件
```

## 隐私

处理全在本地，不上传。详见 [隐私政策](https://bk4ice.github.io/clip2file/)。

## 协议

[MIT](LICENSE)

## 贡献

欢迎提 Issue 和 PR。
