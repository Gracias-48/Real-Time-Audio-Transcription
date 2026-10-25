import type { ASREngine, PythonModel, TranscribeResult } from './types'

export class PythonServerEngine implements ASREngine {
  readonly id = 'python' as const
  readonly label = 'Local Python Server (Faster-Whisper CUDA/CPU)'
  device: string = 'CUDA'

  private ws: WebSocket | null = null
  private nextReqId = 1
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()
  private isLoaded = false
  private serverUrl: string
  private model: PythonModel
  language: string

  constructor(
    serverUrl: string = 'ws://127.0.0.1:8765',
    model: PythonModel = 'tiny',
    language: string = 'id'
  ) {
    this.serverUrl = serverUrl
    this.model = model
    this.language = language
  }

  async load(onProgress: (p: number) => void): Promise<void> {
    if (this.isLoaded && this.ws?.readyState === WebSocket.OPEN) {
      onProgress(100)
      return
    }

    onProgress(20)

    const wsUrl = `${this.serverUrl.replace(/\/$/, '')}/ws/asr`
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl)
        this.ws.binaryType = 'arraybuffer'

        const timeout = setTimeout(() => {
          reject(new Error(`Connection to Python backend timed out at ${wsUrl}. Make sure the server is running.`))
        }, 8000)

        this.ws.onopen = () => {
          clearTimeout(timeout)
          onProgress(60)
          // Request model warm-up/preload
          this.ws?.send(JSON.stringify({ type: 'load', model: this.model }))
        }

        this.ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data)
              if (msg.type === 'loaded') {
                this.isLoaded = true
                this.device = `${msg.device.toUpperCase()} (${msg.computeType})`
                onProgress(100)
                resolve()
                return
              }
              if (msg.id && this.pending.has(msg.id)) {
                const handler = this.pending.get(msg.id)!
                this.pending.delete(msg.id)
                if (msg.error) {
                  handler.reject(new Error(msg.error))
                } else {
                  handler.resolve(msg)
                }
              }
            } catch (err) {
              console.error('WebSocket parse error:', err)
            }
          }
        }

        this.ws.onerror = (_err) => {
          clearTimeout(timeout)
          reject(new Error(`Cannot connect to Python server at ${wsUrl}. Is the local server running on port 8765?`))
        }

        this.ws.onclose = () => {
          this.isLoaded = false
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  async transcribe(audio: Float32Array, opts: { final: boolean; prompt?: string }): Promise<TranscribeResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Python server WebSocket is not connected.')
    }

    const reqId = this.nextReqId++
    const header = JSON.stringify({
      id: reqId,
      final: opts.final,
      model: this.model,
      prompt: opts.prompt,
      language: this.language,
    })

    const headerBytes = new TextEncoder().encode(header)
    const headerLen = headerBytes.byteLength

    // Binary protocol: [uint32 LE headerLen][header bytes][float32 PCM @16k]
    const packet = new Uint8Array(4 + headerLen + audio.byteLength)
    const view = new DataView(packet.buffer)
    view.setUint32(0, headerLen, true)
    packet.set(headerBytes, 4)
    packet.set(new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength), 4 + headerLen)

    return new Promise<TranscribeResult>((resolve, reject) => {
      this.pending.set(reqId, {
        resolve: (data: any) => {
          resolve({ text: data.text || '', ms: data.ms || 0 })
        },
        reject,
      })

      this.ws?.send(packet.buffer)
    })
  }

  dispose(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isLoaded = false
    this.pending.clear()
  }
}
