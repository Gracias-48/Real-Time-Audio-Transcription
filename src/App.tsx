import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { TranscriptPanel } from './components/TranscriptPanel'
import { KeyNotesPanel } from './components/KeyNotesPanel'
import { BottomBar } from './components/BottomBar'
import { SessionArchive } from './components/SessionArchive'
import { EvaluatePage } from './components/EvaluatePage'
import { ExportModal } from './components/ExportModal'
import { SettingsModal } from './components/SettingsModal'
import { useAppStore } from './lib/store'
import { pipelineInstance } from './lib/pipeline'

export const App: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    settings,
    updateSettings,
    toast,
    showToast,
    dismissToast,
  } = useAppStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Sync initial URL path to currentTab, and listen to browser popstate (back/forward)
  useEffect(() => {
    const syncFromPath = () => {
      const path = window.location.pathname.toLowerCase()
      if (path.includes('evaluate')) {
        setCurrentTab('evaluate')
      } else if (path.includes('archive')) {
        setCurrentTab('archive')
      } else {
        setCurrentTab('transcriber')
      }
    }

    syncFromPath()
    window.addEventListener('popstate', syncFromPath)
    return () => window.removeEventListener('popstate', syncFromPath)
  }, [setCurrentTab])

  const handleStart = async () => {
    try {
      await pipelineInstance.start(settings)
    } catch (err: any) {
      console.error('Failed to start capture:', err)
      alert(`Could not start audio capture: ${err?.message || err}`)
    }
  }

  const handleStop = async () => {
    await pipelineInstance.stop()
  }

  const handlePause = async () => {
    await pipelineInstance.pause()
  }

  const handleResume = async () => {
    await pipelineInstance.resume()
  }

  const handleImportAudio = async (file: File) => {
    try {
      await pipelineInstance.importAudioFile(file, settings)
    } catch (err: any) {
      console.error('Failed to import audio:', err)
      alert(`Could not transcribe audio file: ${err?.message || err}`)
    }
  }

  const handlePlaySample = async () => {
    try {
      await pipelineInstance.playSampleLecture(settings)
    } catch (err: any) {
      console.error('Failed to play sample lecture:', err)
      alert(`Could not run sample lecture demo: ${err?.message || err}`)
    }
  }

  const handleCancelImport = () => {
    pipelineInstance.cancelImport()
  }

  const handleRetranscribe = async () => {
    try {
      await pipelineInstance.retranscribeCurrentSession(settings)
    } catch (err: any) {
      console.error('Retranscribe failed:', err)
      alert(`Could not retranscribe session audio: ${err?.message || err}`)
    }
  }

  const handleStopAndSwitchLanguage = async (targetLang: 'id' | 'en' | 'auto') => {
    dismissToast()
    await pipelineInstance.stop()
    updateSettings({ language: targetLang })
    const label = targetLang === 'en' ? 'English (EN)' : 'Bahasa Indonesia (ID)'
    showToast(`Switched to ${label} — click Start Lecture to begin.`, 'info')
  }

  return (
    <div className="bg-white font-sans text-[#141413] antialiased selection:bg-[#141413] selection:text-white h-dvh w-full flex overflow-hidden">
      {/* Pane A: Left Sidebar (240px fixed, #F7F7F5, hairline right border) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Right Shell: Top Utility Bar spanning Center + Right Inspector */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden bg-white">
        <TopBar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        />

        {/* View 1: Edge-to-Edge Live Workbench */}
        {currentTab === 'transcriber' && (
          <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
            {/* Pane C: Center Reading & Transcript Canvas + Floating Capture Dock */}
            <main className="flex-1 min-w-0 relative flex flex-col bg-white overflow-hidden">
              <TranscriptPanel
                onImportAudio={handleImportAudio}
                onPlaySample={handlePlaySample}
                onRetranscribe={handleRetranscribe}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />

              {/* Pane D: Floating Capture Dock centered at bottom of Center Canvas */}
              <BottomBar
                onStart={handleStart}
                onStop={handleStop}
                onPause={handlePause}
                onResume={handleResume}
                onImportAudio={handleImportAudio}
                onCancelImport={handleCancelImport}
              />
            </main>

            {/* Pane E: Right Inspector Panel (320px fixed, #FAFAFA, hairline left border) */}
            {isInspectorOpen && (
              <KeyNotesPanel onOpenExport={() => setIsExportOpen(true)} />
            )}
          </div>
        )}

        {/* View 2: Session Archive */}
        {currentTab === 'archive' && (
          <main className="flex-1 overflow-y-auto bg-white">
            <SessionArchive
              onOpenExport={() => setIsExportOpen(true)}
              onImportAudio={handleImportAudio}
            />
          </main>
        )}

        {/* View 3: Scientific Evaluation Suite */}
        {currentTab === 'evaluate' && (
          <main className="flex-1 overflow-y-auto bg-white">
            <EvaluatePage />
          </main>
        )}
      </div>

      {/* Native <dialog> Modals */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Warm-Monochrome Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl flex flex-wrap items-center gap-2.5 text-[12px] font-medium max-w-lg shadow-[0_4px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.06)] ${
            toast.tone === 'warning'
              ? 'bg-[#FEFCE8] text-[#141413] border border-[#E6E6E3]'
              : 'bg-[#141413] text-white'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              toast.tone === 'warning' ? 'bg-[#D97706]' : 'bg-[#16A34A]'
            }`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-[180px]">{toast.message}</span>
          {toast.actionLabel && toast.pendingLanguage && (
            <button
              type="button"
              onClick={() => void handleStopAndSwitchLanguage(toast.pendingLanguage!)}
              className="h-6 px-2.5 rounded-[6px] bg-[#141413] hover:bg-[#2A2A28] text-white text-[11px] font-medium transition-colors duration-150 cursor-pointer shrink-0"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className={`p-0.5 rounded-[6px] transition-colors duration-150 cursor-pointer shrink-0 ${
              toast.tone === 'warning'
                ? 'text-[#5C5C59] hover:text-[#141413] hover:bg-[#F1F1EF]'
                : 'text-[#8E8E8A] hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
