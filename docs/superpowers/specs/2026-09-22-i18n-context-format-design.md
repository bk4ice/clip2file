# Clip2File 1.1.0 多语言与右键格式选择设计

**设计日期：** 2026-09-22
**目标版本：** 1.1.0
**状态：** 待用户最终审阅，尚未进入实现

## 1. 背景与目标

Clip2File 当前是一个 Manifest V3 Chrome 扩展，支持剪贴板/网页选区内容检测、智能文件名推断、单文件保存、图片内嵌 HTML、项目 ZIP 导出、右键菜单和快捷键。当前界面、manifest、右键菜单和商店资料存在中英文硬编码或分散维护的问题；右键菜单只有一个智能保存动作。

本版本解决两个问题：

1. 扩展内 UI、manifest、右键菜单、隐私政策和 Chrome Web Store 发布材料支持 English 与简体中文；
2. 保留现有右键“一步智能保存”，同时增加常用格式选择，不破坏智能保存路径。

## 2. 已确认的产品决策

- 首发语言：English + 简体中文。
- 语言来源：跟随 Chrome 浏览器语言；未覆盖语言回退 English；不增加扩展内语言切换设置。
- 版本号：从 1.0.0 升级到 1.1.0。
- 右键保留智能保存，并增加格式选择子菜单。
- 显式格式选择只对当前操作生效，不记忆，不改变后续智能保存。
- 格式冲突时不静默降级，不强行生成可能丢失结构的文件。
- 多文件项目不能强制导出为 TXT、Markdown 或 HTML；应使用 ZIP 或智能保存。
- 图片-only 内容不提供纯文本输出。
- 联系方式使用 `bk4ice@gmail.com`。
- 用户要求先确认本地与线上 GitHub 仓库一致，再修改代码；完成后保留本地修改记录并提交、推送到线上。

## 3. 国际化架构

### 3.1 Locale 资源

新增：

```text
public/_locales/en/messages.json
public/_locales/zh_CN/messages.json
```

`manifest.json` 使用 Chrome `__MSG_messageName__` 语法引用以下文案：

- 扩展名称；
- 扩展描述；
- 快捷键描述；
- 需要国际化的 manifest 字段。

### 3.2 运行时文案适配

新增 `src/utils/i18n.ts`，提供最小化的翻译读取接口，例如：

```ts
export function t(key: string, substitutions?: string | string[]): string;
```

该接口封装 `chrome.i18n.getMessage()`，在测试或 Chrome API 不可用时提供稳定 fallback。动态文案（保存成功、失败、构建中、不可用格式等）使用该接口，不再散落硬编码英文。

HTML 文案使用属性标记：

- `data-i18n`：替换文本内容；
- `data-i18n-placeholder`：替换 placeholder；
- `data-i18n-title`：替换 title；
- `data-i18n-aria-label`：替换 aria-label。

页面启动时统一初始化静态文案，动态创建的文件列表、状态提示和按钮 loading 文案由 TypeScript 调用 `t()`。

### 3.3 覆盖范围

纳入国际化：

- manifest 名称、描述、快捷键描述；
- 右键菜单标题和格式名称；
- Popup 全部可见文案、placeholder、title、aria-label、状态提示和 loading 文案；
- Options 全部导航、设置项、说明、按钮、状态和本地处理提示；
- 扩展内隐私政策的中英文组织和联系方式；
- `docs/index.html` 公开隐私政策；
- README 与 RELEASE 中的中英文发布材料。

不翻译：品牌名 Clip2File、文件扩展名、编程语言名、代码内容和用户输入。

## 4. 右键菜单与保存模式

### 4.1 菜单结构

```text
智能保存 / Smart Save
选择格式 / Save as...
├── 纯文本 / Plain Text
├── Markdown
├── HTML
└── ZIP
```

“智能保存”保持为顶层右键项，确保原有一次右键即可保存的路径不增加额外层级；“选择格式”作为另一个顶层项提供子菜单。

使用稳定的菜单 ID。扩展启动/安装时先移除旧菜单，再创建当前版本菜单，避免扩展更新后重复创建。

Chrome 原生 context menu 不做选区内容实时动态置灰。格式项固定展示，点击后由保存逻辑判断能力边界；不可用时不下载，并使用现有 badge/error 反馈。

### 4.2 保存模式接口

```ts
type SaveMode = 'auto' | 'text' | 'markdown' | 'html' | 'zip';
```

右键、快捷键和后续复用逻辑通过统一入口传递 `SaveMode`。`auto` 必须保持当前行为：

