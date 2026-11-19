/**
 * Local IndexedDB Audio Storage for Lecture Sessions.
 * Stores compressed audio blobs (WebM/Opus, MP3, WAV, M4A) 100% on-device
 * so students can click any transcript timestamp to replay exact lecture audio
 * or retranscribe an archived lecture with a larger Whisper model.
 */

const DB_NAME = 'lecture_transcriber_media_v1'
const DB_VERSION = 1
const STORE_NAME = 'session_audio'

export interface StoredSessionAudio {
  sessionId: string
  blob: Blob
  mimeType: string
  sizeBytes: number
  durationMs: number
  savedAt: number
}

export interface StorageUsageStats {
  totalBytes: number
  audioCount: number
  sessionIds: string[]
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is unavailable in this environment.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Failed to open audio database'))
  })
}

export async function saveSessionAudio(
  sessionId: string,
  blob: Blob,
  durationMs: number = 0
): Promise<void> {
  if (!isIndexedDbAvailable() || !sessionId || !blob || blob.size === 0) return
  try {
    const db = await openAudioDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record: StoredSessionAudio = {
        sessionId,
        blob,
        mimeType: blob.type || 'audio/webm',
        sizeBytes: blob.size,
        durationMs,
        savedAt: Date.now(),
      }
      store.put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('Failed saving session audio'))
    })
    db.close()
  } catch (err) {
    console.warn('[audioStore] Could not save audio recording:', err)
  }
}

export async function getSessionAudio(sessionId: string): Promise<StoredSessionAudio | null> {
  if (!isIndexedDbAvailable() || !sessionId) return null
  try {
    const db = await openAudioDb()
    const record = await new Promise<StoredSessionAudio | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(sessionId)
      req.onsuccess = () => resolve((req.result as StoredSessionAudio) || null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return record
  } catch (err) {
    console.warn('[audioStore] Could not read session audio:', err)
    return null
  }
}

export async function deleteSessionAudio(sessionId: string): Promise<void> {
  if (!isIndexedDbAvailable() || !sessionId) return
  try {
    const db = await openAudioDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(sessionId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.warn('[audioStore] Could not delete session audio:', err)
  }
}

export async function getAudioStorageUsage(): Promise<StorageUsageStats> {
  if (!isIndexedDbAvailable()) {
    return { totalBytes: 0, audioCount: 0, sessionIds: [] }
  }
  try {
    const db = await openAudioDb()
    const stats = await new Promise<StorageUsageStats>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => {
        const rows = (req.result as StoredSessionAudio[]) || []
        const totalBytes = rows.reduce((sum, r) => sum + (r.sizeBytes || 0), 0)
        resolve({
          totalBytes,
          audioCount: rows.length,
          sessionIds: rows.map((r) => r.sessionId),
        })
      }
      req.onerror = () => reject(req.error)
    })
    db.close()
    return stats
  } catch {
    return { totalBytes: 0, audioCount: 0, sessionIds: [] }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
