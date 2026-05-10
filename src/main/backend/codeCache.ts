export interface GeneratedFile {
  path: string
  content: string
}

export interface CodeBlueprintFile {
  path: string
  purpose: string
  mainSymbols: string[]
  mustInclude: string[]
  mustNotInclude: string[]
  inputs?: string[]
  outputs?: string[]
  assumptions?: string[]
  evidence?: string
}

export interface CodeBlueprint {
  paperDomain?: string
  coreContribution: string
  minimalImplementationBoundary: string
  files: CodeBlueprintFile[]
  omitted?: Array<{
    item: string
    reason: string
  }>
  minimalityCheck?: {
    whyTheseFilesAreMinimal?: string
    couldAnyFileBeRemoved?: boolean
    overGenerationRisk?: string
  }
}

export interface CodeBundle {
  readme: string
  files: GeneratedFile[]
  blueprint?: CodeBlueprint
}

let cached: CodeBundle | null = null

export function cacheCodeBundle(bundle: CodeBundle): void {
  cached = bundle
}

export function getCachedCodeBundle(): CodeBundle | null {
  return cached
}

export function clearCache(): void {
  cached = null
}
