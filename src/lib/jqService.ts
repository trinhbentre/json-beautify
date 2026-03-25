// JQ service — wraps jq-web, runs in the main thread (WASM is async)
// Includes built-in 300ms debounce and auto-cancels previous queries.

import jq from 'jq-web'

export interface JQResult {
  values: unknown[]
  error?: string
}

let jqInstance: Awaited<typeof jq> | null = null

async function getJQ(): Promise<Awaited<typeof jq>> {
  if (jqInstance) return jqInstance
  jqInstance = await (jq as unknown as Promise<Awaited<typeof jq>>)
  return jqInstance
}

let _generation = 0
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/** Query JQ with 300ms debounce. Returns a cancellable promise. */
export function queryDebounced(
  expression: string,
  data: unknown,
  onResult: (result: JQResult) => void,
): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  const gen = ++_generation
  _debounceTimer = setTimeout(async () => {
    _debounceTimer = null
    try {
      const instance = await getJQ()
      if (gen !== _generation) return // superseded
      const raw = await instance.promised.json(data, expression)
      if (gen !== _generation) return // superseded
      // jq.json returns raw JQ output — collect as array
      const values: unknown[] = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
      onResult({ values })
    } catch (e) {
      if (gen !== _generation) return
      onResult({ values: [], error: (e as Error).message })
    }
  }, 300)
}

/** Cancel any pending debounced query. */
export function cancelQuery(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  _generation++
}
