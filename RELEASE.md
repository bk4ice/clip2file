# Clip2File 上架指南

把 Clip2File 发布到 Chrome Web Store 所需的步骤、材料与文案。

---

## 一、开发者账号

1. 打开 https://chrome.google.com/webstore/devconsole
2. 用 Google 账号登录
3. 首次发布需支付一次性 **$5 美元** 注册费

---

## 二、构建打包

```bash
cd /e/dev_test/clip2file
npm install
npm run build
```

产物在 `dist/`。打包：

```bash
cd dist
zip -r ../clip2file-v1.0.0.zip .
```

注意：`manifest.json` 必须在 zip 根目录。

---

## 三、商店素材

### 3.1 必需

| 素材 | 要求 | 状态 | 路径 |
|------|------|------|------|
| 扩展包 zip | manifest 在根目录 | 构建后生成 | `clip2file-v1.0.0.zip` |
| 图标 128×128 | PNG | ✅ | `public/icons/icon128.png` |
| 隐私政策 URL | 公开可访问 | ✅ | https://bk4ice.github.io/clip2file/ |

### 3.2 推荐

| 素材 | 尺寸 | 用途 |
|------|------|------|
| 截图 | 1280×800 / 640×400 | 展示 popup、右键菜单、设置页 |
| 小图块 | 440×280 | 商店搜索结果展示 |
| 宣传图 | 1400×560 / 920×680 | 详情页顶部（可选） |

可用素材：`assets/banner.png`，裁剪为对应尺寸即可。

### 3.3 截图建议

1. Popup 保存网页文本为 `.txt`
2. Popup 检测 Python 代码，文件名 `main.py`
3. 网页选区右键 → Save as File with Clip2File
4. Options 设置页 General / Privacy

---

## 四、商店文案

### 4.1 基本信息

- Name: Clip2File
- Version: 1.0.0
- Category: Productivity
- Language: English / 中文（简体）

### 4.2 商店描述

**English:**

> **Clip2File — save any clipboard or page selection as the right file, instantly.**
>
> Tired of copying text, code, or images from web pages and then manually creating files? Just press `Alt + S` or right-click the selection. Clip2File detects the content type, picks the correct filename and extension, and downloads it for you.
>
> **What you can do:**
> - Copy text, notes, or article snippets from a web page → save as `.txt` or `.md`
> - Copy images or text + image selections → save as a self-contained `.html` or `.zip`
> - Copy Python / JavaScript / JSON / Markdown code → save as `main.py` / `script.js` / `data.json` / `README.md`
> - Copy a multi-code-block page → export as a project ZIP with proper paths
> - Right-click selected text or image → click **Save as File with Clip2File**
> - Press `Alt + S` anywhere to quick-save clipboard or selection
>
> **Why it stands out:**
> - ⚡ **Lightning fast**: one key or one right-click to save
> - 🧠 **Smart detection**: 15+ file types and content types recognized automatically
> - 🖼️ **Image-friendly**: clipboard images, cross-domain page images, and mixed text+image selections all supported
> - 🔒 **Local & private**: no data ever leaves your browser; no tracking, no ads, no telemetry
> - 🎨 **Native feel**: clean Apple-style UI with light/dark mode
>
> No more dragging text to the desktop and renaming files by hand. Copy → save → done.

**中文：**

> **Clip2File — 把剪贴板或网页选区内容一键保存为正确格式的文件。**
>
> 在网页里看到文字、代码、图片或表格，复制之后还要手动创建文件、整理格式？按一下 `Alt + S`，或右键选中内容，Clip2File 自动识别内容类型、推断最合适的文件名和扩展名，并直接下载到本地。
>
> **你可以用它做这些：**
> - 复制网页中的文字、笔记、文章段落 → 保存为 `.txt` 或 `.md`
> - 复制网页里的图片或图文选区 → 保存为自包含的 `.html` 或 `.zip`
> - 复制网页中的 Python / JavaScript / JSON / Markdown 等代码 → 保存为 `main.py` / `script.js` / `data.json` / `README.md`
> - 复制包含多个代码块的网页内容 → 自动解析并导出为项目 ZIP
> - 在网页中右键选中的文字或图片 → 点击「Save as File with Clip2File」
> - 随时随地按 `Alt + S` 快速保存剪贴板或选区
>
> **核心优势：**
> - ⚡ **极速**：一个快捷键或一次右键即可保存
> - 🧠 **智能**：自动识别文本、图片、代码等 15+ 种内容类型
> - 🖼️ **支持图片**：剪贴板图片、跨域图片、图文混合选区都能处理
> - 🔒 **本地且私密**：不上传、不追踪、无广告、无遥测
> - 🎨 **原生体验**：简洁界面，支持浅色 / 深色模式
>
> 告别手动拖拽、重命名文件。复制 → 保存 → 完成。

### 4.3 单一用途

> This extension saves clipboard content or selected web page text/images as properly formatted local files (code, Markdown, HTML, or ZIP).

### 4.4 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 保存设置（默认文件名、开关） |
| `contextMenus` | 右键「Save as File with Clip2File」 |
| `downloads` | 下载文件到本机 |
| `scripting` | 读取当前页选区内容 |
| `activeTab` | 访问当前活动页 |
| `clipboardRead` | 读取剪贴板文本/图片 |
| `host_permissions: <all_urls>` | 下载网页选区中的图片 |

### 4.5 隐私实践

- Data usage: No user data collected
- Privacy policy URL: `https://bk4ice.github.io/clip2file/`

---

## 五、提交

1. 登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Add new item，上传 zip
3. 填写商店信息、截图、隐私政策 URL
4. 处理红色必填项
5. Submit for review

---

## 六、审核

- 简单插件：1-3 天
- 含 `<all_urls>` 等权限：可能 1-2 周
- 常见拒因：权限理由不具体、隐私链接失效、截图不符
- 按邮件修改后可重新提交，无需再次付费

---

## 七、发布后

- 首次可选 Unlisted 内测，稳定后改 Public
- 更新时改 `manifest.json` 的 version，重新 build 打包，在同一项目上传

---

## 八、材料清单

- [ ] 开发者账号已注册并支付 $5
- [ ] `dist/` 已生成
- [ ] `clip2file-v1.0.0.zip` 已打包
- [ ] `manifest.json` 在 zip 根目录
- [ ] `public/icons/icon128.png` 存在
- [ ] 隐私政策页面 https://bk4ice.github.io/clip2file/ 可访问
- [ ] 1-3 张截图已准备
- [ ] 440×280 小图已准备（推荐）
- [ ] 商店描述已准备
- [ ] 权限说明已准备
