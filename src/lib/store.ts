import { create } from 'zustand'
import type {
  Sentence,
  UtteranceMetric,
  Settings,
  AppStatus,
  SpeakerLabel,
  ImportJobState,
} from './types'
import { replaceTextOccurrences } from './text'
import { deleteSessionAudio } from './audioStore'

const SETTINGS_STORAGE_KEY = 'lecture_transcriber_settings_v3'
const ARCHIVE_STORAGE_KEY = 'lecture_transcriber_sessions_archive_v3'
const ACTIVE_SESSION_STORAGE_KEY = 'lecture_transcriber_active_session_v3'

export interface ArchivedSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  sentences: Sentence[]
  metrics: UtteranceMetric[]
  starredCount: number
  totalWords: number
  durationMs: number
  model: string
  language: string
  hasAudio?: boolean
}

const DEFAULT_SETTINGS: Settings = {
  engine: 'browser',
  browserModel: 'tiny',
  pythonModel: 'tiny',
  language: 'id',
  device: 'auto',
  serverUrl: 'ws://127.0.0.1:8765',
  serverVad: false,
  vadThreshold: 0.35,
  redemptionMs: 700,
  minSpeechMs: 200,
  preSpeechPadMs: 400,
  partialIntervalMs: 800,
  maxUtteranceS: 15,
  glossaryPrompt:
    'Transkripsi perkuliahan dalam bahasa Indonesia. Istilah: sistem operasi, jaringan komputer, pembelajaran mesin, kecerdasan buatan, basis data, algoritma, rekayasa perangkat lunak.',
  autoScroll: true,
  audioSource: 'mic',
  micDeviceId: '',
  noiseConditioning: true,
  saveAudioRecording: true,
  summaryTemplate: 'executive',
}

export function generateSessionId(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `LCT-${dateStr}-${rand}`
}

