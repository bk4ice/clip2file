# Clip2File 开发进度

> Chrome 扩展：将剪贴板/选区内容一键保存为正确的文件格式。

## 项目概览

| 项目     | 内容                               |
| -------- | ---------------------------------- |
| 名称     | Clip2File                          |
| 版本     | 1.0.0                              |
| Manifest | V3                                 |
| 技术栈   | TypeScript + Vite + Vitest + JSZip |
| 测试     | 70 个用例，8 个测试文件，全部通过  |
| 依赖     | jszip@3.10.1                       |

## 目录结构

```
clip2file/
├── public/
│   ├── manifest.json          # Chrome 扩展清单
│   ├── privacy.html           # 隐私政策页面（打包进扩展，供商店审核引用）
│   ├── icons/                 # 16/48/128px PNG（构建时生成）
│   └── README.md
├── src/
│   ├── background/
│   │   └── service-worker.ts  # 右键菜单 + 快捷键 + 图片跨域下载
│   ├── core/
│   │   ├── types.ts           # DetectResult / ParsedFile / ParseResult
│   │   ├── detector.ts        # 语言检测 + 项目检测 + 标题推断
│   │   ├── parser.ts          # Markdown 代码块解析 + 输出标记切分
│   │   ├── path-utils.ts      # 路径规范化 + ZIP Slip 防护
│   │   ├── sanitizer.ts       # 文件名安全过滤
│   │   ├── filename.ts        # 标题提取 + 文件名构造
│   │   ├── file-builder.ts    # 单文件下载（chrome.downloads）
│   │   ├── zip-builder.ts     # JSZip 打包 + Blob 下载
│   │   ├── markdown-builder.ts# 文字+图片 → .md（base64 嵌入）
│   │   └── html-builder.ts    # 文字+图片 → .html（base64 嵌入）
│   ├── popup/
│   │   ├── popup.html / .css / .ts   # Apple 风格毛玻璃卡片布局
│   ├── options/
│   │   ├── options.html / .css / .ts # macOS System Settings 双栏布局
│   └── utils/
│       └── storage.ts         # chrome.storage + commands API + DEFAULT_SETTINGS
├── tests/                     # 8 个测试文件，70 个用例
├── scripts/
│   └── gen-icons.py           # 图标生成
├── PRIVACY.md                 # 隐私政策文档（仓库内，中英双语）
├── vite.config.ts             # postBuild 仅重命名 HTML，保留 ../ 路径
├── tsconfig.json
└── package.json
```

## 权限配置

```json
"permissions": ["storage", "contextMenus", "downloads", "scripting", "activeTab", "clipboardRead"]
"host_permissions": ["<all_urls>"]
"commands": {
  "quick-save": { "suggested_key": "Alt+S" },
  "_execute_action": { "suggested_key": "Alt+Y" }
}
```

## 功能清单

### Phase 1：单文件 MVP ✅

- **语言检测**：15+ 类型（Python、JS、TS、HTML、CSS、JSON、YAML、SQL、Shell、Dockerfile、C++、Java、Go、Rust、Markdown、纯文本）
- **文件名推断**：首行标题提取，去除 Markdown 标记，截断 30 字符
- **Popup 界面**：自动读取剪贴板，实时检测，文件名可编辑，一键保存
- **右键菜单**：选中文字 → 右键 → Save as File with Clip2File
- **Options 页**：默认纯文本文件名设置，`chrome.storage` 持久化

### Phase 2：多文件/ZIP 导出 ✅

