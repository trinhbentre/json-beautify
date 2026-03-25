import { useState, useCallback } from 'react'

const STORAGE_KEY = 'json-beautify-history'
const MAX_ENTRIES = 20

export interface HistoryEntry {
  id: string
  timestamp: number
  preview: string
  content: string
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory)

  const push = useCallback((content: string) => {
    if (!content.trim()) return
    setEntries(prev => {
      // deduplicate: if last entry is identical content, don't add
      if (prev.length > 0 && prev[0].content === content) return prev
      const entry: HistoryEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: Date.now(),
        preview: content.replace(/\s+/g, ' ').trim().slice(0, 60),
        content,
      }
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES)
      saveHistory(updated)
      return updated
    })
  }, [])

  const remove = useCallback((id: string) => {
    setEntries(prev => {
      const updated = prev.filter(e => e.id !== id)
      saveHistory(updated)
      return updated
    })
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setEntries([])
  }, [])

  return { entries, push, remove, clear }
}
