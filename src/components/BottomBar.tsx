import React from 'react'
import { useAppStore } from '../lib/store'

interface BottomBarProps {
  onStart: () => void
  onStop: () => void
  onExport: () => void
}

export const BottomBar: React.FC<BottomBarProps> = ({ onStart, onStop, onExport }) => {
  const { status, partialText } = useAppStore()
  const isListening = status === 'listening'

  return (
    <footer className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 px-6 py-4 border-t border-[#1b263b] bg-[#0c1322]/90 backdrop-blur-md rounded-b-2xl">
      {/* Left: Live Partial Stream */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-bold uppercase tracking-wider text-slate-200">
            Live Partial Stream
          </span>
          {isListening && partialText && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          )}
        </div>
        <p className="text-[14px] text-[#3b82f6] font-medium leading-relaxed truncate min-h-[22px] select-all">
          {partialText || (
            <span className="text-slate-400 italic font-normal">
              {isListening ? 'Listening for speech...' : 'Press Start to begin real-time transcription'}
            </span>
          )}
        </p>
      </div>

      {/* Right: Controls (Start, Stop, Export) */}
      <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
        <button
          onClick={onStart}
          disabled={isListening}
          className={`px-7 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer shadow-md ${
            isListening
              ? 'bg-blue-600/40 text-blue-200 cursor-not-allowed opacity-60'
              : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-98'
          }`}
        >
          Start
        </button>

        <button
          onClick={onStop}
          disabled={!isListening}
          className={`px-7 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border cursor-pointer ${
            !isListening
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
