import React from 'react'
import { useAppStore } from '../lib/store'
import { Link, useLocation } from 'react-router-dom'

interface TopBarProps {
  onOpenSettings: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSettings }) => {
  const { status, statusMessage, latencyMs, rtf, engineDevice, settings, updateSettings } = useAppStore()
  const location = useLocation()
  const isEvaluatePage = location.pathname === '/evaluate'

  const latencySec = (latencyMs / 1000).toFixed(2) + 's'

  // Status dot color
  let dotColor = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
  if (status === 'loading') {
    dotColor = 'bg-amber-400 animate-ping'
  } else if (status === 'error') {
    dotColor = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]'
  } else if (status === 'idle') {
    dotColor = 'bg-slate-500'
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#1b263b] bg-[#0c1322]/80 backdrop-blur-md rounded-t-2xl">
      {/* Left: Status Dot & Label */}
      <div className="flex items-center gap-3">
        <span className={`inline-block w-3 h-3 rounded-full ${dotColor} transition-all duration-300`} />
        <span className="text-[15px] font-semibold tracking-wide text-slate-100 select-none">
          {statusMessage || 'Ready — Click Start to transcribe'}
        </span>
        <div className="hidden sm:inline-flex items-center gap-1.5">
          <span className="items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800/60">
            {settings.engine === 'browser' ? `Browser ${settings.browserModel} (${engineDevice})` : `Python ${settings.pythonModel} (${engineDevice})`}
          </span>
          <button
            onClick={() => {
              const next = settings.language === 'id' ? 'en' : settings.language === 'en' ? 'auto' : 'id'
              updateSettings({ language: next })
            }}
            title="Click to switch language between Indonesian (ID), English (EN), and Auto"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 transition-colors cursor-pointer"
          >
            {settings.language === 'id' && '🇮🇩 ID'}
            {settings.language === 'en' && '🇺🇸 EN'}
            {settings.language === 'auto' && '🌐 AUTO'}
          </button>
        </div>
      </div>

      {/* Right: Metrics & Quick Nav */}
      <div className="flex items-center gap-6">
        {/* Latency & RTF Display (matching mockup typography) */}
        <div className="flex items-center gap-5 text-sm select-none">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-400 font-medium">Latency</span>
            <span className="text-xl sm:text-2xl font-bold text-[#3b82f6] tracking-tight">
              {latencySec}
            </span>
          </div>
          <span className="text-slate-600 font-light">|</span>
          <div className="flex items-baseline gap-2">
            <span className="text-slate-400 font-medium">RTF</span>
            <span className="text-xl sm:text-2xl font-bold text-[#3b82f6] tracking-tight">
              {rtf.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action icons / navigation */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <button
            onClick={onOpenSettings}
            title="ASR & VAD Settings"
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {isEvaluatePage ? (
            <Link
              to="/"
              className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 rounded-lg transition-colors"
            >
              ← Back to App
            </Link>
          ) : (
            <Link
              to="/evaluate"
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
            >
              /evaluate
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
