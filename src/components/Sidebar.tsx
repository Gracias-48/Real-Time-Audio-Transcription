import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppStore } from '../lib/store'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpenSettings }) => {
  const location = useLocation()
  const isEvaluate = location.pathname === '/evaluate'
  const isHome = location.pathname === '/'
  const { sentences } = useAppStore()
  const starredCount = sentences.filter((s) => s.highlighted).length

  const scrollToStarred = () => {
    onClose()
    const target = document.querySelector('.is-starred') || document.getElementById('highlights-container')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Carbon Sidebar Rail */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-low z-40 flex flex-col pt-16 border-r border-[#262626] transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation Index Header */}
        <div className="p-space-md bg-surface-container flex items-center justify-between border-b border-[#262626] select-none">
          <span className="font-mono text-[11px] uppercase text-outline tracking-wider font-semibold">
            Navigation Index
          </span>
          <span className="font-mono text-[11px] text-tertiary font-semibold flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
            SYS_ONLINE
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-space-sm space-y-1 overflow-y-auto">
          <Link
            to="/"
            onClick={onClose}
            className={`flex items-center px-space-md py-space-sm transition-colors text-sm font-medium ${
              isHome
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined mr-space-sm text-[18px]">record_voice_over</span>
            <span>Live Transcriber</span>
          </Link>

          <button
            type="button"
            onClick={scrollToStarred}
            className="w-full text-left flex items-center justify-between px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-sm font-normal cursor-pointer"
          >
            <div className="flex items-center">
              <span className="material-symbols-outlined mr-space-sm text-[18px] text-secondary">star</span>
              <span>Starred Highlights</span>
            </div>
            {starredCount > 0 && (
              <span className="font-mono text-xs px-1.5 py-0.2 bg-secondary-container/20 text-secondary font-bold">
                {starredCount}
              </span>
            )}
          </button>

          <Link
            to="/evaluate"
            onClick={onClose}
            className={`flex items-center px-space-md py-space-sm transition-colors text-sm font-medium ${
              isEvaluate
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined mr-space-sm text-[18px]">query_stats</span>
            <span>Evaluation Suite</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSettings()
            }}
            className="w-full text-left flex items-center px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-sm font-normal cursor-pointer"
          >
            <span className="material-symbols-outlined mr-space-sm text-[18px]">tune</span>
            <span>Acoustic Settings</span>
          </button>
        </nav>

        {/* Telemetry Footer */}
        <div className="p-space-md bg-surface-container-lowest space-y-2 pb-6 border-t border-[#262626]">
          <div className="flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
            <span>BUFFER MEMORY</span>
            <span className="text-tertiary font-mono">18.4 MB / 1GB</span>
          </div>
          <div className="w-full bg-surface-container-high h-1">
            <div className="bg-tertiary h-1 w-[18%]"></div>
          </div>
          <div className="text-outline font-mono text-[11px] pt-1">
            Session ID: #LCT-2026-9980
          </div>
        </div>
      </aside>
    </>
  )
}
