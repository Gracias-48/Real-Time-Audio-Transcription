/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers'
import { cleanWhisperText } from '../lib/text'

// Configure Transformers.js to use self-hosted WASM/WebGPU binaries and cache models in IndexedDB
env.allowLocalModels = false
env.useBrowserCache = true

// Point ONNX runtime to self-hosted WASM folder if needed
if (typeof env.backends?.onnx?.wasm === 'object') {
  env.backends.onnx.wasm.proxy = false
  env.backends.onnx.wasm.wasmPaths = '/ort/'
}

let transcriber: any = null
let currentModel: string = ''
let activeDevice: string = 'wasm'

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data

  if (type === 'load') {
    const { model = 'tiny', device = 'auto' } = data || {}
    try {
      let modelId = 'onnx-community/whisper-tiny'
      if (model === 'tiny.en') {
        modelId = 'onnx-community/whisper-tiny.en'
      } else if (model === 'base.en') {
        modelId = 'onnx-community/whisper-base.en'
      } else if (model === 'base') {
        modelId = 'onnx-community/whisper-base'
      } else {
        modelId = 'onnx-community/whisper-tiny'
      }

      const isEnglishOnly = modelId.endsWith('.en')

      self.postMessage({ type: 'progress', id, progress: 10, status: `Initializing ${model} engine...` })

      // Try WebGPU first if requested / available, fall back to wasm
      const devicesToTry: ('webgpu' | 'wasm')[] =
        device === 'webgpu'
          ? ['webgpu', 'wasm']
          : device === 'wasm'
            ? ['wasm']
            : ['webgpu', 'wasm']

      let lastError: any = null
      transcriber = null

      for (const dev of devicesToTry) {
        try {
          console.log(`[ASR Worker] Attempting to load ${modelId} on ${dev}...`)
          self.postMessage({
            type: 'progress',
            id,
            progress: 25,
            status: `Loading ${model} on ${dev.toUpperCase()}...`,
          })

          const dtype: any =
            dev === 'webgpu'
              ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
              : 'q8'

          transcriber = await pipeline('automatic-speech-recognition', modelId, {
            device: dev,
            dtype,
            progress_callback: (info: any) => {
              if (info.status === 'progress' && typeof info.progress === 'number') {
                const scaled = Math.min(95, Math.round(25 + (info.progress * 0.7)))
                self.postMessage({
                  type: 'progress',
                  id,
                  progress: scaled,
                  status: `Downloading model (${scaled}%)...`,
                })
              }
            },
          })

          // Warmup decode to verify that runtime inference actually works on this device
          console.log(`[ASR Worker] Verifying warmup inference on ${dev}...`)
          const warmupOpts: any = {
            return_timestamps: false,
            chunk_length_s: 30,
          }
          if (!isEnglishOnly) {
            warmupOpts.language = 'id'
            warmupOpts.task = 'transcribe'
          }
          await transcriber(new Float32Array(16000), warmupOpts)
          console.log(`[ASR Worker] Warmup inference succeeded on ${dev}!`)

          activeDevice = dev
          currentModel = modelId
          break
        } catch (err: any) {
          console.warn(`Failed loading/running model on ${dev}:`, err)
          lastError = err
        }
      }

      if (!transcriber) {
        throw new Error(`Could not initialize Whisper model (${model}): ${lastError?.message || lastError}`)
      }

      self.postMessage({
        type: 'loaded',
        id,
        device: activeDevice === 'webgpu' ? 'WebGPU' : 'WASM',
        model: currentModel,
      })
    } catch (err: any) {
      self.postMessage({ type: 'error', id, message: err?.message || String(err) })
    }
  } else if (type === 'transcribe') {
    if (!transcriber) {
      self.postMessage({ type: 'error', id, message: 'ASR engine is not loaded yet.' })
      return
    }

    const { audio, final, prompt, language } = data
    try {
      if (!audio || audio.length < 800) {
        self.postMessage({
          type: 'transcribe_result',
          id,
          text: '',
          ms: 0,
          final,
        })
        return
      }

      const isEnglishOnly = currentModel.endsWith('.en')
      const genOptions: any = {
        return_timestamps: false,
        chunk_length_s: 30,
      }

      if (!isEnglishOnly) {
        const lang = language || 'id'
        if (lang !== 'auto') {
          genOptions.language = lang
        }
        genOptions.task = 'transcribe'
      }

      if (prompt) {
        genOptions.initial_prompt = prompt
      }

      const t0 = performance.now()
      const output = await transcriber(audio, genOptions)

      const rawText = typeof output === 'string' ? output : (output?.text || '')
      const cleaned = cleanWhisperText(rawText)
      const decodeMs = Math.round(performance.now() - t0)
      console.log(`[ASR Worker] Decoded ${audio.length} samples in ${decodeMs}ms (${final ? 'final' : 'partial'}): "${rawText}" -> "${cleaned}"`)

      self.postMessage({
        type: 'transcribe_result',
        id,
        text: cleaned,
        ms: decodeMs,
        final,
      })
    } catch (err: any) {
      console.error('[ASR Worker] Transcribe error:', err)
      self.postMessage({ type: 'error', id, message: err?.message || String(err) })
    }
  }
}
