import { create } from 'zustand'
import type { Sentence, UtteranceMetric, Settings, AppStatus } from './types'

const SETTINGS_STORAGE_KEY = 'lecture_transcriber_settings_v2'
const TRANSCRIPT_STORAGE_KEY = 'lecture_transcriber_session_v2'

const DEFAULT_SETTINGS: Settings = {
  engine: 'browser',
  browserModel: 'tiny',
  pythonModel: 'tiny',
  language: 'id',
  device: 'auto',
  serverUrl: 'ws://127.0.0.1:8765',
  serverVad: false,
  vadThreshold: 0.35,
  redemptionMs: 600,
  minSpeechMs: 250,
  preSpeechPadMs: 300,
  partialIntervalMs: 800,
  maxUtteranceS: 15,
  glossaryPrompt: 'sistem operasi, jaringan komputer, pembelajaran mesin, kecerdasan buatan, basis data, algoritma, rekayasa perangkat lunak',
  autoScroll: true,
}

// Default initial lecture data matching the design mockup exactly
export const MOCK_INITIAL_SENTENCES: Sentence[] = [
  {
    id: 's-1',
    startMs: 12_000,
    text: "Today we'll explore how cognitive overload impacts learning.",
    highlighted: false,
  },
  {
    id: 's-2',
    startMs: 28_000,
    text: 'The brain has limited working memory.',
    highlighted: false,
  },
  {
    id: 's-3',
    startMs: 45_000,
    text: 'When overloaded, retention and comprehension drop.',
    highlighted: true,
    highlightedAt: 46_000,
  },
  {
    id: 's-4',
    startMs: 62_000,
    text: 'Real-time note typing disrupts deep focus.',
    highlighted: false,
  },
  {
    id: 's-5',
    startMs: 78_000,
    text: 'Typed text often lacks the next critical context.',
    highlighted: true,
    highlightedAt: 79_000,
  },
  {
    id: 's-6',
    startMs: 95_000,
    text: 'Keyword spotting rarely signals what matters.',
    highlighted: true,
    highlightedAt: 96_000,
  },
  {
    id: 's-7',
    startMs: 112_000,
    text: 'We need tools that capture meaning, not just words.',
    highlighted: false,
  },
  {
    id: 's-8',
    startMs: 130_000,
    text: "Let's look at a better way to take notes.",
    highlighted: false,
  },
]

export const MOCK_PARTIAL_TEXT =
  "...capture meaning, not just words. Let's build systems that support focus, not fragment it."

function loadPersistedSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        browserModel: parsed.browserModel === 'tiny.en' ? 'tiny' : (parsed.browserModel || 'tiny'),
        language: parsed.language || 'id',
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved settings:', e)
  }
  return DEFAULT_SETTINGS
}

function loadPersistedSentences(): Sentence[] {
  try {
    // Purge old v1 storage if still present
    localStorage.removeItem('lecture_transcriber_session_v1')

    const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const isMock = parsed.some(
          (s: any) =>
            s.id === 's-1' ||
            s.id === 's-2' ||
            (typeof s.text === 'string' && s.text.includes('cognitive overload'))
        )
        if (isMock) {
          localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
          return []
        }
        return parsed
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved session:', e)
  }
  return []
}

interface AppState {
  status: AppStatus
  statusMessage: string
  engineDevice: string
  sentences: Sentence[]
  partialText: string
  isSpeaking: boolean
  latencyMs: number // rolling average in ms
  rtf: number // rolling average
  metrics: UtteranceMetric[]
  settings: Settings
  downloadProgress: number | null // 0 to 100 or null

