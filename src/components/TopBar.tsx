import React, { useState } from 'react'
import { useAppStore } from '../lib/store'

interface TopBarProps {
  onOpenSettings: () => void
  onOpenExport?: () => void
  onToggleSidebar?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  onOpenExport,
  onToggleSidebar,
}) => {
  const {
    currentTab,
    currentSessionTitle,
    renameCurrentSession,
    latencyMs,
    rtf,
    status,
    settings,
    updateSettings,
  } = useAppStore()

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const startTitleEdit = () => {
    setTitleDraft(currentSessionTitle)
    setIsEditingTitle(true)
  }

  const commitTitleEdit = () => {
    if (titleDraft.trim()) {
      renameCurrentSession(titleDraft.trim())
    }
    setIsEditingTitle(false)
  }

  const activeModelLabel =
    settings.engine === 'browser'
      ? `Whisper ${settings.browserModel.toUpperCase()} · Browser`
      : `Whisper ${settings.pythonModel.toUpperCase()} · Python`

  const latencyDisplay = latencyMs > 0 ? `${(latencyMs / 1000).toFixed(2)}s` : '—'
  const rtfDisplay = rtf > 0 ? `${rtf.toFixed(2)}x` : '—'

  return (
    <header className="h-14 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 z-20">
      {/* Left: Mobile Sidebar Toggle + Contextual Document Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            type="button"
            aria-label="Open navigation menu"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition lg:hidden shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              menu
            </span>
          </button>
        )}

        {currentTab === 'transcriber' ? (
          <div className="flex items-center gap-2.5 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitleEdit()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                autoFocus
                aria-label="Lecture session title"
                className="text-sm font-semibold text-slate-900 bg-slate-50 border border-blue-400 rounded-md px-2.5 py-1 focus:outline-none w-52 sm:w-72"
              />
            ) : (
              <button
                type="button"
                onClick={startTitleEdit}
                title="Click to rename this lecture session"
                className="group flex items-center gap-1.5 text-left min-w-0 cursor-pointer rounded-md px-1.5 py-1 -ml-1.5 hover:bg-slate-100/80 transition"
              >
                <h1 className="text-[14px] font-semibold tracking-tight text-slate-900 truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                  {currentSessionTitle}
                </h1>
                <span
                  className="material-symbols-outlined text-[14px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  aria-hidden="true"
                >
                  edit
                </span>
              </button>
            )}

            {/* Engine Status Pill (opens Settings on click) */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/70 text-[11px] font-medium text-slate-600 transition cursor-pointer shrink-0"
              title="Configure Whisper model & audio device"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status === 'listening'
                    ? 'bg-emerald-500 animate-pulse'
                    : status === 'paused'
                    ? 'bg-amber-500'
                    : status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
              <span>{activeModelLabel}</span>
            </button>
          </div>
        ) : (
          <h1 className="text-[14px] font-semibold tracking-tight text-slate-900 truncate">
            {currentTab === 'archive' ? 'Session Archive & History' : 'ASR Evaluation & Benchmarks'}
          </h1>
        )}
      </div>

      {/* Right: Focused Utility Controls (Zero Duplicate Navigation Buttons) */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Language Segmented Pill */}
        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/70 text-[11px] font-medium"
          role="group"
          aria-label="Transcription language"
        >
          <button
            type="button"
            aria-pressed={settings.language === 'id'}
            onClick={() => updateSettings({ language: 'id' })}
            className={`px-2 py-1 rounded-md transition cursor-pointer ${
              settings.language === 'id'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ID
          </button>
          <button
            type="button"
            aria-pressed={settings.language === 'en'}
            onClick={() => updateSettings({ language: 'en' })}
            className={`px-2 py-1 rounded-md transition cursor-pointer ${
              settings.language === 'en'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            EN
          </button>
        </div>

        {/* Honest Live Telemetry Pill */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 font-mono text-[11px] text-slate-500 tabular-nums"
          title="Rolling real-time latency and Real-Time Factor (RTF < 1.0x is faster than real-time)"
        >
          <span>
            Lat <strong className="text-slate-800 font-semibold">{latencyDisplay}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            RTF <strong className="text-slate-800 font-semibold">{rtfDisplay}</strong>
          </span>
        </div>

        {/* Single Clean Export CTA */}
        {onOpenExport && currentTab === 'transcriber' && (
          <button
            type="button"
            onClick={onOpenExport}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              ios_share
            </span>
            <span>Export</span>
          </button>
        )}
      </div>
    </header>
  )
}

export default TopBar
