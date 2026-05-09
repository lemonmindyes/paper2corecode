# Release Log

## 0.1.2

- Added Jiekou as a model provider alongside DeepSeek.
- Added provider-scoped API key and model storage so credentials do not leak between providers.
- Added Jiekou model-specific request handling for supported Gemini models.
- Disabled Jiekou GPT variants that currently fail with the available chat completions endpoint.
- Improved API error display by showing backend error details in the UI.
- Updated PR CI to build on Windows, macOS, and Linux.
