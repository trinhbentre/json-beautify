// ── Shared type inference for model generators ─────────────────────────────

export type InferredType =
  | { kind: 'string' }
  | { kind: 'integer' }
  | { kind: 'float' }
  | { kind: 'boolean' }
  | { kind: 'null'; innerKind?: InferredType['kind'] }
  | { kind: 'unknown' }
  | { kind: 'object'; name: string; fields: { key: string; type: InferredType }[] }
  | { kind: 'array'; itemType: InferredType }

export function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function inferKindFromValue(value: unknown): InferredType['kind'] {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return 'unknown'
}

export function buildTypeTree(value: unknown, name: string): InferredType {
  if (value === null) return { kind: 'null' }
  if (typeof value === 'string') return { kind: 'string' }
  if (typeof value === 'number') return Number.isInteger(value) ? { kind: 'integer' } : { kind: 'float' }
  if (typeof value === 'boolean') return { kind: 'boolean' }

  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'array', itemType: { kind: 'unknown' } }
    // Check if all items have the same kind
    const kinds = value.map(inferKindFromValue)
    const allSame = kinds.every(k => k === kinds[0])
    if (!allSame) {
      return { kind: 'array', itemType: { kind: 'unknown' } }
    }
    const base = name.endsWith('s') ? name.slice(0, -1) : name
    return { kind: 'array', itemType: buildTypeTree(value[0], toPascalCase(base) + 'Item') }
  }

  if (typeof value === 'object') {
    const fields: { key: string; type: InferredType }[] = []
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      fields.push({ key, type: buildTypeTree(val, toPascalCase(key)) })
    }
    return { kind: 'object', name: toPascalCase(name), fields }
  }

  return { kind: 'unknown' }
}

// ── TypeScript Interface generator ─────────────────────────────────────────

function inferTypeTs(value: unknown, name: string, interfaces: Map<string, string>): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    const base = name.endsWith('s') ? name.slice(0, -1) : name
    const itemType = inferTypeTs(value[0], toPascalCase(base) + 'Item', interfaces)
    return `${itemType}[]`
  }
  if (typeof value === 'object') {
    const interfaceName = toPascalCase(name)
    const lines: string[] = [`interface ${interfaceName} {`]
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const fieldType = inferTypeTs(val, toPascalCase(key), interfaces)
      lines.push(`  ${key}: ${fieldType};`)
    }
    lines.push('}')
    interfaces.set(interfaceName, lines.join('\n'))
    return interfaceName
  }
  return 'unknown'
}

export function generateTypeScript(value: unknown): string {
  if (value === null) return '// Cannot generate interface for null'
  if (typeof value !== 'object') return `// Cannot generate interface for primitive value`
  const interfaces = new Map<string, string>()
  if (Array.isArray(value)) {
    if (value.length === 0) return 'type Root = unknown[]'
    inferTypeTs(value[0], 'Item', interfaces)
    return Array.from(interfaces.values()).join('\n\n') + '\n\ntype Root = Item[]'
  }
  inferTypeTs(value, 'Root', interfaces)
  return Array.from(interfaces.values()).join('\n\n')
}

// ── Go struct generator ─────────────────────────────────────────────────────

function goTypeStr(t: InferredType, opts: { bsonTags: boolean }): string {
  switch (t.kind) {
    case 'string': return 'string'
    case 'integer': return 'int64'
    case 'float': return 'float64'
    case 'boolean': return 'bool'
    case 'null': return '*string'
    case 'unknown': return 'interface{}'
    case 'array': {
      const inner = goTypeStr(t.itemType, opts)
      return `[]${inner}`
    }
    case 'object': return t.name + 'Struct'
  }
}

function collectGoStructs(
  t: InferredType,
  structs: Map<string, string>,
  opts: { bsonTags: boolean },
): void {
  if (t.kind !== 'object') {
    if (t.kind === 'array') collectGoStructs(t.itemType, structs, opts)
    return
  }
  // First collect nested
  for (const field of t.fields) {
    collectGoStructs(field.type, structs, opts)
  }
  const structName = t.name + 'Struct'
  const lines: string[] = [`type ${structName} struct {`]
  for (const field of t.fields) {
    const goName = toPascalCase(field.key)
    const goType = field.type.kind === 'null'
      ? '*string'
      : goTypeStr(field.type, opts)
    const jsonTag = `json:"${field.key}"`
    const bsonTag = opts.bsonTags ? ` bson:"${field.key}"` : ''
    lines.push(`\t${goName} ${goType} \`${jsonTag}${bsonTag}\``)
  }
  lines.push('}')
  structs.set(structName, lines.join('\n'))
}

