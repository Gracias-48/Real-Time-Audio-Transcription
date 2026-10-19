/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers'
import { cleanWhisperText } from '../lib/text'

// Configure Transformers.js to use self-hosted WASM/WebGPU binaries and cache models in IndexedDB
env.allowLocalModels = false
env.useBrowserCache = true

// Point ONNX runtime to self-hosted WASM folder if needed
if (typeof env.backends?.onnx?.wasm === 'object') {
  env.backends.onnx.wasm.proxy = false
}

let transcriber: any = null
let currentModel: string = ''
let activeDevice: string = 'wasm'

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data

  if (type === 'load') {
    const { model = 'tiny.en', device = 'auto' } = data || {}
    try {
      const modelId = model === 'base.en' ? 'onnx-community/whisper-base.en' : 'onnx-community/whisper-tiny.en'

      self.postMessage({ type: 'progress', id, progress: 10, status: 'Initializing engine...' })

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
          self.postMessage({
            type: 'progress',
            id,
            progress: 25,
            status: `Loading ${model} on ${dev.toUpperCase()}...`,
          })

          transcriber = await pipeline('automatic-speech-recognition', modelId, {
            device: dev,
            dtype: dev === 'webgpu' ? 'fp32' : 'q8',
            progress_callback: (info: any) => {
              if (info.status === 'progress' && typeof info.progress === 'number') {
                const scaled = Math.min(95, Math.round(25 + (info.progress * 0.7)))
                self.postMessage({ type: 'progress', id, progress: scaled, status: `Downloading ${info.file || 'model'}...` })
              }
            },
          })

          activeDevice = dev
          currentModel = model
          break
        } catch (err: any) {
          console.warn(`Failed loading model on ${dev}:`, err)
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

    const { audio, final, prompt } = data
    try {
      const t0 = performance.now()
      const output = await transcriber(audio, {
        language: 'en',
        task: 'transcribe',
        return_timestamps: false,
        chunk_length_s: 30,
        initial_prompt: prompt || undefined,
      })

      const rawText = typeof output === 'string' ? output : (output?.text || '')
      const cleaned = cleanWhisperText(rawText)
      const decodeMs = Math.round(performance.now() - t0)

      self.postMessage({
        type: 'transcribe_result',
        id,
        text: cleaned,
        ms: decodeMs,
        final,
      })
    } catch (err: any) {
      self.postMessage({ type: 'error', id, message: err?.message || String(err) })
    }
  }
}
