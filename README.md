# Paper2CoreCode 📄⚡

English | [简体中文](README.zh-CN.md)

Paper2CoreCode is a desktop tool that turns research papers into readable summaries and exportable minimal core code.

It is designed for researchers, engineers, and students who want to quickly understand a paper and, when possible, obtain a small implementation of the paper's core computational contribution.

## What It Does ✨

- 📄 Analyze academic paper PDFs.
- 🧠 Generate structured paper summaries with DeepSeek / Jiekou / MiniMax / GLM.
- 🧮 Render Markdown, tables, and LaTeX formulas clearly.
- 💻 Decide whether the paper needs core code.
- 🧭 Plan a minimal core-code blueprint before writing files.
- 📦 Export generated core code as a local project folder.
- 🌐 Switch between Chinese and English UI/output.
- 🖥️ Run as a local Electron desktop app.

## Core Workflow 🚀

1. Select a provider (DeepSeek / Jiekou / MiniMax / GLM) and enter your API key in the sidebar.
2. Choose a model.
3. Select a paper PDF.
4. Start analysis.
5. Read the streamed summary.
6. If code is applicable, the model first plans the smallest file set needed for the paper's core contribution.
7. Download generated core code if the blueprint and files pass local validation.

## Core Code Generation

Paper2CoreCode is intentionally not a full experiment-reproduction generator. It aims to export only the smallest reusable code needed to represent the paper's core computational contribution.

Before code is cached for download, the model must produce a core-code blueprint that describes:

- The inferred paper domain.
- The core contribution to implement.
- The minimal implementation boundary.
- The exact files to generate.
- The purpose and main symbols for each file.
- Items intentionally omitted because they are not part of the core contribution.

Generated files must match the blueprint exactly. Extra files are rejected, missing blueprint files are rejected, and unsafe paths are rejected. This helps avoid over-generating training scripts, datasets, baselines, experiment runners, or full application pipelines when the paper only proposes a smaller method such as a loss, module, dispatch rule, signal-processing algorithm, controller, estimator, or objective function.

## Model Providers

Paper2CoreCode supports multiple OpenAI-compatible model providers:

- DeepSeek: `deepseek-v4-flash`, `deepseek-v4-pro`.
- Jiekou: Claude, Gemini 3.1 preview, and GPT 5.5 models that work with the current chat completions endpoint.
- MiniMax: `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`.
- GLM: `glm-5.1`, `glm-5`, `glm-5-turbo`.

API keys and model choices are stored separately for each provider in the local app user data directory. Switching providers reloads that provider's own saved key and model.

Some Jiekou GPT variants are shown as unsupported and disabled in the model selector because the current Jiekou API gateway rejects them for this app's chat completions flow.

## CI And Release

Pull requests run `npm run build` on Windows, macOS, and Linux through GitHub Actions.

Version tags like `v0.1.3` trigger the release workflow, which builds platform packages for Windows, macOS, and Linux.

## Tech Stack 🛠️

- Electron + TypeScript
- React + Vite
- DeepSeek / Jiekou / MiniMax / GLM APIs (OpenAI-compatible)
- `pdf-parse`
- `react-markdown` + KaTeX
- `electron-builder`

## Download 📦

Prebuilt packages are published on the [GitHub Releases](https://github.com/lemonmindyes/paper2corecode/releases) page.

- Windows: `.exe` installer and `.zip`
- macOS: `.dmg` and `.zip`
- Linux: `.AppImage` and `.deb`

Release packages are generated automatically when a version tag like `v0.1.3` is pushed.

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
- Generated code is cached locally first, then exported by the user after blueprint validation.
- Current desktop builds are unsigned and use the default Electron icon.

## License

Apache License 2.0. See [LICENSE](LICENSE).
