import type { ASREngine, BrowserModel, DevicePref, TranscribeResult } from './types'
import { useAppStore } from './store'

export class BrowserWhisperEngine implements ASREngine {
  readonly id = 'browser' as const
  readonly label = 'In-Browser Whisper (WebGPU / WASM)'
  device: string = 'WASM'

  private worker: Worker | null = null
  private nextReqId = 1
  private pending = new Map<
    number,
    {
      resolve: (val: any) => void
      reject: (err: any) => void
      onProgress?: (p: number, status?: string) => void
    }
  >()
  private isLoaded = false
  private model: BrowserModel
  private prefDevice: DevicePref

  constructor(model: BrowserModel = 'tiny.en', prefDevice: DevicePref = 'auto') {
    this.model = model
    this.prefDevice = prefDevice
  }

  async load(onProgress: (p: number) => void): Promise<void> {
    if (this.isLoaded && this.worker) {
      onProgress(100)
      return
    }

    if (!this.worker) {
      this.worker = new Worker(new URL('../worker/asr.worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
    }

    const reqId = this.nextReqId++

    return new Promise<void>((resolve, reject) => {
      this.pending.set(reqId, {
        resolve: (data: any) => {
          this.isLoaded = true
          this.device = data.device || 'WASM'
          onProgress(100)
          resolve()
        },
        reject,
        onProgress: (p: number, status?: string) => {
          onProgress(p)
          if (status) {
            useAppStore.getState().setStatus('loading', status)
          }
        },
      })

      this.worker?.postMessage({
        type: 'load',
        id: reqId,
        data: {
          model: this.model,
          device: this.prefDevice,
        },
      })
    })
  }

  async transcribe(audio: Float32Array, opts: { final: boolean }): Promise<TranscribeResult> {
    if (!this.worker || !this.isLoaded) {
      throw new Error('Browser Whisper engine is not loaded.')
    }

    const reqId = this.nextReqId++

    return new Promise<TranscribeResult>((resolve, reject) => {
      this.pending.set(reqId, {
        resolve: (data: any) => {
          resolve({ text: data.text, ms: data.ms })
        },
        reject,
      })

      this.worker?.postMessage({
        type: 'transcribe',
        id: reqId,
        data: {
          audio,
          final: opts.final,
        },
      })
    })
  }

  private handleWorkerMessage(e: MessageEvent) {
    const { type, id, ...data } = e.data
    const handler = this.pending.get(id)

    if (type === 'progress') {
      if (handler?.onProgress) {
        handler.onProgress(data.progress || 0, data.status)
      }
      return
    }

    if (!handler) return

    if (type === 'loaded') {
      this.pending.delete(id)
      handler.resolve(data)
    } else if (type === 'transcribe_result') {
      this.pending.delete(id)
      handler.resolve(data)
    } else if (type === 'error') {
      this.pending.delete(id)
      handler.reject(new Error(data.message || 'Worker error'))
    }
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.isLoaded = false
    this.pending.clear()
  }
}