- **Markdown 代码块解析**：```和 ~~~ 围栏，围栏属性`filename=`，位置参数，上方标题/裸文件名推断
- **输出标记切分**：无围栏时按 `输出：`/`Output:` 等标记切分代码+输出为多文件
- **路径安全**：`normalizePath` 去盘符/UNC/前导斜杠，`..` 不逃逸根，`isSafePath` 防 ZIP Slip
- **ZIP 打包**：JSZip DEFLATE 压缩，路径二次校验，支持二进制（图片）条目
- **项目模式 UI**：文件列表预览（路径+语言+来源），全选/全不选，勾选，Generate ZIP

### 鲁棒性加固 ✅

| 修复       | 问题                                                     |
| ---------- | -------------------------------------------------------- |
| 未闭合围栏 | 截断的 AI 输出内容不再丢失（`FENCE_RE` 增加 `\|$` 分支） |
| CSS 误判   | `1.0`/`.add(...)` 不再被当 CSS 选择器（正则收紧）        |
| 性能优化   | `mightBeProject()` 快速预检，单文件不跑全量解析          |
| 重复解析   | `detect()` 缓存 `lastProjectParse`，popup 复用           |
| 防抖       | popup 输入 200ms 防抖                                    |
| `..` 误拒  | 段级检查，`file..txt` 不再被误拒                         |
| 语言名误判 | ` ```app.py ` 正确识别为文件名而非语言                   |
| 标题误判   | `### Summary` 不再被当文件名                             |
| ZIP 名推断 | `inferProjectTitle()` 跳过代码行，从标题提取项目名       |
| CRLF 支持  | 围栏/输出标记正则统一处理 `\r\n`                         |
| 文件数上限 | `MAX_FILES = 200`，防止病态输入                          |

### 图片支持 ✅

- **剪贴板图片读取**：`navigator.clipboard.read()` 读取 `ClipboardItem` 中的 image MIME 类型
- **粘贴事件捕获**：textarea `paste` 事件捕获 `kind=file` 图片项
- **图片预览 UI**：缩略图 + 可编辑文件名 + 文件大小 + 勾选框
- **跨域图片下载**（右键/快捷键）：两步走 + 双策略
  - 注入页面只提取文字 + 图片 URL（不受 CORS 限制）
  - Service worker `fetch` 下载图片（`host_permissions: <all_urls>` + Referer 头）
  - 后备：页面内 `<canvas>` 绘制导出
- **保存格式**：
  - 有图片 → **HTML**（base64 `<img>`，浏览器原生渲染）
  - 纯文字/多文件项目 → 原逻辑（单文件/ZIP）
  - Popup 也支持 Save as ZIP（文字+图片各自独立）

### 快捷键 ✅

| 快捷键  | 功能                                                        |
| ------- | ----------------------------------------------------------- |
| `Alt+S` | Quick Save：保存当前选区（文字+图片），无选区时回退到剪贴板 |
| `Alt+Y` | 打开 Popup                                                  |

- 快捷键触发时扩展图标 badge 闪烁（绿色 ✓ 成功 / 红色 ! 出错）
- Options 页显示当前绑定的快捷键（`chrome.commands.getAll`）
- 用户可在 `chrome://extensions/shortcuts` 自定义

### 关键设计决策

- **HTML 而非 MD 用于图片**：大多数 Markdown 渲染器不支持 `data:` base64 URL 图片，HTML 原生支持
- **避免循环依赖**：parser 不 import detector，内置轻量语言检测
- **ZIP Slip 双重防护**：parser 规范化 + zip-builder 入口校验
- **扩展名处理**：Dockerfile/Makefile 等无扩展名语言不追加 `.Dockerfile`
- **本地执行**：无 LLM，全部规则与启发式在本地完成
- **序列化安全**：`chrome.scripting.executeScript` args 用 base64 字符串，避免 ArrayBuffer 不可序列化

## 测试覆盖

| 测试文件                   | 用例数 | 覆盖内容                                                                |
| -------------------------- | ------ | ----------------------------------------------------------------------- |
| `sanitizer.test.ts`        | 4      | 路径遍历、null 字节、不安全字符、空输入                                 |
| `filename.test.ts`         | 5      | 标题提取、Markdown 标记去除、扩展名组合                                 |
| `path-utils.test.ts`       | 18     | 路径规范化、盘符/UNC/前导斜杠、`..` 解析、安全校验、扩展名补全          |
| `detector.test.ts`         | 8      | 各语言检测、mem0 配置 CSS 误判回归、项目检测、ZIP 文件名推断            |
| `parser.test.ts`           | 19     | 围栏解析、属性/标题/裸文件名、多文件、去重、未闭合围栏、CRLF、MAX_FILES |
| `zip-builder.test.ts`      | 5      | 多文件打包、路径遍历拒绝、`..` 误拒修复、绝对路径拒绝、空列表           |
| `markdown-builder.test.ts` | 5      | 文字+图片嵌入、纯文字、纯图片、多图片、data URL 格式                    |
| `html-builder.test.ts`     | 6      | HTML 文档结构、base64 图片、HTML 转义、代码块、多图片                   |
| **合计**                   | **70** | **全部通过**                                                            |

