# Release Log

## 0.1.3

- Added a core-code blueprint step before generated files are cached for export.
- Reworked code generation guidance to avoid fixed full-project templates and focus on the paper's minimal computational contribution.
- Added local validation so generated code files must exactly match the blueprint file list.
- Added blueprint metadata to cached code bundles and export README content.
- Added MiniMax and GLM model providers alongside DeepSeek and Jiekou.
- Added Vitest-based backend functional tests for blueprint validation, analyzer parsing, and code export.
- Updated PR CI to run tests on Windows, macOS, and Linux before building.

## 0.1.2

- Added Jiekou as a model provider alongside DeepSeek.
- Added provider-scoped API key and model storage so credentials do not leak between providers.
- Added Jiekou model-specific request handling for supported Gemini models.
- Disabled Jiekou GPT variants that currently fail with the available chat completions endpoint.
- Improved API error display by showing backend error details in the UI.
- Updated PR CI to build on Windows, macOS, and Linux.
