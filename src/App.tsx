import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { TranscriptPanel } from './components/TranscriptPanel'
import { KeyNotesPanel } from './components/KeyNotesPanel'
import { BottomBar } from './components/BottomBar'
import { ExportModal } from './components/ExportModal'
import { SettingsModal } from './components/SettingsModal'
import { EvaluatePage } from './components/EvaluatePage'
import { useAppStore } from './lib/store'
import { pipelineInstance } from './lib/pipeline'

const MainTranscriberApp: React.FC = () => {
  const { settings } = useAppStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

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
    <div className="bg-surface font-sans text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen overflow-x-hidden">
      {/* Carbon Sidebar Rail */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Layout Canvas (Offset by 288px / 72 on desktop) */}
      <div className="pl-0 lg:pl-72 flex flex-col min-h-screen">
        {/* Fixed Top Navigation Bar */}
        <TopBar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
        />

        {/* Main Content Area */}
        <main className="relative pt-16 pb-16 w-full flex-1 flex flex-col bg-surface overflow-hidden">
          <div className="flex-1 flex flex-col w-full h-[calc(100vh-8rem)] overflow-hidden">
            <div className="grid grid-cols-12 h-full w-full gap-0">
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
      </div>

      {/* Modals */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainTranscriberApp />} />
      <Route path="/evaluate" element={<EvaluatePage />} />
    </Routes>
  )
}

export default App

