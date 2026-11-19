import React, { useEffect, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatBytes, getAudioStorageUsage } from '../lib/audioStore'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
}

function formatCompactMeta(durationMs: number, sentenceCount: number): string {
  if (durationMs >= 60_000) {
    return `${Math.max(1, Math.round(durationMs / 60_000))}m`
  }
  return `${sentenceCount}l`
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

  const recentSessions = archivedSessions.slice(0, 6)
  const activeModelName =
    settings.engine === 'browser' ? settings.browserModel : settings.pythonModel
  const formattedModelLabel = `Whisper ${activeModelName.charAt(0).toUpperCase()}${activeModelName.slice(1)}`

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
          className="fixed inset-0 bg-[#141413]/25 backdrop-blur-[1px] z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Pane A: 240px Fixed Warm Off-White Sidebar */}
      <aside
        aria-label="Workspace sidebar"
        className={`fixed lg:static inset-y-0 left-0 w-[240px] shrink-0 bg-[#F7F7F5] border-r border-[#E6E6E3] z-40 flex flex-col transition-transform duration-150 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Brand Row (48px) */}
        <div className="h-12 px-3 flex items-center justify-between border-b border-[#E6E6E3] shrink-0">
          <button
            type="button"
            onClick={() => handleNav('transcriber')}
            className="flex items-center gap-2 text-left cursor-pointer group"
          >
            {/* Clean 24x24 Monochrome Brand Mark */}
            <span
              className="w-6 h-6 rounded-[6px] bg-[#141413] text-white flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="6.5" width="1.6" height="3" rx="0.8" fill="currentColor" />
                <rect x="5.2" y="3.5" width="1.6" height="9" rx="0.8" fill="currentColor" />
                <rect x="8.4" y="2" width="1.6" height="12" rx="0.8" fill="currentColor" />
                <rect x="11.6" y="5" width="1.6" height="6" rx="0.8" fill="currentColor" />
              </svg>
            </span>
            <span className="text-[14px] font-semibold tracking-[-0.015em] text-[#141413]">
              TranscribeNote
            </span>
          </button>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                startNewSession()
                handleNav('transcriber')
              }}
              title="New Lecture"
              aria-label="New Lecture"
              className="w-7 h-7 rounded-[6px] text-[#5C5C59] hover:text-[#141413] hover:bg-[#EBEBE8] flex items-center justify-center transition-colors duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                add
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="w-7 h-7 rounded-[6px] text-[#5C5C59] hover:text-[#141413] hover:bg-[#EBEBE8] flex items-center justify-center lg:hidden cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </div>

        {/* Sleek Secondary New Lecture Action */}
        <div className="px-3 pt-3 pb-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              startNewSession()
              handleNav('transcriber')
            }}
            className="w-full h-8 px-2.5 bg-white border border-[#E6E6E3] hover:bg-[#F1F1EF] text-[#141413] text-[13px] font-medium rounded-[6px] flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-[#5C5C59]" aria-hidden="true">
              add
            </span>
            <span>New Lecture</span>
          </button>
        </div>

        {/* Workspace Navigation (30px compact rows) */}
        <nav aria-label="Primary" className="px-2.5 py-1.5 space-y-0.5 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('transcriber')}
            aria-current={currentTab === 'transcriber' ? 'page' : undefined}
            className={`w-full h-[30px] px-2 rounded-[6px] flex items-center gap-2 text-[13px] font-medium transition-colors duration-150 text-left cursor-pointer ${
              currentTab === 'transcriber'
                ? 'bg-[#EBEBE8] text-[#141413]'
                : 'text-[#5C5C59] hover:bg-[#F1F1EF] hover:text-[#141413]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] opacity-75" aria-hidden="true">
              mic_none
            </span>
            <span>Live Studio</span>
          </button>

          <button
            type="button"
            onClick={() => handleNav('archive')}
            aria-current={currentTab === 'archive' ? 'page' : undefined}
            className={`w-full h-[30px] px-2 rounded-[6px] flex items-center justify-between text-[13px] font-medium transition-colors duration-150 text-left cursor-pointer ${
              currentTab === 'archive'
                ? 'bg-[#EBEBE8] text-[#141413]'
                : 'text-[#5C5C59] hover:bg-[#F1F1EF] hover:text-[#141413]'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] opacity-75" aria-hidden="true">
                folder_open
              </span>
              <span>Session Archive</span>
            </span>
            {archivedSessions.length > 0 && (
              <span className="font-mono text-[11px] text-[#8E8E8A] tabular-nums">
                {archivedSessions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNav('evaluate')}
            aria-current={currentTab === 'evaluate' ? 'page' : undefined}
            className={`w-full h-[30px] px-2 rounded-[6px] flex items-center gap-2 text-[13px] font-medium transition-colors duration-150 text-left cursor-pointer ${
              currentTab === 'evaluate'
                ? 'bg-[#EBEBE8] text-[#141413]'
                : 'text-[#5C5C59] hover:bg-[#F1F1EF] hover:text-[#141413]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] opacity-75" aria-hidden="true">
              bar_chart
            </span>
            <span>Evaluation Suite</span>
          </button>
        </nav>

        {/* Recent Lectures */}
        <div className="flex-1 overflow-y-auto px-2.5 pt-3 pb-2">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#8E8E8A]">
              Recent
            </span>
            {archivedSessions.length > 0 && (
              <button
                type="button"
                onClick={() => handleNav('archive')}
                className="text-[11px] text-[#8E8E8A] hover:text-[#141413] transition-colors duration-150 cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          {recentSessions.length === 0 ? (
            <p className="px-2 py-1 text-[12px] text-[#8E8E8A] leading-relaxed">
              Past lectures appear here automatically.
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
                    title={session.title}
                    className={`w-full h-[30px] px-2 rounded-[6px] flex items-center justify-between gap-2 text-left transition-colors duration-150 cursor-pointer group ${
                      isActive
                        ? 'bg-[#EBEBE8] text-[#141413] font-medium'
                        : 'text-[#5C5C59] hover:bg-[#F1F1EF] hover:text-[#141413]'
                    }`}
                  >
                    <span className="text-[13px] truncate">{session.title}</span>
                    <span className="text-[11px] font-mono tabular-nums text-[#8E8E8A] shrink-0">
                      {formatCompactMeta(session.durationMs, session.sentences.length)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Compact Bottom Engine Footer (Single Clickable Row) */}
        <div className="border-t border-[#E6E6E3] p-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSettings()
            }}
            className="w-full px-2.5 py-2 rounded-[6px] hover:bg-[#F1F1EF] text-left transition-colors duration-150 cursor-pointer group"
            title="Open Audio & ASR Engine Settings"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shrink-0" />
                <span className="text-[12px] font-medium text-[#141413] truncate">
                  {formattedModelLabel}
                </span>
              </span>
              <span
                className="material-symbols-outlined text-[15px] text-[#8E8E8A] group-hover:text-[#141413] transition-colors duration-150 shrink-0"
                aria-hidden="true"
              >
                tune
              </span>
            </div>
            <div className="mt-0.5 pl-3.5 text-[11px] font-mono tabular-nums text-[#8E8E8A] truncate">
              Local · {formatBytes(storageBytes)} · {audioClipsCount}{' '}
              {audioClipsCount === 1 ? 'clip' : 'clips'}
            </div>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
