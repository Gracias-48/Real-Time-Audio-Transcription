import React, { useEffect, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatBytes, getAudioStorageUsage } from '../lib/audioStore'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpenSettings }) => {
  const {
    currentTab,
    setCurrentTab,
    archivedSessions,
    currentSessionId,
    startNewSession,
    loadArchivedSession,
    settings,
    audioVersion,
  } = useAppStore()

  const [storageBytes, setStorageBytes] = useState(0)
  const [audioClipsCount, setAudioClipsCount] = useState(0)

  useEffect(() => {
    let active = true
    void getAudioStorageUsage().then((stats) => {
      if (!active) return
      setStorageBytes(stats.totalBytes)
      setAudioClipsCount(stats.audioCount)
    })
    return () => {
      active = false
    }
  }, [audioVersion, archivedSessions.length, currentSessionId])

  const storagePct = Math.min(100, Math.max(4, Math.round((storageBytes / (200 * 1024 * 1024)) * 100)))
  const recentSessions = archivedSessions.slice(0, 4)

  const handleNav = (tab: 'transcriber' | 'archive' | 'evaluate') => {
    setCurrentTab(tab)
    onClose()
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Studio Sidebar Rail */}
      <aside
        aria-label="Primary workspace sidebar"
        className={`fixed lg:static inset-y-0 left-0 w-64 shrink-0 bg-[#f8f9fb] border-r border-slate-200/80 z-40 flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Identity Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200/70 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('transcriber')}
            className="flex items-center gap-2.5 group cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm shadow-blue-600/20 group-hover:scale-95 transition-transform">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                graphic_eq
              </span>
            </div>
            <div className="leading-tight">
              <span className="block text-[14px] font-semibold tracking-tight text-slate-900">
                TranscribeNote
              </span>
              <span className="block text-[10px] font-mono text-slate-400">
                On-Device ASR Studio
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation sidebar"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 lg:hidden cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* Primary Action: New Lecture */}
        <div className="px-3 pt-3.5 pb-2">
          <button
            type="button"
            onClick={() => {
              startNewSession()
              handleNav('transcriber')
            }}
            className="w-full h-9 flex items-center justify-center gap-1.5 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-xs transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              add
            </span>
            <span>New Lecture Session</span>
          </button>
        </div>

        {/* Workspace Navigation */}
        <nav aria-label="Primary" className="px-3 py-2 space-y-0.5">
          <span className="block px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </span>

          <button
            type="button"
            onClick={() => handleNav('transcriber')}
            aria-current={currentTab === 'transcriber' ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-lg transition font-medium text-left cursor-pointer ${
              currentTab === 'transcriber'
                ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                currentTab === 'transcriber' ? 'text-blue-600' : 'text-slate-400'
              }`}
              aria-hidden="true"
            >
              record_voice_over
            </span>
            <span>Live Studio</span>
          </button>

          <button
            type="button"
            onClick={() => handleNav('archive')}
            aria-current={currentTab === 'archive' ? 'page' : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-2 text-[13px] rounded-lg transition font-medium text-left cursor-pointer ${
              currentTab === 'archive'
                ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentTab === 'archive' ? 'text-blue-600' : 'text-slate-400'
                }`}
                aria-hidden="true"
              >
                folder_open
              </span>
              <span>Session Archive</span>
            </div>
            {archivedSessions.length > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 font-medium tabular-nums">
                {archivedSessions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNav('evaluate')}
            aria-current={currentTab === 'evaluate' ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-lg transition font-medium text-left cursor-pointer ${
              currentTab === 'evaluate'
                ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                currentTab === 'evaluate' ? 'text-blue-600' : 'text-slate-400'
              }`}
              aria-hidden="true"
            >
              query_stats
            </span>
            <span>Evaluation Suite</span>
          </button>
        </nav>

        {/* Quick Recent Lectures Switcher */}
        <div className="flex-1 overflow-y-auto px-3 py-2 mt-1">
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Recent Lectures
            </span>
            {archivedSessions.length > 4 && (
              <button
                type="button"
                onClick={() => handleNav('archive')}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          {recentSessions.length === 0 ? (
            <p className="px-2.5 text-[11px] text-slate-400 leading-relaxed">
              Finished lectures auto-save here for instant replay &amp; review.
            </p>
          ) : (
            <div className="space-y-0.5">
              {recentSessions.map((session) => {
                const isActive = currentSessionId === session.id && currentTab === 'transcriber'
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      loadArchivedSession(session.id)
                      onClose()
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer group ${
                      isActive
                        ? 'bg-blue-50/80 text-blue-900'
                        : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-xs font-medium truncate">{session.title}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>{session.sentences.length} lines</span>
                      {session.starredCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600">{session.starredCount} ★</span>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom Engine Settings & Local Storage Card */}
        <div className="p-3 border-t border-slate-200/80 space-y-2.5 bg-[#f8f9fb]">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSettings()
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700 transition shadow-2xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-500" aria-hidden="true">
                tune
              </span>
              <span>Audio &amp; ASR Engine</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
              {settings.engine === 'browser' ? settings.browserModel : settings.pythonModel}
            </span>
          </button>

          <div className="px-2 py-1 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono tabular-nums">
              <span>Local Audio</span>
              <span className="text-[10px] text-slate-600">
                {formatBytes(storageBytes)} · {audioClipsCount} clip{audioClipsCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="w-full bg-slate-200/80 h-1 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${storageBytes > 0 ? storagePct : 0}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">100% On-Device · Zero Cloud STT</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
