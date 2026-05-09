# Paper2CoreCode 📄⚡

[English](README.md) | 简体中文

Paper2CoreCode 是一款桌面端论文阅读与核心代码生成工具，可以把论文 PDF 转换为结构化总结，并在适合复现时导出核心代码项目。

它适合研究人员、工程师和学生快速理解论文内容，并获得可继续开发的组件化实现骨架。

## 它能做什么 ✨

- 📄 分析学术论文 PDF。
- 🧠 使用 DeepSeek 生成结构化论文总结。
- 🧮 清晰渲染 Markdown、表格和 LaTeX 公式。
- 💻 判断论文是否需要生成核心代码。
- 📦 将生成的核心代码导出为本地项目文件夹。
- 🌐 支持中文和英文界面/输出切换。
- 🖥️ 作为本地 Electron 桌面应用运行。

## 核心流程 🚀

1. 输入 DeepSeek API Key。
2. 选择 DeepSeek 模型。
3. 选择论文 PDF。
4. 开始分析。
5. 阅读实时流式生成的论文总结。
6. 如果存在核心代码，下载生成的代码项目。

## 技术栈 🛠️

- Electron + TypeScript
- React + Vite
- DeepSeek API
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
