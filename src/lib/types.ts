/** Shared domain types. */

export interface TranscribeResult {
  text: string
  /** Pure model decode time in milliseconds. */
  ms: number
}

/** Every ASR backend implements this, so engines are swappable. */
export interface ASREngine {
  readonly id: EngineId
  readonly label: string
  /** Device actually used after load (e.g. "webgpu", "wasm", "cuda", "cpu"). */
  device: string
  load(onProgress: (p: number) => void): Promise<void>
  transcribe(audio: Float32Array, opts: { final: boolean }): Promise<TranscribeResult>
  dispose(): void
}

export type EngineId = 'browser' | 'python'
export type BrowserModel = 'tiny.en' | 'base.en'
export type PythonModel = 'tiny.en' | 'base.en' | 'small.en'
export type DevicePref = 'auto' | 'webgpu' | 'wasm'

export interface Sentence {
  id: string
  /** Session-relative start time in ms. */
  startMs: number
  text: string
  highlighted: boolean
  highlightedAt?: number
}

export type MetricKind = 'partial' | 'final'

export interface UtteranceMetric {
  uttId: number
  kind: MetricKind
  /** End of audio chunk sent -> text rendered (ms). */
  latencyMs: number
  decodeMs: number
  audioMs: number
  rtf: number
  engine: EngineId
  model: string
  device: string
  at: number
}

export interface Settings {
  engine: EngineId
  browserModel: BrowserModel
  pythonModel: PythonModel
  device: DevicePref
  serverUrl: string
  /** Server-side VAD streaming (true) or browser VAD + server decode (false). */
  serverVad: boolean
  vadThreshold: number
  redemptionMs: number
  minSpeechMs: number
  preSpeechPadMs: number
  partialIntervalMs: number
  maxUtteranceS: number
  glossaryPrompt: string
  autoScroll: boolean
}

export type AppStatus = 'idle' | 'loading' | 'listening' | 'stopping' | 'error'
