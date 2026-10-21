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
    currentSessionTitle,
    currentSessionId,
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
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setUserHasScrolledUp(distanceFromBottom > 80)
  }

  const liveStartMs =
    currentUtteranceStartMs > 0
      ? currentUtteranceStartMs
      : sentences.length > 0
      ? (sentences[sentences.length - 1]?.startMs || 0) + 3000
      : 0

  return (
    <section
      aria-label="Real-time Lecture Transcription"
      className="flex flex-col h-full bg-white rounded-lg border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden"
    >
      {/* Panel Header Toolbar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
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

        <div className="flex items-center gap-2">
          {/* Quick Filter Search Input */}
          <div className="relative flex items-center bg-slate-50 border border-gray-200/70 rounded-md px-2 py-1">
            <span className="material-symbols-outlined text-[15px] text-slate-400 mr-1">search</span>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter speech stream..."
              className="bg-transparent text-slate-800 text-xs focus:outline-none w-28 sm:w-44 placeholder:text-slate-400 font-sans"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="text-slate-400 hover:text-slate-600 text-xs ml-1"
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
                if (window.confirm('Reset and archive this lecture session?')) {
                  resetSession()
                }
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset current session"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Feed Context / Sub-banner */}
      <div className="px-4 py-1.5 bg-slate-50/70 border-b border-gray-100 flex items-center justify-between text-slate-500 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="font-mono text-blue-600 font-medium text-[11px]">{currentSessionId}</span>
          <span className="text-gray-300">|</span>
          <span className="truncate font-medium text-slate-700">{currentSessionTitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-400 hidden sm:flex">
          <span className="text-emerald-600">Client WebGPU</span>
          <span className="text-gray-300">|</span>
          <span>{settings.language.toUpperCase()}</span>
        </div>
      </div>

      {/* Scrollable Transcript Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 relative scroll-smooth bg-white"
        id="transcript-scroll-area"
      >
        {filteredSentences.length === 0 && !partialText && !isSpeaking && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 select-none">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">mic_none</span>
            </div>
            <p className="font-medium text-sm text-slate-700">Lecture transcription canvas is ready</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
              Click <strong className="text-slate-800">Start Lecture</strong> below and begin speaking.
              Words will appear in real time directly on this feed.
            </p>
          </div>
        )}

        {filteredSentences.map((s) => (
          <article
            key={s.id}
            id={`sentence-${s.id}`}
            onClick={() => toggleHighlight(s.id)}
            className={`group flex items-start gap-3 p-2.5 rounded-md transition-all cursor-pointer select-text relative border ${
              s.highlighted
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
              title={s.highlighted ? 'Remove star from notes' : 'Star & add to notes'}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: s.highlighted ? "'FILL' 1" : "'FILL' 0" }}
              >
                star
              </span>
            </button>

            {/* Monospace Timestamp */}
            <span
              className={`font-mono text-xs shrink-0 pt-0.5 select-none ${
                s.highlighted
                  ? 'text-amber-800 font-semibold'
                  : 'text-slate-400 group-hover:text-primary transition-colors'
              }`}
            >
              [{formatTimestamp(s.startMs)}]
            </span>

            {/* Sentence Content */}
            <div className="flex-1 min-w-0">
              {s.highlighted && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
                    KEYNOTE
                  </span>
                  <span className="text-[10px] text-amber-700 font-mono">
                    STARRED POINT
                  </span>
                </div>
              )}
              <p
                className={`text-sm leading-relaxed ${
                  s.highlighted ? 'text-slate-900 font-medium' : 'text-slate-800'
                }`}
              >
                {s.text}
              </p>
            </div>

            <span className="text-[11px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
              {s.highlighted ? 'Starred' : 'Click to star'}
            </span>
          </article>
        ))}

        {/* In-Line Live Speech Typing Stream Row */}
        {(isSpeaking || partialText) && (
          <article className="flex items-start gap-3 p-2.5 rounded-md bg-blue-50/60 border border-blue-200/60 relative">
            <div className="shrink-0 pt-0.5 text-blue-500">
              <span className="material-symbols-outlined text-[18px] animate-pulse">
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
                <span className="inline-block w-1.5 h-4 ml-1 bg-blue-600 animate-pulse align-middle" />
              </p>
            </div>
          </article>
        )}
      </div>

      {/* Floating Scroll-to-Bottom Pill */}
      {userHasScrolledUp && (
        <div className="p-2 bg-slate-50/90 border-t border-gray-100 flex items-center justify-between text-xs text-slate-500">
          <span>Viewing past lecture transcript</span>
          <button
            onClick={() => {
              setUserHasScrolledUp(false)
              const el = scrollContainerRef.current
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            }}
            type="button"
            className="px-2.5 py-1 rounded bg-white border border-gray-200 text-slate-800 font-medium hover:bg-slate-50 transition shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <span>Resume Auto-Scroll</span>
            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
          </button>
        </div>
      )}
    </section>
  )
}

export default TranscriptPanel
