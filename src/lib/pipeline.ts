import { MicVAD } from '@ricky0123/vad-web'
import type { ASREngine, Settings, UtteranceMetric } from './types'
import { BrowserWhisperEngine } from './browserEngine'
import { PythonServerEngine } from './pythonEngine'
import { useAppStore } from './store'
import { finalizeSentence } from './text'

export class TranscriptionPipeline {
  private engine: ASREngine | null = null
  private vad: MicVAD | null = null
  private isRunning: boolean = false
  private sessionStartTime: number = 0
  private totalElapsedBeforeStartMs: number = 0

  // Rolling utterance audio state
  private isSpeaking: boolean = false
  private utteranceChunks: Float32Array[] = []
  private utteranceStartMs: number = 0
  private lastPartialTime: number = 0
  private isDecoding: boolean = false
  private partialTimer: any = null
  private currentUttId: number = 1
  private demoInterval: any = null

  constructor() {}

  async initialize(settings: Settings, onProgress: (p: number) => void): Promise<void> {
    // Dispose previous engine if needed
    if (this.engine) {
      this.engine.dispose()
      this.engine = null
    }

    if (settings.engine === 'python') {
      this.engine = new PythonServerEngine(settings.serverUrl, settings.pythonModel)
    } else {
      this.engine = new BrowserWhisperEngine(settings.browserModel, settings.device, settings.language)
    }

    await this.engine.load(onProgress)
    useAppStore.getState().setEngineDevice(this.engine.device)
  }

  async start(settings: Settings): Promise<void> {
    if (this.isRunning) return
    const store = useAppStore.getState()
    const existingSentences = store.sentences
    const lastSentence = existingSentences[existingSentences.length - 1]
    this.totalElapsedBeforeStartMs = lastSentence && lastSentence.startMs >= 0 ? (lastSentence.startMs + 2000) : 0
    this.sessionStartTime = performance.now()
    this.isRunning = true
    this.isSpeaking = false
    this.utteranceChunks = []
    this.currentUttId = existingSentences.length + 1

    store.setStatus('loading', 'Loading Whisper AI model (on-device)...')

    try {
      if (!this.engine) {
        await this.initialize(settings, (p) => store.setDownloadProgress(p))
      }

      if (!this.isRunning) return

      store.setStatus('loading', 'Starting Microphone & Silero VAD...')

      // Initialize Silero VAD from self-hosted assets
      this.vad = await MicVAD.new({
        model: 'v5',
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/',
        positiveSpeechThreshold: settings.vadThreshold,
        negativeSpeechThreshold: Math.max(0.1, settings.vadThreshold - 0.15),
        redemptionMs: settings.redemptionMs,
        minSpeechMs: settings.minSpeechMs,
        preSpeechPadMs: settings.preSpeechPadMs,
        startOnLoad: true,

        onSpeechStart: () => {
          this.isSpeaking = true
          this.utteranceStartMs = Math.round((performance.now() - this.sessionStartTime) + this.totalElapsedBeforeStartMs)
          this.lastPartialTime = performance.now()
          const s = useAppStore.getState()
          s.setIsSpeaking(true)
          s.setCurrentUtteranceStartMs(this.utteranceStartMs)
        },

        onFrameProcessed: (_probs, frame) => {
          if (!this.isRunning) return
          if (this.isSpeaking) {
            this.utteranceChunks.push(new Float32Array(frame))
            this.checkPartialOrMaxDuration(settings)
          }
        },

        onSpeechEnd: async (audio) => {
          if (!this.isRunning) return
          this.isSpeaking = false
          const s = useAppStore.getState()
          s.setIsSpeaking(false)
          const audioToCommit = audio && audio.length > 16000 * 0.25 ? audio : this.flattenChunks()
          this.utteranceChunks = []
          await this.commitUtterance(audioToCommit, settings)
        },

        onVADMisfire: () => {
          this.isSpeaking = false
          const s = useAppStore.getState()
          s.setIsSpeaking(false)
          s.setCurrentUtteranceStartMs(0)
          this.utteranceChunks = []
          s.setPartialText('')
        },
      })

      store.setStatus('listening', `Listening - ${this.engine?.label.split(' ')[0] || 'Local Model'}`)
    } catch (err: any) {
      this.isRunning = false
      store.setIsSpeaking(false)
      store.setStatus('error', `Microphone/VAD Error: ${err?.message || err}`)
      throw err
    }
  }

