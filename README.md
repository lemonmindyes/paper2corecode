# Paper2CoreCode 📄⚡

English | [简体中文](README.zh-CN.md)

Paper2CoreCode is a desktop tool that turns research papers into readable summaries and exportable core code.

It is designed for researchers, engineers, and students who want to quickly understand a paper and, when possible, obtain a componentized implementation scaffold.

## What It Does ✨

- 📄 Analyze academic paper PDFs.
- 🧠 Generate structured paper summaries with DeepSeek.
- 🧮 Render Markdown, tables, and LaTeX formulas clearly.
- 💻 Decide whether the paper needs core code.
- 📦 Export generated core code as a local project folder.
- 🌐 Switch between Chinese and English UI/output.
- 🖥️ Run as a local Electron desktop app.

## Core Workflow 🚀

1. Enter your DeepSeek API key.
2. Choose the DeepSeek model.
3. Select a paper PDF.
4. Start analysis.
5. Read the streamed summary.
6. Download generated core code if available.

## Tech Stack 🛠️

- Electron + TypeScript
- React + Vite
- DeepSeek API
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
