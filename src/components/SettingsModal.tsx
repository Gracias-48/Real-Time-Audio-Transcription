import React, { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { BrowserModel, DevicePref, PythonModel } from '../lib/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetSession, loadMockData } = useAppStore()
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
        setServerHealth(`✓ Connected: Python Server Online. Loaded: ${Object.keys(data.loaded || {}).join(', ') || 'None (warm-up ready)'}`)
      } else {
        setServerHealth(`✗ Server responded with status ${res.status}`)
      }
    } catch (e: any) {
      setServerHealth(`✗ Connection failed: Is 'uvicorn app:app --port 8765' running?`)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0b1325] border border-[#1e2d47] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b263b] bg-[#0c1426]">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h3 className="text-base font-bold text-slate-100">Transcription &amp; VAD Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
          {/* Engine Choice */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              ASR Inference Engine
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateSettings({ engine: 'browser' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.engine === 'browser'
                    ? 'bg-blue-950/60 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-sm mb-1">In-Browser Whisper</div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  WebGPU / WASM. Zero backend needed. Runs everywhere (Vercel static deploy).
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ engine: 'python' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.engine === 'python'
                    ? 'bg-blue-950/60 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-sm mb-1">Local Python Server</div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Faster-Whisper CUDA / CPU backend on localhost:8765. Hand-written STFT log-Mel.
                </div>
              </button>
            </div>
          </div>

          {/* Spoken Language Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Spoken Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ language: 'id' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  settings.language === 'id'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                🇮🇩 Indonesian (id)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'en' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  settings.language === 'en'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                🇺🇸 English (en)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'auto' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  settings.language === 'auto'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                🌐 Auto-Detect
              </button>
            </div>
          </div>

          {/* Browser engine options */}
          {settings.engine === 'browser' && (
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-slate-300">Whisper ONNX Model</label>
                <select
                  value={settings.browserModel}
                  onChange={(e) => updateSettings({ browserModel: e.target.value as BrowserModel })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="tiny">whisper-tiny (Multilingual: Indonesian, English, etc.)</option>
                  <option value="base">whisper-base (Multilingual: Higher Accuracy)</option>
                  <option value="tiny.en">whisper-tiny.en (English-only)</option>
                  <option value="base.en">whisper-base.en (English-only)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-slate-300">Acceleration Backend</label>
                <select
                  value={settings.device}
                  onChange={(e) => updateSettings({ device: e.target.value as DevicePref })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="auto">Auto (WebGPU with WASM fallback)</option>
                  <option value="webgpu">WebGPU (Hardware GPU accelerated)</option>
                  <option value="wasm">WebAssembly (CPU Quantized q8)</option>
                </select>
              </div>
            </div>
          )}

          {/* Python engine options */}
          {settings.engine === 'python' && (
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-slate-300">Python Model</label>
                <select
                  value={settings.pythonModel}
                  onChange={(e) => updateSettings({ pythonModel: e.target.value as PythonModel })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="tiny">tiny (Multilingual: Indonesian, English)</option>
                  <option value="base">base (Multilingual: Balanced)</option>
                  <option value="small">small (Multilingual: High accuracy)</option>
                  <option value="tiny.en">tiny.en (English-only)</option>
                  <option value="base.en">base.en (English-only)</option>
                  <option value="small.en">small.en (English-only)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-300">WebSocket Server URL</label>
                  <button
                    type="button"
                    onClick={checkPythonServer}
                    disabled={isCheckingHealth}
                    className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    {isCheckingHealth ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                <input
                  type="text"
                  value={settings.serverUrl}
                  onChange={(e) => updateSettings({ serverUrl: e.target.value })}
                  placeholder="ws://127.0.0.1:8765"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                {serverHealth && (
                  <p className={`text-xs ${serverHealth.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {serverHealth}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* VAD Settings */}
          <div className="space-y-4 pt-2 border-t border-slate-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Silero Voice Activity Detection (VAD)
            </h4>

            {/* Threshold slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Speech Probability Threshold</span>
                <span className="font-mono text-blue-400">{settings.vadThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.85"
                step="0.05"
                value={settings.vadThreshold}
                onChange={(e) => updateSettings({ vadThreshold: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400">Higher values avoid triggering on soft breathing or background fan noise.</span>
            </div>

            {/* Redemption ms */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Silence Redemption Time</span>
                <span className="font-mono text-blue-400">{settings.redemptionMs} ms</span>
              </div>
              <input
                type="range"
                min="300"
                max="1400"
                step="50"
                value={settings.redemptionMs}
                onChange={(e) => updateSettings({ redemptionMs: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400">Duration of silence that triggers sentence completion and commits to transcript.</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={loadMockData}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
            >
              Restore Mockup Sample Data
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear entire transcript and start fresh session?')) {
                  resetSession()
                  onClose()
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
            >
              Clear Session
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-[#1b263b] bg-[#0c1426]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