export function generateSessionTitle(sentences: Sentence[], timestamp: number): string {
  if (sentences.length > 0 && sentences[0]?.text) {
    const text = sentences[0].text.trim()
    return text.length > 45 ? text.substring(0, 42) + '...' : text
  }
  const date = new Date(timestamp)
  return `Lecture — ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} · ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function loadPersistedSettings(): Settings {
  if (!hasLocalStorage()) return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        browserModel: parsed.browserModel === 'tiny.en' ? 'tiny' : parsed.browserModel || 'tiny',
        language: parsed.language || 'id',
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved settings:', e)
  }
  return DEFAULT_SETTINGS
}

function loadPersistedArchive(): ArchivedSession[] {
  if (!hasLocalStorage()) return []
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('Failed to load session archive:', e)
  }
  return []
}

function saveArchive(archive: ArchivedSession[]): void {
  if (!hasLocalStorage()) return
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archive))
  } catch (err) {
    console.warn('Failed to save archive:', err)
  }
}

// On startup: Check if there was an unfinished active session in localStorage.
// If it has sentences, automatically archive it like Gemini, then start fresh!
function initializeStartupSessions(): {
  archive: ArchivedSession[]
  activeSessionId: string
  activeTitle: string
  activeCreatedAt: number
  activeSentences: Sentence[]
} {
  let archive = loadPersistedArchive()

  if (hasLocalStorage()) {
    try {
      const rawActive = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    if (rawActive) {
      const parsed = JSON.parse(rawActive)
      if (parsed && Array.isArray(parsed.sentences) && parsed.sentences.length > 0) {
        // Exclude mock test sentences
        const isMock = parsed.sentences.some(
          (s: any) =>
            s.id === 's-1' || (typeof s.text === 'string' && s.text.includes('cognitive overload'))
        )
        if (!isMock) {
          const words = parsed.sentences.reduce(
            (acc: number, s: Sentence) => acc + s.text.trim().split(/\s+/).length,
            0
          )
          const starred = parsed.sentences.filter((s: Sentence) => s.highlighted).length
          const firstStart = parsed.sentences[0]?.startMs || 0
          const lastStart = parsed.sentences[parsed.sentences.length - 1]?.startMs || 0
          const dur = Math.max(0, lastStart - firstStart + 3000)

          const archived: ArchivedSession = {
            id: parsed.id || generateSessionId(),
            title: parsed.title || generateSessionTitle(parsed.sentences, parsed.createdAt || Date.now()),
            createdAt: parsed.createdAt || Date.now(),
            updatedAt: Date.now(),
            sentences: parsed.sentences,
            metrics: parsed.metrics || [],
            starredCount: starred,
            totalWords: words,
            durationMs: dur,
            model: parsed.model || 'whisper-tiny',
            language: parsed.language || 'id',
            hasAudio: Boolean(parsed.hasAudio),
          }

          // Avoid duplicate ID in archive
          if (!archive.some((a) => a.id === archived.id)) {
            archive = [archived, ...archive]
            saveArchive(archive)
          }
        }
      }
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    }
    } catch (err) {
      console.warn('Error reading active session on startup:', err)
    }
  }

  const newId = generateSessionId()
  const now = Date.now()
  return {
    archive,
    activeSessionId: newId,
    activeTitle: 'Current Lecture Session',
    activeCreatedAt: now,
    activeSentences: [],
  }
}

const startup = initializeStartupSessions()

export type ActiveTab = 'transcriber' | 'archive' | 'evaluate'

interface AppState {
  // Navigation
  currentTab: ActiveTab
  setCurrentTab: (tab: ActiveTab) => void

  // Session Management
  currentSessionId: string
  currentSessionTitle: string
  sessionCreatedAt: number
  archivedSessions: ArchivedSession[]
  hasSessionAudio: boolean
  audioVersion: number
  startNewSession: (title?: string) => string
  loadArchivedSession: (id: string) => void
  deleteArchivedSession: (id: string) => void
  renameArchivedSession: (id: string, newTitle: string) => void
  renameCurrentSession: (newTitle: string) => void
  setHasSessionAudio: (hasAudio: boolean) => void
  bumpAudioVersion: () => void

  // Engine & Transcriber State
  status: AppStatus
  statusMessage: string
  engineDevice: string
  sentences: Sentence[]
  partialText: string
  currentUtteranceStartMs: number
  isSpeaking: boolean
  audioLevel: number
  isClipping: boolean
  micSilentWarning: boolean
  toast: { id: number; message: string; tone: 'info' | 'warning' } | null
  importJob: ImportJobState | null
  latencyMs: number
  rtf: number
  metrics: UtteranceMetric[]
  settings: Settings
  downloadProgress: number | null
  filterQuery: string

  // Actions
  setStatus: (status: AppStatus, message?: string) => void
  setEngineDevice: (device: string) => void
  setPartialText: (text: string) => void
  setCurrentUtteranceStartMs: (ms: number) => void
  setIsSpeaking: (isSpeaking: boolean) => void
  setAudioLevel: (level: number, clipping?: boolean) => void
  setMicSilentWarning: (silent: boolean) => void
  showToast: (message: string, tone?: 'info' | 'warning') => void
  dismissToast: () => void
  setImportJob: (job: ImportJobState | null) => void
  setDownloadProgress: (p: number | null) => void
  setFilterQuery: (query: string) => void
  addSentence: (text: string, startMs: number, speaker?: SpeakerLabel) => void
  setSentences: (sentences: Sentence[]) => void
  editSentence: (id: string, newText: string) => void
  deleteSentence: (id: string) => void
  replaceAllInTranscript: (find: string, replaceWith: string, caseSensitive?: boolean) => number
  addManualNote: (text: string) => void
  toggleHighlight: (id: string) => void
  removeHighlight: (id: string) => void
  recordMetric: (metric: UtteranceMetric) => void
  updateSettings: (partial: Partial<Settings>) => void
  resetSession: () => void
}

function syncArchiveEntry(
  archive: ArchivedSession[],
  sessionId: string,
  title: string,
  sentences: Sentence[],
  metrics: UtteranceMetric[],
  hasAudio?: boolean
): ArchivedSession[] {
  if (!archive.some((a) => a.id === sessionId)) return archive
  const words = sentences.reduce(
    (acc, s) => acc + s.text.trim().split(/\s+/).filter(Boolean).length,
    0
  )
  const starred = sentences.filter((s) => s.highlighted).length
  const firstStart = sentences[0]?.startMs || 0
  const lastStart = sentences[sentences.length - 1]?.startMs || 0
  const dur = sentences.length > 0 ? Math.max(0, lastStart - firstStart + 3000) : 0

  const updated = archive.map((a) =>
    a.id === sessionId
      ? {
          ...a,
          title,
          sentences,
          metrics,
          starredCount: starred,
          totalWords: words,
          durationMs: dur,
          updatedAt: Date.now(),
          hasAudio: hasAudio !== undefined ? hasAudio : a.hasAudio,
        }
      : a
  )
  saveArchive(updated)
  return updated
}

function persistActiveSession(state: AppState): void {
  try {
    if (state.sentences.length > 0) {
      localStorage.setItem(
        ACTIVE_SESSION_STORAGE_KEY,
        JSON.stringify({
          id: state.currentSessionId,
          title: state.currentSessionTitle,
          createdAt: state.sessionCreatedAt,
          sentences: state.sentences,
          metrics: state.metrics,
          model: state.settings.engine === 'browser' ? state.settings.browserModel : state.settings.pythonModel,
          language: state.settings.language,
          hasAudio: state.hasSessionAudio,
        })
      )
    } else {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    }
  } catch (err) {
    console.warn(err)
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'transcriber',
  setCurrentTab: (tab: ActiveTab) => {
    set({ currentTab: tab })
    try {
      const path = tab === 'transcriber' ? '/' : `/${tab}`
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path)
      }
    } catch {
      // ignore
    }
  },

  currentSessionId: startup.activeSessionId,
  currentSessionTitle: startup.activeTitle,
  sessionCreatedAt: startup.activeCreatedAt,
  archivedSessions: startup.archive,
  hasSessionAudio: false,
  audioVersion: 0,

  startNewSession: (customTitle?: string) => {
    const state = get()
    let updatedArchive = state.archivedSessions

    // Archive current session if it has content
    if (state.sentences.length > 0) {
      const words = state.sentences.reduce(
        (acc, s) => acc + s.text.trim().split(/\s+/).filter(Boolean).length,
        0
      )
      const starred = state.sentences.filter((s) => s.highlighted).length
      const firstStart = state.sentences[0]?.startMs || 0
      const lastStart = state.sentences[state.sentences.length - 1]?.startMs || 0
      const dur = Math.max(0, lastStart - firstStart + 3000)

      const archived: ArchivedSession = {
        id: state.currentSessionId,
        title:
          state.currentSessionTitle === 'Current Lecture Session'
            ? generateSessionTitle(state.sentences, state.sessionCreatedAt)
            : state.currentSessionTitle,
        createdAt: state.sessionCreatedAt,
        updatedAt: Date.now(),
        sentences: state.sentences,
        metrics: state.metrics,
        starredCount: starred,
        totalWords: words,
        durationMs: dur,
        model: state.settings.engine === 'browser' ? state.settings.browserModel : state.settings.pythonModel,
        language: state.settings.language,
        hasAudio: state.hasSessionAudio,
      }

      // Filter out if duplicate
      updatedArchive = [archived, ...updatedArchive.filter((a) => a.id !== archived.id)]
      saveArchive(updatedArchive)
    }

    const newId = generateSessionId()
    const now = Date.now()

    set({
      archivedSessions: updatedArchive,
      currentSessionId: newId,
      currentSessionTitle: customTitle?.trim() || 'Current Lecture Session',
      sessionCreatedAt: now,
      sentences: [],
      partialText: '',
      currentUtteranceStartMs: 0,
      hasSessionAudio: false,
      audioVersion: state.audioVersion + 1,
      metrics: [],
      latencyMs: 0,
      rtf: 0,
      filterQuery: '',
      currentTab: 'transcriber',
    })

    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    return newId
  },

  loadArchivedSession: (id: string) => {
    const state = get()
    const session = state.archivedSessions.find((s) => s.id === id)
    if (!session) return

    set({
      currentSessionId: session.id,
      currentSessionTitle: session.title,
      sessionCreatedAt: session.createdAt,
      sentences: session.sentences,
      metrics: session.metrics || [],
      hasSessionAudio: Boolean(session.hasAudio),
      audioVersion: state.audioVersion + 1,
      currentTab: 'transcriber',
      partialText: '',
      isSpeaking: false,
    })
  },

  deleteArchivedSession: (id: string) => {
    const updated = get().archivedSessions.filter((s) => s.id !== id)
    saveArchive(updated)
    set({ archivedSessions: updated })
    void deleteSessionAudio(id)

    // If deleting the currently loaded session, reset to clean
    if (get().currentSessionId === id) {
      get().startNewSession()
    }
  },

  renameArchivedSession: (id: string, newTitle: string) => {
    const clean = newTitle.trim()
    if (!clean) return
    const updated = get().archivedSessions.map((s) =>
      s.id === id ? { ...s, title: clean } : s
    )
    saveArchive(updated)
    set({
      archivedSessions: updated,
      currentSessionTitle: get().currentSessionId === id ? clean : get().currentSessionTitle,
    })
  },

  renameCurrentSession: (newTitle: string) => {
    const clean = newTitle.trim()
    if (!clean) return
    set((state) => {
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        clean,
        state.sentences,
        state.metrics
      )
      const nextState = {
        ...state,
        currentSessionTitle: clean,
        archivedSessions: updatedArchive,
      }
      persistActiveSession(nextState as AppState)
      return {
        currentSessionTitle: clean,
        archivedSessions: updatedArchive,
      }
    })
  },

  setHasSessionAudio: (hasAudio: boolean) => {
    set((state) => {
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        state.sentences,
        state.metrics,
        hasAudio
      )
      return { hasSessionAudio: hasAudio, archivedSessions: updatedArchive }
    })
  },

  bumpAudioVersion: () => set((state) => ({ audioVersion: state.audioVersion + 1 })),

  status: 'idle',
  statusMessage: 'Ready — Click Start to transcribe',
  engineDevice: 'Local Model',
  sentences: startup.activeSentences,
  partialText: '',
  currentUtteranceStartMs: 0,
  isSpeaking: false,
  audioLevel: 0,
  isClipping: false,
  micSilentWarning: false,
  toast: null,
  importJob: null,
  latencyMs: 0,
  rtf: 0,
  metrics: [],
  settings: loadPersistedSettings(),
  downloadProgress: null,
  filterQuery: '',

  setStatus: (status, message) => {
    let defaultMsg = 'Idle'
    if (status === 'listening') {
      const eng = get().settings.engine === 'browser' ? 'Local Model' : 'Python Server'
      defaultMsg = `Listening - ${eng}`
    } else if (status === 'paused') {
      defaultMsg = 'Paused — Click Resume to continue'
    } else if (status === 'importing') {
      defaultMsg = 'Transcribing imported audio...'
    } else if (status === 'loading') {
      defaultMsg = 'Loading Model...'
    } else if (status === 'error') {
      defaultMsg = 'Error'
    }
    set({ status, statusMessage: message || defaultMsg })
  },

  setEngineDevice: (device) => set({ engineDevice: device }),
  setPartialText: (text) => set({ partialText: text }),
  setCurrentUtteranceStartMs: (ms) => set({ currentUtteranceStartMs: ms }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setAudioLevel: (level, clipping = false) => set({ audioLevel: level, isClipping: clipping }),
  setMicSilentWarning: (silent) => set({ micSilentWarning: silent }),
  showToast: (message, tone = 'info') => {
    const id = Date.now()
    set({ toast: { id, message, tone } })
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null })
      }
    }, 4500)
  },
  dismissToast: () => set({ toast: null }),
  setImportJob: (job) => set({ importJob: job }),
  setDownloadProgress: (p) => set({ downloadProgress: p }),
  setFilterQuery: (query) => set({ filterQuery: query }),

  addSentence: (text, startMs, speaker) => {
    const trimmed = text.trim()
    if (!trimmed) return

    set((state) => {
      const newSentence: Sentence = {
        id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        startMs,
        text: trimmed,
        highlighted: false,
        ...(speaker ? { speaker } : {}),
      }
      const updated = [...state.sentences, newSentence]

      // Automatically generate a meaningful session title from first speech if default
      let newTitle = state.currentSessionTitle
      if (state.currentSessionTitle === 'Current Lecture Session' && updated.length === 1) {
        newTitle = generateSessionTitle(updated, state.sessionCreatedAt)
      }

      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        newTitle,
        updated,
        state.metrics
      )

      const nextState = {
        ...state,
        sentences: updated,
        currentSessionTitle: newTitle,
        archivedSessions: updatedArchive,
        partialText: '',
      }
      persistActiveSession(nextState as AppState)
      return {
        sentences: updated,
        currentSessionTitle: newTitle,
        archivedSessions: updatedArchive,
        partialText: '',
      }
    })
  },

  setSentences: (sentences) => {
    set((state) => {
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        sentences,
        state.metrics
      )
      const nextState = { ...state, sentences, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences, archivedSessions: updatedArchive }
    })
  },

  editSentence: (id, newText) => {
    const trimmed = newText.trim()
    if (!trimmed) return
    set((state) => {
      const updated = state.sentences.map((s) =>
        s.id === id ? { ...s, text: trimmed, edited: true } : s
      )
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        updated,
        state.metrics
      )
      const nextState = { ...state, sentences: updated, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences: updated, archivedSessions: updatedArchive }
    })
  },

  deleteSentence: (id) => {
    set((state) => {
      const updated = state.sentences.filter((s) => s.id !== id)
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        updated,
        state.metrics
      )
      const nextState = { ...state, sentences: updated, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences: updated, archivedSessions: updatedArchive }
    })
  },

  replaceAllInTranscript: (find, replaceWith, caseSensitive = false) => {
    if (!find) return 0
    let totalReplacements = 0
    set((state) => {
      const updated = state.sentences.map((s) => {
        const res = replaceTextOccurrences(s.text, find, replaceWith, caseSensitive)
        if (res.count > 0) {
          totalReplacements += res.count
          return { ...s, text: res.text, edited: true }
        }
        return s
      })
      if (totalReplacements === 0) return state
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        updated,
        state.metrics
      )
      const nextState = { ...state, sentences: updated, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences: updated, archivedSessions: updatedArchive }
    })
    return totalReplacements
  },

  addManualNote: (text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    set((state) => {
      const lastStart = state.sentences[state.sentences.length - 1]?.startMs ?? 0
      const nowMs = state.sentences.length > 0 ? lastStart + 1000 : 0
      const newSentence: Sentence = {
        id: `s-manual-${Date.now()}`,
        startMs: Math.max(0, nowMs),
        text: trimmed,
        highlighted: true,
        highlightedAt: Date.now(),
        speaker: 'You',
      }
      const updated = [...state.sentences, newSentence]
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        updated,
        state.metrics
      )
      const nextState = { ...state, sentences: updated, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences: updated, archivedSessions: updatedArchive }
    })
  },

  toggleHighlight: (id) => {
    set((state) => {
      const updated = state.sentences.map((s) => {
        if (s.id === id) {
          const nextVal = !s.highlighted
          return {
            ...s,
            highlighted: nextVal,
            highlightedAt: nextVal ? Date.now() : undefined,
          }
        }
        return s
      })
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        updated,
        state.metrics
      )
      const nextState = { ...state, sentences: updated, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences: updated, archivedSessions: updatedArchive }
    })
  },

  removeHighlight: (id) => {
    set((state) => {
      const updated = state.sentences.map((s) =>
        s.id === id ? { ...s, highlighted: false, highlightedAt: undefined } : s
      )
      const updatedArchive = syncArchiveEntry(
        state.archivedSessions,
        state.currentSessionId,
        state.currentSessionTitle,
        updated,
        state.metrics
      )
      const nextState = { ...state, sentences: updated, archivedSessions: updatedArchive }
      persistActiveSession(nextState as AppState)
      return { sentences: updated, archivedSessions: updatedArchive }
    })
  },

  recordMetric: (metric) => {
    set((state) => {
      const updatedMetrics = [...state.metrics, metric]
      const recent = updatedMetrics.slice(-10)
      const avgLatency = Math.round(
        recent.reduce((sum, m) => sum + m.latencyMs, 0) / recent.length
      )
      const avgRtf = Number((recent.reduce((sum, m) => sum + m.rtf, 0) / recent.length).toFixed(2))

      return {
        metrics: updatedMetrics,
        latencyMs: avgLatency,
        rtf: avgRtf,
      }
    })
  },

  updateSettings: (partial) => {
    const prev = get()
    const isActiveSession = prev.status === 'listening' || prev.status === 'paused'

    set((state) => {
      const updated = { ...state.settings, ...partial }
      try {
        if (hasLocalStorage()) {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
        }
      } catch (err) {
        console.warn(err)
      }
      return { settings: updated }
    })

    if (isActiveSession) {
      const needsRestart =
        (partial.engine !== undefined && partial.engine !== prev.settings.engine) ||
        (partial.browserModel !== undefined &&
          partial.browserModel !== prev.settings.browserModel) ||
        (partial.pythonModel !== undefined && partial.pythonModel !== prev.settings.pythonModel) ||
        (partial.device !== undefined && partial.device !== prev.settings.device) ||
        (partial.audioSource !== undefined && partial.audioSource !== prev.settings.audioSource) ||
        (partial.micDeviceId !== undefined && partial.micDeviceId !== prev.settings.micDeviceId) ||
        (partial.noiseConditioning !== undefined &&
          partial.noiseConditioning !== prev.settings.noiseConditioning)

      if (needsRestart) {
        get().showToast(
          'Model or audio input changed — stop and restart recording to apply.',
          'warning'
        )
      } else if (partial.language !== undefined && partial.language !== prev.settings.language) {
        const langName = partial.language === 'en' ? 'English (EN)' : 'Bahasa Indonesia (ID)'
        get().showToast(
          `Switched live transcription to ${langName} — active immediately!`,
          'info'
        )
      }
    }
  },

  resetSession: () => {
    get().startNewSession()
  },
}))
