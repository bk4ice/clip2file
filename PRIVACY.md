# Clip2File 隐私政策 / Privacy Policy

<span lang="zh-CN" class="lang-tag">中文</span>

**最后更新日期：2025-01-01**

Clip2File（以下简称"本扩展"）是一款 Chrome 浏览器扩展，帮助用户将剪贴板内容或网页选区内容一键保存为格式正确的本地文件（文本、代码、Markdown、HTML 或 ZIP）。

**本扩展不收集、不存储、不传输任何用户数据到开发者服务器或任何第三方服务器。** 所有内容处理均在用户本地浏览器内完成。

## 我们如何使用权限

| 权限 | 用途 | 数据流向 |
| --- | --- | --- |
| `storage` | 保存用户在"设置"页面配置的偏好（如默认文件名、开关选项） | 仅存储在用户本地浏览器，不上传 |
| `contextMenus` | 提供右键菜单"另存为文件"功能 | 不涉及数据传输 |
| `downloads` | 将生成的文件保存到用户本地下载目录 | 文件直接写入用户本机磁盘 |
| `clipboardRead` | 读取剪贴板文本/图片，用于检测类型并生成文件 | 仅在本地内存中处理，不上传 |
| `activeTab` / `scripting` | 读取当前网页选中的文字或图片，用于生成文件 | 仅在本地处理，不发送到任何外部服务器 |
| `host_permissions`（`<all_urls>`） | 保存"包含图片的选区"时，需向图片所在域名请求以下载该图片 | 仅从图片原始 URL 下载数据到本地文件，不经过开发者服务器中转 |

## 我们不会做什么

- 不会将剪贴板内容、网页内容、图片或文件名发送到任何远程服务器
- 不会追踪用户浏览历史或行为
- 不会展示广告或植入第三方追踪代码
- 不会出售或提供数据给任何第三方
- 不包含任何遥测（telemetry）或分析（analytics）代码

## 数据存储

扩展仅使用 `chrome.storage.local` 存储用户偏好设置（默认文件名、界面开关），数据永久保留在用户本机，随扩展卸载而清除，开发者无法访问。

## 联系方式

如对本隐私政策有任何疑问，请通过以下方式联系开发者：_（请在此填写你的邮箱或 GitHub 地址）_

---

<span lang="en" class="lang-tag">ENGLISH</span>

# Clip2File Privacy Policy

**Last updated: 2025-01-01**

Clip2File ("the Extension") is a Chrome browser extension that helps users save clipboard content or web page selections as properly formatted local files (text, code, Markdown, HTML, or ZIP).

**The Extension does not collect, store, or transmit any user data to the developer's servers or any third party.** All content processing happens entirely within the user's local browser.

## How We Use Permissions

| Permission | Purpose | Data Flow |
| --- | --- | --- |
| `storage` | Save user preferences from the Options page (default filename, toggles) | Stored locally only, never uploaded |
| `contextMenus` | Provide the right-click "Save as File" menu item | No data transmission |
| `downloads` | Save generated files to the user's local downloads folder | Files written directly to the user disk |
| `clipboardRead` | Read clipboard text/images to detect content type and generate a file | Processed only in local memory, never uploaded |
| `activeTab` / `scripting` | Read selected text/images on the current page to generate a file | Processed locally only |
| `host_permissions` (`<all_urls>`) | Fetch image bytes from their hosting domain when saving a selection containing images | Downloaded directly from the original URL into the generated file; no developer server involved |

## What We Do Not Do

- We do not send clipboard content, page content, images, or filenames to any remote server
- We do not track browsing history or user behavior
- We do not display ads or embed third-party tracking code
- We do not sell or share any data with third parties
- The Extension contains no telemetry or analytics code

## Data Storage

The Extension uses `chrome.storage.local` to store user preferences (default filename, UI toggles). This data stays on the user's device and is cleared on uninstall.

## Contact

Questions about this policy can be sent to: _（insert your email or GitHub URL here）_