## 构建与加载

```bash
cd E:/dev_test/clip2file
npm install
npm run build    # tsc + gen-icons + vite build
npm test         # vitest run
```

构建产物在 `dist/`，加载方式：Chrome 扩展管理 → 加载已解压的扩展程序 → 选择 `dist` 目录。

主要产物大小：

- `background.js`：~6.0 KB（gzip ~2.4 KB）
- `popup.js`：~8.7 KB（gzip ~2.9 KB）
- `options.js`：~2.3 KB（gzip ~0.95 KB）
- `chunks/storage.js`：~0.6 KB（gzip ~0.28 KB）
- `chunks/html-builder.js`：~111 KB（gzip ~36 KB，含 JSZip）
- `assets/popup.css`：~9.9 KB（gzip ~2.8 KB）
- `assets/options.css`：~8.3 KB（gzip ~2.5 KB）

## 关键修复历史

1. **下载方式**：`URL.createObjectURL` 在 popup 关闭后失效 → data URL → `chrome.downloads` 不保留 filename → 最终改为注入页面 `Blob URL + a[download]`
2. **选区文本**：`info.selectionText` 丢失格式 → 改为页面 DOM `window.getSelection()` 提取
3. **CSS 误判**：mem0 Python 配置被识别为 CSS → 收紧 CSS 正则（`.` 后必须跟字母，禁止 `()` `/` `}`）
4. **多文件未识别**：无围栏的"代码+输出"被当单文件 → `splitOnOutputMarker` 按输出标记切分
5. **ArrayBuffer 不可序列化**：`chrome.scripting` args 传 ArrayBuffer 报错 → 改用 base64 字符串
6. **跨域图片丢失**：页面内 `fetch` 被 CORS 拦截 → 改为 service worker fetch + canvas 后备
7. **MD 不显示 base64 图片**：Markdown 渲染器不支持 `data:` URL → 改为生成 HTML
8. **快捷键不生效**：`Ctrl+Shift+S` 冲突 → 改用 `Alt+S` + badge 视觉反馈

## 上线前打磨（预发布检查）✅

- **调试日志清理**：移除所有纯调试用的 `console.log`（下载流程、检测结果、快捷键触发等），仅保留 `console.warn`/`console.error` 用于真实异常排查
- **隐私政策**：新增 `PRIVACY.md`（仓库内文档，中英双语）和 `public/privacy.html`（打包进扩展，Chrome Web Store 提交时可直接引用 `chrome-extension://<id>/privacy.html`，也可另外托管到 GitHub Pages）
- **新增设置项**：`badgeFeedback`（快捷键角标提示开关，默认开）、`autoCloseOnSave`（Popup 保存成功后自动关闭，默认关），持久化于 `chrome.storage.local`，`DEFAULT_SETTINGS` 常量支持一键恢复默认
- **service-worker 联动**：`flashBadge()` 读取 `badgeFeedback` 设置决定是否显示角标
- **popup 联动**：保存成功后按 `autoCloseOnSave` 设置延迟关闭窗口

## UI 重设计（Apple 风格）✅

以苹果公司顶级 UI 标准重新设计 Popup 与 Options 两个界面，采用 macOS Control Center / System Settings 的视觉语言。

### Popup（`src/popup/popup.html` + `popup.css` + `popup.ts`）

