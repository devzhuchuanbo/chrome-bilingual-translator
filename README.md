# 本地双语翻译

一个基于 Chrome 内置 Translator API 的 Manifest V3 扩展。它在设备本地翻译网页，可将中文显示在原文下方，也可在视觉上用译文替换原文。

## 功能

- 自动识别网页语言，默认翻译为简体中文
- 双语模式：译文紧跟在原文下方
- 替换模式：隐藏原节点并显示译文，可无损恢复
- 优先翻译视口附近内容，支持 SPA 和无限滚动页面
- 段落级翻译、结果缓存、失败重试
- 当前站点自动翻译规则
- 译文颜色、字号和间距设置
- 通过 Chrome 同步默认模式、目标语言、外观和站点规则
- 全程使用 Chrome 内置模型，不上传网页文本

## 环境要求

- 桌面版 Chrome 138 或更高版本
- Node.js 20 或更高版本（仅开发时需要）

Chrome 会在首次使用某个语言对时下载语言包。下载是否可用以及支持的语言对由 Chrome 和当前设备决定。移动版 Chrome 不支持此 API。

## 本地安装

```bash
npm install
npm run build
```

然后：

1. 打开 `chrome://extensions`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择 `.output/chrome-mv3` 目录
5. 打开普通 `http` 或 `https` 网页，点击扩展图标并选择“翻译当前网页”

## 开发命令

```bash
npm run dev        # 开发模式
npm run typecheck  # TypeScript 类型检查
npm test           # 单元测试
npm run build      # 生产构建
npm run zip        # 生成商店上传包
```

## 权限说明

- `activeTab`：用户点击扩展时处理当前网页
- `scripting`：按需注入翻译脚本
- `storage`：同步偏好设置，并在本机保存翻译缓存
- 可选站点权限：仅当用户开启“自动翻译此网站”时，为该站点单独申请

扩展不会默认获取所有网站的持续访问权限。

## Chrome 账号同步

- 默认展示模式、目标语言、译文外观和自动翻译站点规则保存在 `chrome.storage.sync`
- 登录同一 Google 账号并开启 Chrome 同步后，这些设置可同步到其他电脑
- 网站访问权限不会同步；每台电脑首次启用自动翻译时都需要单独确认
- 翻译缓存继续保存在 `chrome.storage.local`，不会上传或同步
- Chrome 翻译语言包由每台电脑分别下载

从旧版本升级时，本机原有设置会自动迁移到 Chrome 同步存储。

## 实现结构

- `entrypoints/content.ts`：网页翻译控制器入口
- `lib/dom/`：正文识别和过滤
- `lib/translator/`：语言检测、Chrome Translator API 和缓存
- `lib/render/`：双语/替换模式渲染及恢复
- `entrypoints/popup/`：当前网页控制和进度
- `entrypoints/options/`：默认模式、外观和站点规则

## 已知限制

- 翻译质量取决于 Chrome 内置模型，不具备可提示的大语言模型上下文和术语库能力。
- `chrome://`、Chrome 应用商店等受保护页面不允许扩展注入。
- 极度依赖自定义布局、Shadow DOM、Canvas 或跨域 iframe 的内容可能无法识别。
- 首版不包含 PDF、视频字幕、划词翻译和输入框翻译。
- 页面语言按正文样本统一识别；高度混合多语言的页面可能有部分段落未达到最佳结果。

## 隐私

网页正文由 Chrome 内置 Translator API 在本机处理。本扩展没有服务器，不收集、上传或共享网页内容。偏好设置和站点规则通过 Chrome 自带的同步存储同步；网页正文和翻译结果不会进入同步存储。翻译缓存保存在 `chrome.storage.local`，最多保留约 500 条最近使用的段落结果。
