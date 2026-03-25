import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

export interface ValidationError {
  path: string
  message: string
  keyword: string
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

function convertPath(instancePath: string): string {
  // Convert AJV instancePath /users/2/email → users[2].email
  return instancePath
    .replace(/^\//, '')                     // remove leading slash
    .replace(/\/(\d+)(\/|$)/g, '[$1]$2')    // /2/ → [2]
    .replace(/\/(\d+)$/g, '[$1]')           // trailing /2 → [2]
    .replace(/\//g, '.')                    // remaining slashes → dot
}

function buildSuggestion(error: { keyword: string; params: Record<string, unknown> }): string | undefined {
  if (error.keyword === 'required') {
    const missing = error.params?.['missingProperty'] as string | undefined
    if (missing) return `Add missing field: '${missing}'`
  }
  return undefined
}

export function validateJson(schema: unknown, json: unknown): ValidationResult {
  try {
    const validate = ajv.compile(schema as object)
    const valid = validate(json)
    if (valid) return { valid: true, errors: [] }

    const errors: ValidationError[] = (validate.errors ?? []).map(err => ({
      path: convertPath(err.instancePath || ''),
      message: err.message ?? 'Unknown error',
      keyword: err.keyword,
      suggestion: buildSuggestion({ keyword: err.keyword, params: err.params as Record<string, unknown> }),
    }))
    return { valid: false, errors }
  } catch (e) {
    return {
      valid: false,
      errors: [{
        path: '',
        message: (e as Error).message,
        keyword: 'schema',
      }],
    }
  }
}
