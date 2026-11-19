import { MicVAD } from '@ricky0123/vad-web'
import type { ASREngine, Settings, SpeakerLabel, UtteranceMetric } from './types'
import { BrowserWhisperEngine } from './browserEngine'
import { PythonServerEngine } from './pythonEngine'
import { useAppStore } from './store'
import { finalizeSentence } from './text'
import { getSessionAudio, saveSessionAudio } from './audioStore'

export interface AudioSegment {
  startMs: number
  samples: Float32Array
}

/**
 * Pure helper: splits 16 kHz mono PCM into natural speech segments (~4s to 14s)
 * by finding low-energy silence valleys and skipping pure silence gaps.
 * Used for Audio File Import and Session Retranscription.
 */
export function segmentAudioBySilence(
  pcm: Float32Array,
  sampleRate: number = 16000,
  minChunkS: number = 4,
  targetChunkS: number = 11,
  maxChunkS: number = 14
): AudioSegment[] {
  if (pcm.length === 0) return []

  const frameSize = Math.floor(sampleRate * 0.1) // 100ms analysis frames
  const totalFrames = Math.ceil(pcm.length / frameSize)
  const frameRms = new Float32Array(totalFrames)

  for (let f = 0; f < totalFrames; f++) {
    const start = f * frameSize
    const end = Math.min(pcm.length, start + frameSize)
    let sumSq = 0
    for (let i = start; i < end; i++) {
      sumSq += pcm[i] * pcm[i]
    }
    frameRms[f] = Math.sqrt(sumSq / Math.max(1, end - start))
  }

  const silenceThreshold = 0.006
  const minFrames = Math.max(1, Math.round(minChunkS * 10))
  const targetFrames = Math.max(minFrames, Math.round(targetChunkS * 10))
  const maxFrames = Math.max(targetFrames, Math.round(maxChunkS * 10))

  const segments: AudioSegment[] = []
  let cursor = 0

  while (cursor < totalFrames) {
    // Skip leading silence
    while (cursor < totalFrames && frameRms[cursor] < silenceThreshold) {
      cursor++
    }
    if (cursor >= totalFrames) break

    const segStartFrame = Math.max(0, cursor - 2) // 200ms pre-speech pad
    const maxEndFrame = Math.min(totalFrames, segStartFrame + maxFrames)
    const minEndFrame = Math.min(totalFrames, segStartFrame + minFrames)
    const idealEndFrame = Math.min(totalFrames, segStartFrame + targetFrames)

    let splitFrame = maxEndFrame

    if (maxEndFrame < totalFrames) {
      // Search for the quietest valley between minEndFrame and maxEndFrame
      let bestFrame = idealEndFrame
      let lowestEnergy = Infinity

      for (let f = minEndFrame; f < maxEndFrame; f++) {
        // Prefer quiet regions closest to target duration
        const distPenalty = Math.abs(f - idealEndFrame) * 0.00015
        const score = frameRms[f] + distPenalty
        if (score < lowestEnergy) {
          lowestEnergy = score
          bestFrame = f
        }
        // Early stop if we hit a clear 300ms pause near or past target
        if (
          f >= idealEndFrame - 15 &&
          frameRms[f] < silenceThreshold &&
          f + 1 < totalFrames &&
          frameRms[f + 1] < silenceThreshold
        ) {
          bestFrame = f + 1
          break
        }
      }
      splitFrame = bestFrame
    }

    const startSample = segStartFrame * frameSize
    const endSample = Math.min(pcm.length, splitFrame * frameSize)
    if (endSample - startSample >= sampleRate * 0.35) {
      // Check that the chunk actually contains audible energy
      let maxRms = 0
      for (let f = segStartFrame; f < splitFrame; f++) {
        if (frameRms[f] > maxRms) maxRms = frameRms[f]
      }
      if (maxRms >= silenceThreshold) {
        segments.push({
          startMs: Math.round((startSample / sampleRate) * 1000),
          samples: pcm.subarray(startSample, endSample),
        })
      }
    }

    cursor = Math.max(cursor + 1, splitFrame)
  }

  return segments
}