- 多文件项目 → ZIP；
- 有图片的网页选区 → 自包含 HTML；
- 普通文本/代码 → 检测结果对应的文件扩展名。

### 4.3 显式格式规则

| 模式 | 允许内容 | 输出 |
|---|---|---|
| `text` | 有文本的单内容 | 强制 `.txt`；代码也按纯文本输出 |
| `markdown` | 有文本或图片 | `.md`；复用 `buildMarkdown()`，图片嵌入 base64 data URL |
| `html` | 有文本或图片 | `.html`；复用 `buildHtml()`，图片嵌入 base64 |
| `zip` | 多文件项目、图片/文字组合或单文本 | 独立文件条目 ZIP；项目路径和安全校验保持不变 |

多文件项目使用 `text`、`markdown`、`html` 时拒绝操作并提示使用 ZIP/智能保存。纯图片内容使用 `text` 时拒绝操作。不可用格式不自动降级。

显式格式只替换扩展名，保留已有的基础文件名推断结果：

```text
example.py + Markdown → example.md
example.py + HTML     → example.html
example.py + TXT      → example.txt
```

文件名仍经过现有 `sanitizeFilename()` 处理。

## 5. 模块边界

尽量将格式决策从 `src/background/service-worker.ts` 中抽出，但不做无关重构：

```text
src/core/save-format.ts
  SaveMode、格式能力判断、冲突结果、扩展名决策

src/core/save-builder.ts
  根据 SaveMode 组合现有 text/Markdown/HTML/ZIP builder

src/background/service-worker.ts
  菜单注册、当前 Tab 提取、图片抓取、下载调用、badge/error 边界
```

Popup 继续保留现有交互逻辑；格式能力和扩展名规则应尽量复用核心模块，避免 Popup 与 service worker 分叉。

## 6. 错误与反馈

- 智能保存成功/失败：沿用当前 badge 反馈行为和 `badgeFeedback` 设置；
- 显式格式不可用：不下载，显示错误 badge，并输出可诊断的 `console.warn`；
- 构建异常：显示错误 badge，保留 `console.error`；
- 不引入远程服务，不上传剪贴板、选区或图片数据。

## 7. 商店材料与隐私政策

`RELEASE.md` 维护两套独立 listing 源材料：

- English：Name、Short description、Detailed description、Single purpose、Permission justifications；
- 简体中文：名称、简短描述、详细描述、单一用途、权限说明。

README、RELEASE、隐私政策和截图准备说明同步到 1.1.0。Chrome Web Store listing 仍需在 Developer Dashboard 手工录入，不做商店发布 API。

所有隐私政策中的联系方式占位符替换为：`bk4ice@gmail.com`。

## 8. 测试与验收

### 8.1 自动测试

新增格式核心测试，覆盖：

- `auto` 行为与现有规则一致；
- 普通文本、代码显式导出 TXT；
- Markdown 文本和图片输出；
- HTML 文本和图片输出；
- 项目内容只允许 ZIP/auto；
- 图片-only 不允许 TXT；
- 扩展名替换和文件名安全处理；
- locale key 完整性；
- manifest 的 `__MSG_...__` key 均存在；
- 菜单初始化不会重复创建。

### 8.2 本地验证

```bash
npm test
npm run build
```

构建后确认：

- `dist/manifest.json` 在根目录；
- `dist/_locales/en/messages.json` 存在；
- `dist/_locales/zh_CN/messages.json` 存在；
- popup/options/background 资源路径正确；
- 开发者模式加载 `dist/` 后可验证两种语言；
- 右键智能保存和四种显式格式行为符合规则；
- 图片、项目、普通文本三个关键场景无错误下载。

## 9. Git 与发布流程

实现前：

1. 访问远端并 `git fetch origin --prune`；
2. 比较本地 `HEAD`、远端默认分支和工作区状态；
3. 若远端存在本地没有的提交，先停止并向用户报告，不覆盖远端变更；
4. 保留用户当前未跟踪的产品方案文档，不纳入本次变更。

实现后：

1. 更新 `package.json`、`public/manifest.json` 和发布文档版本到 `1.1.0`；
2. 运行测试和构建；
3. 记录变更文件、测试输出和发布说明；
4. 创建 commit；
5. push 到远端 `main`；
6. 再次确认远端 commit 与本地一致，并反馈 commit hash。

## 10. 非目标

本版本不包含：

- 语言手动切换设置；
- 日语、韩语或其他语言；
- 右键菜单按选区实时动态置灰；
- 格式选择记忆；
- AI/远程转换服务；
- 保存历史；
- 新增图片格式转换；
- 与 Chrome Web Store Dashboard 的自动同步。
