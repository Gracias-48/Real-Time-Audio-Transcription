import React, { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { BrowserModel, DevicePref, PythonModel } from '../lib/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, startNewSession } = useAppStore()
  const [serverHealth, setServerHealth] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  if (!isOpen) return null

  const checkPythonServer = async () => {
    setIsCheckingHealth(true)
    setServerHealth(null)
    try {
      const httpUrl = settings.serverUrl.replace(/^ws/, 'http').replace(/\/$/, '')
      const res = await fetch(`${httpUrl}/health`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        setServerHealth(`✓ Connected: Python Server Online. Loaded: ${Object.keys(data.loaded || {}).join(', ') || 'None (ready)'}`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-xl border border-gray-200/80 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Acoustic &amp; ASR Engine Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Adjust on-device speech model and voice activity detection thresholds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-slate-700">
          {/* Engine Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              ASR Inference Engine
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateSettings({ engine: 'browser' })}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  settings.engine === 'browser'
                    ? 'bg-blue-50/60 border-blue-500 text-slate-900'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-slate-600'
                }`}
              >
                <div className="font-semibold text-xs mb-1 text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">memory</span>
                  <span>In-Browser Whisper</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  100% Client-side WebGPU / WASM. Zero backend server required.
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ engine: 'python' })}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  settings.engine === 'python'
                    ? 'bg-blue-50/60 border-blue-500 text-slate-900'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-slate-600'
                }`}
              >
                <div className="font-semibold text-xs mb-1 text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-700">terminal</span>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Browser Whisper Model
                  </label>
                  <select
                    value={settings.browserModel}
                    onChange={(e) => updateSettings({ browserModel: e.target.value as BrowserModel })}
                    className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="tiny">whisper-tiny (Multilingual - 39M)</option>
                    <option value="base">whisper-base (Multilingual - 74M)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Computation Device
                  </label>
                  <select
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Python Whisper Model
                  </label>
                  <select
                    value={settings.pythonModel}
                    onChange={(e) => updateSettings({ pythonModel: e.target.value as PythonModel })}
                    className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="tiny">whisper-tiny (Fastest - 39M)</option>
                    <option value="base">whisper-base (Recommended - 74M)</option>
                    <option value="small">whisper-small (Highest Accuracy - 244M)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WebSocket Server Endpoint
                  </label>
                  <div className="flex gap-2">
                    <input
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

          {/* Language Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ASR Primary Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value as 'id' | 'en' })}
                className="w-full bg-white border border-gray-200 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="id">Bahasa Indonesia (id)</option>
                <option value="en">English (en)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                VAD Silence Threshold ({settings.vadThreshold})
              </label>
              <input
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
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Lecture Domain Glossary Prompt (Bias Hint)
            </label>
            <textarea
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
    </div>
  )
}

export default SettingsModal
