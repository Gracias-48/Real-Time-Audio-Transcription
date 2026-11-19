import React, { useCallback, useEffect, useId, useState } from 'react'
import { useAppStore } from '../lib/store'
import { useModalDialog } from '../lib/useModalDialog'
import type { AudioSourceMode, BrowserModel, DevicePref, PythonModel } from '../lib/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, startNewSession } = useAppStore()
  const dialogRef = useModalDialog(isOpen, onClose)
  const titleId = useId()

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
          `✓ Connected: Python Server Online. Loaded: ${Object.keys(data.loaded || {}).join(', ') || 'None (ready)'}`
        )
      } else {
        setServerHealth(`✗ Server responded with status ${res.status}`)
      }
    } catch {
      setServerHealth(`✗ Connection failed: Is 'uvicorn app:app --port 8765' running on localhost?`)
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
      <div className="w-full bg-white rounded-xl border border-gray-200/80 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                tune
              </span>
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-semibold tracking-tight text-slate-900">
                Acoustic &amp; ASR Engine Configuration
              </h2>
              <p className="text-xs text-slate-400">
                100% local speech processing — zero cloud API keys or subscriptions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            type="button"
            aria-label="Close settings dialog"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-slate-700">
          {/* Audio Capture & Conditioning (Meetily-inspired) */}
          <div className="space-y-3 p-4 bg-slate-50/80 rounded-lg border border-gray-200/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                Audio Capture &amp; Hardware
              </span>
              <button
                type="button"
                onClick={() => void refreshAudioDevices()}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  refresh
                </span>
                <span>Refresh Devices</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="audio-source-select" className="block text-xs font-medium text-slate-700 mb-1">
                  Capture Mode
                </label>
                <select
                  id="audio-source-select"
                  value={settings.audioSource}
                  onChange={(e) =>
                    updateSettings({ audioSource: e.target.value as AudioSourceMode })
                  }
                  className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="mic">Microphone Only (Classroom)</option>
                  <option value="system">Tab / System Audio (Zoom, Meet, YouTube)</option>
                  <option value="mixed">Dual Mixed: Mic + Tab Audio (Speaker Tags)</option>
                </select>
              </div>

              <div>
                <label htmlFor="mic-device-select" className="block text-xs font-medium text-slate-700 mb-1">
                  Microphone Input Device
                </label>
                <select
                  id="mic-device-select"
                  value={settings.micDeviceId}
                  onChange={(e) => updateSettings({ micDeviceId: e.target.value })}
                  disabled={settings.audioSource === 'system'}
                  className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">System Default Microphone</option>
                  {audioInputs.map((dev, i) => (
                    <option key={dev.deviceId || i} value={dev.deviceId}>
                      {dev.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
                {deviceStatus && (
                  <p className="text-[10px] text-slate-400 mt-1">{deviceStatus}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label
                htmlFor="noise-conditioning-toggle"
                className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer bg-white p-2.5 rounded border border-gray-200/70"
              >
                <input
                  id="noise-conditioning-toggle"
                  type="checkbox"
                  checked={settings.noiseConditioning}
                  onChange={(e) => updateSettings({ noiseConditioning: e.target.checked })}
                  className="mt-0.5 rounded border-gray-300 text-blue-600"
                />
                <span>
                  <strong className="block font-medium text-slate-900">
                    Noise Filter &amp; Anti-Clipping
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    80Hz high-pass + dynamic leveling for quiet rooms
                  </span>
                </span>
              </label>

              <label
                htmlFor="save-audio-toggle"
                className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer bg-white p-2.5 rounded border border-gray-200/70"
              >
                <input
                  id="save-audio-toggle"
                  type="checkbox"
                  checked={settings.saveAudioRecording}
                  onChange={(e) => updateSettings({ saveAudioRecording: e.target.checked })}
                  className="mt-0.5 rounded border-gray-300 text-blue-600"
                />
                <span>
                  <strong className="block font-medium text-slate-900">
                    Save Local Audio Replay
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    Store WebM in IndexedDB for click-to-replay &amp; retranscribe
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Engine Choice */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              Local ASR Inference Engine
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={settings.engine === 'browser'}
                onClick={() => updateSettings({ engine: 'browser' })}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  settings.engine === 'browser'
                    ? 'bg-blue-50/60 border-blue-500 text-slate-900'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-slate-600'
                }`}
              >
                <div className="font-semibold text-xs mb-1 text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600" aria-hidden="true">
                    memory
                  </span>
                  <span>In-Browser Whisper</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  100% Client-side WebGPU / WASM. Zero backend server required.
                </div>
              </button>

              <button
                type="button"
                aria-pressed={settings.engine === 'python'}
                onClick={() => updateSettings({ engine: 'python' })}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  settings.engine === 'python'
                    ? 'bg-blue-50/60 border-blue-500 text-slate-900'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-slate-600'
                }`}
              >
                <div className="font-semibold text-xs mb-1 text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-700" aria-hidden="true">
                    terminal
                  </span>
                  <span>Local Python Server</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  faster-whisper CUDA / CTranslate2 on localhost:8765.
                </div>
              </button>
            </div>
          </div>

          {/* Browser Whisper Model */}
          {settings.engine === 'browser' && (
            <div className="space-y-3 p-4 bg-slate-50/80 rounded-lg border border-gray-200/60">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="browser-model-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Browser Whisper Model
                  </label>
                  <select
                    id="browser-model-select"
                    value={settings.browserModel}
                    onChange={(e) =>
                      updateSettings({ browserModel: e.target.value as BrowserModel })
                    }
                    className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="tiny">whisper-tiny (Multilingual - 39M)</option>
                    <option value="base">whisper-base (Higher Accuracy - 74M)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="compute-device-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Computation Device
                  </label>
                  <select
                    id="compute-device-select"
                    value={settings.device}
                    onChange={(e) => updateSettings({ device: e.target.value as DevicePref })}
                    className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="auto">Auto (WebGPU with WASM fallback)</option>
                    <option value="webgpu">WebGPU (Hardware Shaders)</option>
                    <option value="wasm">WASM CPU (Threaded SIMD)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Python Server Config */}
          {settings.engine === 'python' && (
            <div className="space-y-3 p-4 bg-slate-50/80 rounded-lg border border-gray-200/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="python-model-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Python Whisper Model
                  </label>
                  <select
                    id="python-model-select"
                    value={settings.pythonModel}
                    onChange={(e) =>
                      updateSettings({ pythonModel: e.target.value as PythonModel })
                    }
                    className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="tiny">whisper-tiny (Fastest - 39M)</option>
                    <option value="base">whisper-base (Recommended - 74M)</option>
                    <option value="small">whisper-small (Highest Accuracy - 244M)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="server-url-input" className="block text-xs font-medium text-slate-700 mb-1">
                    WebSocket Server Endpoint
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="server-url-input"
                      type="text"
                      value={settings.serverUrl}
                      onChange={(e) => updateSettings({ serverUrl: e.target.value })}
                      className="flex-1 bg-white border border-gray-200 rounded-md p-2 text-xs font-mono text-slate-900 focus:outline-none"
                      placeholder="ws://127.0.0.1:8765"
                    />
                    <button
                      type="button"
                      onClick={checkPythonServer}
                      disabled={isCheckingHealth}
                      className="px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      {isCheckingHealth ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                </div>
              </div>
              {serverHealth && (
                <div className="mt-1 text-xs font-mono text-slate-600">{serverHealth}</div>
              )}
            </div>
          )}

          {/* Language Selection & VAD */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="asr-language-select" className="block text-xs font-medium text-slate-700 mb-1">
                ASR Primary Language
              </label>
              <select
                id="asr-language-select"
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value as 'id' | 'en' })}
                className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="id">Bahasa Indonesia (id)</option>
                <option value="en">English (en)</option>
              </select>
            </div>

            <div>
              <label htmlFor="vad-threshold-range" className="block text-xs font-medium text-slate-700 mb-1">
                VAD Silence Threshold ({settings.vadThreshold})
              </label>
              <input
                id="vad-threshold-range"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={settings.vadThreshold}
                onChange={(e) => updateSettings({ vadThreshold: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 mt-2 cursor-pointer"
              />
            </div>
          </div>

          {/* Academic Technical Terms Prompt */}
          <div>
            <label htmlFor="glossary-prompt-input" className="block text-xs font-medium text-slate-700 mb-1">
              Lecture Domain Glossary Prompt (Whisper Bias Hint)
            </label>
            <textarea
              id="glossary-prompt-input"
              value={settings.glossaryPrompt}
              onChange={(e) => updateSettings({ glossaryPrompt: e.target.value })}
              rows={3}
              className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="Comma-separated technical terms..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm('Archive current session and clear transcript?')) {
                startNewSession()
                onClose()
              }
            }}
            type="button"
            className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
          >
            Start New Session
          </button>
          <button
            onClick={onClose}
            type="button"
            className="h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default SettingsModal
