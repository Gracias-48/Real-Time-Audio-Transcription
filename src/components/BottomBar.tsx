import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import type { AudioSourceMode } from '../lib/types'

interface BottomBarProps {
  onStart: () => void
  onStop: () => void
  onPause: () => void
  onResume: () => void
  onImportAudio: (file: File) => void
  onCancelImport: () => void
}

const SOURCE_OPTIONS: { id: AudioSourceMode; label: string; icon: string; title: string }[] = [
  {
    id: 'mic',
    label: 'Mic',
    icon: 'mic_none',
    title: 'Record from your microphone (best for classroom lectures)',
  },
  {
    id: 'system',
    label: 'Tab Audio',
    icon: 'screen_share',
    title: 'Captures Zoom, Meet, or YouTube audio cleanly without a meeting bot',
  },
  {
    id: 'mixed',
    label: 'Mic + Tab',
    icon: 'podcasts',
    title: 'Captures Zoom, Meet, or YouTube audio cleanly mixed with your mic (auto-labels Lecturer vs You)',
  },
]

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const BottomBar: React.FC<BottomBarProps> = ({
  onStart,
  onStop,
  onPause,
  onResume,
  onImportAudio,
  onCancelImport,
}) => {
  const {
    status,
    audioLevel,
    isClipping,
    downloadProgress,
    importJob,
    settings,
    updateSettings,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)

  const isListening = status === 'listening'
  const isPaused = status === 'paused'
  const isLoading = status === 'loading'
  const isImporting = status === 'importing' || Boolean(importJob?.active)
  const isRecordingSession = isListening || isPaused

  // Live elapsed timer for the recording dock
  useEffect(() => {
    if (!isRecordingSession) return
    if (isPaused) return
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isRecordingSession, isPaused])

  const handleStartClick = () => {
    setElapsedSec(0)
    onStart()
  }

  const handleStopClick = () => {
    setElapsedSec(0)
    onStop()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImportAudio(file)
    }
    e.target.value = ''
  }

  const meterBars = [15, 30, 45, 60, 75, 90]

  return (
    <div className="pointer-events-none absolute bottom-5 inset-x-0 flex justify-center px-4 z-20">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import pre-recorded lecture audio file"
      />

      {/* Floating Capture Pill Dock */}
      <div
        role="region"
        aria-label="Audio capture controls"
        className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#E6E6E3] rounded-xl px-2 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex items-center gap-2 max-w-full"
      >
        {isImporting && importJob ? (
          <div className="flex items-center gap-3 px-2 py-0.5 min-w-[260px] max-w-md">
            <span
              className="material-symbols-outlined text-[16px] text-[#5C5C59] animate-spin shrink-0"
              aria-hidden="true"
            >
              progress_activity
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#141413] mb-1">
                <span className="truncate">
                  {importJob.mode === 'retranscribe' ? 'Retranscribing' : 'Transcribing'}{' '}
                  {importJob.filename}
                </span>
                <span className="font-mono text-[#5C5C59] tabular-nums shrink-0">
                  {importJob.totalChunks > 0
                    ? `${importJob.currentChunk}/${importJob.totalChunks}`
                    : `${importJob.percent}%`}
                </span>
              </div>
              <progress
                value={importJob.percent}
                max={100}
                aria-label="Audio transcription progress"
                className="w-full h-1 rounded-full overflow-hidden accent-[#141413]"
              />
            </div>
            <button
              type="button"
              onClick={onCancelImport}
              className="h-7 px-2.5 rounded-[6px] border border-[#E6E6E3] bg-white hover:bg-[#F1F1EF] text-[#5C5C59] hover:text-[#141413] text-[12px] font-medium transition-colors duration-150 cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2.5 px-2.5 h-8 text-[12px] font-mono text-[#5C5C59]">
            <span
              className="material-symbols-outlined text-[16px] animate-spin text-[#141413] shrink-0"
              aria-hidden="true"
            >
              progress_activity
            </span>
            <span className="truncate max-w-[240px]">
              {downloadProgress !== null
                ? `Loading Whisper (${downloadProgress}%)...`
                : 'Initializing local audio...'}
            </span>
            <button
              type="button"
              onClick={handleStopClick}
              className="h-7 px-2 rounded-[6px] hover:bg-[#F1F1EF] text-[#5C5C59] hover:text-[#141413] font-sans text-[12px] font-medium transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : isRecordingSession ? (
          <>
            {/* Live Monochrome RMS Level Bars + Elapsed Timer */}
            <div className="flex items-center gap-2.5 pl-2 pr-1">
              <div
                className="flex items-end gap-[2px] h-4 shrink-0"
                title={isClipping ? 'Audio clipping detected' : `Input level: ${audioLevel}%`}
                aria-hidden="true"
              >
                {meterBars.map((threshold, idx) => {
                  const active = !isPaused && audioLevel >= threshold - 8
                  return (
                    <span
                      key={threshold}
                      className={`w-[2px] rounded-full transition-all duration-75 ${
                        active
                          ? idx >= 5 && isClipping
                            ? 'bg-[#DC2626]'
                            : 'bg-[#141413]'
                          : 'bg-[#E6E6E3]'
                      }`}
                      style={{ height: `${Math.round(35 + idx * 12)}%` }}
                    />
                  )
                })}
              </div>

              <span className="font-mono text-[12px] font-medium tabular-nums text-[#141413]">
                {formatElapsed(elapsedSec)}
              </span>
              {isPaused && (
                <span className="text-[11px] text-[#8E8E8A] font-medium">Paused</span>
              )}
            </div>

            <div className="h-5 w-px bg-[#E6E6E3]" aria-hidden="true" />

            <button
              type="button"
              onClick={isPaused ? onResume : onPause}
              className="h-8 px-2.5 rounded-[6px] text-[12px] font-medium text-[#5C5C59] hover:text-[#141413] hover:bg-[#F4F4F2] inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={handleStopClick}
              className="h-8 px-3.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-[2px] bg-white" aria-hidden="true" />
              <span>Stop</span>
            </button>
          </>
        ) : (
          <>
            {/* Source Segmented Control */}
            <div
              className="inline-flex items-center h-8 p-0.5 rounded-lg bg-[#F4F4F2]"
              role="group"
              aria-label="Audio capture source"
            >
              {SOURCE_OPTIONS.map((opt) => {
                const selected = settings.audioSource === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ audioSource: opt.id })}
                    title={opt.title}
                    aria-pressed={selected}
                    className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                      selected
                        ? 'bg-white text-[#141413] border border-[#E6E6E3] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                        : 'text-[#5C5C59] hover:text-[#141413] border border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      {opt.icon}
                    </span>
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="h-5 w-px bg-[#E6E6E3]" aria-hidden="true" />

            {/* Quiet Import Audio Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Import pre-recorded audio (.mp3, .wav, .m4a, .webm)"
              className="h-8 px-2.5 rounded-[6px] text-[12px] font-medium text-[#5C5C59] hover:text-[#141413] hover:bg-[#F4F4F2] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                upload_file
              </span>
              <span className="hidden sm:inline">Import Audio</span>
            </button>

            {/* Single Dominant Primary CTA: Start Lecture */}
            <button
              type="button"
              onClick={handleStartClick}
              disabled={isImporting}
              className="h-8 px-3.5 rounded-lg bg-[#141413] hover:bg-[#2A2A28] disabled:opacity-50 text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" aria-hidden="true" />
              <span>Start Lecture</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default BottomBar
