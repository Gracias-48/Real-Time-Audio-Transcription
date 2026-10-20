import React from 'react'
import { useAppStore } from '../lib/store'
import { Link, useLocation } from 'react-router-dom'

interface TopBarProps {
  onOpenSettings: () => void
  onOpenExport?: () => void
  onToggleSidebar?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSettings, onOpenExport, onToggleSidebar }) => {
  const { status, statusMessage, latencyMs, rtf, engineDevice, settings, updateSettings } = useAppStore()
  const location = useLocation()
  const isEvaluatePage = location.pathname === '/evaluate'

  const latencySec = (latencyMs / 1000).toFixed(2) + 's'

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest z-50 flex items-center justify-between px-space-md border-b border-[#262626]">
      {/* Left: Brand & Acoustic Engine Status */}
      <div className="flex items-center gap-space-md min-w-0">
        {/* Mobile Hamburger */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors lg:hidden shrink-0 cursor-pointer"
            title="Toggle Navigation Menu"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        )}

        {/* Brand Group */}
        <div className="flex items-center gap-space-sm shrink-0">
          <div className="w-8 h-8 bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm select-none">
            TN
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs">
              <span className="font-sans text-base font-semibold tracking-tight text-on-surface leading-none">
                TranscribeNote
              </span>
              <span className="font-mono text-[10px] bg-primary-container text-on-primary-container px-1 py-0.5 uppercase tracking-wide font-medium">
                Carbon v1.2
              </span>
            </div>
            <span className="font-mono text-[11px] text-outline tracking-tight pt-0.5">
              Lecture AI · On-Device ASR
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-surface-bright hidden xl:block"></div>

        {/* Live Listening Status Beacon */}
        <div className="hidden xl:flex items-center gap-space-xs px-space-sm py-1 bg-tertiary-container/20 text-tertiary font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'listening'
                ? 'bg-tertiary animate-pulse'
                : status === 'loading'
                  ? 'bg-secondary animate-ping'
                  : 'bg-outline'
            }`}
          ></span>
          <span className="font-medium tracking-wide uppercase">
            {status === 'listening'
              ? 'Listening (WebGPU Local)'
              : status === 'loading'
                ? 'Loading Model...'
                : statusMessage || 'Ready / Standby'}
          </span>
        </div>

        {/* Engine Badge */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-space-sm py-1 bg-surface-container font-mono text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px] text-primary">memory</span>
          <span>
            {settings.engine === 'browser'
              ? `Browser ${settings.browserModel} (${engineDevice})`
              : `Python ${settings.pythonModel} (${engineDevice})`}
          </span>
        </div>

        {/* Security / Privacy Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-space-sm py-1 bg-surface-container font-mono text-[11px] text-tertiary">
          <span className="material-symbols-outlined text-[14px]">lock</span>
          <span>100% On-Device / No Cloud</span>
        </div>
      </div>

      {/* Right: Language, Telemetry, and Quick Actions */}
      <div className="flex items-center gap-space-md shrink-0">
        {/* Language Switcher */}
        <div className="flex items-center bg-surface-container p-0.5">
          <button
            onClick={() => updateSettings({ language: 'id' })}
            className={`px-2 py-1 font-mono text-[11px] transition-colors cursor-pointer ${
              settings.language === 'id'
                ? 'bg-primary-container text-on-primary-container font-semibold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            type="button"
            title="Set spoken language to Indonesian"
          >
            🇮🇩 ID
          </button>
          <button
            onClick={() => updateSettings({ language: 'en' })}
            className={`px-2 py-1 font-mono text-[11px] transition-colors cursor-pointer ${
              settings.language === 'en'
                ? 'bg-primary-container text-on-primary-container font-semibold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            type="button"
            title="Set spoken language to English"
          >
            🇺🇸 EN
          </button>
          <button
            onClick={() => updateSettings({ language: 'auto' })}
            className={`px-2 py-1 font-mono text-[11px] transition-colors cursor-pointer ${
              settings.language === 'auto'
                ? 'bg-primary-container text-on-primary-container font-semibold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            type="button"
            title="Auto-detect language"
          >
            🌐 Auto
          </button>
        </div>

        {/* Latency & RTF Display */}
        <div className="hidden md:flex items-center gap-space-sm bg-surface-container-low px-space-sm py-1 font-mono text-[12px] border border-[#262626]">
          <div className="flex items-center gap-1">
            <span className="text-outline">Latency:</span>
            <span className="text-tertiary font-semibold">{latencySec}</span>
          </div>
          <span className="text-outline-variant">|</span>
          <div className="flex items-center gap-1">
            <span className="text-outline">RTF:</span>
            <span className="text-secondary font-semibold">{rtf.toFixed(2)}x</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-space-xs">
          {isEvaluatePage ? (
            <Link
              to="/"
              className="px-space-sm py-1.5 font-mono text-[11px] text-primary bg-primary-container/20 border border-primary/40 hover:bg-primary-container hover:text-on-primary-container transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span className="hidden sm:inline">Transcriber</span>
            </Link>
          ) : (
            <Link
              to="/evaluate"
              className="px-space-sm py-1.5 font-mono text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">speed</span>
              <span className="hidden lg:inline">/evaluate</span>
            </Link>
          )}

          <button
            onClick={onOpenSettings}
            className="px-space-sm py-1.5 font-mono text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center gap-1 cursor-pointer"
            type="button"
            title="Acoustic & VAD Settings"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="hidden lg:inline">Settings</span>
          </button>

          {onOpenExport && (
            <button
              onClick={onOpenExport}
              className="px-space-sm py-1.5 font-mono text-[11px] text-on-primary bg-primary-container hover:bg-inverse-primary transition-colors flex items-center gap-1 cursor-pointer font-medium"
              type="button"
              title="Export Notes & Transcript"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
