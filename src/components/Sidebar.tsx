import React from 'react'
import { useAppStore } from '../lib/store'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpenSettings }) => {
  const {
    currentTab,
    setCurrentTab,
    sentences,
    archivedSessions,
    currentSessionId,
    startNewSession,
  } = useAppStore()

  const starredCount = sentences.filter((s) => s.highlighted).length

  const handleNav = (tab: 'transcriber' | 'archive' | 'evaluate') => {
    setCurrentTab(tab)
    onClose()
  }

  const scrollToStarred = () => {
    if (currentTab !== 'transcriber') {
      setCurrentTab('transcriber')
    }
    onClose()
    setTimeout(() => {
      const target =
        document.querySelector('.is-starred') || document.getElementById('highlights-container')
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
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

      {/* Academic Dashboard Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-200/70 z-30 flex flex-col pt-16 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* + New Session Action Button */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => {
              startNewSession()
              handleNav('transcriber')
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-slate-900 text-white hover:bg-slate-800 rounded-md font-medium shadow-xs transition-colors cursor-pointer"
            title="Archive previous lecture & start a fresh session"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Lecture Session</span>
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {/* Live Transcriber */}
          <button
            type="button"
            onClick={() => handleNav('transcriber')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-md transition-colors font-medium text-left cursor-pointer ${
              currentTab === 'transcriber'
                ? 'bg-slate-100/90 text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[17px] ${
                currentTab === 'transcriber' ? 'text-primary' : 'text-slate-400'
              }`}
            >
              record_voice_over
            </span>
            <span>Live Transcriber</span>
          </button>

          {/* Starred Highlights */}
          <button
            type="button"
            onClick={scrollToStarred}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors font-medium text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[17px] text-amber-500">star</span>
              <span>Starred Notes</span>
            </div>
            {starredCount > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold">
                {starredCount}
              </span>
            )}
          </button>

          {/* Session Archive */}
          <button
            type="button"
            onClick={() => handleNav('archive')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors font-medium text-left cursor-pointer ${
              currentTab === 'archive'
                ? 'bg-slate-100/90 text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`material-symbols-outlined text-[17px] ${
                  currentTab === 'archive' ? 'text-primary' : 'text-slate-400'
                }`}
              >
                folder_open
              </span>
              <span>Session Archive</span>
            </div>
            {archivedSessions.length > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {archivedSessions.length}
              </span>
            )}
          </button>

          {/* Evaluation Suite */}
          <button
            type="button"
            onClick={() => handleNav('evaluate')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-md transition-colors font-medium text-left cursor-pointer ${
              currentTab === 'evaluate'
                ? 'bg-slate-100/90 text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[17px] ${
                currentTab === 'evaluate' ? 'text-primary' : 'text-slate-400'
              }`}
            >
              query_stats
            </span>
            <span>Evaluation Suite</span>
          </button>

          {/* Acoustic Settings */}
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSettings()
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors font-medium text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px] text-slate-400">tune</span>
            <span>Acoustic Settings</span>
          </button>
        </nav>

        {/* Telemetry Footer */}
        <div className="p-4 border-t border-gray-100 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex justify-between items-center text-slate-500 font-mono">
            <span>Local Buffer</span>
            <span className="font-mono text-[10px]">18.4 MB / 1GB</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '18%' }} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
              {currentSessionId}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="SYS_ONLINE" />
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
