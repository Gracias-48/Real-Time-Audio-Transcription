import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import { deleteSessionAudio, getSessionAudio } from '../lib/audioStore'

interface TranscriptPanelProps {
  onImportAudio?: (file: File) => void
  onPlaySample?: () => void
  onRetranscribe?: () => void
  onOpenSettings?: () => void
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2]

/** Compact editorial timestamp: MM:SS under 1 hour, H:MM:SS at 1h+. */
function formatShortTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
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
    currentSessionTitle,
    renameCurrentSession,
    audioVersion,
    bumpAudioVersion,
    setHasSessionAudio,
    importJob,
  } = useAppStore()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)

  // Document title inline editor
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  // Inline sentence editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  // Search + Find & Replace expandable strip
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [showReplaceRow, setShowReplaceRow] = useState(false)
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

  // Keyboard shortcuts: Cmd/Ctrl + F or Cmd/Ctrl + K opens inline transcript search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault()
        setShowSearchBar(true)
        setTimeout(() => searchInputRef.current?.focus(), 20)
      } else if (e.key === 'Escape' && showSearchBar && document.activeElement === searchInputRef.current) {
        setShowSearchBar(false)
        setFilterQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showSearchBar, setFilterQuery])

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

  // Auto-scroll to newest sentence / live row unless user has scrolled up
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

  const startTitleEdit = () => {
    setTitleDraft(currentSessionTitle)
    setIsEditingTitle(true)
  }

  const commitTitleEdit = () => {
    if (titleDraft.trim()) {
      renameCurrentSession(titleDraft.trim())
    }
    setIsEditingTitle(false)
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
    if (!filterQuery) return
    const count = replaceAllInTranscript(filterQuery, replaceTerm, caseSensitive)
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

  const triggerRetranscribe = () => {
    if (!onRetranscribe || isBusy) return
    const modelName = settings.engine === 'browser' ? settings.browserModel : settings.pythonModel
    if (
      window.confirm(
        `Retranscribe this saved lecture audio using Whisper ${modelName} (${settings.language.toUpperCase()})? Current lines will be replaced.`
      )
    ) {
      onRetranscribe()
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

  // Session duration display for quiet document metadata row
  const sessionDurationMs =
    audioDurationS > 0
      ? audioDurationS * 1000
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

  const scrubPercent =
    audioDurationS > 0 ? Math.min(100, Math.max(0, (playbackTimeS / audioDurationS) * 100)) : 0

  return (
    <section
      aria-label="Lecture Transcript Canvas"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col min-h-0 bg-white relative overflow-hidden"
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
        <div className="absolute inset-4 z-30 bg-[#FAFAFA]/95 backdrop-blur-xs border border-dashed border-[#141413] rounded-xl flex flex-col items-center justify-center text-center p-6 pointer-events-none">
          <span className="material-symbols-outlined text-[28px] text-[#141413] mb-2" aria-hidden="true">
            audio_file
          </span>
          <p className="text-[14px] font-medium text-[#141413]">
            Drop audio file to transcribe locally
          </p>
          <p className="text-[12px] text-[#8E8E8A] mt-1">
            MP3, WAV, M4A, OGG, or WebM
          </p>
        </div>
      )}

      {/* Full-Canvas Scrollable Reading Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth bg-white"
        id="transcript-scroll-area"
      >
        <div className="max-w-[720px] mx-auto px-6 sm:px-8 pt-8 pb-28">
          {/* Editorial Document Header */}
          <header className="mb-5">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitleEdit()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                autoFocus
                aria-label="Edit lecture title"
                className="w-full text-[24px] font-semibold tracking-[-0.02em] text-[#141413] bg-[#FAFAFA] border border-[#141413] rounded-[6px] px-2 py-0.5 -mx-2 focus:outline-none leading-tight"
              />
            ) : (
              <button
                type="button"
                onClick={startTitleEdit}
                title="Click to rename lecture"
                className="group inline-flex items-baseline gap-2 text-left max-w-full cursor-pointer rounded-[6px] -mx-1.5 px-1.5 py-0.5 hover:bg-[#F7F7F5] transition-colors duration-150"
              >
                <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#141413] leading-tight break-words">
                  {currentSessionTitle}
                </h1>
                <span
                  className="material-symbols-outlined text-[15px] text-[#8E8E8A] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
                  aria-hidden="true"
                >
                  edit
                </span>
              </button>
            )}

            {/* Single Quiet Metadata & Utility Row */}
            <div className="mt-2 pb-4 border-b border-[#E6E6E3] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#8E8E8A]">
              <div className="flex items-center gap-2 font-mono tabular-nums">
                {isListening && (
                  <span className="inline-flex items-center gap-1.5 text-[#DC2626] font-sans font-medium mr-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                    Recording
                  </span>
                )}
                {status === 'paused' && (
                  <span className="inline-flex items-center gap-1.5 text-[#5C5C59] font-sans font-medium mr-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E8A]" />
                    Paused
                  </span>
                )}
                <span>
                  <span id="sentence-counter">{sentences.length}</span>{' '}
                  {sentences.length === 1 ? 'segment' : 'segments'}
                </span>
                <span>·</span>
                <span>{formatShortTime(sessionDurationMs)}</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showSearchBar
                    setShowSearchBar(next)
                    if (next) {
                      setTimeout(() => searchInputRef.current?.focus(), 20)
                    } else {
                      setFilterQuery('')
                      setShowReplaceRow(false)
                    }
                  }}
                  aria-expanded={showSearchBar}
                  title="Search & Replace (Ctrl+F)"
                  className={`h-7 px-2 rounded-[6px] inline-flex items-center gap-1 text-[12px] transition-colors duration-150 cursor-pointer ${
                    showSearchBar || filterQuery
                      ? 'bg-[#EBEBE8] text-[#141413] font-medium'
                      : 'text-[#5C5C59] hover:text-[#141413] hover:bg-[#F1F1EF]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    search
                  </span>
                  <span>Search</span>
                </button>

                {audioUrl && onRetranscribe && !isBusy && (
                  <button
                    type="button"
                    onClick={triggerRetranscribe}
                    title="Re-run local Whisper on saved recording"
                    className="h-7 px-2 rounded-[6px] inline-flex items-center gap-1 text-[12px] text-[#5C5C59] hover:text-[#141413] hover:bg-[#F1F1EF] transition-colors duration-150 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      autorenew
                    </span>
                    <span className="hidden sm:inline">Retranscribe</span>
                  </button>
                )}

                {sentences.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Archive and start a fresh lecture session?')) {
                        resetSession()
                      }
                    }}
                    title="Archive & clear canvas"
                    aria-label="Archive and reset session"
                    className="h-7 w-7 rounded-[6px] inline-flex items-center justify-center text-[#8E8E8A] hover:text-[#141413] hover:bg-[#F1F1EF] transition-colors duration-150 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      delete_sweep
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Inline Search + Find & Replace Strip */}
            {(showSearchBar || filterQuery) && (
              <div className="mt-3 p-2.5 bg-[#FAFAFA] border border-[#E6E6E3] rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[15px] text-[#8E8E8A] shrink-0"
                    aria-hidden="true"
                  >
                    search
                  </span>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Find in transcript..."
                    aria-label="Search transcript text"
                    className="flex-1 bg-transparent text-[13px] text-[#141413] placeholder:text-[#8E8E8A] focus:outline-none"
                  />
                  {filterQuery && (
                    <span className="text-[11px] font-mono tabular-nums text-[#8E8E8A] shrink-0">
                      {filteredSentences.length} matched
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowReplaceRow((p) => !p)}
                    aria-expanded={showReplaceRow}
                    className={`h-6 px-2 rounded-[6px] text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                      showReplaceRow
                        ? 'bg-[#EBEBE8] text-[#141413]'
                        : 'text-[#5C5C59] hover:text-[#141413] hover:bg-[#F1F1EF]'
                    }`}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchBar(false)
                      setShowReplaceRow(false)
                      setFilterQuery('')
                    }}
                    aria-label="Close search bar"
                    className="w-6 h-6 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#F1F1EF] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>

                {showReplaceRow && (
                  <form
                    onSubmit={handleReplaceAll}
                    className="pt-2 border-t border-[#E6E6E3] flex flex-wrap items-center gap-2 text-[12px]"
                  >
                    <input
                      type="text"
                      value={replaceTerm}
                      onChange={(e) => setReplaceTerm(e.target.value)}
                      placeholder="Replace with..."
                      aria-label="Replacement text"
                      className="flex-1 min-w-[160px] h-7 bg-white border border-[#E6E6E3] rounded-[6px] px-2.5 text-[12px] text-[#141413] placeholder:text-[#8E8E8A] focus:outline-none focus:border-[#141413]"
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-[#5C5C59] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        className="rounded border-[#E6E6E3] accent-[#141413]"
                      />
                      <span>Match case</span>
                    </label>
                    <button
                      type="submit"
                      disabled={!filterQuery}
                      className="h-7 px-2.5 rounded-[6px] bg-[#141413] hover:bg-[#2A2A28] disabled:opacity-40 text-white text-[11px] font-medium transition-colors duration-150 cursor-pointer"
                    >
                      Replace all
                    </button>
                    {replaceFeedback && (
                      <span className="text-[11px] font-mono text-[#5C5C59]">
                        {replaceFeedback}
                      </span>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* Smart Muted-Mic Warning Banner */}
            {micSilentWarning && isListening && (
              <div
                role="alert"
                className="mt-3 px-3 py-2 bg-[#FEFCE8] border border-[#E6E6E3] rounded-lg flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#141413]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[16px] text-[#D97706]"
                    aria-hidden="true"
                  >
                    mic_off
                  </span>
                  <span>
                    No audio input detected — check if your microphone is muted.
                  </span>
                </div>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="h-6 px-2 rounded-[6px] bg-white border border-[#E6E6E3] hover:bg-[#F1F1EF] text-[#141413] text-[11px] font-medium transition-colors duration-150 cursor-pointer"
                  >
                    Audio Settings
                  </button>
                )}
              </div>
            )}

            {/* Slim 40px Audio Playback Strip (only visible when audio exists) */}
            {audioUrl && (
              <div className="group/player mt-4 h-10 bg-[#FAFAFA] border border-[#E6E6E3] rounded-lg px-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayback}
                  aria-label={isPlaying ? 'Pause lecture audio' : 'Play lecture audio'}
                  className="w-[26px] h-[26px] rounded-full bg-[#141413] hover:bg-[#2A2A28] text-white flex items-center justify-center transition-colors duration-150 shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <input
                  type="range"
                  min={0}
                  max={Math.max(1, audioDurationS)}
                  step={0.1}
                  value={Math.min(playbackTimeS, Math.max(1, audioDurationS))}
                  onChange={(e) => {
                    const sec = parseFloat(e.target.value)
                    setPlaybackTimeS(sec)
                    if (audioRef.current) {
                      audioRef.current.currentTime = sec
                    }
                  }}
                  aria-label="Seek audio recording"
                  className="studio-scrubber flex-1 min-w-[80px]"
                  style={{
                    background: `linear-gradient(to right, #141413 ${scrubPercent}%, #E6E6E3 ${scrubPercent}%)`,
                  }}
                />

                <span className="font-mono text-[11px] text-[#5C5C59] tabular-nums shrink-0">
                  {formatShortTime(playbackTimeS * 1000)} / {formatShortTime(audioDurationS * 1000)}
                </span>

                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  title="Playback speed"
                  className="h-6 px-1.5 rounded-[6px] hover:bg-[#EBEBE8] font-mono text-[11px] text-[#5C5C59] hover:text-[#141413] tabular-nums transition-colors duration-150 cursor-pointer shrink-0"
                >
                  {PLAYBACK_RATES[playbackRateIdx]}x
                </button>

                {onRetranscribe && !isBusy && (
                  <button
                    type="button"
                    onClick={triggerRetranscribe}
                    className="hidden sm:inline-flex h-6 px-2 rounded-[6px] hover:bg-[#EBEBE8] text-[11px] font-medium text-[#5C5C59] hover:text-[#141413] transition-colors duration-150 cursor-pointer shrink-0"
                  >
                    Retranscribe
                  </button>
                )}

                {!isBusy && (
                  <button
                    type="button"
                    onClick={() => void handleDiscardSavedAudio()}
                    aria-label="Remove saved audio clip"
                    title="Delete saved audio clip"
                    className="w-6 h-6 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#EBEBE8] flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      close
                    </span>
                  </button>
                )}
              </div>
            )}
          </header>

          {/* Calm Editorial Empty State */}
          {filteredSentences.length === 0 && !partialText && !isSpeaking && !importJob?.active && (
            <div className="py-20 flex flex-col items-center justify-center text-center select-none">
              <span
                className="material-symbols-outlined text-[24px] text-[#B4B4B0] mb-3"
                aria-hidden="true"
              >
                graphic_eq
              </span>
              <p className="text-[14px] font-medium text-[#141413]">
                {filterQuery ? 'No matching transcript segments' : 'Ready to transcribe'}
              </p>
              <p className="text-[13px] text-[#8E8E8A] mt-1 max-w-sm leading-relaxed">
                {filterQuery
                  ? 'Try a different keyword or clear the search filter.'
                  : 'Click Start Lecture below, share a browser tab, or drop an audio file anywhere on this page.'}
              </p>
              {!filterQuery && !isBusy && onPlaySample && (
                <button
                  type="button"
                  onClick={onPlaySample}
                  className="mt-4 h-8 px-3 rounded-[6px] bg-white border border-[#E6E6E3] hover:bg-[#F7F7F5] text-[#5C5C59] hover:text-[#141413] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    play_circle
                  </span>
                  <span>Try Sample Lecture</span>
                </button>
              )}
            </div>
          )}

          {/* Editorial 2-Column Gutter Transcript Feed */}
          <div className="space-y-0.5">
            {filteredSentences.map((s) => {
              const isEditingThis = editingId === s.id
              const isCurrentlyPlaying = activePlayingId === s.id
              const tsLabel = formatShortTime(s.startMs)

              return (
                <article
                  key={s.id}
                  id={`sentence-${s.id}`}
                  onClick={() => {
                    if (!isEditingThis) toggleHighlight(s.id)
                  }}
                  className={`group grid grid-cols-[72px_1fr] gap-4 py-3 px-3 -mx-3 rounded-lg transition-colors duration-150 cursor-pointer select-text relative ${
                    isCurrentlyPlaying
                      ? 'bg-[#F1F1EF]'
                      : s.highlighted
                      ? 'is-starred border-l-2 border-[#D97706] bg-[#FEFCE8]/50 hover:bg-[#FEFCE8]/75'
                      : 'hover:bg-[#F9F9F8]'
                  }`}
                >
                  {/* 72px Left Gutter: Timestamp + Hover/Starred Star Icon */}
                  <div className="flex items-start justify-between pt-[3px] shrink-0">
                    {audioUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          replayAt(s.startMs)
                        }}
                        aria-label={`Replay audio at ${tsLabel}`}
                        title="Click to replay audio"
                        className={`font-mono text-[12px] tabular-nums transition-colors duration-150 cursor-pointer ${
                          isCurrentlyPlaying
                            ? 'text-[#141413] font-medium'
                            : 'text-[#8E8E8A] hover:text-[#141413]'
                        }`}
                      >
                        {tsLabel}
                      </button>
                    ) : (
                      <span className="font-mono text-[12px] tabular-nums text-[#8E8E8A] group-hover:text-[#141413] transition-colors duration-150 select-none">
                        {tsLabel}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleHighlight(s.id)
                      }}
                      aria-label={
                        s.highlighted
                          ? `Unstar segment at ${tsLabel}`
                          : `Star segment at ${tsLabel}`
                      }
                      aria-pressed={s.highlighted}
                      className={`p-0.5 -mt-0.5 rounded transition-opacity duration-150 cursor-pointer ${
                        s.highlighted
                          ? 'opacity-100 text-[#D97706]'
                          : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#8E8E8A] hover:text-[#D97706]'
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[14px]"
                        style={{ fontVariationSettings: s.highlighted ? "'FILL' 1" : "'FILL' 0" }}
                        aria-hidden="true"
                      >
                        star
                      </span>
                    </button>
                  </div>

                  {/* Right Content Column */}
                  <div className="min-w-0 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {(s.speaker || s.edited) && !isEditingThis && (
                        <div className="flex items-center gap-2 mb-0.5">
                          {s.speaker && (
                            <span className="text-[11px] uppercase tracking-wider font-medium text-[#8E8E8A]">
                              {s.speaker}
                            </span>
                          )}
                          {s.edited && (
                            <span className="text-[11px] text-[#8E8E8A] italic">edited</span>
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
                            className="flex-1 bg-white border border-[#141413] rounded-[6px] px-2.5 py-1 text-[15px] text-[#141413] focus:outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={commitEdit}
                              className="h-7 px-2.5 rounded-[6px] bg-[#141413] text-white text-[12px] font-medium hover:bg-[#2A2A28] cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="h-7 px-2.5 rounded-[6px] border border-[#E6E6E3] bg-white text-[#5C5C59] text-[12px] hover:bg-[#F1F1EF] cursor-pointer"
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
                          className="text-[15px] leading-[1.65] text-[#1F1F1E]"
                          title="Click to star · Double-click to edit"
                        >
                          {s.text}
                        </p>
                      )}
                    </div>

                    {/* Subtle Hover Row Actions */}
                    {!isEditingThis && (
                      <div
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 shrink-0 pt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => startEditing(s.id, s.text)}
                          aria-label={`Edit segment at ${tsLabel}`}
                          title="Edit"
                          className="w-6 h-6 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#EBEBE8] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSentence(s.id)}
                          aria-label={`Delete segment at ${tsLabel}`}
                          title="Delete"
                          className="w-6 h-6 rounded-[6px] text-[#8E8E8A] hover:text-[#DC2626] hover:bg-[#F1F1EF] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}

            {/* In-Line Live Speech Streaming Gutter Row */}
            {(isSpeaking || partialText) && (
              <article className="grid grid-cols-[72px_1fr] gap-4 py-3 px-3 -mx-3 rounded-lg bg-[#FAFAFA] border border-[#E6E6E3]">
                <div className="flex items-center gap-1.5 pt-[3px] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse shrink-0" />
                  <span className="font-mono text-[12px] tabular-nums text-[#5C5C59]">
                    {formatShortTime(liveStartMs)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wider font-medium text-[#DC2626] mb-0.5">
                    Live
                  </span>
                  <p className="text-[15px] leading-[1.65] text-[#141413]">
                    {partialText || (
                      <span className="italic text-[#8E8E8A]">Listening...</span>
                    )}
                    <span className="inline-block w-[2px] h-4 bg-[#141413] ml-1 align-middle animate-pulse" />
                  </p>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Scroll-to-Bottom Pill when scrolled up */}
      {userHasScrolledUp && (
        <button
          type="button"
          onClick={() => {
            setUserHasScrolledUp(false)
            const el = scrollContainerRef.current
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
          }}
          className="absolute bottom-20 right-6 h-7 px-2.5 rounded-full bg-[#141413] text-white text-[11px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.14)] hover:bg-[#2A2A28] inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer z-10"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            arrow_downward
          </span>
          <span>Latest</span>
        </button>
      )}
    </section>
  )
}

export default TranscriptPanel
