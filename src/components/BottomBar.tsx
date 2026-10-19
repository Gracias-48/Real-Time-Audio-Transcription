import React from 'react'
import { useAppStore } from '../lib/store'

interface BottomBarProps {
  onStart: () => void
  onStop: () => void
  onExport: () => void
}

export const BottomBar: React.FC<BottomBarProps> = ({ onStart, onStop, onExport }) => {
  const { status, partialText, isSpeaking, downloadProgress } = useAppStore()
  const isListening = status === 'listening'
  const isLoading = status === 'loading'
  const isBusy = isListening || isLoading

  return (
    <footer className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 px-6 py-4 border-t border-[#1b263b] bg-[#0c1322]/90 backdrop-blur-md rounded-b-2xl">
      {/* Left: Live Partial Stream */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-bold uppercase tracking-wider text-slate-200">
            Live Partial Stream
          </span>
          {isListening && isSpeaking && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <span>●</span> SPEECH
            </span>
          )}
          {isListening && partialText && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          )}
        </div>
        <p className="text-[14px] text-[#3b82f6] font-medium leading-relaxed truncate min-h-[22px] select-all">
          {partialText ? (
            <span>{partialText}</span>
          ) : isLoading ? (
            <span className="text-blue-300 italic flex items-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {downloadProgress !== null ? `Loading model (${downloadProgress}%)...` : 'Initializing engine & microphone...'}
            </span>
          ) : isListening ? (
            isSpeaking ? (
              <span className="text-amber-300 font-medium animate-pulse">
                🎙️ Hearing voice, processing speech...
              </span>
            ) : (
              <span className="text-slate-400 italic font-normal">
                Listening for speech from microphone...
              </span>
            )
          ) : (
            <span className="text-slate-400 italic font-normal">
              Press Start to begin real-time transcription
            </span>
          )}
        </p>
      </div>

      {/* Right: Controls (Start, Stop, Export) */}
      <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
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