- **视觉语言**：macOS Control Center / Spotlight 观感
  - SF 系统字体栈（`-apple-system` / SF Pro / PingFang SC），告别通用 Roboto
  - 毛玻璃面板（`backdrop-filter: saturate(180%) blur(20px)`）+ 极淡的蓝色/紫色径向渐变背景
  - 胶囊形按钮（`border-radius: 980px`，Apple 标志性圆角），主按钮带蓝色光晕投影
  - 细线描边 SVG 图标替换所有 emoji（设置齿轮、下载、文件、图片、文件夹、ZIP 等），1.4px 描边
  - 检测信息改为胶囊标签 + 置信度彩色圆点（绿/琥珀/红，按置信度分级，`detect-dot` + `is-high/is-mid/is-low`）
  - 自定义 checkbox（Apple 蓝圆角方块 + 白色对勾 + 按压缩放动效）
  - Toast 状态提示：底部居中浮起的毛玻璃胶囊，弹簧缓动滑入
  - 面板入场动画：淡入 + 上移，`cubic-bezier(0.16, 1, 0.3, 1)` 缓动
  - 按钮按下 `scale(0.975)` 模拟物理按压
- **结构改进**：每个功能区（内容输入、图片、文件名、项目文件）独立成卡片面板，带小标题 + 图标，层次清晰
- **按钮 loading 状态**：文案拆到独立 `<span class="btn-label">`，JS 改文案时只改 span 不覆盖 SVG 图标

### Options（`src/options/options.html` + `options.css` + `options.ts`）

- **视觉语言**：macOS System Settings 经典布局
  - 左侧导航栏 + 右侧内容区的双栏布局（236px 侧栏）
  - 侧栏：品牌头部（Logo + 名称 + "Settings" 副标题）+ 4 个导航项（General / Shortcuts / Formats / About，带 SVG 图标）+ 底部 "On-device only" 绿色锁徽章
  - 分组内嵌列表（inset grouped list）：圆角白卡 + 行间细线分隔，和 macOS 系统设置一模一样的行布局（图标 + 标题 + 副说明 + 右侧控件）
  - iOS 风格开关（绿色 toggle，弹簧滑块动效）
  - About 页：大 Logo hero 区 + 版本号 + 隐私政策链接 + 本地处理徽章
  - 单页应用式导航：点击侧栏切换 section，带淡入上移动画，不刷新页面（`activateSection()`）
  - 大标题排版（26px，`letter-spacing: -0.02em`，Apple 式负字距）

### 两页共同点

- 完整深色模式适配（`prefers-color-scheme: dark`，所有颜色、卡片、阴影都重映射）
- `prefers-reduced-motion` 支持，尊重无障碍偏好
- 所有动效只用 `transform` / `opacity`，GPU 安全
- 自定义弹簧缓动 `cubic-bezier(0.32, 0.72, 0, 1)`
- 所有元素 ID 保留，功能逻辑零破坏

## 构建路径修复 ✅

- **问题**：`vite.config.ts` 的 `postBuild` 插件把 HTML 里 vite 生成的 `../` 路径错误重写为 `./`，但 HTML 位于 `dist/popup/`、`dist/options/` 子目录而 JS/CSS/chunks 在 `dist/` 根目录，导致 `./` 相对路径全部 404（`options.js`、`storage.js`、`options.css`、`modulepreload-polyfill.js` 等加载失败）
- **修复**：去掉错误的重写逻辑，`postBuild` 只做文件名重命名（`popup.html` → `index.html`），保留 vite 默认的 `../` 路径不变
- **验证**：构建后所有引用资源（`../popup.js`、`../chunks/*`、`../assets/*`、`../icons/*`）均存在且路径正确

## 下一阶段：Phase 3（待规划）

- [ ] 目录树可视化预览（嵌套文件夹展示）
- [ ] 文件内容预览（点击文件名展开）
- [ ] 支持更多 AI 输出格式（Anthropic `<artifact>` 块、Cursor 导出）
- [ ] ZIP 内包含 README / 项目元信息
- [ ] 拖拽导入 `.txt` / `.md` 文件解析
- [ ] 国际化与主题切换
- [ ] 图片格式转换（WebP → PNG）
- [ ] 保存历史记录

