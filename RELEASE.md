# Clip2File 上架指南

本文档列出将 Clip2File 发布到 Chrome Web Store 所需的全部步骤与材料。

---

## 一、开发者账号准备

1. 打开 https://chrome.google.com/webstore/devconsole
2. 使用 Google 账号登录
3. 首次发布需支付一次性 **$5 美元** 注册费（信用卡，终身有效，可发布任意数量扩展）

---

## 二、构建打包

```bash
cd /e/dev_test/clip2file
npm install
npm run build
```

构建产物位于 `dist/` 目录。

打包为 zip（注意 `manifest.json` 必须在 zip 根目录）：

```bash
cd dist
zip -r ../clip2file-v1.0.0.zip .
cd ..
```

Windows 用户也可以直接进入 `dist/` 文件夹，全选文件后右键「压缩到 ZIP 文件」。

---

## 三、商店素材准备

### 3.1 必需素材

| 素材 | 要求 | 当前状态 | 路径 |
|------|------|---------|------|
| 扩展图标 | 128×128 PNG | ✅ 已有 | `public/icons/icon128.png` |
| 扩展包 zip | `manifest.json` 在根目录 | ✅ 构建后生成 | `dist/` → `clip2file-v1.0.0.zip` |
| 隐私政策 URL | 公开可访问 | ✅ 已启用 | https://bk4ice.github.io/clip2file/ |

### 3.2 推荐素材

| 素材 | 要求 | 建议 |
|------|------|------|
| 截图 | 1280×800 或 640×400 PNG/JPG | 至少 1 张，建议 2-3 张 |
| 小图块 | 440×280 PNG | 商店搜索结果展示，强烈建议 |
| 宣传图 | 1400×560 或 920×680 | 可选，用于商店详情页顶部 |

现有可用素材：
- `assets/banner.png` — 可用于宣传图 / 小图 tile（建议裁剪为 440×280 或 1280×800）

### 3.3 截图内容建议

1. **Popup 主界面**：展示检测出 Python 代码并生成 `main.py`
2. **右键菜单**：网页选区文字 → 右键 → Save as File with Clip2File
3. **Options 设置页**：展示 General / Privacy 标签页

---

## 四、商店表单填写

### 4.1 基本信息

| 字段 | 建议内容 |
|------|----------|
| Name | Clip2File |
| Version | 1.0.0（与 `manifest.json` 一致）|
| Category | Productivity |
| Language | English / 中文（简体） |

### 4.2 商店描述（Store Listing）

**English:**

> Clip2File — save clipboard content or web selections as the right file instantly.
>
> Copy code, text, JSON, Markdown or images, then press Alt+S or click the toolbar icon to generate the correct file with the proper name and extension. Supports multi-file project ZIPs, cross-domain image downloads, and self-contained HTML output. All processing happens locally in your browser. No data is uploaded.

**中文：**

> Clip2File — 把剪贴板或网页选区内容一键保存为正确格式的文件。
>
> 复制代码、文本、JSON、Markdown 或图片，按 Alt+S 或点击扩展图标，即可自动生成带有正确扩展名的文件。支持多文件项目 ZIP、跨域图片下载、自包含 HTML 输出。所有处理均在浏览器本地完成，不上传任何数据。

### 4.3 单一用途说明（Single purpose）

> This extension helps users save clipboard content or selected web page text/images as properly formatted local files (code, Markdown, HTML, or ZIP).

### 4.4 权限说明（Justification）

| 权限 | 用途说明 |
|------|----------|
| `storage` | Save user preferences from the Options page (default filename, toggles) |
| `contextMenus` | Provide the right-click "Save as File" menu item |
| `downloads` | Save generated files to the user's local downloads folder |
| `scripting` | Execute scripts in the active tab to read selected text/images |
| `activeTab` | Access the current tab's content to read user selection |
| `clipboardRead` | Read clipboard text/images to detect type and generate a file |
| `host_permissions: <all_urls>` | Fetch image bytes from any hosting domain when saving a selection containing images |

### 4.5 隐私实践（Privacy practices）

- **Data usage**: 选择「No user data collected」
- **Privacy policy URL**: `https://bk4ice.github.io/clip2file/`
- **Single purpose**: 粘贴上方单一用途说明

---

## 五、提交流程

1. 登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 点击 **Add new item**
3. 上传 `clip2file-v1.0.0.zip`
4. 填写商店信息、截图、隐私政策 URL
5. 仔细检查红色感叹号的必填项
6. 点击 **Submit for review**

---

## 六、审核时间与注意事项

- 普通插件：1-3 天
- 使用了 `<all_urls>` 等敏感权限，可能触发人工复核：1-2 周
- 常见被拒原因：
  - 权限理由写得不够具体
  - 隐私政策 URL 无法访问
  - 截图与扩展功能不符
- 收到邮件后按反馈修改，重新上传即可，无需重新付费

---

## 七、发布后

- 首次发布可选择 **Unlisted** 先内测，稳定后再切换为 **Public**
- 后续更新：修改 `manifest.json` 中的 `version`（如 `1.0.1`），重新 `npm run build` 打包 zip，在同一条目上传新版本

---

## 八、材料清单核对

- [ ] Chrome Web Store 开发者账号已注册并支付 $5
- [ ] 构建产物 `dist/` 已生成
- [ ] `dist/` 已打包为 `clip2file-v1.0.0.zip`
- [ ] `manifest.json` 在 zip 根目录
- [ ] 128×128 图标在 `public/icons/icon128.png`
- [ ] 隐私政策页面 https://bk4ice.github.io/clip2file/ 可访问
- [ ] 1-3 张 1280×800 / 640×400 截图已准备
- [ ] 440×280 小图 tile 已准备（可选但推荐）
- [ ] 商店描述（中英双语）已准备
- [ ] 权限说明文案已准备
