import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'
import { deleteSessionAudio, getSessionAudio } from '../lib/audioStore'

interface TranscriptPanelProps {
  onStart?: () => void
  onImportAudio?: (file: File) => void
  onPlaySample?: () => void
  onRetranscribe?: () => void
  onOpenSettings?: () => void
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2]

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  onStart,
  onImportAudio,
  onPlaySample,
  onRetranscribe,
  onOpenSettings,
}) => {
  const {
    sentences,
    toggleHighlight,
    editSentence,
    deleteSentence,
    replaceAllInTranscript,
    settings,
    resetSession,
    partialText,
    isSpeaking,
    status,
    micSilentWarning,
    currentUtteranceStartMs,
    filterQuery,
    setFilterQuery,
    currentSessionId,
    audioVersion,
    bumpAudioVersion,
    setHasSessionAudio,
    importJob,
  } = useAppStore()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)

  // Inline sentence editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  // Find & Replace bar state
  const [showReplace, setShowReplace] = useState(false)
  const [findTerm, setFindTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [replaceFeedback, setReplaceFeedback] = useState<string | null>(null)

  // Drag-and-drop audio upload state
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // IndexedDB Audio Replay state
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTimeS, setPlaybackTimeS] = useState(0)
  const [audioDurationS, setAudioDurationS] = useState(0)
  const [playbackRateIdx, setPlaybackRateIdx] = useState(0)

  const isListening = status === 'listening'
  const isBusy =
    status === 'listening' || status === 'paused' || status === 'importing' || status === 'loading'

  // Load saved IndexedDB audio for current session
  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    void getSessionAudio(currentSessionId).then((stored) => {
      if (!active) return
      setIsPlaying(false)
      setPlaybackTimeS(0)
      if (stored && stored.blob && stored.blob.size > 0) {
        createdUrl = URL.createObjectURL(stored.blob)
        setAudioUrl(createdUrl)
        setAudioDurationS(stored.durationMs > 0 ? stored.durationMs / 1000 : 0)
      } else {
        setAudioUrl(null)
        setAudioDurationS(0)
      }
    })

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [currentSessionId, audioVersion])

  // Filter sentences by search query
  const filteredSentences = sentences.filter((s) =>
    filterQuery.trim() === ''
      ? true
      : s.text.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (s.speaker && s.speaker.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  // Auto-scroll to newest sentence / live typing row unless user has scrolled up
  useEffect(() => {
    if (!settings.autoScroll || userHasScrolledUp || editingId) return
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [sentences.length, partialText, isSpeaking, userHasScrolledUp, settings.autoScroll, editingId])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setUserHasScrolledUp(distanceFromBottom > 80)
  }

  const startEditing = (id: string, currentText: string) => {
    setEditingId(id)
    setEditDraft(currentText)
  }

  const commitEdit = () => {
    if (editingId && editDraft.trim()) {
      editSentence(editingId, editDraft)
    }
    setEditingId(null)
    setEditDraft('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const handleReplaceAll = (e: React.FormEvent) => {
    e.preventDefault()
    if (!findTerm) return
    const count = replaceAllInTranscript(findTerm, replaceTerm, caseSensitive)
    setReplaceFeedback(
      count > 0 ? `Replaced ${count} match${count === 1 ? '' : 'es'}` : 'No matches found'
    )
    setTimeout(() => setReplaceFeedback(null), 3000)
  }

  // Audio playback controls
  const togglePlayback = () => {
    const el = audioRef.current
    if (!el || !audioUrl) return
    if (el.paused) {
      el.playbackRate = PLAYBACK_RATES[playbackRateIdx]
      void el.play()
    } else {
      el.pause()
    }
  }

  const replayAt = (startMs: number) => {
    const el = audioRef.current
    if (!el || !audioUrl) return
    const targetSec = Math.max(0, startMs / 1000)
    el.currentTime = targetSec
    el.playbackRate = PLAYBACK_RATES[playbackRateIdx]
    setPlaybackTimeS(targetSec)
    void el.play()
  }

  const cyclePlaybackRate = () => {
    const nextIdx = (playbackRateIdx + 1) % PLAYBACK_RATES.length
    setPlaybackRateIdx(nextIdx)
    if (audioRef.current) {
      audioRef.current.playbackRate = PLAYBACK_RATES[nextIdx]
    }
  }

  const handleDiscardSavedAudio = async () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    await deleteSessionAudio(currentSessionId)
    setHasSessionAudio(false)
    bumpAudioVersion()
  }

  // Drag & Drop handlers for importing audio files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isBusy && onImportAudio) {
      setIsDraggingFile(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    if (isBusy || !onImportAudio) return
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onImportAudio(file)
    }
  }

  const liveStartMs =
    currentUtteranceStartMs > 0
      ? currentUtteranceStartMs
      : sentences.length > 0
      ? (sentences[sentences.length - 1]?.startMs || 0) + 3000
      : 0

  // Determine currently playing sentence for audio sync highlight
  const playbackMs = playbackTimeS * 1000
  let activePlayingId: string | null = null
  if (isPlaying && sentences.length > 0) {
    for (let i = 0; i < sentences.length; i++) {
      const curr = sentences[i]
      const next = sentences[i + 1]
      if (playbackMs >= curr.startMs && (!next || playbackMs < next.startMs)) {
        activePlayingId = curr.id
        break
      }
    }
  }

  return (
    <section
      aria-label="Real-time Lecture Transcription"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="studio-card flex flex-col h-full rounded-2xl overflow-hidden relative"
    >
      {/* Hidden audio element backed by IndexedDB Blob URL */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setPlaybackTimeS(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
              setAudioDurationS(e.currentTarget.duration)
            }
          }}
        />
      )}

      {/* Drag & Drop Audio Import Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-20 bg-blue-50/95 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center text-center p-6 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
              audio_file
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            Drop Lecture Audio to Transcribe Locally
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Supports .mp3, .wav, .m4a, .ogg, .webm — processed 100% on-device
          </p>
        </div>
      )}

      {/* Single Unified Panel Header */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 select-none shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isListening
                ? 'bg-emerald-500 animate-pulse'
                : status === 'paused'
                ? 'bg-amber-500'
                : status === 'importing'
                ? 'bg-blue-500 animate-pulse'
                : 'bg-slate-300'
            }`}
          />
          <h2 className="text-[14px] font-semibold tracking-tight text-slate-900">
            Transcript
          </h2>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium tabular-nums">
            <span id="sentence-counter">{sentences.length}</span>{' '}
            {sentences.length === 1 ? 'line' : 'lines'}
          </span>
          {isListening && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium hidden sm:inline-flex items-center gap-1">
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Search Input */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 focus-within:bg-white focus-within:border-blue-400 transition">
            <span
              className="material-symbols-outlined text-[15px] text-slate-400 mr-1.5"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search lecture..."
              aria-label="Filter transcript sentences"
              className="bg-transparent text-slate-800 text-xs focus:outline-none w-28 sm:w-40 placeholder:text-slate-400"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="text-slate-400 hover:text-slate-700 text-xs ml-1 cursor-pointer"
                type="button"
                aria-label="Clear transcript filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle Find & Replace Toolbar */}
          <button
            type="button"
            onClick={() => {
              setShowReplace((prev) => !prev)
              if (!showReplace && filterQuery && !findTerm) {
                setFindTerm(filterQuery)
              }
            }}
            aria-expanded={showReplace}
            className={`h-8 px-2.5 text-xs rounded-lg border transition flex items-center gap-1 cursor-pointer ${
              showReplace
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                : 'bg-white border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title="Find and replace misheard terms across the transcript"
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              find_replace
            </span>
            <span className="hidden sm:inline">Replace</span>
          </button>

          {sentences.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Archive and start a fresh lecture session?')) {
                  resetSession()
                }
              }}
              className="h-8 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center cursor-pointer"
              aria-label="Archive and reset session"
              title="Archive & start fresh"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                delete_sweep
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Smart Muted-Mic Warning Banner (prevents confusion when hardware mic is muted!) */}
      {micSilentWarning && isListening && (
        <div
          role="alert"
          className="px-5 py-2.5 bg-amber-50 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[17px] text-amber-600" aria-hidden="true">
              mic_off
            </span>
            <span>
              <strong>No audio signal detected.</strong> Check if your microphone mute switch is on
              or select another input device.
            </span>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium text-[11px] transition cursor-pointer"
            >
              Check Mic Settings
            </button>
          )}
        </div>
      )}

      {/* Expandable Find & Replace Bar */}
      {showReplace && (
        <form
          onSubmit={handleReplaceAll}
          className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/70 flex flex-wrap items-center gap-2 text-xs shrink-0"
        >
          <input
            type="text"
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            placeholder="Find term..."
            aria-label="Find term in transcript"
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
          />
          <span className="material-symbols-outlined text-[14px] text-slate-400" aria-hidden="true">
            arrow_forward
          </span>
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace with..."
            aria-label="Replacement text"
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Match case</span>
          </label>
          <button
            type="submit"
            disabled={!findTerm}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[11px] font-medium transition cursor-pointer"
          >
            Replace All
          </button>
          {replaceFeedback && (
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              {replaceFeedback}
            </span>
          )}
        </form>
      )}

      {/* Refined Light-Surface Audio Replay Strip */}
      {audioUrl && (
        <div className="px-5 py-2.5 bg-slate-50/90 border-b border-slate-200/70 flex flex-wrap items-center gap-3 text-xs shrink-0">
          <button
            type="button"
            onClick={togglePlayback}
            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition shrink-0 cursor-pointer"
            aria-label={isPlaying ? 'Pause lecture audio playback' : 'Play recorded lecture audio'}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <span className="font-mono text-[11px] text-slate-600 tabular-nums shrink-0">
            {formatTimestamp(playbackTimeS * 1000)}{' '}
            <span className="text-slate-400">/ {formatTimestamp(audioDurationS * 1000)}</span>
          </span>

          <input
            type="range"
            min={0}
            max={Math.max(1, audioDurationS)}
            step={0.2}
            value={Math.min(playbackTimeS, Math.max(1, audioDurationS))}
            onChange={(e) => {
              const sec = parseFloat(e.target.value)
              setPlaybackTimeS(sec)
              if (audioRef.current) {
                audioRef.current.currentTime = sec
              }
            }}
            aria-label="Seek lecture audio recording"
            className="flex-1 min-w-[100px] accent-blue-600 h-1.5 cursor-pointer"
          />

          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-mono text-[11px] font-medium transition cursor-pointer shrink-0 tabular-nums"
            title="Cycle playback speed"
          >
            {PLAYBACK_RATES[playbackRateIdx]}x
          </button>

          {onRetranscribe && !isBusy && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Retranscribe this saved lecture audio using ${
                      settings.engine === 'browser' ? settings.browserModel : settings.pythonModel
                    } (${settings.language.toUpperCase()})? Current lines will be replaced.`
                  )
                ) {
                  onRetranscribe()
                }
              }}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 text-slate-700 hover:text-blue-700 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shrink-0"
              title="Re-run Whisper on this saved recording"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                autorenew
              </span>
              <span className="hidden sm:inline">Retranscribe</span>
            </button>
          )}

          {!isBusy && (
            <button
              type="button"
              onClick={() => void handleDiscardSavedAudio()}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
              aria-label="Delete saved audio recording for this session"
              title="Delete saved audio clip"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                close
              </span>
            </button>
          )}
        </div>
      )}

      {/* Scrollable Transcript Canvas */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2 relative scroll-smooth bg-white"
        id="transcript-scroll-area"
      >
        {filteredSentences.length === 0 && !partialText && !isSpeaking && !importJob?.active && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 select-none">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
              <span className="material-symbols-outlined text-[26px]" aria-hidden="true">
                graphic_eq
              </span>
            </div>
            <h3 className="font-semibold text-[15px] text-slate-900 tracking-tight">
              Ready to transcribe your lecture
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">
              Speak into your microphone, capture a Zoom / YouTube tab with no bot, or drop an{' '}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                .mp3 / .wav
              </code>{' '}
              recording here. Click any line to pin it as a study note.
            </p>

            {!isBusy && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                {onStart && (
                  <button
                    type="button"
                    onClick={onStart}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      mic
                    </span>
                    <span>Start Live Recording</span>
                  </button>
                )}
                {onPlaySample && (
                  <button
                    type="button"
                    onClick={onPlaySample}
                    className="h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-blue-600" aria-hidden="true">
                      play_circle
                    </span>
                    <span>Try Sample Lecture</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {filteredSentences.map((s) => {
          const isEditingThis = editingId === s.id
          const isCurrentlyPlaying = activePlayingId === s.id
          const tsLabel = formatTimestamp(s.startMs)

          return (
            <article
              key={s.id}
              id={`sentence-${s.id}`}
              onClick={() => {
                if (!isEditingThis) toggleHighlight(s.id)
              }}
              className={`group flex items-start gap-3 px-3.5 py-3 rounded-xl transition-all cursor-pointer select-text relative border ${
                isCurrentlyPlaying
                  ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                  : s.highlighted
                  ? 'is-starred bg-amber-50/60 border-amber-200/90 border-l-[3px] border-l-amber-500'
                  : 'bg-white border-transparent hover:border-slate-200/80 hover:bg-slate-50/70'
              }`}
            >
              {/* Star toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleHighlight(s.id)
                }}
                type="button"
                className={`shrink-0 mt-0.5 transition-transform group-hover:scale-110 cursor-pointer ${
                  s.highlighted
                    ? 'text-amber-500'
                    : 'text-slate-300 group-hover:text-amber-500'
                }`}
                aria-label={
                  s.highlighted
                    ? `Remove star at ${tsLabel}`
                    : `Star sentence at ${tsLabel} to key notes`
                }
                aria-pressed={s.highlighted}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: s.highlighted ? "'FILL' 1" : "'FILL' 0" }}
                  aria-hidden="true"
                >
                  star
                </span>
              </button>

              {/* Timestamp / Click-to-Replay Chip */}
              {audioUrl ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    replayAt(s.startMs)
                  }}
                  className={`font-mono text-[11px] tabular-nums shrink-0 mt-0.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 transition-colors cursor-pointer ${
                    isCurrentlyPlaying
                      ? 'bg-blue-600 text-white font-semibold'
                      : s.highlighted
                      ? 'bg-amber-100/80 text-amber-900 hover:bg-amber-200/80 font-medium'
                      : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  aria-label={`Replay audio at ${tsLabel}`}
                  title="Click to replay recorded audio from this moment"
                >
                  <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                    {isCurrentlyPlaying ? 'volume_up' : 'play_arrow'}
                  </span>
                  <span>{tsLabel}</span>
                </button>
              ) : (
                <span
                  className={`font-mono text-[11px] tabular-nums shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md select-none ${
                    s.highlighted
                      ? 'bg-amber-100/80 text-amber-900 font-medium'
                      : 'bg-slate-100/80 text-slate-500'
                  }`}
                >
                  {tsLabel}
                </span>
              )}

              {/* Content or Inline Editor */}
              <div className="flex-1 min-w-0">
                {(s.speaker || s.edited) && !isEditingThis && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {s.speaker && (
                      <span
                        className={`text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded font-mono ${
                          s.speaker === 'Lecturer'
                            ? 'bg-indigo-50 text-indigo-700'
                            : s.speaker === 'You'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.speaker}
                      </span>
                    )}
                    {s.edited && (
                      <span className="text-[10px] text-slate-400 font-mono italic">edited</span>
                    )}
                  </div>
                )}

                {isEditingThis ? (
                  <div
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitEdit()
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelEdit()
                        }
                      }}
                      autoFocus
                      aria-label={`Edit transcript text at ${tsLabel}`}
                      className="flex-1 bg-white border border-blue-400 rounded-lg px-2.5 py-1.5 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startEditing(s.id, s.text)
                    }}
                    className={`text-[15px] leading-relaxed ${
                      s.highlighted ? 'text-slate-900 font-medium' : 'text-slate-800'
                    }`}
                    title="Click to star · Double-click to edit"
                  >
                    {s.text}
                  </p>
                )}
              </div>

              {/* Hover Row Actions */}
              {!isEditingThis && (
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => startEditing(s.id, s.text)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    aria-label={`Edit sentence at ${tsLabel}`}
                    title="Edit text"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSentence(s.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    aria-label={`Delete sentence at ${tsLabel}`}
                    title="Delete line"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
              )}
            </article>
          )
        })}

        {/* In-Line Live Speech Streaming Row */}
        {(isSpeaking || partialText) && (
          <article className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-blue-50/70 border border-blue-200/80 relative">
            <div className="shrink-0 mt-0.5 text-blue-600">
              <span className="material-symbols-outlined text-[18px] animate-pulse" aria-hidden="true">
                mic
              </span>
            </div>

            <span className="font-mono text-[11px] tabular-nums bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 select-none">
              {formatTimestamp(liveStartMs)}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[15px] text-slate-900 font-medium leading-relaxed">
                {partialText || (
                  <span className="italic text-slate-400 font-normal">Listening to speech...</span>
                )}
                <span className="inline-block w-1.5 h-4 bg-blue-600 ml-1 align-middle animate-pulse rounded-xs" />
              </p>
            </div>
          </article>
        )}
      </div>

      {/* Scroll-to-Live Floating Pill */}
      {userHasScrolledUp && (
        <button
          type="button"
          onClick={() => {
            setUserHasScrolledUp(false)
            const el = scrollContainerRef.current
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium shadow-lg hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            arrow_downward
          </span>
          <span>Jump to live</span>
        </button>
      )}
    </section>
  )
}

export default TranscriptPanel
