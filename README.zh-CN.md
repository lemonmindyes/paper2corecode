# Paper2CoreCode 📄⚡

[English](README.md) | 简体中文

Paper2CoreCode 是一款桌面端论文阅读与核心代码生成工具，可以把论文 PDF 转换为结构化总结，并在适合复现时导出核心代码项目。

它适合研究人员、工程师和学生快速理解论文内容，并获得可继续开发的组件化实现骨架。

## 它能做什么 ✨

- 📄 分析学术论文 PDF。
- 🧠 使用 DeepSeek / Jiekou 生成结构化论文总结。
- 🧮 清晰渲染 Markdown、表格和 LaTeX 公式。
- 💻 判断论文是否需要生成核心代码。
- 📦 将生成的核心代码导出为本地项目文件夹。
- 🌐 支持中文和英文界面/输出切换。
- 🖥️ 作为本地 Electron 桌面应用运行。

## 核心流程 🚀

1. 在侧边栏选择模型供应商（DeepSeek / Jiekou）并配置 API Key。
2. 选择模型。
3. 选择论文 PDF。
4. 开始分析。
5. 阅读实时流式生成的论文总结。
6. 如果存在核心代码，下载生成的代码项目。

## 模型供应商

Paper2CoreCode 支持多个 OpenAI-compatible 模型供应商：

- DeepSeek：`deepseek-v4-flash`、`deepseek-v4-pro`。
- Jiekou：当前 chat completions 流程可用的 Claude、Gemini 3.1 preview 和 GPT 5.5 模型。
- MiniMax：`MiniMax-M2.7`、`MiniMax-M2.7-highspeed`、`MiniMax-M2.5`、`MiniMax-M2.5-highspeed`。
- GLM：`glm-5.1`、`glm-5`、`glm-5-turbo`。

API Key 和模型选择会按供应商分别保存在本机应用用户数据目录中。切换供应商时，应用会重新加载该供应商自己的 API Key 和模型。

部分 Jiekou GPT 变体会在模型选择器中标记为 unsupported 并禁用，因为当前 Jiekou API 网关会拒绝它们用于本应用的 chat completions 流程。

## CI 与发布

Pull Request 会通过 GitHub Actions 在 Windows、macOS 和 Linux 上运行 `npm run build`。

推送类似 `v0.1.2` 的版本标签时，会触发 release workflow，并为 Windows、macOS 和 Linux 构建平台安装包。

## 技术栈 🛠️

- Electron + TypeScript
- React + Vite
- DeepSeek / Jiekou API（OpenAI-compatible）
- `pdf-parse`
- `react-markdown` + KaTeX
- `electron-builder`

## 下载 📦

预构建安装包会发布在 [GitHub Releases](https://github.com/lemonmindyes/paper2corecode/releases) 页面。

- Windows：`.exe` 安装包和 `.zip`
- macOS：`.dmg` 和 `.zip`
- Linux：`.AppImage` 和 `.deb`

当推送类似 `v0.1.0` 的版本标签时，Release 产物会由 GitHub Actions 自动构建并上传。

## 开发

```bash
npm install
npm run dev
```

构建应用：

```bash
npm run build
```

构建平台安装包：

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

构建产物会生成到 `release/`。

## 说明

- API Key 会保存在本机应用用户数据目录中。
- 暂不支持没有可提取文本的扫描版 PDF。
- 生成的代码会先缓存在本地，再由用户主动导出。
- 当前桌面端构建未签名，并使用默认 Electron 图标。

## 开源协议

Apache License 2.0。详见 [LICENSE](LICENSE)。
