import { JSONParser } from '@streamparser/json'

export type ParseWorkerInMsg =
  | { type: 'parseString'; id: string; text: string }
  | { type: 'parseChunks'; id: string; chunks: ArrayBuffer[]; totalSize: number }

export type ParseWorkerOutMsg =
  | { type: 'progress'; id: string; percent: number; bytesRead: number }
  | { type: 'done'; id: string; root: unknown; nodeCount: number; parseTimeMs: number }
  | { type: 'error'; id: string; message: string }

const SMALL_FILE_THRESHOLD = 5 * 1024 * 1024 // 5MB

function parseSmall(text: string): { root: unknown; nodeCount: number } {
  const root = JSON.parse(text)
  let nodeCount = 0
  function count(v: unknown) {
    nodeCount++
    if (v !== null && typeof v === 'object') {
      for (const child of Object.values(v as object)) count(child)
    }
  }
  count(root)
  return { root, nodeCount }
}

function parseStreaming(
  chunks: string[],
  totalSize: number,
  onProgress: (percent: number, bytesRead: number) => void,
): Promise<{ root: unknown; nodeCount: number }> {
  return new Promise((resolve, reject) => {
    let nodeCount = 0
    let root: unknown = undefined
    let bytesRead = 0

    const parser = new JSONParser({
      paths: ['$'],
      keepStack: false,
    })

    parser.onValue = ({ value, stack }) => {
      if (stack.length === 0) {
        root = value
      }
      nodeCount++
    }

    parser.onError = (err) => {
      reject(new Error(err.message))
    }

    parser.onEnd = () => {
      resolve({ root, nodeCount })
    }

    let chunkIdx = 0
    function processNext() {
      if (chunkIdx >= chunks.length) return
      const chunk = chunks[chunkIdx++]
      bytesRead += chunk.length
      const percent = Math.round((bytesRead / totalSize) * 100)
      onProgress(percent, bytesRead)
      parser.write(chunk)
      // Yield to allow progress messages through
      if (chunkIdx < chunks.length) {
        setTimeout(processNext, 0)
      }
    }

    processNext()
  })
}

self.onmessage = async (e: MessageEvent<ParseWorkerInMsg>) => {
  const msg = e.data
  const start = performance.now()

  if (msg.type === 'parseString') {
    try {
      const { text, id } = msg
      if (text.length < SMALL_FILE_THRESHOLD) {
        const { root, nodeCount } = parseSmall(text)
        const parseTimeMs = performance.now() - start
        self.postMessage({ type: 'done', id, root, nodeCount, parseTimeMs } satisfies ParseWorkerOutMsg)
      } else {
        // Split into ~256KB chunks for progress reporting
        const CHUNK = 256 * 1024
        const chunks: string[] = []
        for (let i = 0; i < text.length; i += CHUNK) {
          chunks.push(text.slice(i, i + CHUNK))
        }
        const { root, nodeCount } = await parseStreaming(
          chunks,
          text.length,
          (percent, bytesRead) => {
            self.postMessage({ type: 'progress', id, percent, bytesRead } satisfies ParseWorkerOutMsg)
          },
        )
        const parseTimeMs = performance.now() - start
        self.postMessage({ type: 'done', id, root, nodeCount, parseTimeMs } satisfies ParseWorkerOutMsg)
      }
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: (err as Error).message } satisfies ParseWorkerOutMsg)
    }
  } else if (msg.type === 'parseChunks') {
    try {
      const { id, chunks: buffers, totalSize } = msg
      const decoder = new TextDecoder('utf-8')
      const textChunks = buffers.map(buf => decoder.decode(buf, { stream: true }))
      const { root, nodeCount } = await parseStreaming(
        textChunks,
        totalSize,
        (percent, bytesRead) => {
          self.postMessage({ type: 'progress', id, percent, bytesRead } satisfies ParseWorkerOutMsg)
        },
      )
      const parseTimeMs = performance.now() - start
      self.postMessage({ type: 'done', id, root, nodeCount, parseTimeMs } satisfies ParseWorkerOutMsg)
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: (err as Error).message } satisfies ParseWorkerOutMsg)
    }
  }
}
