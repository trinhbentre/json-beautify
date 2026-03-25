import type { ParseWorkerInMsg, ParseWorkerOutMsg } from '../workers/parseWorker'

export interface ParseResult {
  root: unknown
  nodeCount: number
  sizeBytes: number
  parseTimeMs: number
}

type ProgressCallback = (percent: number, bytesRead: number) => void

let _worker: Worker | null = null

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../workers/parseWorker.ts', import.meta.url), { type: 'module' })
  }
  return _worker
}

function genId(): string {
  return Math.random().toString(36).slice(2)
}

const pending = new Map<
  string,
  { resolve: (r: ParseResult) => void; reject: (e: Error) => void; onProgress?: ProgressCallback; sizeBytes: number }
>()

function initListener() {
  const worker = getWorker()
  worker.onmessage = (e: MessageEvent<ParseWorkerOutMsg>) => {
    const msg = e.data
    const p = pending.get(msg.id)
    if (!p) return
    if (msg.type === 'progress') {
      p.onProgress?.(msg.percent, msg.bytesRead)
    } else if (msg.type === 'done') {
      pending.delete(msg.id)
      p.resolve({ root: msg.root, nodeCount: msg.nodeCount, sizeBytes: p.sizeBytes, parseTimeMs: msg.parseTimeMs })
    } else if (msg.type === 'error') {
      pending.delete(msg.id)
      p.reject(new Error(msg.message))
    }
  }
  worker.onerror = (e) => {
    for (const [id, p] of pending) {
      pending.delete(id)
      p.reject(new Error(e.message))
    }
  }
}

let _listenerInit = false
function ensureListener() {
  if (!_listenerInit) {
    _listenerInit = true
    initListener()
  }
}

export function parseString(text: string, onProgress?: ProgressCallback): Promise<ParseResult> {
  ensureListener()
  const id = genId()
  const sizeBytes = new Blob([text]).size
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress, sizeBytes })
    getWorker().postMessage({ type: 'parseString', id, text } satisfies ParseWorkerInMsg)
  })
}

export async function parseFile(file: File, onProgress?: ProgressCallback): Promise<ParseResult> {
  ensureListener()
  const id = genId()
  const sizeBytes = file.size
  const CHUNK = 256 * 1024
  const buffers: ArrayBuffer[] = []
  let offset = 0
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK)
    buffers.push(await slice.arrayBuffer())
    offset += CHUNK
  }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress, sizeBytes })
    getWorker().postMessage({ type: 'parseChunks', id, chunks: buffers, totalSize: sizeBytes } satisfies ParseWorkerInMsg, buffers)
  })
}

export async function parseUrl(url: string, onProgress?: ProgressCallback): Promise<ParseResult> {
  ensureListener()
  // Validate URL to prevent SSRF — only allow http/https
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

  const contentLength = Number(response.headers.get('content-length') ?? 0)

  const reader = response.body!.getReader()
  const chunks: ArrayBuffer[] = []
  let bytesRead = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    chunks.push(value.buffer as ArrayBuffer)
    if (contentLength > 0) {
      onProgress?.(Math.round((bytesRead / contentLength) * 100), bytesRead)
    }
  }

  const id = genId()
  const sizeBytes = bytesRead
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress, sizeBytes })
    getWorker().postMessage({ type: 'parseChunks', id, chunks, totalSize: sizeBytes } satisfies ParseWorkerInMsg, chunks)
  })
}

export function abortAll() {
  // Terminate and recreate the worker
  if (_worker) {
    _worker.terminate()
    _worker = null
    _listenerInit = false
  }
  for (const [id, p] of pending) {
    pending.delete(id)
    p.reject(new Error('Aborted'))
  }
}
