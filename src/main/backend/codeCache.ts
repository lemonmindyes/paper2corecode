export interface GeneratedFile {
  path: string
  content: string
}

export interface CodeBundle {
  readme: string
  files: GeneratedFile[]
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
