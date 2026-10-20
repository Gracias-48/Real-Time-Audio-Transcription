import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'

export const TranscriptPanel: React.FC = () => {
  const {
    sentences,
    toggleHighlight,
    settings,
    resetSession,
    partialText,
    isSpeaking,
    status,
    currentUtteranceStartMs,
    filterQuery,
    setFilterQuery,
  } = useAppStore()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)
  const isListening = status === 'listening'

  // Filter sentences by search query
  const filteredSentences = sentences.filter((s) =>
    filterQuery.trim() === ''
      ? true
      : s.text.toLowerCase().includes(filterQuery.toLowerCase())
  )

  // Auto-scroll to newest sentence / live typing row unless user has scrolled up
  useEffect(() => {
    if (!settings.autoScroll || userHasScrolledUp) return
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [sentences.length, partialText, isSpeaking, userHasScrolledUp, settings.autoScroll])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setUserHasScrolledUp(!isAtBottom)
  }

  const handleResumeAutoScroll = () => {
    setUserHasScrolledUp(false)
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }

  // Calculate live timestamp for active utterance
  const liveTimestampMs =
    currentUtteranceStartMs > 0
      ? currentUtteranceStartMs
      : sentences.length > 0
        ? sentences[sentences.length - 1].startMs + 2000
        : 0

  return (
    <section
      aria-label="Real-time Lecture Transcription"
      className="flex flex-col h-full bg-surface-container-lowest relative overflow-hidden border-r border-[#262626]"
    >
      {/* Panel Header Toolbar */}
      <div className="px-space-md py-space-sm bg-surface-container-low flex flex-wrap items-center justify-between gap-space-sm select-none border-b border-[#262626]">
        <div className="flex items-center gap-space-sm">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 ${
                isListening ? 'bg-primary animate-pulse' : 'bg-outline'
              }`}
            />
            <h2 className="font-sans text-sm font-semibold tracking-tight text-on-surface">
              Live Lecture Feed
            </h2>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 bg-surface-container-high text-primary font-medium tracking-wide">
            <span id="sentence-counter">{sentences.length}</span> SENTENCES
          </span>
          <span className="font-mono text-[11px] px-2 py-0.5 bg-tertiary-container/20 text-tertiary uppercase hidden sm:inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> ASR 16kHz VAD
          </span>
        </div>

        <div className="flex items-center gap-space-xs">
          {/* Quick Filter Search Input */}
          <div className="relative flex items-center bg-surface-container px-2 py-1 border border-[#353534]">
            <span className="material-symbols-outlined text-[16px] text-outline mr-1">search</span>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter speech stream..."
              className="bg-transparent text-on-surface text-xs focus:outline-none w-28 sm:w-44 placeholder:text-outline font-sans"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="text-outline hover:text-on-surface text-xs ml-1"
                type="button"
              >
                ✕
              </button>
            )}
          </div>

          {/* Clear Feed Button */}
          {sentences.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Reset and clear entire lecture transcript session?')) {
                  resetSession()
                }
              }}
              title="Reset active feed display"
              className="px-space-sm py-1 font-mono text-[11px] text-on-surface-variant hover:text-error hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              <span className="hidden md:inline">Clear Feed</span>
            </button>
          )}
        </div>
      </div>

      {/* Feed Context Sub-banner */}
      <div className="px-space-md py-1.5 bg-surface-container flex items-center justify-between text-outline font-mono text-[11px] border-b border-[#262626]">
        <div className="flex items-center gap-2 truncate">
          <span className="text-secondary font-medium">COMP6822001</span>
          <span className="truncate">// Speech Recognition · Real-Time Lecture Transcriber</span>
        </div>
        <div className="flex items-center gap-space-sm shrink-0 font-mono">
          <span className="text-tertiary">GPU SRAM: 18.2MB Cache</span>
          <span className="text-outline-variant">|</span>
          <span>Model: {settings.browserModel}</span>
        </div>
      </div>

      {/* Scrollable Transcript Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        id="transcript-scroll-area"
        className="flex-1 overflow-y-auto px-space-md py-space-md space-y-2 relative scroll-smooth focus:outline-none"
        tabIndex={0}
      >
        {filteredSentences.length === 0 && !isListening ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 text-center px-4 select-none">
            <span className="material-symbols-outlined text-[36px] text-outline opacity-60">
              mic_none
            </span>
            <p className="text-sm font-semibold text-on-surface">Transcript Feed is Empty</p>
            <p className="text-xs text-outline max-w-sm">
              Click &ldquo;Start Recording&rdquo; in the controller bar below to begin live speech recognition.
            </p>
          </div>
        ) : (
          <>
            {filteredSentences.map((s) => {
              const isStarred = s.highlighted

              return (
                <article
                  key={s.id}
                  id={`sentence-${s.id}`}
                  onClick={() => toggleHighlight(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleHighlight(s.id)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isStarred}
                  title={isStarred ? 'Remove star' : 'Star & extract to notes'}
                  className={`transcript-row group flex items-start gap-space-sm p-space-sm transition-all cursor-pointer relative select-text border border-transparent ${
                    isStarred
                      ? 'is-starred bg-secondary/15 hover:bg-secondary/20 shadow-xs'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  {/* Left Highlight Yellow Accent Bar */}
                  {isStarred && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary" />
                  )}

                  {/* Star Trigger Button */}
                  <button
                    className={`star-trigger shrink-0 pt-0.5 hover:scale-110 transition-transform cursor-pointer ${
                      isStarred ? 'text-secondary' : 'text-outline group-hover:text-secondary'
                    }`}
                    type="button"
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ fontVariationSettings: isStarred ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {isStarred ? 'star' : 'star_outline'}
                    </span>
                  </button>

                  {/* Monospace Timestamp */}
                  <span
                    className={`font-mono text-xs shrink-0 pt-0.5 select-none ${
                      isStarred ? 'text-secondary font-semibold' : 'text-outline group-hover:text-primary'
                    }`}
                  >
                    [{formatTimestamp(s.startMs)}]
                  </span>

                  {/* Sentence Body */}
                  <div className="flex-1 min-w-0">
                    {isStarred && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] bg-secondary text-on-secondary px-1.5 py-0.2 font-bold tracking-wider uppercase">
                          Keypoint
                        </span>
                        <span className="font-mono text-[11px] text-secondary-fixed">
                          Takeaway #{s.id.slice(-4)}
                        </span>
                      </div>
                    )}
                    <p
                      className={`text-sm leading-relaxed ${
                        isStarred ? 'text-on-surface font-medium' : 'text-on-surface'
                      }`}
                    >
                      {s.text}
                    </p>
                  </div>

                  <span
                    className={`font-mono text-[11px] shrink-0 ${
                      isStarred
                        ? 'text-secondary font-semibold'
                        : 'text-outline opacity-0 group-hover:opacity-100 transition-opacity'
                    }`}
                  >
                    {isStarred ? 'STARRED' : 'Click to star'}
                  </span>
                </article>
              )
            })}

            {/* In-Line Live Captioning Row (Active Streaming) */}
            {isListening && (
              <div
                id="live-caption-container"
                className="mt-4 p-space-sm bg-surface-container-high transition-all border border-primary/30 shadow-xs"
              >
                {/* Header Strip */}
                <div className="flex items-center justify-between mb-2 pb-1.5 bg-surface-container-highest/60 px-2 py-1">
                  <div className="flex items-center gap-space-xs">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="font-mono text-[11px] uppercase font-semibold text-primary tracking-wider">
                      [LIVE STREAMING]
                    </span>
                    <span className="font-mono text-[11px] text-outline ml-2 font-medium hidden sm:inline">
                      AUDIO CH: 01 (16kHz VAD)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-tertiary">
                      {isSpeaking ? 'Voice Active' : 'Waiting...'}
                    </span>
                    <span className="font-mono text-[11px] text-outline">
                      [{formatTimestamp(liveTimestampMs)}]
                    </span>
                  </div>
                </div>

                {/* Live Text Body */}
                <div className="flex items-start gap-space-sm pl-1">
                  <span className="font-mono text-sm text-primary font-bold pt-0.5 select-none">
                    &gt;&gt;
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface leading-relaxed font-normal">
                      {partialText ? (
                        <>
                          <span>{partialText}</span>
                          <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
                        </>
                      ) : isSpeaking ? (
                        <span className="text-secondary italic flex items-center gap-1.5">
                          <span>Mendengarkan ucapan...</span>
                        </span>
                      ) : (
                        <span className="text-outline italic text-xs">
                          Mikrofon aktif — silakan berbicara, transkripsi real-time langsung diketik di sini...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Auto-Scroll Status Indicator */}
      {userHasScrolledUp && (
        <div className="absolute bottom-10 right-4 z-20 flex items-center gap-2">
          <button
            onClick={handleResumeAutoScroll}
            className="px-space-sm py-1.5 bg-surface-container-highest hover:bg-surface-bright text-on-surface font-mono text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer border border-[#424656]"
            id="autoscroll-toggle-btn"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">
              arrow_downward
            </span>
            <span>Resume Auto-Scroll</span>
          </button>
        </div>
      )}

      {/* Bottom Audio Telemetry Sparkline Strip */}
      <div className="px-space-md py-1.5 bg-surface-container-low flex items-center justify-between text-outline font-mono text-[11px] select-none border-t border-[#262626]">
        <div className="flex items-center gap-3">
          <span className="text-on-surface-variant font-medium">Acoustic Signal:</span>
          {/* Mini Waveform visualization */}
          <svg className="h-3 w-28 text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 100 12">
            <path
              d={
                isSpeaking
                  ? 'M0 6 L8 6 L12 1 L16 11 L20 2 L24 10 L28 0 L32 12 L36 3 L40 9 L44 0 L48 12 L52 2 L56 10 L60 4 L64 8 L68 2 L72 10 L76 5 L80 7 L84 3 L88 9 L92 6 L100 6'
                  : 'M0 6 L100 6'
              }
              stroke="currentColor"
              strokeLinecap="square"
              strokeWidth="1.5"
            />
          </svg>
          <span className="text-tertiary font-mono">
            {isSpeaking ? '-18.4 dBFS' : '-48.0 dBFS'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Status: <strong className="text-on-surface">{isListening ? 'Streaming' : 'Standby'}</strong>
          </span>
          <span className="text-outline-variant">·</span>
          <span>
            Sample Rate: <strong>16,000 Hz</strong>
          </span>
        </div>
      </div>
    </section>
  )
}
