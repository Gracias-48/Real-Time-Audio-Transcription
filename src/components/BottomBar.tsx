import React from 'react'
import { useAppStore } from '../lib/store'

interface BottomBarProps {
  onStart: () => void
  onStop: () => void
  onExport: () => void
}

export const BottomBar: React.FC<BottomBarProps> = ({ onStart, onStop, onExport }) => {
  const { status, isSpeaking, downloadProgress } = useAppStore()
  const isListening = status === 'listening'
  const isLoading = status === 'loading'
  const isBusy = isListening || isLoading

  return (
    <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-t border-[#1b263b] bg-[#0c1322]/90 backdrop-blur-md rounded-b-2xl">
      {/* Left: Audio & Session Status (Transcriptions stream directly above in the transcript panel) */}
      <div className="flex items-center gap-3.5 min-w-0">
        {isLoading ? (
          <div className="flex items-center gap-2.5 text-blue-300 text-xs">
            <svg className="w-4 h-4 animate-spin text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="font-medium">
              {downloadProgress !== null
                ? `Mengunduh model Whisper AI (${downloadProgress}%)...`
                : 'Menginisialisasi mikrofon & model lokal...'}
            </span>
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-3 min-w-0">
            {/* Animated Audio Wave Indicator */}
            <div className="flex items-end gap-1 h-4 shrink-0">
              <span
                className={`w-1 rounded-full bg-blue-400 transition-all ${
                  isSpeaking ? 'h-4 animate-bounce' : 'h-1.5 opacity-40'
                }`}
              />
              <span
                className={`w-1 rounded-full bg-blue-500 transition-all ${
                  isSpeaking ? 'h-5 animate-bounce [animation-delay:0.15s]' : 'h-2.5 opacity-60'
                }`}
              />
              <span
                className={`w-1 rounded-full bg-blue-400 transition-all ${
                  isSpeaking ? 'h-3.5 animate-bounce [animation-delay:0.3s]' : 'h-1.5 opacity-40'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">
                  {isSpeaking ? '🎙️ Terdeteksi Suara' : 'Mikrofon Siaga (Standby)'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-blue-950/80 text-blue-300 border border-blue-800/80">
                  LIVE IN TRANSCRIPT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {isSpeaking
                  ? 'Kata-kata langsung muncul dan diketik pada baris transkrip di atas.'
                  : 'Berbicaralah ke mikrofon, transkripsi real-time langsung aktif.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-500 shrink-0" />
            <span>
              Tekan <strong className="text-slate-300 font-medium">Start</strong> untuk memulai transkripsi langsung di panel atas.
            </span>
          </div>
        )}
      </div>

      {/* Right: Controls (Start, Stop, Export) */}
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
        <button
          onClick={onStart}
          disabled={isBusy}
          className={`px-7 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer shadow-md ${
            isBusy
              ? 'bg-blue-600/40 text-blue-200 cursor-not-allowed opacity-60'
              : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-98'
          }`}
        >
          {isLoading ? 'Starting...' : 'Start'}
        </button>

        <button
          onClick={onStop}
          disabled={status === 'idle'}
          className={`px-7 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border cursor-pointer ${
            status === 'idle'
              ? 'bg-[#151d2d] text-slate-500 border-slate-800/80 cursor-not-allowed'
              : 'bg-[#182235] hover:bg-[#22314d] text-slate-200 border-[#2b3c5e] active:scale-98'
          }`}
        >
          Stop
        </button>

        <button
          onClick={onExport}
          className="px-7 py-2.5 rounded-xl font-medium text-sm bg-[#182235] hover:bg-[#22314d] text-slate-200 border border-[#2b3c5e] transition-all duration-200 active:scale-98 cursor-pointer shadow-sm"
        >
          Export
        </button>
      </div>
    </footer>
  )
}