export function generateGo(value: unknown, rootName: string, opts: { bsonTags: boolean }): string {
  if (value === null || typeof value !== 'object') return '// Cannot generate struct for this value'
  const tree = buildTypeTree(value, rootName)
  const structs = new Map<string, string>()
  collectGoStructs(tree, structs, opts)
  const rootStructName = toPascalCase(rootName) + 'Struct'
  // Return all nested first, then root last
  const parts: string[] = []
  for (const [name, body] of structs) {
    if (name !== rootStructName) parts.push(body)
  }
  if (structs.has(rootStructName)) parts.push(structs.get(rootStructName)!)
  return parts.join('\n\n')
}

// ── Java class generator ────────────────────────────────────────────────────

function javaTypeStr(t: InferredType): string {
  switch (t.kind) {
    case 'string': return 'String'
    case 'integer': return 'int'
    case 'float': return 'double'
    case 'boolean': return 'boolean'
    case 'null': return '@Nullable String'
    case 'unknown': return 'Object'
    case 'array': {
      const inner = javaTypeStr(t.itemType)
      return `List<${inner === 'int' ? 'Integer' : inner === 'double' ? 'Double' : inner === 'boolean' ? 'Boolean' : inner}>`
    }
    case 'object': return t.name
  }
}

function collectJavaClasses(
  t: InferredType,
  classes: Map<string, string>,
): void {
  if (t.kind !== 'object') {
    if (t.kind === 'array') collectJavaClasses(t.itemType, classes)
    return
  }
  for (const field of t.fields) {
    collectJavaClasses(field.type, classes)
  }
  const lines: string[] = [`public class ${t.name} {`]
  for (const field of t.fields) {
    const jType = javaTypeStr(field.type)
    lines.push(`    @JsonProperty("${field.key}")`)
    lines.push(`    public ${jType} ${field.key};`)
  }
  lines.push('}')
  classes.set(t.name, lines.join('\n'))
}

export function generateJava(value: unknown, rootName: string): string {
  if (value === null || typeof value !== 'object') return '// Cannot generate class for this value'
  const tree = buildTypeTree(value, rootName)
  const classes = new Map<string, string>()
  collectJavaClasses(tree, classes)
  const rootClassName = toPascalCase(rootName)
  const header = 'import com.fasterxml.jackson.annotation.JsonProperty;\nimport javax.annotation.Nullable;\nimport java.util.List;\n'
  const parts: string[] = [header]
  for (const [name, body] of classes) {
    if (name !== rootClassName) parts.push(body)
  }
  if (classes.has(rootClassName)) parts.push(classes.get(rootClassName)!)
  return parts.join('\n\n')
}

// ── C# POCO generator ───────────────────────────────────────────────────────

function csharpTypeStr(t: InferredType): string {
  switch (t.kind) {
    case 'string': return 'string'
    case 'integer': return 'int'
    case 'float': return 'double'
    case 'boolean': return 'bool'
    case 'null': return 'string?'
    case 'unknown': return 'object'
    case 'array': {
      const inner = csharpTypeStr(t.itemType)
      return `List<${inner}>`
    }
    case 'object': return t.name
  }
}

function collectCSharpClasses(
  t: InferredType,
  classes: Map<string, string>,
): void {
  if (t.kind !== 'object') {
    if (t.kind === 'array') collectCSharpClasses(t.itemType, classes)
    return
  }
  for (const field of t.fields) {
    collectCSharpClasses(field.type, classes)
  }
  const lines: string[] = [`public class ${t.name}`]
  lines.push('{')
  for (const field of t.fields) {
    const csType = csharpTypeStr(field.type)
    const propName = toPascalCase(field.key)
    lines.push(`    [JsonPropertyName("${field.key}")]`)
    lines.push(`    public ${csType} ${propName} { get; set; }`)
  }
  lines.push('}')
  classes.set(t.name, lines.join('\n'))
}

export function generateCSharp(value: unknown, rootName: string): string {
  if (value === null || typeof value !== 'object') return '// Cannot generate class for this value'
  const tree = buildTypeTree(value, rootName)
  const classes = new Map<string, string>()
  collectCSharpClasses(tree, classes)
  const rootClassName = toPascalCase(rootName)
  const header = 'using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n'
  const parts: string[] = [header]
  for (const [name, body] of classes) {
    if (name !== rootClassName) parts.push(body)
  }
  if (classes.has(rootClassName)) parts.push(classes.get(rootClassName)!)
  return parts.join('\n\n')
}
