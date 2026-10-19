import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { TranscriptPanel } from './components/TranscriptPanel'
import { KeyNotesPanel } from './components/KeyNotesPanel'
import { BottomBar } from './components/BottomBar'
import { ExportModal } from './components/ExportModal'
import { SettingsModal } from './components/SettingsModal'
import { PrivacyBanner } from './components/PrivacyBanner'
import { EvaluatePage } from './components/EvaluatePage'
import { useAppStore } from './lib/store'
import { pipelineInstance } from './lib/pipeline'

const MainTranscriberApp: React.FC = () => {
  const { settings } = useAppStore()
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [demoNotice, setDemoNotice] = useState<string | null>(null)

  const handleStart = async () => {
    try {
      await pipelineInstance.start(settings)
    } catch (err: any) {
      alert(`Could not start microphone: ${err?.message || err}. You can also use "Play Sample" to run demo audio!`)
    }
  }

  const handleStop = async () => {
    await pipelineInstance.stop()
  }

  const handlePlayDemo = async () => {
    setDemoNotice('Streaming bundled lecture sample through ASR pipeline...')
    try {
      const resp = await fetch('/sample-lecture.wav')
      const arrayBuf = await resp.arrayBuffer()
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      const decoded = await audioCtx.decodeAudioData(arrayBuf)
      await audioCtx.close()
      await pipelineInstance.playAudioBuffer(decoded, settings)
    } catch (err: any) {
      alert(`Demo playback error: ${err?.message || err}`)
    } finally {
      setTimeout(() => setDemoNotice(null), 3000)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#070b14] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* 100% On-Device Privacy Banner */}
      <PrivacyBanner />

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl flex flex-col">
          {/* Header Title (matching mockup subtitle style) */}
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 px-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white m-0">
                Application Interface <span className="text-[#3b82f6]">Mockup</span> (UI Design)
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Real-Time Lecture Transcriber &amp; 1-Click Highlight Note Assistant · 100% Local Inference
              </p>
            </div>
            {demoNotice && (
              <span className="text-xs font-mono text-blue-400 bg-blue-950/80 border border-blue-800 px-3 py-1 rounded-full animate-pulse">
                {demoNotice}
              </span>
            )}
          </div>

          {/* Central Card Shell matching mockup border & inner background */}
          <div className="w-full rounded-2xl bg-[#0b1325] border border-[#1b263b] shadow-2xl shadow-black/80 flex flex-col overflow-hidden">
            {/* Top Bar (Status, Latency, RTF, Settings) */}
            <TopBar
              onOpenSettings={() => setIsSettingsOpen(true)}
              onPlayDemo={handlePlayDemo}
            />

            {/* Split Panels: Left (Full Transcript) | Right (Key Notes) */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1b263b] flex-1">
              <TranscriptPanel />
              <KeyNotesPanel />
            </div>

            {/* Bottom Bar: Live Partial Stream, Start, Stop, Export */}
            <BottomBar
              onStart={handleStart}
              onStop={handleStop}
              onExport={() => setIsExportOpen(true)}
            />
          </div>
        </div>
      </main>

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