  private checkPartialOrMaxDuration(settings: Settings) {
    if (this.isDecoding) return // never overlap decodes

    const now = performance.now()
    const totalSamples = this.utteranceChunks.reduce((acc, c) => acc + c.length, 0)
    const durationSeconds = totalSamples / 16000

    // Force commit if utterance exceeds max duration (15s)
    if (durationSeconds >= settings.maxUtteranceS) {
      const fullBuffer = this.flattenChunks()
      this.utteranceChunks = []
      this.isSpeaking = true
      this.utteranceStartMs = now - this.sessionStartTime
      void this.commitUtterance(fullBuffer, settings)
      return
    }

    // Trigger partial decode tick every ~partialIntervalMs
    if (now - this.lastPartialTime >= settings.partialIntervalMs && totalSamples >= 16000 * 0.5) {
      this.lastPartialTime = now
      const audioToDecode = this.flattenChunks()
      void this.decodePartial(audioToDecode, settings)
    }
  }

  private flattenChunks(): Float32Array {
    const total = this.utteranceChunks.reduce((acc, c) => acc + c.length, 0)
    const out = new Float32Array(total)
    let offset = 0
    for (const chunk of this.utteranceChunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }

  private async decodePartial(audio: Float32Array, settings: Settings) {
    if (!this.engine || this.isDecoding) return
    this.isDecoding = true

    const t0 = performance.now()
    try {
      const res = await this.engine.transcribe(audio, { final: false })
      const latencyMs = Math.round(performance.now() - t0)
      const audioMs = (audio.length / 16000) * 1000
      const rtf = Number(((res.ms / 1000) / (audioMs / 1000)).toFixed(2))

      if (res.text) {
        useAppStore.getState().setPartialText(res.text.trim())
      }

      const metric: UtteranceMetric = {
        uttId: this.currentUttId,
        kind: 'partial',
        latencyMs,
        decodeMs: res.ms,
        audioMs,
        rtf,
        engine: settings.engine,
        model: settings.engine === 'browser' ? settings.browserModel : settings.pythonModel,
        device: this.engine.device,
        at: Date.now(),
      }
      useAppStore.getState().recordMetric(metric)
    } catch (e: any) {
      console.warn('Partial decode error:', e)
    } finally {
      this.isDecoding = false
    }
  }

  private async commitUtterance(audio: Float32Array, settings: Settings) {
    const store = useAppStore.getState()
    if (!this.engine || audio.length < 16000 * 0.3) {
      this.utteranceChunks = []
      store.setPartialText('')
      store.setCurrentUtteranceStartMs(0)
      return
    }

    this.isDecoding = true
    const uttId = this.currentUttId++
    const startMs = this.utteranceStartMs
    const t0 = performance.now()

    try {
      const res = await this.engine.transcribe(audio, { final: true })
      const latencyMs = Math.round(performance.now() - t0)
      const audioMs = (audio.length / 16000) * 1000
      const rtf = Number(((res.ms / 1000) / (audioMs / 1000)).toFixed(2))

      const finalized = finalizeSentence(res.text)
      if (finalized) {
        store.addSentence(finalized, startMs)
      }
      store.setPartialText('')
      store.setCurrentUtteranceStartMs(0)

      const metric: UtteranceMetric = {
        uttId,
        kind: 'final',
        latencyMs,
        decodeMs: res.ms,
        audioMs,
        rtf,
        engine: settings.engine,
        model: settings.engine === 'browser' ? settings.browserModel : settings.pythonModel,
        device: this.engine.device,
        at: Date.now(),
      }
      useAppStore.getState().recordMetric(metric)
    } catch (e: any) {
      console.error('Final decode error:', e)
      useAppStore.getState().setStatus('error', `Decode error: ${e?.message || e}`)
    } finally {
      this.isDecoding = false
      this.utteranceChunks = []
    }
  }

  /**
   * Demo Mode: streams an audio file through the same transcription pipeline
   */
  async playAudioBuffer(audioBuffer: AudioBuffer, settings: Settings): Promise<void> {
    if (this.isRunning) await this.stop()
    this.sessionStartTime = performance.now()
    this.isRunning = true
    this.isSpeaking = false
    this.utteranceChunks = []

    const store = useAppStore.getState()
    if (!this.engine) {
      await this.initialize(settings, (p) => store.setDownloadProgress(p))
    }

    store.setStatus('listening', 'Demo Stream: Playing Audio Sample')

    // Extract mono 16kHz PCM
    const raw = audioBuffer.getChannelData(0)
    const channelData: Float32Array =
      audioBuffer.sampleRate !== 16000
        ? resampleAudio(raw, audioBuffer.sampleRate, 16000)
        : raw

    const frameSize = 512
    let readPos = 0

    // Feed frames periodically to simulate real speaker cadence
    return new Promise<void>((resolve) => {
      this.demoInterval = setInterval(async () => {
        if (!this.isRunning || readPos >= channelData.length) {
          clearInterval(this.demoInterval)
          this.demoInterval = null
          if (this.utteranceChunks.length > 0) {
            await this.commitUtterance(this.flattenChunks(), settings)
          }
          store.setStatus('idle', 'Demo playback completed')
          this.isRunning = false
          resolve()
          return
        }

        const chunk = channelData.subarray(readPos, Math.min(channelData.length, readPos + frameSize))
        readPos += frameSize

        // Energy based simple speech gating for demo audio stream
        let energy = 0
        for (let i = 0; i < chunk.length; i++) energy += Math.abs(chunk[i])
        const avgEnergy = energy / chunk.length

        if (avgEnergy > 0.015) {
          if (!this.isSpeaking) {
            this.isSpeaking = true
            this.utteranceStartMs = performance.now() - this.sessionStartTime
            this.lastPartialTime = performance.now()
          }
          this.utteranceChunks.push(new Float32Array(chunk))
          this.checkPartialOrMaxDuration(settings)
        } else {
          if (this.isSpeaking && this.utteranceChunks.length > 16000 * 0.4 / frameSize) {
            this.isSpeaking = false
            const audioToCommit = this.flattenChunks()
            this.utteranceChunks = []
            await this.commitUtterance(audioToCommit, settings)
          }
        }
      }, 30) // ~32ms per 512-sample frame @16kHz
    })
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.isSpeaking = false
    const store = useAppStore.getState()
    store.setIsSpeaking(false)

    if (this.demoInterval) {
      clearInterval(this.demoInterval)
      this.demoInterval = null
    }

    if (this.partialTimer) {
      clearTimeout(this.partialTimer)
      this.partialTimer = null
    }

    if (this.vad) {
      try {
        await this.vad.pause()
        await this.vad.destroy()
      } catch (err) {
        console.warn('VAD destroy error:', err)
      }
      this.vad = null
    }

    // Flush any pending utterance
    if (this.utteranceChunks.length > 0) {
      const finalAudio = this.flattenChunks()
      this.utteranceChunks = []
      const settings = store.settings
      await this.commitUtterance(finalAudio, settings)
    }

    store.setPartialText('')
    store.setStatus('idle', 'Ready — Click Start to transcribe')
  }

  dispose(): void {
    void this.stop()
    if (this.engine) {
      this.engine.dispose()
      this.engine = null
    }
  }
}

function resampleAudio(source: Float32Array, srcRate: number, dstRate: number): Float32Array {
  const ratio = srcRate / dstRate
  const outLength = Math.round(source.length / ratio)
  const result = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio
    const indexLow = Math.floor(srcIndex)
    const indexHigh = Math.min(source.length - 1, Math.ceil(srcIndex))
    const weight = srcIndex - indexLow
    result[i] = source[indexLow] * (1 - weight) + source[indexHigh] * weight
  }
  return result
}

export const pipelineInstance = new TranscriptionPipeline()
