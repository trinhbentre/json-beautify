import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'

const DB_NAME = 'json-beautify-db'
const DB_VERSION = 1
const MAX_HISTORY = 50
const MAX_ENTRY_BYTES = 10 * 1024 * 1024 // 10MB

export interface Draft {
  id: 'current'
  content: string
  timestamp: number
  name?: string
}

export interface HistoryEntry {
  id: string
  timestamp: number
  preview: string
  content: string | null // null if tooLarge
  sizeBytes: number
  name?: string
  encrypted: boolean
  tooLarge?: boolean
}

interface JsonBeautifyDB {
  drafts: {
    key: string
    value: Draft
  }
  history: {
    key: string
    value: HistoryEntry
    indexes: { timestamp: number }
  }
  settings: {
    key: string
    value: { key: string; value: unknown }
  }
}

let dbPromise: Promise<IDBPDatabase<JsonBeautifyDB>> | null = null

function getDb(): Promise<IDBPDatabase<JsonBeautifyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JsonBeautifyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

// --- Draft ---

export async function saveDraft(content: string, name?: string): Promise<void> {
  const db = await getDb()
  await db.put('drafts', { id: 'current', content, timestamp: Date.now(), name })
}

export async function loadDraft(): Promise<Draft | null> {
  const db = await getDb()
  return (await db.get('drafts', 'current')) ?? null
}

export async function clearDraft(): Promise<void> {
  const db = await getDb()
  await db.delete('drafts', 'current')
}

// --- History ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function pushHistory(content: string, name?: string): Promise<string> {
  const db = await getDb()
  const sizeBytes = new TextEncoder().encode(content).length
  const tooLarge = sizeBytes > MAX_ENTRY_BYTES

  // Deduplicate: if latest entry has same content, skip
  const existing = await getHistory(1)
  if (existing.length > 0 && existing[0].content === content) return existing[0].id

  const id = generateId()
  const entry: HistoryEntry = {
    id,
    timestamp: Date.now(),
    preview: content.replace(/\s+/g, ' ').trim().slice(0, 80),
    content: tooLarge ? null : content,
    sizeBytes,
    name,
    encrypted: false,
    tooLarge,
  }
  await db.put('history', entry)

  // Auto-prune
  const count = await getHistoryCount()
  if (count > MAX_HISTORY) {
    const all = await getHistory()
    const toDelete = all.slice(MAX_HISTORY)
    for (const e of toDelete) {
      await db.delete('history', e.id)
    }
  }

  return id
}

export async function getHistory(limit = MAX_HISTORY): Promise<HistoryEntry[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('history', 'timestamp')
  return all.reverse().slice(0, limit)
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | null> {
  const db = await getDb()
  return (await db.get('history', id)) ?? null
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('history', id)
}

export async function clearHistory(): Promise<void> {
  const db = await getDb()
  await db.clear('history')
}

export async function getHistoryCount(): Promise<number> {
  const db = await getDb()
  return db.count('history')
}

export async function exportHistory(): Promise<Blob> {
  const entries = await getHistory(MAX_HISTORY)
  return new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
}

export async function importHistory(blob: Blob): Promise<number> {
  const text = await blob.text()
  const entries = JSON.parse(text) as HistoryEntry[]
  const db = await getDb()
  let count = 0
  for (const entry of entries) {
    if (entry.id && entry.timestamp && entry.preview !== undefined) {
      await db.put('history', entry)
      count++
    }
  }
  return count
}

// --- Encryption ---

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptContent(content: string, passphrase: string): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>
  const key = await deriveKey(passphrase, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(content),
  )
  // Layout: [16 bytes salt][12 bytes iv][encrypted...]
  const result = new Uint8Array(16 + 12 + encrypted.byteLength)
  result.set(salt, 0)
  result.set(iv, 16)
  result.set(new Uint8Array(encrypted), 28)
  return result.buffer as ArrayBuffer
}

export async function decryptContent(data: ArrayBuffer, passphrase: string): Promise<string> {
  const bytes = new Uint8Array(data)
  const salt = bytes.slice(0, 16) as Uint8Array<ArrayBuffer>
  const iv = bytes.slice(16, 28) as Uint8Array<ArrayBuffer>
  const encrypted = bytes.slice(28)
  const key = await deriveKey(passphrase, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted,
  )
  return new TextDecoder().decode(decrypted)
}

// --- Backward compat: migrate localStorage → IndexedDB ---

const LS_KEY = 'json-beautify-history'

export async function migrateFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return
  try {
    const entries = JSON.parse(raw) as Array<{
      id: string; timestamp: number; preview: string; content: string
    }>
    const db = await getDb()
    const existing = await getHistoryCount()
    if (existing > 0) {
      // Already migrated
      localStorage.removeItem(LS_KEY)
      return
    }
    for (const e of entries) {
      const sizeBytes = new TextEncoder().encode(e.content).length
      await db.put('history', {
        id: e.id,
        timestamp: e.timestamp,
        preview: e.preview,
        content: e.content,
        sizeBytes,
        encrypted: false,
      })
    }
    localStorage.removeItem(LS_KEY)
  } catch {
    // Migration failed silently — old data remains in localStorage
  }
}
