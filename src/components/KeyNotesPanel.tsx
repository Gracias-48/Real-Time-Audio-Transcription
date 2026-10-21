import React, { useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'

interface KeyNotesPanelProps {
  onOpenExport?: () => void
}

export const KeyNotesPanel: React.FC<KeyNotesPanelProps> = ({ onOpenExport }) => {
  const { sentences, removeHighlight, addManualNote } = useAppStore()
  const [manualNoteText, setManualNoteText] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)

  const highlights = sentences.filter((s) => s.highlighted)

  const scrollToSentence = (id: string) => {
    const el = document.getElementById(`sentence-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-amber-400')
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1600)
    }
  }

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualNoteText.trim()) return
    addManualNote(manualNoteText)
    setManualNoteText('')
  }

  const handleCopyAll = async () => {
    if (highlights.length === 0) return
    const text = highlights
      .map((h) => `[${formatTimestamp(h.startMs)}] ${h.text}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }

  const totalWords = sentences.reduce(
    (acc, s) => acc + s.text.trim().split(/\s+/).filter(Boolean).length,
    0
  )
  const avgWps =
    sentences.length > 0 ? (totalWords / sentences.length).toFixed(1) : '0.0'

  return (
    <aside
      aria-label="Key Takeaways and Highlights"
      className="flex flex-col h-full bg-white rounded-lg border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden"
    >
      {/* Panel Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-[18px]">star</span>
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">
            Key Lecture Notes
          </h3>
          <span
            className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold"
            id="highlight-pill"
          >
            {highlights.length} {highlights.length === 1 ? 'NOTE' : 'NOTES'}
          </span>
        </div>

        {highlights.length > 0 && (
          <button
            onClick={handleCopyAll}
            type="button"
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
            title="Copy all notes to clipboard"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copyFeedback ? 'check' : 'content_copy'}
            </span>
            <span>{copyFeedback ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Quick Metrics Ribbon */}
      <div className="px-4 py-2 bg-slate-50/60 border-b border-gray-100 grid grid-cols-2 gap-2 text-center select-none text-xs">
        <div className="p-1.5 bg-white rounded border border-gray-200/50">
          <div className="font-mono text-xs font-semibold text-slate-900">{totalWords}</div>
          <div className="text-[10px] text-slate-400">Total Words</div>
        </div>
        <div className="p-1.5 bg-white rounded border border-gray-200/50">
          <div className="font-mono text-xs font-semibold text-slate-900">{avgWps}</div>
          <div className="text-[10px] text-slate-400">Avg Words/Sentence</div>
        </div>
      </div>

      {/* Scrollable Highlight List */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-white"
        id="highlights-container"
      >
        {highlights.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 select-none">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[20px]">star_outline</span>
            </div>
            <p className="font-medium text-xs text-slate-700">No highlighted points yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
              Click the star icon next to any sentence in the transcript to pin it as a key study note.
            </p>
          </div>
        ) : (
          highlights.map((h, idx) => (
            <div
              key={h.id}
              className="p-3 rounded-md bg-amber-50/40 border border-amber-200/70 hover:border-amber-300 transition-all flex flex-col gap-1.5 group relative"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wide">
                    Note #{idx + 1}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Jump button */}
                  <button
                    onClick={() => scrollToSentence(h.id)}
                    type="button"
                    className="font-mono text-[10px] text-amber-800 hover:text-blue-600 transition-colors flex items-center gap-0.5 cursor-pointer"
                    title="Jump to sentence in transcript feed"
                  >
                    <span>{formatTimestamp(h.startMs)}</span>
                    <span className="material-symbols-outlined text-[12px]">north_east</span>
                  </button>

                  {/* Remove highlight */}
                  <button
                    onClick={() => removeHighlight(h.id)}
                    type="button"
                    className="text-slate-400 hover:text-rose-600 transition p-0.5"
                    title="Remove highlight"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-800 leading-relaxed font-normal">
                {h.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Manual Quick Note Pin Bar */}
      <form
        onSubmit={handleAddManual}
        className="p-3 bg-slate-50/60 border-t border-gray-100 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[16px] text-slate-400">edit_note</span>
        <input
          type="text"
          value={manualNoteText}
          onChange={(e) => setManualNoteText(e.target.value)}
          placeholder="Pin manual note ([ENTER] to save)..."
          className="flex-1 bg-white border border-gray-200 rounded px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!manualNoteText.trim()}
          className="px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
        >
          Pin
        </button>
      </form>

      {/* Panel Bottom Export Trigger */}
      {highlights.length > 0 && onOpenExport && (
        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {highlights.length} study points
          </span>
          <button
            onClick={onOpenExport}
            type="button"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">file_download</span>
            <span>Export Notes</span>
          </button>
        </div>
      )}
    </aside>
  )
}

export default KeyNotesPanel
