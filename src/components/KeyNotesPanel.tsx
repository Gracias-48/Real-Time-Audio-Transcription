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
      el.classList.add('ring-2', 'ring-secondary')
      setTimeout(() => el.classList.remove('ring-2', 'ring-secondary'), 1600)
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

  return (
    <aside
      aria-label="Key Takeaways and Highlights"
      className="flex flex-col h-full bg-surface-container-low relative overflow-hidden"
    >
      {/* Panel Header */}
      <div className="px-space-md py-space-sm bg-surface-container flex items-center justify-between gap-space-sm select-none border-b border-[#262626]">
        <div className="flex items-center gap-space-xs">
          <span
            className="material-symbols-outlined text-secondary text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            star
          </span>
          <h3 className="font-sans text-sm font-semibold tracking-tight text-on-surface">
            Key Lecture Notes
          </h3>
          <span
            className="font-mono text-xs px-2 py-0.5 bg-secondary-container/20 text-secondary font-semibold"
            id="highlight-pill"
          >
            {highlights.length} {highlights.length === 1 ? 'HIGHLIGHT' : 'HIGHLIGHTS'}
          </span>
        </div>
      </div>

      {/* Quick Metrics Ribbon */}
      <div className="px-space-md py-space-xs bg-surface-container-lowest grid grid-cols-2 gap-2 text-center select-none border-b border-[#262626]">
        <div className="p-1 bg-surface-container-low">
          <div className="font-mono text-base text-secondary font-semibold leading-tight">
            {highlights.length}
          </div>
          <div className="font-mono text-[10px] text-outline uppercase tracking-wider">
            Starred Notes
          </div>
        </div>
        <div className="p-1 bg-surface-container-low">
          <div className="font-mono text-base text-tertiary font-semibold leading-tight">
            {sentences.length > 0 ? formatTimestamp(sentences[sentences.length - 1].startMs) : '00:00'}
          </div>
          <div className="font-mono text-[10px] text-outline uppercase tracking-wider">
            Latest Timestamp
          </div>
        </div>
      </div>

      {/* Highlights Scroll List */}
      <div
        id="highlights-container"
        className="flex-1 overflow-y-auto px-space-md py-space-md space-y-3 focus:outline-none"
        tabIndex={0}
      >
        {highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 space-y-2 select-none">
            <span
              className="material-symbols-outlined text-[32px] text-secondary/60"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bookmark_star
            </span>
            <p className="text-sm font-semibold text-on-surface">No Highlighted Notes Yet</p>
            <p className="text-xs text-outline max-w-xs leading-relaxed">
              Click any sentence or the star icon in the left transcript to immediately pin it here as a key lecture takeaway without typing.
            </p>
          </div>
        ) : (
          highlights.map((h, idx) => (
            <div
              key={h.id}
              className="note-card bg-surface-container hover:bg-surface-container-high p-space-sm transition-all relative group border border-[#2e2e2e]"
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => scrollToSentence(h.id)}
                  className="font-mono text-xs px-2 py-0.5 bg-secondary text-on-secondary font-semibold hover:bg-secondary-fixed-dim transition-colors flex items-center gap-1 cursor-pointer"
                  title="Click to jump to sentence in transcript"
                  type="button"
                >
                  <span>{formatTimestamp(h.startMs)}</span>
                  <span className="material-symbols-outlined text-[12px]">north_east</span>
                </button>

                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-surface-container-highest text-on-surface-variant uppercase font-medium">
                    Note #{idx + 1}
                  </span>
                  <button
                    onClick={() => removeHighlight(h.id)}
                    className="remove-highlight-btn text-outline hover:text-error transition-colors p-0.5 cursor-pointer"
                    title="Remove highlight"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>

              {/* Note text */}
              <p
                onClick={() => scrollToSentence(h.id)}
                className="text-sm text-on-surface leading-relaxed cursor-pointer hover:text-primary transition-colors select-text"
              >
                &ldquo;{h.text}&rdquo;
              </p>

              {/* Card Footer */}
              <div className="mt-2 pt-2 border-t border-[#262626] flex items-center justify-between text-outline font-mono text-[11px]">
                <span>1-Click Bookmark</span>
                <span className="text-secondary font-medium">#KEYNOTE</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Interactive Manual Quick-Note Bar */}
      <div className="p-space-sm bg-surface-container border-t border-[#262626]">
        <form onSubmit={handleAddManual} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="manual-note-input"
              className="font-mono text-[10px] text-outline uppercase tracking-wider font-semibold"
            >
              Quick Manual Note
            </label>
            <span className="font-mono text-[10px] text-secondary">[ENTER] to pin</span>
          </div>
          <div className="flex items-center bg-surface-container-high px-2 py-1 border border-[#353534] focus-within:border-primary">
            <input
              id="manual-note-input"
              type="text"
              value={manualNoteText}
              onChange={(e) => setManualNoteText(e.target.value)}
              placeholder="Add observation or lecture question..."
              className="bg-transparent text-on-surface text-xs focus:outline-none flex-1 placeholder:text-outline font-sans"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-primary text-on-primary font-mono text-xs hover:bg-primary-fixed-dim transition-colors flex items-center shrink-0 cursor-pointer font-medium"
            >
              <span className="material-symbols-outlined text-[14px] mr-0.5">add</span>
              Pin
            </button>
          </div>
        </form>
      </div>

      {/* Export Bottom Bar */}
      <div className="p-space-sm bg-surface-container-lowest flex items-center gap-space-xs border-t border-[#262626]">
        <button
          onClick={onOpenExport}
          className="flex-1 py-2 px-space-sm bg-primary-container text-on-primary-container font-mono text-xs font-semibold hover:bg-inverse-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          <span>Export Notes &amp; Transcript</span>
        </button>

        <button
          onClick={handleCopyAll}
          className="py-2 px-space-sm bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-xs transition-colors flex items-center justify-center gap-1 shrink-0 cursor-pointer border border-[#353534]"
          title="Copy all highlights to clipboard"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">
            {copyFeedback ? 'check' : 'content_copy'}
          </span>
          <span className="hidden sm:inline">{copyFeedback ? 'Copied!' : 'Copy Notes'}</span>
        </button>
      </div>
    </aside>
  )
}
