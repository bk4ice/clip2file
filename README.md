<p align="center">
  <img src="assets/banner.png" alt="Clip2File banner" width="100%" />
</p>

<h1 align="center">Clip2File</h1>

<p align="center">
  把选中的网页内容，直接变成可用的本地文件。<br/>
  <strong>Save selected web content as useful local files.</strong>
</p>

<p align="center">
  <a href="https://github.com/bk4ice/clip2file/releases">Releases</a> •
  <a href="#install">安装</a> •
  <a href="#features">功能</a> •
  <a href="https://bk4ice.github.io/clip2file/">隐私政策</a>
</p>

---

## 简介

在网页里看到一段文字、代码、图片或表格，复制之后还要手动建文件、整理格式？按一下 `Alt + S`，或者右键选中内容，Clip2File 自动识别类型、给出合适的文件名，直接存到本地。

**你可以用它做这些：**

- 复制网页中的文字、笔记、文章段落 → 保存为 `.txt` 或 `.md`
- 复制网页里的图片或图文选区 → 保存为自包含的 `.html` 或 `.zip`
- 复制 Python / JavaScript / JSON / Markdown 等代码 → 保存为 `main.py` / `script.js` / `data.json` / `README.md`
- 复制包含多个代码块的网页内容 → 自动解析并导出为项目 ZIP
- 在网页中右键选中的文字或图片 → 选择「智能保存」或指定 TXT / Markdown / HTML / ZIP 格式
- 随时随地按 `Alt + S` 快速保存剪贴板或选区

**核心优势：**

- ⚡ **极速**：一个快捷键或一次右键即可保存
- 🧠 **智能**：自动识别文本、图片、代码等 15+ 种内容类型
- 🖼️ **支持图片**：剪贴板图片、网页图片、图文混合选区都能处理
- 🔒 **本地且私密**：不上传、不追踪、无广告、无遥测
- 🎨 **原生体验**：简洁界面，支持浅色 / 深色模式

告别手动拖拽、重命名文件。复制 → 保存 → 完成。

## 功能

- 🚀 按 `Alt + S`、点扩展图标，或右键 → 直接生成文件
- 🧠 自动识别文本、图片、代码、JSON、Markdown 等 15+ 种类型
- 📦 多段内容自动打包成 ZIP
- 🖼️ 支持剪贴板图片、网页图片、图文混排
- ⚡ `Alt + S` 快速保存，`Alt + Y` 打开面板
- 🖱️ 右键菜单：保留智能保存，并支持选择 TXT / Markdown / HTML / ZIP
- 🎨 简洁界面，支持浅色 / 深色模式

## 1.2.0：网页选区保存质量升级

以用户选中的区域为范围，不抓取整篇文章或整页镜像。

- HTML 保留选区内标题、段落、列表、链接、表格和图文顺序，图片内嵌以便离线阅读。
- 右键 Markdown：无图片生成 `.md`；有图片生成 ZIP，包含 `content.md` 与 `assets/`，图片使用相对路径。
- 合并单元格或不规则表格在 Markdown 中保留为安全 HTML，并提示编辑器兼容性限制；不提供 CSV/TSV。
- 缺失图片保留原位说明，并显示可关闭的部分完成提示；失败不再只记录在控制台。
- TXT 不保留格式或链接地址，含图片的选区仍需使用 HTML/Markdown。
- 图片请求限制：单张 10 MiB、总计 30 MiB、最多 100 个资源；网络/画布后备单次最多 8 秒，整个图片阶段最多 45 秒。
- 不导出网页脚本、事件属性或不安全链接。不支持背景图片、Canvas、视频、闭合 Shadow DOM 和虚拟列表中未加载的内容。
- 剪贴板 Popup 保留既有操作；本次结构化提取针对右键和 Alt+S 的网页选区。

### English

Save only the selected web content, not the entire article or page. HTML preserves semantic structure and image order with embedded offline images. Markdown selections without images produce `.md`; selections with images produce a ZIP containing `content.md` and relative `assets/` files. Missing images retain placeholders and trigger a dismissible partial-result warning. Merged or irregular tables remain safe HTML inside Markdown with a compatibility warning.

## 安装

### 方式一：Chrome Web Store（推荐方式）

访问 [Chrome Web Store 页面](https://chromewebstore.google.com/detail/clip2file/gfmpdogdgjfbcnhonaljiohncogoiooo)，点击“添加至 Chrome”。

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

真实 Chromium MV3 导出测试：

```bash
npm exec -- playwright install chromium
npm run build
npm run test:browser
```

浏览器测试通过临时扩展静态捕获菜单回调，验证真实后台、页面注入、图片获取和下载；原生右键点击及系统 Alt+S 仍需手动验收。测试不会修改用户的 Chrome 资料目录。安装测试浏览器时可设置 `PLAYWRIGHT_SKIP_BROWSER_GC=1`，避免自动清理旧版测试浏览器缓存。

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
└── README.md       # 本文件
```

## 隐私

处理全在本地，不上传。详见 [隐私政策](https://bk4ice.github.io/clip2file/)。

## 协议

[MIT](LICENSE)

## 贡献

欢迎提 Issue 和 PR。
