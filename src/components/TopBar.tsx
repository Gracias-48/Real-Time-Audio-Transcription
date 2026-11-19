import React from 'react'
import { useAppStore } from '../lib/store'

interface TopBarProps {
  onOpenSettings: () => void
  onOpenExport?: () => void
  onToggleSidebar?: () => void
  isInspectorOpen?: boolean
  onToggleInspector?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  onOpenExport,
  onToggleSidebar,
  isInspectorOpen = true,
  onToggleInspector,
}) => {
  const { currentTab, latencyMs, rtf, status, settings, updateSettings } = useAppStore()

  const activeModelName =
    settings.engine === 'browser' ? settings.browserModel : settings.pythonModel
  const modelTitle = `${activeModelName.charAt(0).toUpperCase()}${activeModelName.slice(1)}`
  const engineOrigin = settings.engine === 'browser' ? 'Browser' : 'Python'

  const latencyDisplay = latencyMs > 0 ? `${(latencyMs / 1000).toFixed(2)}s` : '—'
  const rtfDisplay = rtf > 0 ? `${rtf.toFixed(2)}x` : '—'
  const isRecordingOrPaused = status === 'listening' || status === 'paused'

  const sectionLabel =
    currentTab === 'transcriber'
      ? 'Live Studio'
      : currentTab === 'archive'
      ? 'Session Archive'
      : 'Evaluation Suite'

  return (
    <header className="h-12 shrink-0 bg-white border-b border-[#E6E6E3] px-4 flex items-center justify-between gap-3 z-20">
      {/* Left: Mobile Drawer Trigger + Quiet Breadcrumb & Plain Engine Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            type="button"
            aria-label="Open navigation sidebar"
            className="w-7 h-7 rounded-[6px] text-[#5C5C59] hover:text-[#141413] hover:bg-[#F1F1EF] flex items-center justify-center lg:hidden shrink-0 transition-colors duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              menu
            </span>
          </button>
        )}

        <div className="flex items-center gap-2 text-[12px] min-w-0">
          <span className="font-medium text-[#141413] shrink-0">{sectionLabel}</span>
          {currentTab === 'transcriber' && (
            <>
              <span className="text-[#D4D4D0] select-none">/</span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 text-[#5C5C59] hover:text-[#141413] transition-colors duration-150 truncate cursor-pointer"
                title="Configure Whisper model & audio input"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    status === 'listening'
                      ? 'bg-[#DC2626] animate-pulse'
                      : status === 'error'
                      ? 'bg-[#DC2626]'
                      : 'bg-[#16A34A]'
                  }`}
                />
                <span className="truncate">
                  Whisper {modelTitle} · {engineOrigin}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right: Tight 8px Utility Group */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Clean ID | EN Segmented Toggle */}
        <div
          className={`inline-flex items-center h-7 p-0.5 rounded-[6px] bg-[#F1F1EF] text-[12px] font-medium ${
            isRecordingOrPaused ? 'opacity-80' : ''
          }`}
          role="group"
          aria-label="Transcription language"
          title={
            isRecordingOrPaused
              ? 'Stop recording first to change transcription language'
              : 'Select transcription language'
          }
        >
          <button
            type="button"
            aria-pressed={settings.language === 'id'}
            onClick={() => updateSettings({ language: 'id' })}
            className={`h-6 px-2 rounded-[4px] transition-colors duration-150 cursor-pointer ${
              settings.language === 'id'
                ? 'bg-white text-[#141413] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-[#5C5C59] hover:text-[#141413]'
            }`}
          >
            ID
          </button>
          <button
            type="button"
            aria-pressed={settings.language === 'en'}
            onClick={() => updateSettings({ language: 'en' })}
            className={`h-6 px-2 rounded-[4px] transition-colors duration-150 cursor-pointer ${
              settings.language === 'en'
                ? 'bg-white text-[#141413] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-[#5C5C59] hover:text-[#141413]'
            }`}
          >
            EN
          </button>
        </div>

        {/* Quiet Monospace Telemetry (No Pill Border) */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-1.5 font-mono text-[11px] text-[#8E8E8A] tabular-nums select-none"
          title="Rolling real-time decode latency and Real-Time Factor"
        >
          <span>Lat {latencyDisplay}</span>
          <span>·</span>
          <span>RTF {rtfDisplay}</span>
        </div>

        {/* Demoted Secondary Export Button */}
        {onOpenExport && currentTab === 'transcriber' && (
          <button
            type="button"
            onClick={onOpenExport}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[6px] bg-white border border-[#E6E6E3] hover:bg-[#F7F7F5] text-[#141413] text-[12px] font-medium transition-colors duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px] text-[#5C5C59]" aria-hidden="true">
              ios_share
            </span>
            <span>Export</span>
          </button>
        )}

        {/* Right Inspector Collapse Toggle */}
        {currentTab === 'transcriber' && onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            aria-pressed={isInspectorOpen}
            aria-label={isInspectorOpen ? 'Collapse notes inspector' : 'Expand notes inspector'}
            title={isInspectorOpen ? 'Hide inspector panel' : 'Show inspector panel'}
            className={`w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors duration-150 cursor-pointer ${
              isInspectorOpen
                ? 'text-[#141413] bg-[#F1F1EF]'
                : 'text-[#5C5C59] hover:text-[#141413] hover:bg-[#F1F1EF]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
              right_panel_open
            </span>
          </button>
        )}
      </div>
    </header>
  )
}

export default TopBar
