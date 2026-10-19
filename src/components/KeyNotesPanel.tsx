import React from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'

export const KeyNotesPanel: React.FC = () => {
  const { sentences, removeHighlight } = useAppStore()
  const highlights = sentences.filter((s) => s.highlighted)

  const scrollToSentence = (id: string) => {
    const el = document.getElementById(`sentence-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Pulse animation effect
      el.classList.add('ring-2', 'ring-blue-400')
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1200)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-[380px] h-[520px] bg-[#0c1322]/50">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1b263b]/70 bg-[#0c1322]/60">
        <h2 className="text-[13px] font-bold tracking-wider text-slate-100 uppercase">
          Highlighted Key Notes
        </h2>
        <span className="text-xs text-amber-400 font-mono font-medium">
          {highlights.length} {highlights.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 focus:outline-none">
        {highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4 space-y-2">
            <span className="text-2xl opacity-60">✨</span>
            <p className="text-sm font-medium text-slate-300">No highlighted notes yet</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Click any sentence on the left transcript while listening to bookmark key lecture takeaways without typing.
            </p>
          </div>
        ) : (
          highlights.map((h) => (
            <div
              key={h.id}
              className="group relative flex flex-col justify-between p-4 rounded-xl bg-[#0b1325] border border-[#1e2c47] hover:border-[#2e4268] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {/* Note sentence text */}
              <p
                onClick={() => scrollToSentence(h.id)}
                title="Click to jump to transcript position"
                className="text-[14px] leading-relaxed text-slate-100 font-normal cursor-pointer hover:text-blue-200 transition-colors"
              >
                {h.text}
              </p>

              {/* Card Footer: Timestamp & Remove button */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#162138]/60">
                <button
                  onClick={() => scrollToSentence(h.id)}
                  title="Click to scroll to this sentence in full transcript"
                  className="font-mono text-xs font-semibold text-[#3b82f6] hover:text-[#60a5fa] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>{formatTimestamp(h.startMs)}</span>
                  <span className="text-[10px] opacity-70">↗</span>
                </button>

                <button
                  onClick={() => removeHighlight(h.id)}
                  title="Remove from key notes (un-highlight)"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
