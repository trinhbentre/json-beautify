import { useState, useEffect, useCallback, useRef } from 'react'
import {
  saveDraft as dbSaveDraft,
  loadDraft,
  clearDraft as dbClearDraft,
  pushHistory as dbPushHistory,
  getHistory,
  deleteHistoryEntry,
  clearHistory as dbClearHistory,
  exportHistory,
  importHistory,
  migrateFromLocalStorage,
} from '../lib/storageService'
import type { Draft, HistoryEntry } from '../lib/storageService'

export type { HistoryEntry, Draft }

export function useStorage(content: string) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>('')

  // Initial load + migration
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        await migrateFromLocalStorage()
        const [entries, savedDraft] = await Promise.all([getHistory(), loadDraft()])
        if (!cancelled) {
          setHistory(entries)
          setDraft(savedDraft)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [])

  // Auto-save draft debounced 2s (text mode only — caller passes '' or content)
  useEffect(() => {
    if (!content) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(async () => {
      if (content === lastSavedContentRef.current) return
      lastSavedContentRef.current = content
      await dbSaveDraft(content)
      setDraft({ id: 'current', content, timestamp: Date.now() })
    }, 2000)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [content])

  const pushHistory = useCallback(async (text: string, name?: string) => {
    if (!text.trim()) return
    await dbPushHistory(text, name)
    const entries = await getHistory()
    setHistory(entries)
  }, [])

  const restoreEntry = useCallback(async (id: string): Promise<string | null> => {
    const entries = await getHistory()
    const entry = entries.find(e => e.id === id)
    return entry?.content ?? null
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    await deleteHistoryEntry(id)
    setHistory(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearHistory = useCallback(async () => {
    await dbClearHistory()
    setHistory([])
  }, [])

  const clearDraft = useCallback(async () => {
    await dbClearDraft()
    setDraft(null)
    lastSavedContentRef.current = ''
  }, [])

  const doExport = useCallback(async () => {
    const blob = await exportHistory()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `json-beautify-history-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const doImport = useCallback(async (file: File) => {
    const blob = new Blob([await file.arrayBuffer()], { type: 'application/json' })
    await importHistory(blob)
    const entries = await getHistory()
    setHistory(entries)
  }, [])

  return {
    history,
    draft,
    loading,
    pushHistory,
    restoreEntry,
    deleteEntry,
    clearHistory,
    clearDraft,
    exportHistory: doExport,
    importHistory: doImport,
  }
}
