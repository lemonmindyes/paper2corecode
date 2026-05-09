# Paper2CoreCode 📄⚡

English | [简体中文](README.zh-CN.md)

Paper2CoreCode is a desktop tool that turns research papers into readable summaries and exportable core code.

It is designed for researchers, engineers, and students who want to quickly understand a paper and, when possible, obtain a componentized implementation scaffold.

## What It Does ✨

- 📄 Analyze academic paper PDFs.
- 🧠 Generate structured paper summaries with DeepSeek / Jiekou.
- 🧮 Render Markdown, tables, and LaTeX formulas clearly.
- 💻 Decide whether the paper needs core code.
- 📦 Export generated core code as a local project folder.
- 🌐 Switch between Chinese and English UI/output.
- 🖥️ Run as a local Electron desktop app.

## Core Workflow 🚀

1. Select a provider (DeepSeek / Jiekou) and enter your API key in the sidebar.
2. Choose a model.
3. Select a paper PDF.
4. Start analysis.
5. Read the streamed summary.
6. Download generated core code if available.

## Model Providers

Paper2CoreCode supports multiple OpenAI-compatible model providers:

- DeepSeek: `deepseek-v4-flash`, `deepseek-v4-pro`.
- Jiekou: Claude, Gemini 3.1 preview, and GPT 5.5 models that work with the current chat completions endpoint.

API keys and model choices are stored separately for each provider in the local app user data directory. Switching providers reloads that provider's own saved key and model.

Some Jiekou GPT variants are shown as unsupported and disabled in the model selector because the current Jiekou API gateway rejects them for this app's chat completions flow.

## CI And Release

Pull requests run `npm run build` on Windows, macOS, and Linux through GitHub Actions.

Version tags like `v0.1.2` trigger the release workflow, which builds platform packages for Windows, macOS, and Linux.

## Tech Stack 🛠️

- Electron + TypeScript
- React + Vite
- DeepSeek / Jiekou API（OpenAI-compatible）
- `pdf-parse`
- `react-markdown` + KaTeX
- `electron-builder`

## Download 📦

Prebuilt packages are published on the [GitHub Releases](https://github.com/lemonmindyes/paper2corecode/releases) page.

- Windows: `.exe` installer and `.zip`
- macOS: `.dmg` and `.zip`
- Linux: `.AppImage` and `.deb`

Release packages are generated automatically when a version tag like `v0.1.0` is pushed.

## Development

```bash
npm install
npm run dev
```

Build the app:

```bash
npm run build
```

Build platform packages:

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Build artifacts are generated in `release/`.

## Notes

- API keys are stored locally in the app user data directory.
- Scanned PDFs without extractable text are not supported yet.
- Generated code is cached locally first, then exported by the user.
- Current desktop builds are unsigned and use the default Electron icon.

## License

Apache License 2.0. See [LICENSE](LICENSE).
