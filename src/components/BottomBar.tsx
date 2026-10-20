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
    <footer className="fixed bottom-0 left-0 lg:left-72 right-0 h-16 bg-surface-container-lowest z-30 flex items-center justify-between px-space-md border-t border-[#262626]">
      {/* Left: Audio & Session Status */}
      <div className="flex items-center gap-space-md min-w-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-primary font-mono text-xs">
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
                className={`w-1 bg-primary transition-all ${
                  isSpeaking ? 'h-4 animate-bounce' : 'h-1.5 opacity-40'
                }`}
              />
              <span
                className={`w-1 bg-primary-container transition-all ${
                  isSpeaking ? 'h-5 animate-bounce [animation-delay:0.15s]' : 'h-2.5 opacity-60'
                }`}
              />
              <span
                className={`w-1 bg-primary transition-all ${
                  isSpeaking ? 'h-3.5 animate-bounce [animation-delay:0.3s]' : 'h-1.5 opacity-40'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-on-surface">
                  {isSpeaking ? '🎙️ SPEECH DETECTED' : 'MICROPHONE STANDBY'}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-tertiary-container/30 text-tertiary font-semibold hidden sm:inline">
                  16kHz VAD STREAMING
                </span>
              </div>
              <p className="font-mono text-[11px] text-outline truncate">
                {isSpeaking
                  ? 'Transcribing directly into live transcript feed above.'
                  : 'Speak into microphone to transcribe in real-time.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-outline font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-outline shrink-0" />
            <span>
              Engine Ready · Press <strong className="text-on-surface font-semibold">Start Recording</strong> to stream.
            </span>
          </div>
        )}
      </div>

      {/* Right: Controller Buttons */}
      <div className="flex items-center gap-space-xs shrink-0">
        <button
          onClick={onStart}
          disabled={isBusy}
          className={`h-10 px-space-md font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            isBusy
              ? 'bg-primary-container/30 text-on-primary-container/40 cursor-not-allowed'
              : 'bg-primary-container text-on-primary-container hover:bg-inverse-primary'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isLoading ? 'hourglass_top' : 'mic'}
          </span>
          <span>{isLoading ? 'Starting...' : 'Start Recording'}</span>
        </button>

        <button
          onClick={onStop}
          disabled={status === 'idle'}
          className={`h-10 px-space-md font-mono text-xs transition-colors flex items-center gap-1.5 cursor-pointer border ${
            status === 'idle'
              ? 'bg-surface-container text-outline border-[#2e2e2e] cursor-not-allowed'
              : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-[#424656]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">stop</span>
          <span>Stop</span>
        </button>

        <button
          onClick={onExport}
          className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface font-mono text-xs transition-colors hidden sm:flex items-center gap-1.5 cursor-pointer border border-[#2e2e2e]"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">file_download</span>
          <span>Export</span>
        </button>
      </div>
    </footer>
  )
}
