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
  const { currentTab, setCurrentTab, settings } = useAppStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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
      console.error('Failed to start microphone:', err)
      alert(`Could not start microphone: ${err?.message || err}`)
    }
  }

  const handleStop = async () => {
    await pipelineInstance.stop()
  }

  return (
    <div className="bg-[#fafafa] font-sans text-slate-900 antialiased selection:bg-slate-900 selection:text-white min-h-screen overflow-x-hidden">
      {/* Sidebar Navigation Rail (w-56) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Layout Canvas (Offset by 224px / w-56 on desktop) */}
      <div className="pl-0 lg:pl-56 flex flex-col min-h-screen">
        {/* Fixed Top Navigation Bar */}
        <TopBar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
        />

        {/* View Switcher: Live Transcriber | Session Archive | Evaluation Suite */}
        {currentTab === 'transcriber' && (
          <>
            <main className="relative pt-16 pb-20 w-full flex-1 flex flex-col bg-[#fafafa] px-4 sm:px-6 py-4">
              <div className="flex-1 flex flex-col w-full h-[calc(100vh-9.5rem)] overflow-hidden">
                <div className="grid grid-cols-12 h-full w-full gap-4">
                  {/* LEFT PANEL: Live Lecture Feed (Cols 1-8 / ~65% on Desktop) */}
                  <div className="col-span-12 lg:col-span-8 h-full overflow-hidden">
                    <TranscriptPanel />
                  </div>

                  {/* RIGHT PANEL: Key Lecture Notes (Cols 9-12 / ~35% on Desktop) */}
                  <div className="col-span-12 lg:col-span-4 h-full overflow-hidden">
                    <KeyNotesPanel onOpenExport={() => setIsExportOpen(true)} />
                  </div>
                </div>
              </div>
            </main>

            {/* Floating Bottom Action Bar */}
            <BottomBar
              onStart={handleStart}
              onStop={handleStop}
              onExport={() => setIsExportOpen(true)}
            />
          </>
        )}

        {currentTab === 'archive' && (
          <main className="relative w-full flex-1 bg-[#fafafa]">
            <SessionArchive onOpenExport={() => setIsExportOpen(true)} />
          </main>
        )}

        {currentTab === 'evaluate' && (
          <main className="relative w-full flex-1 bg-[#fafafa]">
            <EvaluatePage />
          </main>
        )}
      </div>

      {/* Modals */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default App
