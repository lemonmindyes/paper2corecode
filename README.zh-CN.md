# Paper2CoreCode 📄⚡

[English](README.md) | 简体中文

Paper2CoreCode 是一款桌面端论文阅读与最小核心代码生成工具，可以把论文 PDF 转换为结构化总结，并在适合实现时导出最小核心代码。

它适合研究人员、工程师和学生快速理解论文内容，并在可行时获得论文核心可计算贡献的小型实现。

## 它能做什么 ✨

- 📄 分析学术论文 PDF。
- 🧠 使用 DeepSeek / Jiekou / MiniMax / GLM / Xiaomi MiMo / Kimi 生成结构化论文总结。
- 🧮 清晰渲染 Markdown、表格和 LaTeX 公式。
- 💻 判断论文是否需要生成核心代码。
- 🧭 在写入文件前规划最小核心代码蓝图。
- 📦 将生成的核心代码导出为本地项目文件夹。
- ⏱️ 在分析过程中显示分析状态、耗时和可用的 token 消耗。
- 🛑 支持取消正在进行的分析。
- ↔️ 支持侧边栏、上传区域和总结区域拖动缩放，并记住布局尺寸。
- 🌐 支持中文和英文界面/输出切换。
- 🖥️ 作为本地 Electron 桌面应用运行。

## 核心流程 🚀

1. 在侧边栏选择模型供应商（DeepSeek / Jiekou / MiniMax / GLM / Xiaomi MiMo / Kimi）并配置 API Key。
2. 选择模型。
3. 选择论文 PDF。
4. 开始分析。
5. 在阅读实时流式总结时查看分析状态、耗时和 token 消耗。
6. 如有需要，可以取消并重新开始分析。
7. 如果适合生成代码，模型会先规划实现论文核心贡献所需的最小文件集合。
8. 当蓝图和文件通过本地校验后，下载生成的核心代码。

## 核心代码生成

Paper2CoreCode 并不是完整实验复现生成器。它的目标是只导出表达论文核心可计算贡献所需的最小可复用代码。

在代码被缓存并允许下载前，模型必须先生成核心代码蓝图，说明：

- 推断出的论文领域。
- 要实现的核心贡献。
- 最小实现边界。
- 需要生成的精确文件列表。
- 每个文件的用途和主要符号。
- 因为不属于核心贡献而故意省略的内容。

生成文件必须与蓝图完全一致。额外文件会被拒绝，缺少蓝图文件会被拒绝，不安全路径也会被拒绝。这有助于避免在论文只提出较小方法时过度生成训练脚本、数据集、baseline、实验运行器或完整应用流水线，例如论文只提出一个 loss、模块、调度规则、信号处理算法、控制器、估计器或目标函数时，只导出对应核心代码。

## 模型供应商

Paper2CoreCode 支持多个 OpenAI-compatible 模型供应商：

- DeepSeek：`deepseek-v4-flash`、`deepseek-v4-pro`。
- Jiekou：当前 chat completions 流程可用的 Claude、Gemini 3.1 preview 和 GPT 5.5 模型。
- MiniMax：`MiniMax-M2.7`、`MiniMax-M2.7-highspeed`、`MiniMax-M2.5`、`MiniMax-M2.5-highspeed`。
- GLM：`glm-5.1`、`glm-5`、`glm-5-turbo`。
- Xiaomi MiMo：`mimo-v2.5-pro`、`mimo-v2-pro`、`mimo-v2.5`。
- Kimi：`kimi-k2.6`、`kimi-k2.5`。

API Key 和模型选择会按供应商分别保存在本机应用用户数据目录中。切换供应商时，应用会重新加载该供应商自己的 API Key 和模型。

部分 Jiekou GPT 变体会在模型选择器中标记为 unsupported 并禁用，因为当前 Jiekou API 网关会拒绝它们用于本应用的 chat completions 流程。

## CI 与发布

Pull Request 会通过 GitHub Actions 在 Windows、macOS 和 Linux 上进行检查。

推送类似 `v0.1.4` 的版本标签时，会触发 release workflow，并为 Windows、macOS 和 Linux 构建平台安装包。

## 技术栈 🛠️

- Electron + TypeScript
- React + Vite
- DeepSeek / Jiekou / MiniMax / GLM / Xiaomi MiMo / Kimi APIs（OpenAI-compatible）
- `pdf-parse`
- `react-markdown` + KaTeX
- `electron-builder`

## 下载 📦

预构建安装包会发布在 [GitHub Releases](https://github.com/lemonmindyes/paper2corecode/releases) 页面。

- Windows：`.exe` 安装包和 `.zip`
- macOS：`.dmg` 和 `.zip`
- Linux：`.AppImage` 和 `.deb`

当推送类似 `v0.1.4` 的版本标签时，Release 产物会由 GitHub Actions 自动构建并上传。

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
- 生成的代码会先在本地通过蓝图校验并缓存，再由用户主动导出。
- 当前桌面端构建未签名，并使用默认 Electron 图标。

## 开源协议

Apache License 2.0。详见 [LICENSE](LICENSE)。