  // Actions
  setStatus: (status: AppStatus, message?: string) => void
  setEngineDevice: (device: string) => void
  setPartialText: (text: string) => void
  setIsSpeaking: (isSpeaking: boolean) => void
  setDownloadProgress: (p: number | null) => void
  addSentence: (text: string, startMs: number) => void
  toggleHighlight: (id: string) => void
  removeHighlight: (id: string) => void
  recordMetric: (metric: UtteranceMetric) => void
  updateSettings: (partial: Partial<Settings>) => void
  resetSession: () => void
  loadMockData: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'idle',
  statusMessage: 'Ready — Click Start to transcribe',
  engineDevice: 'Local Model',
  sentences: loadPersistedSentences(),
  partialText: '',
  isSpeaking: false,
  latencyMs: 0,
  rtf: 0,
  metrics: [],
  settings: loadPersistedSettings(),
  downloadProgress: null,

  setStatus: (status, message) => {
    let defaultMsg = 'Idle'
    if (status === 'listening') {
      const eng = get().settings.engine === 'browser' ? 'Local Model' : 'Python Server'
      defaultMsg = `Listening - ${eng}`
    } else if (status === 'loading') {
      defaultMsg = 'Loading model...'
    } else if (status === 'stopping') {
      defaultMsg = 'Finishing sentence...'
    } else if (status === 'error') {
      defaultMsg = 'Engine Error'
    } else if (status === 'idle') {
      defaultMsg = 'Ready — Click Start to transcribe'
    }
    set({ status, statusMessage: message || defaultMsg })
  },

  setEngineDevice: (device) => set({ engineDevice: device }),
  setPartialText: (partialText) => set({ partialText }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),

  addSentence: (text, startMs) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const newSentence: Sentence = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      startMs,
      text: trimmed,
      highlighted: false,
    }
    set((state) => {
      const updated = [...state.sentences, newSentence]
      try {
        localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(updated))
      } catch (err) {
        console.warn('Storage quota exceeded:', err)
      }
      return { sentences: updated, partialText: '' }
    })
  },

  toggleHighlight: (id) => {
    set((state) => {
      const updated = state.sentences.map((s) =>
        s.id === id
          ? {
              ...s,
              highlighted: !s.highlighted,
              highlightedAt: !s.highlighted ? Date.now() : undefined,
            }
          : s
      )
      try {
        localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(updated))
      } catch (err) {
        console.warn(err)
      }
      return { sentences: updated }
    })
  },

  removeHighlight: (id) => {
    set((state) => {
      const updated = state.sentences.map((s) =>
        s.id === id ? { ...s, highlighted: false, highlightedAt: undefined } : s
      )
      try {
        localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(updated))
      } catch (err) {
        console.warn(err)
      }
      return { sentences: updated }
    })
  },

  recordMetric: (metric) => {
    set((state) => {
      const updatedMetrics = [...state.metrics, metric]
      // Calculate rolling averages for last 10 decodes
      const recent = updatedMetrics.slice(-10)
      const avgLatency = Math.round(recent.reduce((sum, m) => sum + m.latencyMs, 0) / recent.length)
      const avgRtf = Number((recent.reduce((sum, m) => sum + m.rtf, 0) / recent.length).toFixed(2))

      return {
        metrics: updatedMetrics,
        latencyMs: avgLatency,
        rtf: avgRtf,
      }
    })
  },

  updateSettings: (partial) => {
    set((state) => {
      const updated = { ...state.settings, ...partial }
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
      } catch (err) {
        console.warn(err)
      }
      return { settings: updated }
    })
  },

  resetSession: () => {
    set({
      sentences: [],
      partialText: '',
      metrics: [],
      latencyMs: 0,
      rtf: 0,
      status: 'idle',
      statusMessage: 'Idle',
    })
    try {
      localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    } catch (err) {
      console.warn(err)
    }
  },

  loadMockData: () => {
    set({
      sentences: MOCK_INITIAL_SENTENCES,
      partialText: MOCK_PARTIAL_TEXT,
      latencyMs: 420,
      rtf: 0.87,
      status: 'listening',
      statusMessage: 'Listening - Local Model',
    })
    try {
      localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(MOCK_INITIAL_SENTENCES))
    } catch (err) {
      console.warn(err)
    }
  },
}))
