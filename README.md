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
  <a href="PRIVACY.md">隐私政策</a>
</p>

---

## 简介

Clip2File 是一款 Chrome 扩展，帮助用户一键把剪贴板或网页选区内容保存为正确的文件格式：

- 复制一段 Python / JavaScript / JSON / Markdown 等代码 → 按 `Alt + S` 或右键保存为 `.py` / `.js` / `.json` / `.md`
- 复制多段代码 → 打包成项目 ZIP
- 复制带图片的网页选区 → 保存为 `.html` 或 `.zip`
- 复制纯文本 → 保存为 `.txt`

所有处理都在本地完成，**不收集、不上传、不追踪**任何用户数据。

## 功能

- 🚀 **一键保存**：复制内容后按 `Alt + S`、点击扩展图标，或右键选中内容选择「Save as File with Clip2File」即可生成文件
- 🧠 **智能识别**：自动检测 15+ 种编程语言与文件类型
- 📦 **多文件/ZIP**：自动解析 Markdown 代码块，生成项目结构或 ZIP
- 🖼️ **图片支持**：剪贴板图片、网页选区图片均可嵌入 HTML 或打包
- ⚡ **快捷键**：
  - `Alt + S` — 快速保存当前选区/剪贴板内容
  - `Alt + Y` — 打开扩展面板
- 🖱️ **右键菜单**：网页选区文字/图片 → 右键 → 另存为文件
- 🎨 **Apple 风格界面**：毛玻璃 Popup + macOS System Settings 风格选项页
- 🌓 **深色模式**：自动跟随系统偏好

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

Clip2File 在本地处理所有内容（剪贴板文本、网页选区、图片），不会将任何数据发送到开发者服务器或第三方。

详见 [PRIVACY.md](PRIVACY.md)。

## 贡献

欢迎 Issue 和 Pull Request！

## 协议

[MIT License](LICENSE)
