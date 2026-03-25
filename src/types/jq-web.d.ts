// Type declarations for jq-web (no official @types package)
declare module 'jq-web' {
  interface JQInstance {
    json(input: unknown, filter: string): unknown
    raw(input: string, filter: string, flags?: string[]): string
    promised: {
      json(input: unknown, filter: string): Promise<unknown>
      raw(input: string, filter: string, flags?: string[]): Promise<string>
    }
  }

  const jq: Promise<JQInstance> & JQInstance
  export = jq
}