export function resampleAudio(source: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (srcRate === dstRate) return source
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

function getPreferredRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

export class TranscriptionPipeline {
  private engine: ASREngine | null = null
  private engineConfigKey: string = ''
  private vad: MicVAD | null = null

  // Lifecycle state
  private isRunning: boolean = false
  private isPaused: boolean = false
  private sessionStartTime: number = 0
  private totalPausedMs: number = 0
  private pauseStartedAt: number = 0
  private totalElapsedBeforeStartMs: number = 0
  private activeSessionId: string = ''

  // Audio capture & conditioning graph
  private captureCtx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private systemStream: MediaStream | null = null
  private processedStream: MediaStream | null = null
  private masterAnalyser: AnalyserNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private systemAnalyser: AnalyserNode | null = null
  private meterInterval: ReturnType<typeof setInterval> | null = null

  // Dual-channel energy accumulators for zero-ML speaker attribution
  private uttMicEnergySum: number = 0
  private uttSystemEnergySum: number = 0
  private uttEnergySamples: number = 0

  // Session MediaRecorder for IndexedDB Click-to-Replay
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private lastAudioSaveAt: number = 0

  // Rolling utterance audio state
  private isSpeaking: boolean = false
  private utteranceChunks: Float32Array[] = []
  private utteranceStartMs: number = 0
  private lastPartialTime: number = 0
  private isDecoding: boolean = false
  private currentUttId: number = 1
  private demoInterval: ReturnType<typeof setInterval> | null = null

  // Batch import / retranscription cancellation
  private importCancelled: boolean = false

  constructor() {}

  private buildEngineKey(settings: Settings): string {
    return [
      settings.engine,
      settings.engine === 'browser' ? settings.browserModel : settings.pythonModel,
      settings.device,
      settings.language,
      settings.serverUrl,
    ].join('|')
  }

  /** Avoid biasing English streams with the default Indonesian glossary prompt. */
  private getEffectivePrompt(settings: Settings): string | undefined {
    const raw = settings.glossaryPrompt?.trim()
    if (!raw) return undefined
    if (
      settings.language === 'en' &&
      raw.toLowerCase().startsWith('transkripsi perkuliahan dalam bahasa indonesia')
    ) {
      return undefined
    }
    return raw
  }

  async initialize(settings: Settings, onProgress: (p: number) => void): Promise<void> {
    const nextKey = this.buildEngineKey(settings)
    if (this.engine && this.engineConfigKey === nextKey) {
      this.engine.language = settings.language
      onProgress(100)
      return
    }

    if (this.engine) {
      this.engine.dispose()
      this.engine = null
      this.engineConfigKey = ''
    }

    if (settings.engine === 'python') {
      this.engine = new PythonServerEngine(
        settings.serverUrl,
        settings.pythonModel,
        settings.language
      )
    } else {
      this.engine = new BrowserWhisperEngine(
        settings.browserModel,
        settings.device,
        settings.language
      )
    }

    await this.engine.load(onProgress)
    this.engineConfigKey = nextKey
    useAppStore.getState().setEngineDevice(this.engine.device)
  }

  /** Computes session-relative elapsed ms excluding paused intervals. */
  private getSessionClockMs(): number {
    const activePause = this.isPaused ? performance.now() - this.pauseStartedAt : 0
    return Math.max(
      0,
      Math.round(
        performance.now() -
          this.sessionStartTime -
          this.totalPausedMs -
          activePause +
          this.totalElapsedBeforeStartMs
      )
    )
  }

  private sampleRms(analyser: AnalyserNode): { rms: number; peak: number } {
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    let sumSq = 0
    let peak = 0
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i])
      sumSq += v * v
      if (v > peak) peak = v
    }
    return { rms: Math.sqrt(sumSq / buf.length), peak }
  }

  /**
   * Acquires Mic and/or Browser Tab/System Audio and builds the Web Audio conditioning graph
   * (80Hz High-Pass Filter + Anti-Clipping DynamicsCompressor + Live dB Analyser).
   */
  private async setupAudioCapture(settings: Settings): Promise<MediaStream> {
    this.teardownAudioCapture()

    const mode = settings.audioSource || 'mic'
    const wantsMic = mode === 'mic' || mode === 'mixed'
    const wantsSystem = mode === 'system' || mode === 'mixed'

    if (wantsSystem) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          'Tab/System audio capture is not supported by this browser. Use Chrome or Edge.'
        )
      }
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as MediaTrackConstraints,
      })

      const sysAudioTracks = displayStream.getAudioTracks()
      if (sysAudioTracks.length === 0) {
        displayStream.getTracks().forEach((t) => t.stop())
        throw new Error(
          'No audio track was shared. Please check "Also share tab audio" (or "Share system audio") in the browser popup and try again.'
        )
      }
      this.systemStream = displayStream
      // If user clicks Chrome's native "Stop sharing" button, cleanly stop the pipeline
      sysAudioTracks[0].onended = () => {
        if (this.isRunning) {
          void this.stop()
        }
      }
    }

    if (wantsMic) {
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: settings.noiseConditioning,
      }
      if (settings.micDeviceId) {
        audioConstraints.deviceId = { ideal: settings.micDeviceId }
      }
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      } catch (err) {
        this.teardownAudioCapture()
        throw err
      }
    }

    // Build Web Audio conditioning graph
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    this.captureCtx = ctx

    const mixer = ctx.createGain()
    mixer.gain.value = 1.0

    if (this.micStream) {
      const micSrc = ctx.createMediaStreamSource(this.micStream)
      const micGain = ctx.createGain()
      micGain.gain.value = 1.0
      const micAnalyser = ctx.createAnalyser()
      micAnalyser.fftSize = 256
      micSrc.connect(micGain)
      micGain.connect(micAnalyser)
      micAnalyser.connect(mixer)
      this.micAnalyser = micAnalyser
    }

    if (this.systemStream) {
      // Extract audio-only MediaStream for Web Audio source node
      const audioOnlySys = new MediaStream(this.systemStream.getAudioTracks())
      const sysSrc = ctx.createMediaStreamSource(audioOnlySys)
      const sysGain = ctx.createGain()
      sysGain.gain.value = 1.0
      const sysAnalyser = ctx.createAnalyser()
      sysAnalyser.fftSize = 256
      sysSrc.connect(sysGain)
      sysGain.connect(sysAnalyser)
      sysAnalyser.connect(mixer)
      this.systemAnalyser = sysAnalyser
    }

    // Signal conditioning: 80Hz High-Pass Filter + Anti-Clipping Compressor (Meetily-inspired)
    let tailNode: AudioNode = mixer
    if (settings.noiseConditioning) {
      const highPass = ctx.createBiquadFilter()
      highPass.type = 'highpass'
      highPass.frequency.value = 80
      highPass.Q.value = 0.707

      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -24
      compressor.knee.value = 30
      compressor.ratio.value = 6
      compressor.attack.value = 0.003
      compressor.release.value = 0.25

      tailNode.connect(highPass)
      highPass.connect(compressor)
      tailNode = compressor
    }

    const masterAnalyser = ctx.createAnalyser()
    masterAnalyser.fftSize = 512
    tailNode.connect(masterAnalyser)
    this.masterAnalyser = masterAnalyser

    const dest = ctx.createMediaStreamDestination()
    masterAnalyser.connect(dest)
    // Keep Chromium's Web Audio render clock actively pumping even without speakers output
    const silentSink = ctx.createGain()
    silentSink.gain.value = 0
    masterAnalyser.connect(silentSink)
    silentSink.connect(ctx.destination)
    this.processedStream = dest.stream

    // Live RMS audio level, muted-mic detection & dual-channel speaker energy sampler (~15 FPS)
    let silentTicks = 0
    useAppStore.getState().setMicSilentWarning(false)
    this.meterInterval = setInterval(() => {
      if (!this.isRunning || this.isPaused || !this.masterAnalyser) return
      const { rms, peak } = this.sampleRms(this.masterAnalyser)
      // Convert RMS to human-perceptible 0..100 scale
      const db = rms > 0.0001 ? 20 * Math.log10(rms) : -80
      const normalized = Math.max(0, Math.min(100, Math.round(((db + 55) / 55) * 100)))
      const store = useAppStore.getState()
      store.setAudioLevel(normalized, peak >= 0.96)

      // Warn user if 0 audio signal arrives for ~4s (e.g., hardware mic mute switch is on)
      if (rms < 0.0004) {
        silentTicks += 1
        if (silentTicks === 62 && !store.micSilentWarning) {
          store.setMicSilentWarning(true)
        }
      } else {
        silentTicks = 0
        if (store.micSilentWarning) {
          store.setMicSilentWarning(false)
        }
      }

      if (this.isSpeaking && this.micAnalyser && this.systemAnalyser) {
        this.uttMicEnergySum += this.sampleRms(this.micAnalyser).rms
        this.uttSystemEnergySum += this.sampleRms(this.systemAnalyser).rms
        this.uttEnergySamples += 1
      }
    }, 65)

    return this.processedStream
  }

  private startSessionRecorder(stream: MediaStream, sessionId: string) {
    if (typeof MediaRecorder === 'undefined') return
    try {
      const mimeType = getPreferredRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 })
        : new MediaRecorder(stream)

      this.recordedChunks = []
      this.lastAudioSaveAt = Date.now()

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          this.recordedChunks.push(ev.data)
          // Periodically checkpoint recording to IndexedDB every ~15s
          if (Date.now() - this.lastAudioSaveAt >= 15000) {
            this.lastAudioSaveAt = Date.now()
            const blob = new Blob(this.recordedChunks, {
              type: recorder.mimeType || 'audio/webm',
            })
            void saveSessionAudio(sessionId, blob, this.getSessionClockMs()).then(() => {
              const s = useAppStore.getState()
              if (s.currentSessionId === sessionId) {
                s.setHasSessionAudio(true)
              }
            })
          }
        }
      }

      recorder.start(5000)
      this.mediaRecorder = recorder
    } catch (err) {
      console.warn('[Pipeline] MediaRecorder unavailable for session audio backup:', err)
    }
  }

  private async stopSessionRecorder(): Promise<void> {
    const recorder = this.mediaRecorder
    this.mediaRecorder = null
    if (!recorder || recorder.state === 'inactive') return

    const sessionId = this.activeSessionId
    const durationMs = this.getSessionClockMs()

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      try {
        recorder.stop()
      } catch {
        resolve()
      }
    })

    if (this.recordedChunks.length > 0 && sessionId) {
      const blob = new Blob(this.recordedChunks, {
        type: recorder.mimeType || 'audio/webm',
      })
      await saveSessionAudio(sessionId, blob, durationMs)
      const s = useAppStore.getState()
      if (s.currentSessionId === sessionId) {
        s.setHasSessionAudio(true)
        s.bumpAudioVersion()
      }
    }
    this.recordedChunks = []
  }

  private teardownAudioCapture() {
    if (this.meterInterval) {
      clearInterval(this.meterInterval)
      this.meterInterval = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop())
      this.micStream = null
    }
    if (this.systemStream) {
      this.systemStream.getTracks().forEach((t) => t.stop())
      this.systemStream = null
    }
    this.processedStream = null
    this.masterAnalyser = null
    this.micAnalyser = null
    this.systemAnalyser = null
    if (this.captureCtx) {
      void this.captureCtx.close().catch(() => {})
      this.captureCtx = null
    }
    const store = useAppStore.getState()
    store.setAudioLevel(0, false)
    store.setMicSilentWarning(false)
  }

  private resolveCurrentSpeaker(settings: Settings): SpeakerLabel | undefined {
    if (settings.audioSource === 'system') return 'Lecturer'
    if (settings.audioSource === 'mixed') {
      if (this.uttEnergySamples > 0) {
        // System audio is typically the remote lecturer; mic is the student
        return this.uttSystemEnergySum >= this.uttMicEnergySum * 0.85 ? 'Lecturer' : 'You'
      }
      return 'Lecturer'
    }
    return undefined
  }

  async start(settings: Settings): Promise<void> {
    if (this.isRunning) return
    const store = useAppStore.getState()
    const existingSentences = store.sentences
    const lastSentence = existingSentences[existingSentences.length - 1]
    this.totalElapsedBeforeStartMs =
      lastSentence && lastSentence.startMs >= 0 ? lastSentence.startMs + 2000 : 0
    this.sessionStartTime = performance.now()
    this.totalPausedMs = 0
    this.pauseStartedAt = 0
    this.isRunning = true
    this.isPaused = false
    this.isSpeaking = false
    this.utteranceChunks = []
    this.currentUttId = existingSentences.length + 1
    this.activeSessionId = store.currentSessionId

    store.setStatus('loading', 'Loading Whisper AI model (on-device)...')

    try {
      await this.initialize(settings, (p) => store.setDownloadProgress(p))
      if (!this.isRunning) return

      const sourceLabel =
        settings.audioSource === 'system'
          ? 'Tab / System Audio'
          : settings.audioSource === 'mixed'
          ? 'Mic + Tab Audio Mixer'
          : 'Microphone'
      store.setStatus('loading', `Starting ${sourceLabel} & Silero VAD...`)

      const stream = await this.setupAudioCapture(settings)
      if (!this.isRunning) {
        this.teardownAudioCapture()
        return
      }

      // Start local IndexedDB audio recorder for Click-to-Replay
      if (settings.saveAudioRecording) {
        this.startSessionRecorder(stream, this.activeSessionId)
      }

      // Initialize Silero VAD fed by our conditioned MediaStream
      this.vad = await MicVAD.new({
        model: 'v5',
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/',
        getStream: async () => this.processedStream!,
        pauseStream: async () => {
          // Keep our conditioned capture graph alive for instant Resume without re-prompting!
        },
        resumeStream: async () => this.processedStream!,
        positiveSpeechThreshold: settings.vadThreshold,
        negativeSpeechThreshold: Math.max(0.1, settings.vadThreshold - 0.15),
        redemptionMs: settings.redemptionMs,
        minSpeechMs: settings.minSpeechMs,
        preSpeechPadMs: settings.preSpeechPadMs,
        startOnLoad: true,

        onSpeechStart: () => {
          if (this.isPaused) return
          this.isSpeaking = true
          this.uttMicEnergySum = 0
          this.uttSystemEnergySum = 0
          this.uttEnergySamples = 0
          this.utteranceStartMs = this.getSessionClockMs()
          this.lastPartialTime = performance.now()
          const s = useAppStore.getState()
          s.setIsSpeaking(true)
          s.setCurrentUtteranceStartMs(this.utteranceStartMs)
        },

        onFrameProcessed: (_probs, frame) => {
          if (!this.isRunning || this.isPaused) return
          if (this.isSpeaking) {
            this.utteranceChunks.push(new Float32Array(frame))
            this.checkPartialOrMaxDuration(useAppStore.getState().settings)
          }
        },

        onSpeechEnd: async (audio) => {
          if (!this.isRunning || this.isPaused) return
          this.isSpeaking = false
          const s = useAppStore.getState()
          s.setIsSpeaking(false)
          const liveSettings = s.settings
          const speaker = this.resolveCurrentSpeaker(liveSettings)
          const audioToCommit =
            audio && audio.length > 16000 * 0.25 ? audio : this.flattenChunks()
          this.utteranceChunks = []
          await this.commitUtterance(audioToCommit, liveSettings, speaker)
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

      store.setDownloadProgress(null)
      store.setStatus(
        'listening',
        `Listening (${sourceLabel}) — ${this.engine?.label.split(' ')[0] || 'Local Model'}`
      )
    } catch (err: any) {
      this.isRunning = false
      this.isPaused = false
      this.teardownAudioCapture()
      store.setDownloadProgress(null)
      store.setIsSpeaking(false)
      store.setStatus('error', `Audio/VAD Error: ${err?.message || err}`)
      throw err
    }
  }

  async pause(): Promise<void> {
    if (!this.isRunning || this.isPaused) return
    this.isPaused = true
    this.pauseStartedAt = performance.now()
    const store = useAppStore.getState()

    // Flush any active speech snippet cleanly before pausing
    if (this.utteranceChunks.length > 0) {
      const pending = this.flattenChunks()
      this.utteranceChunks = []
      const speaker = this.resolveCurrentSpeaker(store.settings)
      await this.commitUtterance(pending, store.settings, speaker)
    }

    this.isSpeaking = false
    store.setIsSpeaking(false)
    store.setAudioLevel(0, false)
    store.setPartialText('')

    if (this.vad) {
      try {
        await this.vad.pause()
      } catch (err) {
        console.warn('[Pipeline] VAD pause warning:', err)
      }
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.pause()
      } catch (err) {
        console.warn('[Pipeline] Recorder pause warning:', err)
      }
    }

    store.setStatus('paused', 'Recording paused — Click Resume to continue')
  }

  async resume(): Promise<void> {
    if (!this.isRunning || !this.isPaused) return
    const store = useAppStore.getState()
    if (this.pauseStartedAt > 0) {
      this.totalPausedMs += performance.now() - this.pauseStartedAt
      this.pauseStartedAt = 0
    }
    this.isPaused = false

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      try {
        this.mediaRecorder.resume()
      } catch (err) {
        console.warn('[Pipeline] Recorder resume warning:', err)
      }
    }

    if (this.vad) {
      try {
        await this.vad.start()
      } catch (err) {
        console.warn('[Pipeline] VAD resume warning:', err)
      }
    }

    store.setStatus('listening', `Listening — ${this.engine?.label.split(' ')[0] || 'Local Model'}`)
  }

  private checkPartialOrMaxDuration(settings: Settings) {
    if (this.isDecoding) return // never overlap decodes

    const now = performance.now()
    const totalSamples = this.utteranceChunks.reduce((acc, c) => acc + c.length, 0)
    const durationSeconds = totalSamples / 16000

    // Force commit if utterance exceeds max duration (15s)
    if (durationSeconds >= settings.maxUtteranceS) {
      const fullBuffer = this.flattenChunks()
      const speaker = this.resolveCurrentSpeaker(settings)
      this.utteranceChunks = []
      this.isSpeaking = true
      this.utteranceStartMs = this.getSessionClockMs()
      void this.commitUtterance(fullBuffer, settings, speaker)
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
      const res = await this.engine.transcribe(audio, {
        final: false,
        prompt: this.getEffectivePrompt(settings),
        language: settings.language,
      })
      const latencyMs = Math.round(performance.now() - t0)
      const audioMs = (audio.length / 16000) * 1000
      const rtf = Number((res.ms / 1000 / (audioMs / 1000)).toFixed(2))

      if (res.text && !this.isPaused) {
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

  private async commitUtterance(
    audio: Float32Array,
    settings: Settings,
    speaker?: SpeakerLabel,
    explicitStartMs?: number
  ) {
    const store = useAppStore.getState()
    if (!this.engine || audio.length < 16000 * 0.3) {
      this.utteranceChunks = []
      store.setPartialText('')
      store.setCurrentUtteranceStartMs(0)
      return
    }

    this.isDecoding = true
    const uttId = this.currentUttId++
    const startMs = explicitStartMs !== undefined ? explicitStartMs : this.utteranceStartMs
    const t0 = performance.now()

    try {
      const res = await this.engine.transcribe(audio, {
        final: true,
        prompt: this.getEffectivePrompt(settings),
        language: settings.language,
      })
      const latencyMs = Math.round(performance.now() - t0)
      const audioMs = (audio.length / 16000) * 1000
      const rtf = Number((res.ms / 1000 / (audioMs / 1000)).toFixed(2))

      const finalized = finalizeSentence(res.text)
      if (finalized) {
        store.addSentence(finalized, startMs, speaker)
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
   * Meetily-style Audio File Import: decodes .mp3 / .wav / .m4a / .webm locally,
   * saves to IndexedDB for Click-to-Replay, and transcribes speech chunks with Cancel support.
   */
  async importAudioFile(file: File, settings: Settings): Promise<void> {
    if (this.isRunning) {
      await this.stop()
    }
    const store = useAppStore.getState()
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
    const sessionId =
      store.sentences.length > 0
        ? store.startNewSession(cleanTitle || 'Imported Lecture Audio')
        : (() => {
            store.renameCurrentSession(cleanTitle || 'Imported Lecture Audio')
            return store.currentSessionId
          })()

    await this.runBatchTranscription(file, file.name, settings, sessionId, 'import')
  }

  /**
   * Meetily-style Retranscribe: re-runs local Whisper on an existing recorded/imported
   * session's IndexedDB audio (e.g. after upgrading from whisper-tiny to whisper-base
   * or updating the Domain Glossary Prompt).
   */
  async retranscribeCurrentSession(settings: Settings): Promise<void> {
    if (this.isRunning) {
      await this.stop()
    }
    const store = useAppStore.getState()
    const stored = await getSessionAudio(store.currentSessionId)
    if (!stored || !stored.blob) {
      throw new Error('No saved audio recording found for this session.')
    }
    store.setSentences([])
    await this.runBatchTranscription(
      stored.blob,
      store.currentSessionTitle || 'Recorded Session',
      settings,
      store.currentSessionId,
      'retranscribe'
    )
  }

  cancelImport(): void {
    this.importCancelled = true
  }

  private async runBatchTranscription(
    audioBlob: Blob,
    label: string,
    settings: Settings,
    sessionId: string,
    mode: 'import' | 'retranscribe'
  ): Promise<void> {
    const store = useAppStore.getState()
    this.importCancelled = false
    store.setCurrentTab('transcriber')
    store.setStatus('loading', `Loading Whisper model for ${mode === 'import' ? 'audio import' : 'retranscription'}...`)
    store.setImportJob({
      active: true,
      filename: label,
      currentChunk: 0,
      totalChunks: 0,
      percent: 5,
      mode,
    })

    try {
      await this.initialize(settings, (p) => store.setDownloadProgress(p))
      store.setDownloadProgress(null)
      if (this.importCancelled) {
        store.setImportJob(null)
        store.setStatus('idle', 'Audio import cancelled')
        return
      }

      store.setStatus('importing', `Decoding audio stream (${label})...`)
      const arrayBuf = await audioBlob.arrayBuffer()
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const decodeCtx = new AudioCtx()
      const audioBuffer = await decodeCtx.decodeAudioData(arrayBuf.slice(0))
      await decodeCtx.close()

      const durationMs = Math.round(audioBuffer.duration * 1000)

      // Persist imported audio in IndexedDB so Click-to-Replay works immediately
      if (mode === 'import') {
        await saveSessionAudio(sessionId, audioBlob, durationMs)
        useAppStore.getState().setHasSessionAudio(true)
        useAppStore.getState().bumpAudioVersion()
      }

      // Mix down to mono 16kHz PCM
      const rawMono = new Float32Array(audioBuffer.length)
      const numChannels = audioBuffer.numberOfChannels
      for (let ch = 0; ch < numChannels; ch++) {
        const chData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < chData.length; i++) {
          rawMono[i] += chData[i] / numChannels
        }
      }
      const pcm16k = resampleAudio(rawMono, audioBuffer.sampleRate, 16000)
      const segments = segmentAudioBySilence(pcm16k, 16000)

      if (segments.length === 0) {
        store.setImportJob(null)
        store.setStatus('idle', 'No audible speech detected in the audio file.')
        return
      }

      const speaker: SpeakerLabel = mode === 'import' ? 'Imported' : 'Lecturer'
      for (let i = 0; i < segments.length; i++) {
        if (this.importCancelled) break
        const seg = segments[i]
        const percent = Math.round(((i + 0.5) / segments.length) * 100)
        store.setImportJob({
          active: true,
          filename: label,
          currentChunk: i + 1,
          totalChunks: segments.length,
          percent,
          mode,
        })
        store.setStatus(
          'importing',
          `${mode === 'import' ? 'Importing' : 'Retranscribing'} segment ${i + 1}/${segments.length}...`
        )
        await this.commitUtterance(seg.samples, settings, speaker, seg.startMs)
      }

      store.setImportJob(null)
      store.setStatus(
        'idle',
        this.importCancelled
          ? 'Batch transcription cancelled'
          : `Completed ${segments.length} segments from "${label}"`
      )
    } catch (err: any) {
      store.setDownloadProgress(null)
      store.setImportJob(null)
      store.setStatus('error', `Audio Import Error: ${err?.message || err}`)
      throw err
    }
  }

  /**
   * Demo Mode: loads the bundled sample lecture audio clip and transcribes it
   * through the exact same local Whisper pipeline (works with zero microphone).
   */
  async playSampleLecture(settings: Settings): Promise<void> {
    if (this.isRunning) {
      await this.stop()
    }
    const resp = await fetch('/sample-lecture.wav')
    if (!resp.ok) {
      throw new Error('Could not load bundled sample lecture clip (/sample-lecture.wav).')
    }
    const blob = await resp.blob()
    const sampleFile = new File([blob], 'Sample Lecture Demo.wav', { type: 'audio/wav' })
    await this.importAudioFile(sampleFile, settings)
  }

  /**
   * Demo Mode: streams an audio file through the same transcription pipeline
   */
  async playAudioBuffer(audioBuffer: AudioBuffer, settings: Settings): Promise<void> {
    if (this.isRunning) await this.stop()
    this.sessionStartTime = performance.now()
    this.totalPausedMs = 0
    this.isRunning = true
    this.isPaused = false
    this.isSpeaking = false
    this.utteranceChunks = []

    const store = useAppStore.getState()
    await this.initialize(settings, (p) => store.setDownloadProgress(p))

    store.setStatus('listening', 'Demo Stream: Playing Audio Sample')

    const raw = audioBuffer.getChannelData(0)
    const channelData: Float32Array =
      audioBuffer.sampleRate !== 16000
        ? resampleAudio(raw, audioBuffer.sampleRate, 16000)
        : raw

    const frameSize = 512
    let readPos = 0

    return new Promise<void>((resolve) => {
      this.demoInterval = setInterval(async () => {
        if (!this.isRunning || readPos >= channelData.length) {
          if (this.demoInterval) {
            clearInterval(this.demoInterval)
            this.demoInterval = null
          }
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

        let energy = 0
        for (let i = 0; i < chunk.length; i++) energy += Math.abs(chunk[i])
        const avgEnergy = energy / chunk.length

        if (avgEnergy > 0.015) {
          if (!this.isSpeaking) {
            this.isSpeaking = true
            this.utteranceStartMs = this.getSessionClockMs()
            this.lastPartialTime = performance.now()
          }
          this.utteranceChunks.push(new Float32Array(chunk))
          this.checkPartialOrMaxDuration(settings)
        } else {
          if (this.isSpeaking && this.utteranceChunks.length > (16000 * 0.4) / frameSize) {
            this.isSpeaking = false
            const audioToCommit = this.flattenChunks()
            this.utteranceChunks = []
            await this.commitUtterance(audioToCommit, settings)
          }
        }
      }, 30)
    })
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.isPaused = false
    this.isSpeaking = false
    const store = useAppStore.getState()
    store.setIsSpeaking(false)
    store.setAudioLevel(0, false)

    if (this.demoInterval) {
      clearInterval(this.demoInterval)
      this.demoInterval = null
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

    // Stop recorder & persist full session audio to IndexedDB before closing streams
    await this.stopSessionRecorder()

    // Flush any pending utterance
    if (this.utteranceChunks.length > 0) {
      const finalAudio = this.flattenChunks()
      this.utteranceChunks = []
      const settings = store.settings
      const speaker = this.resolveCurrentSpeaker(settings)
      await this.commitUtterance(finalAudio, settings, speaker)
    }

    this.teardownAudioCapture()
    store.setPartialText('')
    store.setStatus('idle', 'Ready — Click Start to transcribe')
  }

  dispose(): void {
    this.importCancelled = true
    void this.stop()
    if (this.engine) {
      this.engine.dispose()
      this.engine = null
      this.engineConfigKey = ''
    }
  }
}

export const pipelineInstance = new TranscriptionPipeline()