## Chrome 插件上线操作手册（首次发布）

### 第一步：准备账号

1.  打开 https://chrome.google.com/webstore/devconsole
2.  用你的 Google 账号登录
3.  首次使用需支付 一次性 $5 美元注册费（信用卡支付，终身有效，可发布任意数量插件）

### 第二步：打包扩展

在项目目录执行：

```bash
  cd E:/dev_test/clip2file
  npm install
  npm run build
```

然后把 dist/ 目录里的内容压缩成 zip（注意：manifest.json 必须在 zip 根目录，不能多包一层 dist 文件夹）：

```bash
  cd dist
  zip -r ../clip2file-v1.0.0.zip .
  cd ..
```

（Windows 也可以直接进入 dist 文件夹，全选文件后右键"压缩到 ZIP 文件"）

### 第三步：准备上架素材

在提交前先准备好这些文件，商店表单会要求：

- 图标：128×128 PNG（已有，public/icons/icon128.png）
- 至少 1 张截图：1280×800 或 640×400 PNG/JPG（建议做 2-3 张，展示 popup 弹窗、右键菜单效果）
- 小图块（可选但推荐）：440×280 PNG，用于商店搜索结果展示
- 隐私政策页面 URL：因为用到剪贴板、页面内容、广泛主机权限，几乎必填。最简单的做法：
  - 用 GitHub 建一个仓库或 GitHub Pages，放一个 PRIVACY.md/privacy.html，内容大致是：
    │ Clip2File 在本地处理所有内容（剪贴板文本、页面选区、图片），不会将任何数据发送到开发者服务器或第三方。扩展不收集、不存储、不传输用户数据。
  - 我可以帮你直接写好这个隐私政策文件，你只需要找地方托管（GitHub Pages 免费且够用）。

### 第四步：登录开发者后台，创建新条目

1.  进入 Developer Dashboard → "新增项目"（Add new item)
2.  上传第二步打好的 zip
3.  系统会自动解析 manifest.json 填充部分信息，你需要补充：

Store Listing（商店信息）

- Description（商店详情页描述，可以比 manifest 里长，可以中英双语）
- Category：建议选 "Productivity"（生产力工具）
- Language：English / 中文（可都填）
- 截图、小图块（用第三步准备的素材）

Privacy practices（隐私实践）— 这是重点，逐项如实填写

- Single purpose（单一用途说明）：例如
  │ "This extension lets users save clipboard content or selected web page text/images as properly formatted local files (code, markdown, HTML, or ZIP)."
- 权限用途说明（Justification），针对每个权限写一句话：
  - storage：保存用户在 Options 页设置的默认文件名偏好
  - contextMenus：提供"右键 → 保存为文件"菜单项
  - downloads：将生成的文件保存到用户本地磁盘
  - scripting + activeTab：读取用户在当前网页选中的文本/图片以生成文件
  - clipboardRead：读取用户剪贴板内容以检测并生成文件
  - host_permissions: <all_urls>：需要在任意网站上抓取用户选中的图片（跨域下载），因为图片可能来自任意域名的网站
- Data usage（数据使用声明）：勾选"不收集用户数据"相关选项（因为你确实全本地处理，无远程上传），填入隐私政策 URL

### 第五步：提交审核

1.  检查所有必填项（红色感叹号提示）已填完
2.  点击 "提交审核"（Submit for review）
3.  审核时间：
    - 权限简单的插件通常 1-3 天
    - 你这个插件用了 <all_urls> 广泛主机权限，可能触发人工复核，需要 1-2 周，请有心理预期
4.  如果被拒，Google 会发邮件说明原因（常见是权限理由写得不够具体、隐私政策链接失效等），修改后重新提交即可，不需要重新付费

### 第六步：发布后

- 首次发布默认是"公开"可见，也可以选择"不公开（Unlisted）"先内测，觉得没问题再切换为公开
- 后续更新版本：改 manifest.json 里的 version（如 1.0.1），重新 npm run build 打包 zip，在 Dashboard 里同一条目上传新包，无需重新付费，审核流程同上（通常比首次快）
