import React, { useCallback, useEffect, useId, useState } from 'react'
import { useAppStore } from '../lib/store'
import { useModalDialog } from '../lib/useModalDialog'
import type { AudioSourceMode, BrowserModel, DevicePref, PythonModel } from '../lib/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, startNewSession, status } = useAppStore()
  const dialogRef = useModalDialog(isOpen, onClose)
  const titleId = useId()
  const isRecordingActive = status === 'listening' || status === 'paused'

  const [serverHealth, setServerHealth] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [deviceStatus, setDeviceStatus] = useState<string>('')

  const refreshAudioDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter((d) => d.kind === 'audioinput')
      setAudioInputs(mics)
      setDeviceStatus(
        mics.some((m) => m.label)
          ? `${mics.length} microphone(s) detected`
          : 'Grant mic permission on Start to reveal hardware labels'
      )
    } catch {
      setDeviceStatus('Could not enumerate microphones')
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !navigator.mediaDevices?.enumerateDevices) return
    let active = true
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (!active) return
        const mics = devices.filter((d) => d.kind === 'audioinput')
        setAudioInputs(mics)
        setDeviceStatus(
          mics.some((m) => m.label)
            ? `${mics.length} microphone(s) detected`
            : 'Grant mic permission on Start to reveal hardware labels'
        )
      })
      .catch(() => {
        if (active) setDeviceStatus('Could not enumerate microphones')
      })
    return () => {
      active = false
    }
  }, [isOpen])

  const checkPythonServer = async () => {
    setIsCheckingHealth(true)
    setServerHealth(null)
    try {
      const httpUrl = settings.serverUrl.replace(/^ws/, 'http').replace(/\/$/, '')
      const res = await fetch(`${httpUrl}/health`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        setServerHealth(
          `Connected · Loaded: ${Object.keys(data.loaded || {}).join(', ') || 'None (ready)'}`
        )
      } else {
        setServerHealth(`Server responded with status ${res.status}`)
      }
    } catch {
      setServerHealth(`Connection failed — ensure 'uvicorn app:app --port 8765' is running locally.`)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-modal w-full max-w-xl"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="w-full bg-white rounded-xl border border-[#E6E6E3] shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E6E6E3] bg-white">
          <div>
            <h2 id={titleId} className="text-[14px] font-semibold tracking-[-0.01em] text-[#141413]">
              Audio &amp; ASR Engine
            </h2>
            <p className="text-[12px] text-[#8E8E8A] mt-0.5">
              Configure local speech recognition, hardware input, and glossary hints
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#F1F1EF] flex items-center justify-center transition-colors duration-150 cursor-pointer"
            type="button"
            aria-label="Close settings dialog"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-[13px] text-[#5C5C59]">
          {isRecordingActive && (
            <div className="px-3 py-2 rounded-[6px] bg-[#FEFCE8] border border-[#E6E6E3] text-[12px] text-[#141413] flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] mt-1.5 shrink-0" />
              <span>
                Recording is active. Stop and restart the lecture to apply Language, Whisper Model,
                or Audio Input changes cleanly.
              </span>
            </div>
          )}

          {/* Audio Capture & Hardware */}
          <div className="space-y-3 p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E3]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#8E8E8A]">
                Audio Input
              </span>
              <button
                type="button"
                onClick={() => void refreshAudioDevices()}
                className="text-[11px] text-[#5C5C59] hover:text-[#141413] font-medium inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  refresh
                </span>
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="audio-source-select"
                  className="block text-[12px] font-medium text-[#141413] mb-1"
                >
                  Capture Source
                </label>
                <select
                  id="audio-source-select"
                  value={settings.audioSource}
                  onChange={(e) =>
                    updateSettings({ audioSource: e.target.value as AudioSourceMode })
                  }
                  className="w-full h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] focus:outline-none focus:border-[#141413]"
                >
                  <option value="mic">Microphone Only</option>
                  <option value="system">Tab / System Audio (Zoom, Meet, YouTube)</option>
                  <option value="mixed">Dual Mixed: Mic + Tab Audio</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="mic-device-select"
                  className="block text-[12px] font-medium text-[#141413] mb-1"
                >
                  Microphone Hardware
                </label>
                <select
                  id="mic-device-select"
                  value={settings.micDeviceId}
                  onChange={(e) => updateSettings({ micDeviceId: e.target.value })}
                  disabled={settings.audioSource === 'system'}
                  className="w-full h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] focus:outline-none focus:border-[#141413] disabled:opacity-50"
                >
                  <option value="">System Default Microphone</option>
                  {audioInputs.map((dev, i) => (
                    <option key={dev.deviceId || i} value={dev.deviceId}>
                      {dev.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
                {deviceStatus && (
                  <p className="text-[11px] text-[#8E8E8A] mt-1">{deviceStatus}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <label
                htmlFor="noise-conditioning-toggle"
                className="flex items-start gap-2 text-[12px] text-[#5C5C59] cursor-pointer bg-white p-2.5 rounded-[6px] border border-[#E6E6E3]"
              >
                <input
                  id="noise-conditioning-toggle"
                  type="checkbox"
                  checked={settings.noiseConditioning}
                  onChange={(e) => updateSettings({ noiseConditioning: e.target.checked })}
                  className="mt-0.5 rounded border-[#E6E6E3] accent-[#141413]"
                />
                <span>
                  <strong className="block font-medium text-[#141413]">
                    Noise Filter &amp; Anti-Clipping
                  </strong>
                  <span className="text-[11px] text-[#8E8E8A]">
                    80 Hz high-pass + dynamic vocal leveling
                  </span>
                </span>
              </label>

              <label
                htmlFor="save-audio-toggle"
                className="flex items-start gap-2 text-[12px] text-[#5C5C59] cursor-pointer bg-white p-2.5 rounded-[6px] border border-[#E6E6E3]"
              >
                <input
                  id="save-audio-toggle"
                  type="checkbox"
                  checked={settings.saveAudioRecording}
                  onChange={(e) => updateSettings({ saveAudioRecording: e.target.checked })}
                  className="mt-0.5 rounded border-[#E6E6E3] accent-[#141413]"
                />
                <span>
                  <strong className="block font-medium text-[#141413]">
                    Save Audio Locally
                  </strong>
                  <span className="text-[11px] text-[#8E8E8A]">
                    IndexedDB WebM for replay &amp; retranscription
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Engine Choice */}
          <div className="space-y-2">
            <span className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#8E8E8A]">
              Local ASR Engine
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={settings.engine === 'browser'}
                onClick={() => updateSettings({ engine: 'browser' })}
                className={`p-3 rounded-[6px] border text-left transition-colors duration-150 cursor-pointer ${
                  settings.engine === 'browser'
                    ? 'bg-[#F7F7F5] border-[#141413] text-[#141413]'
                    : 'bg-white border-[#E6E6E3] hover:bg-[#FAFAFA] text-[#5C5C59]'
                }`}
              >
                <div className="font-medium text-[12px] mb-0.5 text-[#141413] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    memory
                  </span>
                  <span>In-Browser Whisper</span>
                </div>
                <div className="text-[11px] text-[#8E8E8A] leading-snug">
                  WebGPU / WASM in a local worker. No server required.
                </div>
              </button>

              <button
                type="button"
                aria-pressed={settings.engine === 'python'}
                onClick={() => updateSettings({ engine: 'python' })}
                className={`p-3 rounded-[6px] border text-left transition-colors duration-150 cursor-pointer ${
                  settings.engine === 'python'
                    ? 'bg-[#F7F7F5] border-[#141413] text-[#141413]'
                    : 'bg-white border-[#E6E6E3] hover:bg-[#FAFAFA] text-[#5C5C59]'
                }`}
              >
                <div className="font-medium text-[12px] mb-0.5 text-[#141413] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    terminal
                  </span>
                  <span>Local Python Server</span>
                </div>
                <div className="text-[11px] text-[#8E8E8A] leading-snug">
                  faster-whisper CUDA / CPU on localhost:8765.
                </div>
              </button>
            </div>
          </div>

          {/* Browser Whisper Model */}
          {settings.engine === 'browser' && (
            <div className="p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E3] grid grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="browser-model-select"
                  className="block text-[12px] font-medium text-[#141413] mb-1"
                >
                  Whisper Checkpoint
                </label>
                <select
                  id="browser-model-select"
                  value={settings.browserModel}
                  onChange={(e) =>
                    updateSettings({ browserModel: e.target.value as BrowserModel })
                  }
                  className="w-full h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] focus:outline-none focus:border-[#141413]"
                >
                  <option value="tiny">whisper-tiny (Fastest · 39M)</option>
                  <option value="base">whisper-base (Higher Accuracy · 74M)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="compute-device-select"
                  className="block text-[12px] font-medium text-[#141413] mb-1"
                >
                  Execution Backend
                </label>
                <select
                  id="compute-device-select"
                  value={settings.device}
                  onChange={(e) => updateSettings({ device: e.target.value as DevicePref })}
                  className="w-full h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] focus:outline-none focus:border-[#141413]"
                >
                  <option value="auto">Auto (WebGPU with WASM fallback)</option>
                  <option value="webgpu">WebGPU (GPU Shaders)</option>
                  <option value="wasm">WASM CPU (Threaded SIMD)</option>
                </select>
              </div>
            </div>
          )}

          {/* Python Server Config */}
          {settings.engine === 'python' && (
            <div className="p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E3] space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="python-model-select"
                    className="block text-[12px] font-medium text-[#141413] mb-1"
                  >
                    Python Whisper Model
                  </label>
                  <select
                    id="python-model-select"
                    value={settings.pythonModel}
                    onChange={(e) =>
                      updateSettings({ pythonModel: e.target.value as PythonModel })
                    }
                    className="w-full h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] focus:outline-none focus:border-[#141413]"
                  >
                    <option value="tiny">whisper-tiny (Fastest · 39M)</option>
                    <option value="base">whisper-base (Recommended · 74M)</option>
                    <option value="small">whisper-small (Highest Accuracy · 244M)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="server-url-input"
                    className="block text-[12px] font-medium text-[#141413] mb-1"
                  >
                    WebSocket Endpoint
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="server-url-input"
                      type="text"
                      value={settings.serverUrl}
                      onChange={(e) => updateSettings({ serverUrl: e.target.value })}
                      className="flex-1 h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] font-mono text-[#141413] focus:outline-none focus:border-[#141413]"
                      placeholder="ws://127.0.0.1:8765"
                    />
                    <button
                      type="button"
                      onClick={checkPythonServer}
                      disabled={isCheckingHealth}
                      className="h-8 px-3 bg-white border border-[#E6E6E3] hover:bg-[#F1F1EF] text-[#141413] rounded-[6px] text-[12px] font-medium disabled:opacity-50 transition-colors duration-150 cursor-pointer"
                    >
                      {isCheckingHealth ? '...' : 'Test'}
                    </button>
                  </div>
                </div>
              </div>
              {serverHealth && (
                <div className="text-[11px] font-mono text-[#5C5C59]">{serverHealth}</div>
              )}
            </div>
          )}

          {/* Language & VAD */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="asr-language-select"
                className="block text-[12px] font-medium text-[#141413] mb-1"
              >
                Transcription Language
              </label>
              <select
                id="asr-language-select"
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value as 'id' | 'en' })}
                className="w-full h-8 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] focus:outline-none focus:border-[#141413]"
              >
                <option value="id">Bahasa Indonesia (ID)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="vad-threshold-range"
                className="block text-[12px] font-medium text-[#141413] mb-1 tabular-nums"
              >
                VAD Sensitivity ({settings.vadThreshold})
              </label>
              <input
                id="vad-threshold-range"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={settings.vadThreshold}
                onChange={(e) => updateSettings({ vadThreshold: parseFloat(e.target.value) })}
                className="w-full accent-[#141413] mt-2 cursor-pointer"
              />
            </div>
          </div>

          {/* Domain Glossary Prompt */}
          <div>
            <label
              htmlFor="glossary-prompt-input"
              className="block text-[12px] font-medium text-[#141413] mb-1"
            >
              Lecture Domain Glossary (Bias Hint)
            </label>
            <textarea
              id="glossary-prompt-input"
              value={settings.glossaryPrompt}
              onChange={(e) => updateSettings({ glossaryPrompt: e.target.value })}
              rows={3}
              className="w-full bg-white border border-[#E6E6E3] rounded-[6px] p-2.5 text-[12px] font-mono text-[#141413] focus:outline-none focus:border-[#141413]"
              placeholder="Comma-separated technical terms..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#E6E6E3] flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm('Archive current session and clear transcript?')) {
                startNewSession()
                onClose()
              }
            }}
            type="button"
            className="text-[12px] text-[#5C5C59] hover:text-[#DC2626] font-medium transition-colors duration-150 cursor-pointer"
          >
            Start New Session
          </button>
          <button
            onClick={onClose}
            type="button"
            className="h-8 px-4 rounded-[6px] bg-[#141413] hover:bg-[#2A2A28] text-white text-[12px] font-medium transition-colors duration-150 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default SettingsModal
