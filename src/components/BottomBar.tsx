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
    <footer className="fixed bottom-0 left-0 lg:left-56 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200/70 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Audio & Session Status */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-blue-600 font-mono text-xs">
            <span className="material-symbols-outlined text-[18px] animate-spin">
              progress_activity
            </span>
            <span className="truncate">
              {downloadProgress !== null
                ? `Loading Whisper model (${downloadProgress}%)...`
                : 'Initializing microphone & local engine...'}
            </span>
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-3 min-w-0">
            {/* Animated Audio Wave Indicator */}
            <div className="flex items-end gap-1 h-4 shrink-0">
              <span
                className={`w-1 bg-blue-600 rounded-full transition-all ${
                  isSpeaking ? 'h-4 animate-bounce' : 'h-1.5 opacity-40'
                }`}
              />
              <span
                className={`w-1 bg-blue-500 rounded-full transition-all ${
                  isSpeaking ? 'h-5 animate-bounce [animation-delay:0.15s]' : 'h-2.5 opacity-60'
                }`}
              />
              <span
                className={`w-1 bg-blue-600 rounded-full transition-all ${
                  isSpeaking ? 'h-3.5 animate-bounce [animation-delay:0.3s]' : 'h-1.5 opacity-40'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {isSpeaking ? '🎙️ Speech Detected' : 'Microphone Standby'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium font-mono hidden sm:inline">
                  16kHz Streaming
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden md:block">
                Silero VAD active · Local WebGPU inference
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="truncate font-medium">Ready to record lecture notes</span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              (100% on-device)
            </span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onExport}
          className="h-9 px-3 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          title="Export notes and transcript"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400">
            file_download
          </span>
          <span className="hidden sm:inline">Export</span>
        </button>

        {isBusy ? (
          <button
            onClick={onStop}
            className="h-9 px-4 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">stop</span>
            <span>Stop Recording</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            className="h-9 px-4 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            <span>Start Lecture</span>
          </button>
        )}
      </div>
    </footer>
  )
}

export default BottomBar
