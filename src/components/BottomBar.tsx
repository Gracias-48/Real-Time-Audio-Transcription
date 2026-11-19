import React, { useRef } from 'react'
import { useAppStore } from '../lib/store'
import type { AudioSourceMode } from '../lib/types'

interface BottomBarProps {
  onStart: () => void
  onStop: () => void
  onPause: () => void
  onResume: () => void
  onExport: () => void
  onImportAudio: (file: File) => void
  onCancelImport: () => void
}

const SOURCE_OPTIONS: { id: AudioSourceMode; label: string; icon: string; title: string }[] = [
  { id: 'mic', label: 'Mic', icon: 'mic', title: 'Record from Microphone (in-person lecture)' },
  {
    id: 'system',
    label: 'Tab Audio',
    icon: 'screen_share',
    title: 'Capture Browser Tab / System Audio (Zoom, Meet, YouTube — no bot)',
  },
  {
    id: 'mixed',
    label: 'Mic + Tab',
    icon: 'podcasts',
    title: 'Mix Mic + Tab Audio with automatic Lecturer / You speaker labels',
  },
]

export const BottomBar: React.FC<BottomBarProps> = ({
  onStart,
  onStop,
  onPause,
  onResume,
  onExport,
  onImportAudio,
  onCancelImport,
}) => {
  const {
    status,
    isSpeaking,
    audioLevel,
    isClipping,
    downloadProgress,
    importJob,
    settings,
    updateSettings,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isListening = status === 'listening'
  const isPaused = status === 'paused'
  const isLoading = status === 'loading'
  const isImporting = status === 'importing' || Boolean(importJob?.active)
  const isRecordingSession = isListening || isPaused

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImportAudio(file)
    }
    e.target.value = ''
  }

  // Generate 7-bar live RMS audio level visualization
  const meterBars = [14, 28, 42, 56, 70, 84, 95]

  return (
    <footer className="fixed bottom-0 left-0 lg:left-56 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200/70 z-30 flex items-center justify-between gap-3 px-4 sm:px-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import pre-recorded lecture audio file"
      />

      {/* Left: Live Telemetry / Import Progress / Source Selector */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isImporting && importJob ? (
          <div className="flex items-center gap-3 min-w-0 flex-1 max-w-md">
            <span
              className="material-symbols-outlined text-[18px] text-blue-600 animate-spin shrink-0"
              aria-hidden="true"
            >
              progress_activity
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                <span className="truncate">
                  {importJob.mode === 'retranscribe' ? 'Retranscribing' : 'Importing'}{' '}
                  {importJob.filename}
                </span>
                <span className="font-mono text-blue-600 ml-2 shrink-0">
                  {importJob.totalChunks > 0
                    ? `${importJob.currentChunk}/${importJob.totalChunks} (${importJob.percent}%)`
                    : `${importJob.percent}%`}
                </span>
              </div>
              <progress
                value={importJob.percent}
                max={100}
                aria-label="Audio transcription progress"
                className="w-full h-1.5 rounded-full overflow-hidden accent-blue-600"
              />
            </div>
            <button
              type="button"
              onClick={onCancelImport}
              className="h-7 px-2.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-medium transition cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-blue-600 font-mono text-xs min-w-0">
            <span
              className="material-symbols-outlined text-[18px] animate-spin shrink-0"
              aria-hidden="true"
            >
              progress_activity
            </span>
            <span className="truncate">
              {downloadProgress !== null
                ? `Loading Whisper model (${downloadProgress}%)...`
                : 'Initializing audio pipeline & local engine...'}
            </span>
          </div>
        ) : isRecordingSession ? (
          <div className="flex items-center gap-3 min-w-0">
            {/* Real-time RMS dB Audio Meter */}
            <div
              className="flex items-end gap-0.5 h-5 px-1.5 py-0.5 rounded bg-slate-50 border border-gray-200/70 shrink-0"
              title={
                isClipping
                  ? 'Peak audio clipping detected (anti-clipping active)'
                  : `Live input level: ${audioLevel}%`
              }
              aria-hidden="true"
            >
              {meterBars.map((threshold, idx) => {
                const active = !isPaused && audioLevel >= threshold - 8
                const barColor =
                  idx >= 6
                    ? 'bg-rose-500'
                    : idx >= 4
                    ? 'bg-amber-500'
                    : isSpeaking
                    ? 'bg-blue-600'
                    : 'bg-emerald-500'
                return (
                  <span
                    key={threshold}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      active ? barColor : 'bg-slate-200'
                    }`}
                    style={{ height: `${Math.round(28 + idx * 12)}%` }}
                  />
                )
              })}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {isPaused
                    ? 'Recording Paused'
                    : isSpeaking
                    ? 'Speech Detected'
                    : 'Audio Standby'}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium font-mono hidden sm:inline ${
                    isPaused
                      ? 'bg-amber-50 text-amber-700'
                      : isClipping
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {isPaused
                    ? 'PAUSED'
                    : settings.audioSource === 'mixed'
                    ? 'MIC + TAB'
                    : settings.audioSource === 'system'
                    ? 'TAB AUDIO'
                    : '16kHz MIC'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden md:block truncate">
                {settings.noiseConditioning ? '80Hz HPF + Compressor' : 'Raw input'} · Silero VAD ·{' '}
                {settings.saveAudioRecording ? 'Saving local replay' : 'Text only'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Quick Audio Source Switcher Pill */}
            <div
              className="inline-flex items-center p-0.5 rounded-md bg-slate-100 border border-gray-200/70 shrink-0"
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
                    className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 cursor-pointer ${
                      selected
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
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

            <span className="text-slate-400 font-mono text-[11px] hidden xl:inline truncate">
              100% on-device · zero API key
            </span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {!isRecordingSession && !isLoading && !isImporting && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-3 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Import pre-recorded lecture audio (.mp3, .wav, .m4a, .webm)"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">
              upload_file
            </span>
            <span className="hidden md:inline">Import Audio</span>
          </button>
        )}

        <button
          onClick={onExport}
          className="h-9 px-3 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          title="Export notes, study templates, SRT subtitles or PDF"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">
            file_download
          </span>
          <span className="hidden sm:inline">Export</span>
        </button>

        {isRecordingSession && (
          <button
            onClick={isPaused ? onResume : onPause}
            className={`h-9 px-3 rounded-md border text-xs font-medium transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isPaused
                ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {isPaused ? 'play_arrow' : 'pause'}
            </span>
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        )}

        {isRecordingSession || isLoading ? (
          <button
            onClick={onStop}
            className="h-9 px-4 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              stop
            </span>
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={isImporting}
            className="h-9 px-4 rounded-md bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              play_arrow
            </span>
            <span>Start Lecture</span>
          </button>
        )}
      </div>
    </footer>
  )
}

export default BottomBar
