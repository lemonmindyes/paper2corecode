export function buildSummaryPrompt(text: string, language: string = 'zh-CN'): { system: string; user: string } {
  const isEn = language === 'en-US'

  const system = `You are an expert AI research paper analyst. Your task is to analyze academic papers and produce structured README.md summaries.

Rules:
- Be precise and factual. Do not fabricate details not present in the paper.
- If a section (e.g. limitations) is not present in the paper, explicitly state "Not mentioned in the paper."
- Use ${isEn ? 'English' : 'Chinese'} for all output content.
- Format mathematical expressions with Markdown LaTeX delimiters: inline math as $...$ and block math as $$...$$.
- Maintain academic rigor and professional tone.`

  const paperTitle = isEn ? 'Paper Title' : '论文标题'
  const oneSentence = isEn ? 'One-Sentence Summary' : '一句话总结'
  const coreProblem = isEn ? 'Core Problem' : '核心问题'
  const keyContributions = isEn ? 'Key Contributions' : '主要贡献'
  const methodOverview = isEn ? 'Method Overview' : '方法概述'
  const experimentalResults = isEn ? 'Experimental Results' : '实验结果'
  const limitations = isEn ? 'Limitations' : '局限性'

  const userPrompt = `Please analyze the following academic paper and produce README.md content for this paper.

Paper text:
---
${text}
---

Your output MUST be valid Markdown suitable for a README.md file and follow this exact structure:

# ${paperTitle}
(extract the paper title precisely)

## ${oneSentence}
(one sentence summarizing the entire paper)

## ${coreProblem}
- What problem does this paper aim to solve?
- Why is this problem important?

## ${keyContributions}
- (list 2-5 key contributions, each as a bullet point)

## ${methodOverview}
- (describe the proposed method, key formulas, algorithms, architecture in detail)

 ## ${experimentalResults}
- (summarize key experiments, datasets, metrics, and main findings)
- Present ALL quantitative results (comparison tables, ablation studies) as proper GitHub Flavored Markdown tables using | pipes and header separator rows.
- The first column (model name) must use '---' (left-aligned). Numeric columns (IS, FID, NLL, accuracy, etc.) must use '---:' (right-aligned).
- Use inline LaTeX ($...$) for ALL mathematical symbols inside table cells, e.g. $L_{simple}$, $\Sigma$, $\le 3.70$.
- Do NOT split formulas across multiple lines within a cell. Each cell must be on a single line.
- Do NOT use spaces or tabs to align columns. Use ONLY | pipes and proper header separators.

## ${limitations}
- (list limitations mentioned in the paper, or state "Not mentioned in the paper.")

Important:
- Do not include any demo code in this README.md summary.
- Use this README.md only for paper explanation, assumptions, and integration notes.
- Do not include a code-generation assessment section. The application will generate code files separately after this summary is complete.
- For formulas, do NOT wrap LaTeX in ordinary parentheses like ( q(x_t|x_{t-1}) = ... ).
- Use inline formulas like $q(x_t \\mid x_{t-1})$.
- Use block formulas on separate lines like:
$$
q(x_t \\mid x_{t-1}) = \\mathcal{N}(x_t; \\sqrt{1-\\beta_t}x_{t-1}, \\beta_t I)
$$`

  return {
    system,
    user: userPrompt,
  }
}

export function buildCodePrompt(text: string, summaryContext: string, language: string = 'zh-CN'): { system: string; user: string } {
  const isEn = language === 'en-US'

  const system = `You are an expert AI research paper analyst. Your task is to analyze academic papers and produce structured summaries and, when applicable, extract core algorithmic implementations.

Rules:
- Be precise and factual. Do not fabricate details not present in the paper.
- If a section (e.g. limitations) is not present in the paper, explicitly state "Not mentioned in the paper."
- Use ${isEn ? 'English' : 'Chinese'} for all output content.
- Maintain academic rigor and professional tone.`

  const userPrompt = `Based on the paper and its summary below, extract or implement the core algorithms, model architectures, and training/inference procedures as a small componentized code folder.

Paper text:
---
${text}
---

Summary context:
${summaryContext}

---

Your task:
1. Identify the smallest implementable core method from the paper.
2. Implement it as multiple focused files inside a folder-style project structure.
3. Prefer Python for ML/algorithm papers.
4. Keep files componentized and minimal: configuration, model/algorithm, loss/metrics if needed, training or inference, and an example entry point.
5. Include a requirements.txt file when dependencies are needed.

Output format:
Return ONLY strict JSON. Do not wrap it in Markdown fences. Do not add prose before or after the JSON.

The JSON schema MUST be:
{
  "files": [
    {
      "path": "requirements.txt",
      "content": "..."
    },
    {
      "path": "core_code/__init__.py",
      "content": "..."
    },
    {
      "path": "core_code/config.py",
      "content": "..."
    },
    {
      "path": "core_code/model.py",
      "content": "..."
    },
    {
      "path": "core_code/losses.py",
      "content": "..."
    },
    {
      "path": "core_code/train.py",
      "content": "..."
    },
    {
      "path": "core_code/inference.py",
      "content": "..."
    },
    {
      "path": "core_code/example.py",
      "content": "..."
    }
  ]
}

If the paper is NOT suitable for code extraction, return ONLY:
{
  "files": [],
  "notApplicableReason": "brief reason"
}

Rules:
- Only implement what is clearly described in the paper. Do NOT add features not mentioned.
- Do NOT generate README.md. The application creates README.md separately from the paper summary.
- Every file path MUST be relative, use forward slashes, and MUST NOT contain "..".
- Prefer the folder name "core_code" for source files.
- Use comments to explain key implementation decisions only where helpful.
- If the paper uses pseudo-code, translate it to real code.
- If the paper describes an architecture, implement the forward pass.
- If the paper has a training procedure, implement the training loop.
- Keep code APIs, filenames, classes, and variables in English even when the UI language is Chinese.`

  return {
    system,
    user: userPrompt,
  }
}

