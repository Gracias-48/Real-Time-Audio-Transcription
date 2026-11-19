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

  return (
    <div className="bg-[#f6f7f9] font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white h-dvh w-full flex overflow-hidden">
      {/* Studio Sidebar Navigation Rail */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Right Workspace Shell (Header + Full-Height Viewport + Grounded Dock) */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        <TopBar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
        />

        {/* View 1: Live Studio (100% Viewport Height Split Workspace, zero dead bottom gap) */}
        {currentTab === 'transcriber' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <main className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto lg:overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-[540px] lg:min-h-0 max-w-[1600px] mx-auto">
                {/* LEFT COLUMN (~66%): Live Transcript Studio */}
                <div className="lg:col-span-8 h-[60vh] lg:h-full min-h-0 flex flex-col">
                  <TranscriptPanel
                    onStart={handleStart}
                    onImportAudio={handleImportAudio}
                    onPlaySample={handlePlaySample}
                    onRetranscribe={handleRetranscribe}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                </div>

                {/* RIGHT COLUMN (~34%): Key Lecture Notes & Live Study Summary */}
                <div className="lg:col-span-4 h-[50vh] lg:h-full min-h-0 flex flex-col">
                  <KeyNotesPanel onOpenExport={() => setIsExportOpen(true)} />
                </div>
              </div>
            </main>

            {/* Grounded Studio Transport Dock */}
            <BottomBar
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              onResume={handleResume}
              onImportAudio={handleImportAudio}
              onCancelImport={handleCancelImport}
            />
          </div>
        )}

        {/* View 2: Session Archive */}
        {currentTab === 'archive' && (
          <main className="flex-1 overflow-y-auto">
            <SessionArchive
              onOpenExport={() => setIsExportOpen(true)}
              onImportAudio={handleImportAudio}
            />
          </main>
        )}

        {/* View 3: Scientific Evaluation Suite */}
        {currentTab === 'evaluate' && (
          <main className="flex-1 overflow-y-auto">
            <EvaluatePage />
          </main>
        )}
      </div>

      {/* Native <dialog> Modals */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default App
