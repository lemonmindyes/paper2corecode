import * as fs from 'fs'
import * as path from 'path'
import { CodeBlueprint, getCachedCodeBundle } from './codeCache'

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()
}

function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) return 'Not specified.'
  return items.map((item) => `- ${item}`).join('\n')
}

function buildBlueprintReadmeSection(blueprint: CodeBlueprint): string {
  const generatedFiles = blueprint.files
    .map((file) => `| ${escapeMarkdownTableCell(file.path)} | ${escapeMarkdownTableCell(file.purpose)} | ${escapeMarkdownTableCell(file.mainSymbols.join(', '))} |`)
    .join('\n')

  const omitted = blueprint.omitted && blueprint.omitted.length > 0
    ? blueprint.omitted
        .map((item) => `| ${escapeMarkdownTableCell(item.item)} | ${escapeMarkdownTableCell(item.reason)} |`)
        .join('\n')
    : '| None specified. | Not applicable. |'

  const assumptions = blueprint.files.flatMap((file) => file.assumptions || [])
  const minimality = blueprint.minimalityCheck?.whyTheseFilesAreMinimal

  return `

## Core Code Scope

This export intentionally contains only the paper's minimal core computational contribution. It does not include experiment reproduction code, baselines, datasets, training scripts, simulators, or full application pipelines unless they are part of the proposed method itself.

### Implemented Core Contribution

${blueprint.coreContribution}

### Minimal Implementation Boundary

${blueprint.minimalImplementationBoundary}

${blueprint.paperDomain ? `### Inferred Paper Domain\n\n${blueprint.paperDomain}\n\n` : ''}### Generated Files

| File | Purpose | Main Symbols |
|---|---|---|
${generatedFiles}

### Intentionally Omitted

| Item | Reason |
|---|---|
${omitted}

### Assumptions

${formatList(assumptions)}

${minimality ? `### Minimality Check\n\n${minimality}\n` : ''}`
}

function buildExportReadme(readme: string, blueprint?: CodeBlueprint): string {
  if (!blueprint) return readme
  return `${readme.trimEnd()}${buildBlueprintReadmeSection(blueprint)}`
}

function resolveSafePath(rootDir: string, relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const lower = normalized.toLowerCase()

  if (
    normalized.startsWith('/') ||
    /^[a-z]:/i.test(normalized) ||
    parts.includes('..') ||
    parts.includes('') ||
    lower === 'readme.md' ||
    lower.endsWith('/readme.md')
  ) {
    return null
  }

  const root = path.resolve(rootDir)
  const target = path.resolve(root, ...parts)
  return target.startsWith(root + path.sep) ? target : null
}

export function writeCodeFolder(outputDir: string): { ok: true; path: string } | { ok: false; error: string } {
  const bundle = getCachedCodeBundle()
  if (!bundle) {
    return { ok: false, error: 'No cached core code found. Please analyze a paper first.' }
  }

  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(outputDir, 'README.md'), buildExportReadme(bundle.readme, bundle.blueprint), 'utf-8')

    for (const file of bundle.files) {
      const target = resolveSafePath(outputDir, file.path)
      if (!target) {
        return { ok: false, error: `Unsafe generated file path: ${file.path}` }
      }

      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, file.content, 'utf-8')
    }

    return { ok: true, path: outputDir }
  } catch (err) {
    return { ok: false, error: `Failed to write project folder: ${(err as Error).message}` }
  }
}
