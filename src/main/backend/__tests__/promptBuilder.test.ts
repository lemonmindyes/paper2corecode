import { describe, expect, it } from 'vitest'
import { buildCodePrompt, buildCombinedAnalysisPrompt, buildSummaryPrompt } from '../promptBuilder'

describe('promptBuilder', () => {
  it.each([
    ['Python', 'py'],
    ['C', 'c'],
    ['C++', 'cpp'],
    ['Java', 'java'],
    ['Go', 'go'],
    ['Rust', 'rs'],
    ['MATLAB', 'm'],
    ['R', 'R'],
  ])('uses the expected source extension for %s code output', (codeLanguage, extension) => {
    const prompt = buildCombinedAnalysisPrompt('paper body', 'en-US', codeLanguage)

    expect(prompt.system).toContain(`generated in ${codeLanguage}`)
    expect(prompt.user).toContain(`core_code/descriptive_file_name.${extension}`)
  })

  it('builds Chinese summary prompts by default with README and math rules', () => {
    const prompt = buildSummaryPrompt('paper body')

    expect(prompt.system).toContain('Use Chinese')
    expect(prompt.user).toContain('paper body')
    expect(prompt.user).toContain('# 论文标题')
    expect(prompt.user).toContain('## 一句话总结')
    expect(prompt.user).toContain('GitHub Flavored Markdown tables')
    expect(prompt.user).toContain('Do not include any demo code')
    expect(prompt.user).toContain('$$')
  })

  it('builds English summary prompts when requested', () => {
    const prompt = buildSummaryPrompt('paper body', 'en-US')

    expect(prompt.system).toContain('Use English')
    expect(prompt.user).toContain('# Paper Title')
    expect(prompt.user).toContain('## One-Sentence Summary')
    expect(prompt.user).toContain('## Experimental Results')
  })

  it('builds code prompts with strict JSON schema and summary context', () => {
    const prompt = buildCodePrompt('paper text', 'summary text', 'en-US', 'Rust')

    expect(prompt.system).toContain('Use English')
    expect(prompt.user).toContain('paper text')
    expect(prompt.user).toContain('summary text')
    expect(prompt.user).toContain('Return ONLY strict JSON')
    expect(prompt.user).toContain('"files"')
    expect(prompt.user).toContain('"notApplicableReason"')
    expect(prompt.user).toContain('Generate all demo/core code in Rust')
    expect(prompt.user).toContain('core_code/descriptive_file_name.rs')
    expect(prompt.user).toContain('Every file path MUST be relative')
  })

  it('builds combined prompts with required tagged protocol for non-code papers', () => {
    const prompt = buildCombinedAnalysisPrompt('combined paper')

    expect(prompt.system).toContain('Use Chinese')
    expect(prompt.user).toContain('combined paper')
    expect(prompt.user).toContain('<P2CC_SUMMARY>')
    expect(prompt.user).toContain('<P2CC_CODE_DECISION>')
    expect(prompt.user).toContain('{"needed": true, "reason": "brief reason"}')
    expect(prompt.user).toContain('If "needed" is false, stop immediately')
  })

  it('builds combined prompts with blueprint and exact code bundle constraints', () => {
    const prompt = buildCombinedAnalysisPrompt('combined paper', 'en-US', 'C++')

    expect(prompt.system).toContain('Use English')
    expect(prompt.system).toContain('Demo Code and core code files MUST be generated in C++')
    expect(prompt.user).toContain('# Paper Title')
    expect(prompt.user).toContain('<P2CC_CODE_BLUEPRINT>')
    expect(prompt.user).toContain('<P2CC_CODE_BUNDLE>')
    expect(prompt.user).toContain('The selected output code language is C++')
    expect(prompt.user).toContain('<P2CC_FILE path="core_code/descriptive_file_name.cpp">')
    expect(prompt.user).toContain('no more and no fewer')
    expect(prompt.user).toContain('Avoid generic files')
  })
})
