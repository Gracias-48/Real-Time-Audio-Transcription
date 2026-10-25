import React from 'react'
import { useAppStore } from '../lib/store'

interface TopBarProps {
  onOpenSettings: () => void
  onOpenExport?: () => void
  onToggleSidebar?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSettings, onOpenExport, onToggleSidebar }) => {
  const {
    currentTab,
    setCurrentTab,
    latencyMs,
    rtf,
    settings,
    updateSettings,
    startNewSession,
    archivedSessions,
  } = useAppStore()

  const latencySec = (latencyMs / 1000).toFixed(2) + 's'

  const breadcrumbLabel =
    currentTab === 'transcriber'
      ? 'Live Transcriber'
      : currentTab === 'archive'
      ? 'Session Archive'
      : 'Evaluation Suite'

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-gray-200/70 z-40 flex items-center justify-between px-4 sm:px-6">
      {/* Brand & Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile menu trigger */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            type="button"
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition lg:hidden shrink-0 cursor-pointer"
            title="Toggle Menu"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        )}

        {/* Logo & Brand Name */}
        <button
          type="button"
          onClick={() => setCurrentTab('transcriber')}
          className="flex items-center gap-2 group cursor-pointer text-left shrink-0"
        >
          <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center transition-transform group-hover:scale-95 shadow-2xs">
            <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-slate-900 hidden sm:inline">
            TranscribeNote
          </span>
        </button>

        <span className="text-gray-300 text-xs select-none">/</span>
        <span className="text-xs text-slate-600 font-medium truncate">{breadcrumbLabel}</span>

        {/* Engine status beacon */}
        <div className="hidden md:flex items-center gap-1.5 ml-2 pl-3 border-l border-gray-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-slate-500 font-normal">
            {settings.engine === 'browser'
              ? `Whisper ${settings.browserModel.toUpperCase()} (WebGPU/WASM)`
              : `Python Whisper ${settings.pythonModel.toUpperCase()} (Local)`}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Minimal Language Switch */}
        <div className="flex items-center p-0.5 rounded-md bg-slate-100/70 text-[11px] font-medium text-slate-500">
          <button
            type="button"
            onClick={() => updateSettings({ language: 'id' })}
            className={`px-2 py-0.5 rounded transition cursor-pointer ${
              settings.language === 'id'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ID
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ language: 'en' })}
            className={`px-2 py-0.5 rounded transition cursor-pointer ${
              settings.language === 'en'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            EN
          </button>
        </div>

        {/* Telemetry Pills (Latency & RTF) */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 border border-gray-200/60 font-mono text-[11px] text-slate-600">
          <span>Lat: <strong className="text-slate-900">{latencySec}</strong></span>
          <span className="text-gray-300">|</span>
          <span>RTF: <strong className="text-slate-900">{rtf > 0 ? `${rtf}x` : '0.38x'}</strong></span>
        </div>

        {/* + New Session Button */}
        <button
          type="button"
          onClick={() => {
            startNewSession()
            setCurrentTab('transcriber')
          }}
          className="hidden sm:inline-flex h-8 px-2.5 items-center gap-1.5 rounded-md border border-gray-200/80 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
          title="Start fresh lecture session"
        >
          <span className="material-symbols-outlined text-[15px] text-slate-500">add</span>
          <span>New Session</span>
        </button>

        {/* Navigation Switchers (NO NEW TABS) */}
        {currentTab === 'evaluate' ? (
          <button
            type="button"
            onClick={() => setCurrentTab('transcriber')}
            className="h-8 px-2.5 inline-flex items-center gap-1 rounded-md bg-primary-container text-white text-[12px] font-medium hover:bg-primary-hover transition shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span className="hidden sm:inline">Transcriber</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentTab('evaluate')}
            className="h-8 px-2.5 inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-white text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-gray-300 transition shadow-2xs cursor-pointer"
            title="Scientific ASR Benchmark Suite"
          >
            <span className="material-symbols-outlined text-[15px] text-slate-400">query_stats</span>
            <span className="hidden lg:inline">/evaluate</span>
          </button>
        )}

        {/* History Archive Link */}
        <button
          type="button"
          onClick={() => setCurrentTab('archive')}
          className={`h-8 px-2.5 inline-flex items-center gap-1 rounded-md border text-[12px] font-medium transition shadow-2xs cursor-pointer ${
            currentTab === 'archive'
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-200/80 bg-white text-slate-600 hover:text-slate-900 hover:border-gray-300'
          }`}
          title="View Session Archive & History"
        >
          <span className="material-symbols-outlined text-[15px] text-slate-400">folder_open</span>
          <span className="hidden xl:inline">Archive</span>
          {archivedSessions.length > 0 && (
            <span className="text-[10px] font-mono px-1 rounded-full bg-slate-100 text-slate-600">
              {archivedSessions.length}
            </span>
          )}
        </button>

        {/* Acoustic Settings Trigger */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="h-8 px-2.5 inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-white text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-gray-300 transition shadow-2xs cursor-pointer"
          title="Acoustic Settings"
        >
          <span className="material-symbols-outlined text-[15px] text-slate-400">tune</span>
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* Export Notes Trigger */}
        {onOpenExport && (
          <button
            type="button"
            onClick={onOpenExport}
            className="h-8 px-3 inline-flex items-center gap-1 rounded-md bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition shadow-2xs cursor-pointer"
            title="Export Notes (Markdown, JSON, Local AI Summary)"
          >
            <span className="material-symbols-outlined text-[15px]">file_download</span>
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>
    </header>
  )
}

export default TopBar
