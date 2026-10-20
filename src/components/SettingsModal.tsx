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
    } catch {
      setServerHealth(`✗ Connection failed: Is 'uvicorn app:app --port 8765' running?`)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-surface-container-low border border-[#353534] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
            <h3 className="text-base font-semibold text-on-surface font-sans">
              Acoustic &amp; VAD Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-bright transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-on-surface-variant">
          {/* Engine Choice */}
          <div className="space-y-3">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-outline">
              ASR Inference Engine
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateSettings({ engine: 'browser' })}
                className={`p-3 border text-left transition-all cursor-pointer ${
                  settings.engine === 'browser'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface'
                    : 'bg-surface-container border-[#2e2e2e] hover:border-[#424656] text-on-surface-variant'
                }`}
              >
                <div className="font-semibold text-sm mb-1 text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">memory</span>
                  <span>In-Browser Whisper</span>
                </div>
                <div className="text-[11px] text-outline leading-snug">
                  WebGPU / WASM. Zero backend needed. Runs directly on laptop.
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ engine: 'python' })}
                className={`p-3 border text-left transition-all cursor-pointer ${
                  settings.engine === 'python'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface'
                    : 'bg-surface-container border-[#2e2e2e] hover:border-[#424656] text-on-surface-variant'
                }`}
              >
                <div className="font-semibold text-sm mb-1 text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-secondary">terminal</span>
                  <span>Local Python Server</span>
                </div>
                <div className="text-[11px] text-outline leading-snug">
                  Faster-Whisper CUDA / CPU backend on localhost:8765.
                </div>
              </button>
            </div>
          </div>

          {/* Spoken Language Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-outline">
              Spoken Language Specification
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ language: 'id' })}
                className={`py-2 px-3 border text-xs font-mono font-semibold transition-all cursor-pointer ${
                  settings.language === 'id'
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container border-[#2e2e2e] text-on-surface-variant hover:border-[#424656]'
                }`}
              >
                🇮🇩 Indonesian (id)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'en' })}
                className={`py-2 px-3 border text-xs font-mono font-semibold transition-all cursor-pointer ${
                  settings.language === 'en'
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container border-[#2e2e2e] text-on-surface-variant hover:border-[#424656]'
                }`}
              >
                🇺🇸 English (en)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'auto' })}
                className={`py-2 px-3 border text-xs font-mono font-semibold transition-all cursor-pointer ${
                  settings.language === 'auto'
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container border-[#2e2e2e] text-on-surface-variant hover:border-[#424656]'
                }`}
              >
                🌐 Auto-Detect
              </button>
            </div>
          </div>

          {/* Browser engine options */}
          {settings.engine === 'browser' && (
            <div className="p-4 bg-surface-container border border-[#2e2e2e] space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-on-surface">Whisper ONNX Model</label>
                <select
                  value={settings.browserModel}
                  onChange={(e) => updateSettings({ browserModel: e.target.value as BrowserModel })}
                  className="bg-surface-container-high border border-[#424656] px-3 py-1.5 text-xs text-on-surface font-mono focus:outline-none"
                >
                  <option value="tiny">whisper-tiny (Multilingual: ID, EN)</option>
                  <option value="base">whisper-base (Multilingual: Higher Accuracy)</option>
                  <option value="tiny.en">whisper-tiny.en (English-only)</option>
                  <option value="base.en">whisper-base.en (English-only)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-on-surface">Acceleration Backend</label>
                <select
                  value={settings.device}
                  onChange={(e) => updateSettings({ device: e.target.value as DevicePref })}
                  className="bg-surface-container-high border border-[#424656] px-3 py-1.5 text-xs text-on-surface font-mono focus:outline-none"
                >
                  <option value="auto">Auto (WebGPU with WASM fallback)</option>
                  <option value="webgpu">WebGPU (Hardware GPU Shader)</option>
                  <option value="wasm">WebAssembly (CPU Quantized q8)</option>
                </select>
              </div>
            </div>
          )}

          {/* Python engine options */}
          {settings.engine === 'python' && (
            <div className="p-4 bg-surface-container border border-[#2e2e2e] space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-on-surface">Python Model</label>
                <select
                  value={settings.pythonModel}
                  onChange={(e) => updateSettings({ pythonModel: e.target.value as PythonModel })}
                  className="bg-surface-container-high border border-[#424656] px-3 py-1.5 text-xs text-on-surface font-mono focus:outline-none"
                >
                  <option value="tiny">tiny (Multilingual: ID, EN)</option>
                  <option value="base">base (Multilingual: Balanced)</option>
                  <option value="small">small (Multilingual: High accuracy)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-on-surface">WebSocket Server URL</label>
                  <button
                    type="button"
                    onClick={checkPythonServer}
                    disabled={isCheckingHealth}
                    className="text-[11px] text-primary hover:underline cursor-pointer font-mono"
                  >
                    {isCheckingHealth ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                <input
                  type="text"
                  value={settings.serverUrl}
                  onChange={(e) => updateSettings({ serverUrl: e.target.value })}
                  placeholder="ws://127.0.0.1:8765"
                  className="w-full bg-surface-container-high border border-[#424656] px-3 py-1.5 text-xs text-on-surface font-mono focus:outline-none"
                />
                {serverHealth && (
                  <p className={`text-xs font-mono ${serverHealth.startsWith('✓') ? 'text-tertiary' : 'text-secondary'}`}>
                    {serverHealth}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* VAD Settings */}
          <div className="space-y-4 pt-2 border-t border-[#262626]">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-outline">
              Silero Voice Activity Detection (VAD)
            </h4>

            {/* Threshold slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface">Speech Probability Threshold</span>
                <span className="font-mono text-primary font-semibold">{settings.vadThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.85"
                step="0.05"
                value={settings.vadThreshold}
                onChange={(e) => updateSettings({ vadThreshold: parseFloat(e.target.value) })}
                className="w-full accent-primary-container cursor-pointer"
              />
              <span className="text-[11px] text-outline">Higher values prevent triggering on breathing or fan noise.</span>
            </div>

            {/* Redemption ms */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface">Silence Redemption Time</span>
                <span className="font-mono text-primary font-semibold">{settings.redemptionMs} ms</span>
              </div>
              <input
                type="range"
                min="300"
                max="1400"
                step="50"
                value={settings.redemptionMs}
                onChange={(e) => updateSettings({ redemptionMs: parseInt(e.target.value, 10) })}
                className="w-full accent-primary-container cursor-pointer"
              />
              <span className="text-[11px] text-outline">Duration of silence that triggers sentence completion and commit.</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-[#262626] flex items-center justify-between">
            <button
              type="button"
              onClick={loadMockData}
              className="text-xs font-mono text-primary hover:underline cursor-pointer"
            >
              Restore Mock Demo Data
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear entire transcript and start fresh session?')) {
                  resetSession()
                  onClose()
                }
              }}
              className="text-xs font-mono text-error hover:underline cursor-pointer"
            >
              Clear Session
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-[#262626] bg-surface-container">
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs font-mono font-semibold text-on-primary bg-primary-container hover:bg-inverse-primary transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
