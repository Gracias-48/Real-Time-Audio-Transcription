import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'
import { getSessionAudio } from '../lib/audioStore'

interface TranscriptPanelProps {
  onImportAudio?: (file: File) => void
  onRetranscribe?: () => void
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2]

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  onImportAudio,
  onRetranscribe,
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
    currentUtteranceStartMs,
    filterQuery,
    setFilterQuery,
    currentSessionTitle,
    currentSessionId,
    audioVersion,
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
  const isBusy = status === 'listening' || status === 'paused' || status === 'importing' || status === 'loading'

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
      count > 0 ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}` : 'No matches found'
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

  // Determine currently playing sentence index for audio sync highlight
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
      className="flex flex-col h-full bg-white rounded-lg border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden relative"
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
        <div className="absolute inset-0 z-20 bg-blue-50/90 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-lg flex flex-col items-center justify-center text-center p-6 pointer-events-none">
          <span className="material-symbols-outlined text-[36px] text-blue-600 mb-2">
            audio_file
          </span>
          <p className="text-sm font-semibold text-slate-900">
            Drop Lecture Audio to Transcribe Locally
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Supports .mp3, .wav, .m4a, .ogg, .webm — processed 100% on-device
          </p>
        </div>
      )}

      {/* Panel Header Toolbar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening
                  ? 'bg-emerald-500 animate-pulse'
                  : status === 'paused'
                  ? 'bg-amber-500'
                  : 'bg-slate-300'
              }`}
            />
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-900">
              Live Lecture Feed
            </h2>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
            <span id="sentence-counter">{sentences.length}</span> SENTENCES
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium hidden sm:inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ASR 16kHz VAD
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Filter Search Input */}
          <div className="relative flex items-center bg-slate-50 border border-gray-200/70 rounded-md px-2 py-1">
            <span className="material-symbols-outlined text-[15px] text-slate-400 mr-1" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter transcript..."
              aria-label="Filter transcript sentences"
              className="bg-transparent text-slate-800 text-xs focus:outline-none w-24 sm:w-36 placeholder:text-slate-400 font-sans"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="text-slate-400 hover:text-slate-600 text-xs ml-1 cursor-pointer"
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
            className={`px-2 py-1 text-xs rounded border transition flex items-center gap-1 cursor-pointer ${
              showReplace
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                : 'bg-white border-gray-200/70 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
            title="Find and replace misheard terms across the transcript"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              find_replace
            </span>
            <span className="hidden xl:inline">Replace</span>
          </button>

          {/* Clear Feed Button */}
          {sentences.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Archive and start a fresh lecture session?')) {
                  resetSession()
                }
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Archive & reset current session"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                delete_sweep
              </span>
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Find & Replace Bar (Meetily-style) */}
      {showReplace && (
        <form
          onSubmit={handleReplaceAll}
          className="px-4 py-2 bg-blue-50/40 border-b border-blue-100 flex flex-wrap items-center gap-2 text-xs"
        >
          <input
            type="text"
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            placeholder="Find term (e.g. hierarchisocial)"
            aria-label="Find term in transcript"
            className="bg-white border border-gray-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-40 sm:w-48"
          />
          <span className="material-symbols-outlined text-[14px] text-slate-400" aria-hidden="true">
            arrow_forward
          </span>
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace with (e.g. hierarki sosial)"
            aria-label="Replacement text"
            className="bg-white border border-gray-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-40 sm:w-48"
          />
          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span>Match case</span>
          </label>
          <button
            type="submit"
            disabled={!findTerm}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[11px] font-medium transition cursor-pointer"
          >
            Replace All
          </button>
          {replaceFeedback && (
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              {replaceFeedback}
            </span>
          )}
        </form>
      )}

      {/* Feed Context / Sub-banner */}
      <div className="px-4 py-1.5 bg-slate-50/70 border-b border-gray-100 flex items-center justify-between text-slate-500 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="font-mono text-blue-600 font-medium text-[11px]">{currentSessionId}</span>
          <span className="text-gray-300">|</span>
          <span className="truncate font-medium text-slate-700">{currentSessionTitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-400 hidden sm:flex">
          <span className="text-emerald-600">
            {settings.engine === 'browser'
              ? `Browser ${settings.browserModel}`
              : `Python ${settings.pythonModel}`}
          </span>
          <span className="text-gray-300">|</span>
          <span>{settings.language.toUpperCase()}</span>
        </div>
      </div>

      {/* Click-to-Replay Audio Player Bar (shown whenever IndexedDB audio exists for this session) */}
      {audioUrl && (
        <div className="px-4 py-2 bg-slate-900 text-slate-100 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={togglePlayback}
            className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition shrink-0 cursor-pointer"
            aria-label={isPlaying ? 'Pause lecture audio playback' : 'Play recorded lecture audio'}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <span className="font-mono text-[11px] text-slate-300 shrink-0">
            {formatTimestamp(playbackTimeS * 1000)} / {formatTimestamp(audioDurationS * 1000)}
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
            className="flex-1 min-w-[100px] accent-blue-500 h-1 cursor-pointer"
          />

          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] transition cursor-pointer shrink-0"
            title="Cycle audio playback speed"
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
                    } (${settings.language.toUpperCase()})? Current sentences will be replaced.`
                  )
                ) {
                  onRetranscribe()
                }
              }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shrink-0"
              title="Re-run local Whisper on this recording with current model & glossary settings"
            >
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                autorenew
              </span>
              <span className="hidden sm:inline">Retranscribe</span>
            </button>
          )}
        </div>
      )}

      {/* Scrollable Transcript Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 relative scroll-smooth bg-white"
        id="transcript-scroll-area"
      >
        {filteredSentences.length === 0 && !partialText && !isSpeaking && !importJob?.active && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 select-none">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                mic_none
              </span>
            </div>
            <p className="font-medium text-sm text-slate-700">
              Lecture transcription canvas is ready
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
              Click <strong className="text-slate-800">Start Lecture</strong> (Mic, Tab Audio, or
              Mic + Tab) — or drag &amp; drop a pre-recorded <code className="text-slate-600">.mp3/.wav</code>{' '}
              lecture file right here.
            </p>
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
              className={`group flex items-start gap-2.5 p-2.5 rounded-md transition-all cursor-pointer select-text relative border ${
                isCurrentlyPlaying
                  ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-200'
                  : s.highlighted
                  ? 'is-starred bg-amber-50/50 border-amber-200/80'
                  : 'bg-white border-transparent hover:border-gray-200/70 hover:bg-slate-50/60'
              }`}
            >
              {/* Star toggle icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleHighlight(s.id)
                }}
                type="button"
                className={`shrink-0 pt-0.5 transition-transform group-hover:scale-110 cursor-pointer ${
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

              {/* Monospace Timestamp (Click-to-Replay when audio is saved) */}
              {audioUrl ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    replayAt(s.startMs)
                  }}
                  className={`font-mono text-xs shrink-0 pt-0.5 inline-flex items-center gap-0.5 rounded px-1 -mx-1 transition-colors cursor-pointer ${
                    isCurrentlyPlaying
                      ? 'bg-blue-600 text-white font-semibold'
                      : s.highlighted
                      ? 'text-amber-800 hover:bg-amber-100 font-semibold'
                      : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                  aria-label={`Replay audio at ${tsLabel}`}
                  title="Click to replay recorded audio at this timestamp"
                >
                  <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                    {isCurrentlyPlaying ? 'volume_up' : 'play_arrow'}
                  </span>
                  <span>[{tsLabel}]</span>
                </button>
              ) : (
                <span
                  className={`font-mono text-xs shrink-0 pt-0.5 select-none ${
                    s.highlighted
                      ? 'text-amber-800 font-semibold'
                      : 'text-slate-400 group-hover:text-primary transition-colors'
                  }`}
                >
                  [{tsLabel}]
                </span>
              )}

              {/* Sentence Content or Inline Editor */}
              <div className="flex-1 min-w-0">
                {(s.highlighted || s.speaker || s.edited) && !isEditingThis && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {s.speaker && (
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded font-mono ${
                          s.speaker === 'Lecturer'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                            : s.speaker === 'You'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.speaker}
                      </span>
                    )}
                    {s.highlighted && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
                        KEYNOTE
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
                      className="flex-1 bg-white border border-blue-400 rounded px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-2 py-1 rounded border border-gray-200 bg-white text-slate-600 text-xs hover:bg-slate-50 cursor-pointer"
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
                    className={`text-sm leading-relaxed ${
                      s.highlighted ? 'text-slate-900 font-medium' : 'text-slate-800'
                    }`}
                    title="Click to star · Double-click to edit"
                  >
                    {s.text}
                  </p>
                )}
              </div>

              {/* Row Hover Actions (Edit / Delete) */}
              {!isEditingThis && (
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => startEditing(s.id, s.text)}
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    aria-label={`Edit sentence at ${tsLabel}`}
                    title="Edit sentence"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSentence(s.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    aria-label={`Delete sentence at ${tsLabel}`}
                    title="Delete sentence"
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

        {/* In-Line Live Speech Typing Stream Row */}
        {(isSpeaking || partialText) && (
          <article className="flex items-start gap-3 p-2.5 rounded-md bg-blue-50/60 border border-blue-200/60 relative">
            <div className="shrink-0 pt-0.5 text-blue-500">
              <span className="material-symbols-outlined text-[18px] animate-pulse" aria-hidden="true">
                mic
              </span>
            </div>

            <span className="font-mono text-xs text-blue-600 font-semibold shrink-0 pt-0.5 select-none">
              [{formatTimestamp(liveStartMs)}]
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-600 text-white font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE STREAMING
                </span>
              </div>
              <p className="text-sm text-slate-900 font-medium leading-relaxed">
                {partialText || (
                  <span className="italic text-slate-400">Listening to speech...</span>
                )}
                <span className="inline-block w-1.5 h-4 bg-blue-600 ml-1 align-middle animate-pulse" />
              </p>
            </div>
          </article>
        )}
      </div>

      {/* Floating Scroll-to-Bottom Pill when user scrolled up */}
      {userHasScrolledUp && (
        <button
          type="button"
          onClick={() => {
            setUserHasScrolledUp(false)
            const el = scrollContainerRef.current
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium shadow-md hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
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