export function buildCombinedAnalysisPrompt(text: string, language: string = 'zh-CN'): { system: string; user: string } {
  const isEn = language === 'en-US'

  const system = `You are an expert AI research paper analyst. Analyze the paper, write a README.md-style summary, decide whether core component code is needed, and generate code only when applicable.

Rules:
- Be precise and factual. Do not fabricate details not present in the paper.
- Use ${isEn ? 'English' : 'Chinese'} for paper summary and decision reason.
- Keep generated code APIs, filenames, classes, and variables in English.
- Format mathematical expressions in the summary with Markdown LaTeX delimiters: inline math as $...$ and block math as $$...$$.
- Follow the exact tagged output protocol. Do not add prose before, between, or after the required tags.`

  const paperTitle = isEn ? 'Paper Title' : '论文标题'
  const oneSentence = isEn ? 'One-Sentence Summary' : '一句话总结'
  const coreProblem = isEn ? 'Core Problem' : '核心问题'
  const keyContributions = isEn ? 'Key Contributions' : '主要贡献'
  const methodOverview = isEn ? 'Method Overview' : '方法概述'
  const experimentalResults = isEn ? 'Experimental Results' : '实验结果'
  const limitations = isEn ? 'Limitations' : '局限性'

  const userPrompt = `Please analyze the following academic paper.

Paper text:
---
${text}
---

Output protocol:

1. First output the paper summary inside these exact tags:
<P2CC_SUMMARY>
# ${paperTitle}
(extract the paper title precisely)

## ${oneSentence}
(one sentence summarizing the entire paper)

## ${coreProblem}
- What problem does this paper aim to solve?
- Why is this problem important?

## ${keyContributions}
- (list 2-5 key contributions, each as a bullet point)

## ${methodOverview}
- (describe the proposed method, key formulas, algorithms, architecture in detail)

## ${experimentalResults}
- (summarize key experiments, datasets, metrics, and main findings)
- Present ALL quantitative results (comparison tables, ablation studies) as proper GitHub Flavored Markdown tables using | pipes and header separator rows.
- The first column (model name) must use '---' (left-aligned). Numeric columns (IS, FID, NLL, accuracy, etc.) must use '---:' (right-aligned).
- Use inline LaTeX ($...$) for ALL mathematical symbols inside table cells, e.g. $L_{simple}$, $\Sigma$, $\le 3.70$.
- Do NOT split formulas across multiple lines within a cell. Each cell must be on a single line.
- Do NOT use spaces or tabs to align columns. Use ONLY | pipes and proper header separators.

## ${limitations}
- (list limitations mentioned in the paper, or state "Not mentioned in the paper.")
</P2CC_SUMMARY>

Important summary rules:
- Do not include demo code in the summary.
- Do not include a code-generation assessment section in the summary.
- For formulas, do NOT wrap LaTeX in ordinary parentheses like ( q(x_t|x_{t-1}) = ... ).
- Use inline formulas like $q(x_t \\mid x_{t-1})$.
- Use block formulas on separate lines like:
$$
q(x_t \\mid x_{t-1}) = \\mathcal{N}(x_t; \\sqrt{1-\\beta_t}x_{t-1}, \\beta_t I)
$$

2. Then decide whether this paper needs extractable core component code. Output ONLY strict JSON inside these exact tags:
<P2CC_CODE_DECISION>
{"needed": true, "reason": "brief reason"}
</P2CC_CODE_DECISION>

Use "needed": true only if the paper clearly describes at least one implementable algorithm, model architecture, loss/metric, training/inference procedure, or pseudocode that can be translated into reusable code. Use "needed": false for surveys, purely theoretical discussions without implementable procedure, position papers, benchmarks without a new method, or papers lacking enough implementation detail.

3. If "needed" is false, stop immediately after </P2CC_CODE_DECISION>. Do NOT output a code bundle.

4. If "needed" is true, continue by outputting componentized files inside these exact tags:
<P2CC_CODE_BUNDLE>
<P2CC_FILE path="requirements.txt">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/__init__.py">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/config.py">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/model.py">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/losses.py">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/train.py">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/inference.py">
...
</P2CC_FILE>
<P2CC_FILE path="core_code/example.py">
...
</P2CC_FILE>
</P2CC_CODE_BUNDLE>

Code generation rules:
- Only implement what is clearly described in the paper. Do NOT add features not mentioned.
- Do NOT generate README.md. The application creates README.md separately from the paper summary.
- Every file path MUST be relative, use forward slashes, and MUST NOT contain "..".
- Put each generated file in its own <P2CC_FILE path="relative/path">...</P2CC_FILE> block.
- Do NOT encode file contents as JSON strings. Write raw file content directly inside the file block.
- Prefer the folder name "core_code" for source files.
- Prefer Python for ML/algorithm papers.
- Keep files componentized and minimal: configuration, model/algorithm, loss/metrics if needed, training or inference, and an example entry point.
- Include requirements.txt when dependencies are needed.
- Use comments to explain key implementation decisions only where helpful.`

  return {
    system,
    user: userPrompt,
  }
}
