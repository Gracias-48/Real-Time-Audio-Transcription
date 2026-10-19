import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'

export const TranscriptPanel: React.FC = () => {
  const { sentences, toggleHighlight, settings } = useAppStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)

  // Auto-scroll to newest sentence unless user has scrolled up
  useEffect(() => {
    if (!settings.autoScroll || userHasScrolledUp) return
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [sentences.length, userHasScrolledUp, settings.autoScroll])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setUserHasScrolledUp(!isAtBottom)
  }

  const handleResumeAutoScroll = () => {
    setUserHasScrolledUp(false)
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-[380px] h-[520px] bg-[#0c1322]/50 border-r border-[#1b263b] relative">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1b263b]/70 bg-[#0c1322]/60">
        <h2 className="text-[13px] font-bold tracking-wider text-slate-100 uppercase">
          Full Auto-Saved Transcript
        </h2>
        <span className="text-xs text-slate-400 font-mono">
          {sentences.length} {sentences.length === 1 ? 'sentence' : 'sentences'}
        </span>
      </div>

      {/* Scrollable Sentence List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 focus:outline-none"
        tabIndex={0}
        aria-label="Transcribed sentences list"
      >
        {sentences.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 text-center px-4">
            <svg className="w-8 h-8 text-slate-500 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            <p className="text-sm font-medium text-slate-300">Transcript is empty</p>
            <p className="text-xs text-slate-400">Click &ldquo;Start&rdquo; and speak into your microphone to transcribe in real-time.</p>
          </div>
        ) : (
          sentences.map((s) => {
            const isHighlighted = s.highlighted

            return (
              <div
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
                aria-pressed={isHighlighted}
                title={isHighlighted ? 'Click to un-highlight' : '1-Click to highlight key takeaway'}
                className={`group flex items-start gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer select-none border ${
                  isHighlighted
                    ? 'bg-[#372a0f]/80 hover:bg-[#433313] border-[#ca8a04]/80 text-amber-100 shadow-[0_0_15px_rgba(202,138,4,0.15)] ring-1 ring-amber-500/30'
                    : 'bg-transparent hover:bg-slate-800/40 border-transparent text-slate-200'
                }`}
              >
                {/* Timestamp & Star badge */}
                <div className="flex items-center gap-1.5 font-mono text-[13px] shrink-0 pt-0.5">
                  {isHighlighted ? (
                    <span className="text-amber-400 text-sm leading-none drop-shadow">⭐</span>
                  ) : (
                    <span className="text-slate-500 text-sm leading-none opacity-0 group-hover:opacity-60 transition-opacity">
                      ☆
                    </span>
                  )}
                  <span
                    className={
                      isHighlighted
                        ? 'text-amber-300 font-semibold'
                        : 'text-slate-400 group-hover:text-slate-300 font-medium'
                    }
                  >
                    {formatTimestamp(s.startMs)}
                  </span>
                  <span className="text-slate-600 font-light">|</span>
                </div>

                {/* Sentence text */}
                <p className={`text-[14px] leading-relaxed flex-1 ${isHighlighted ? 'font-medium text-amber-50' : 'text-slate-100'}`}>
                  {s.text}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* Resume auto-scroll button if user scrolled up */}
      {userHasScrolledUp && (
        <button
          onClick={handleResumeAutoScroll}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur-sm border border-blue-400/40 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>↓ Resume auto-scroll</span>
        </button>
      )}
    </div>
  )
}
