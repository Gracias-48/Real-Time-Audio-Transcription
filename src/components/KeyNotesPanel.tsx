import React, { useMemo, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'
import { generateExtractiveSummary, STUDY_TEMPLATES } from '../lib/summary'
import type { SummaryTemplate } from '../lib/types'

interface KeyNotesPanelProps {
  onOpenExport?: () => void
}

export const KeyNotesPanel: React.FC<KeyNotesPanelProps> = ({ onOpenExport }) => {
  const {
    sentences,
    removeHighlight,
    addManualNote,
    settings,
    updateSettings,
    filterQuery,
    setFilterQuery,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<'notes' | 'outline'>('notes')
  const [manualNoteText, setManualNoteText] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)

  const highlights = sentences.filter((s) => s.highlighted)
  const summary = useMemo(
    () => generateExtractiveSummary(sentences, 6, settings.glossaryPrompt),
    [sentences, settings.glossaryPrompt]
  )

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
    setActiveTab('notes')
  }

  const handleCopyAll = async () => {
    const pool = activeTab === 'notes' ? highlights : summary.summarySentences
    if (pool.length === 0) return
    const text = pool.map((h) => `[${formatTimestamp(h.startMs)}] ${h.text}`).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }

  const totalWords = sentences.reduce(
    (acc, s) => acc + s.text.trim().split(/\s+/).filter(Boolean).length,
    0
  )

  return (
    <aside
      aria-label="Key Takeaways and Study Outline"
      className="studio-card flex flex-col h-full rounded-2xl overflow-hidden"
    >
      {/* Clean Segmented Rail Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-2 select-none shrink-0">
        <div
          className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60"
          role="group"
          aria-label="Study panel view"
        >
          <button
            type="button"
            aria-pressed={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] text-amber-500" aria-hidden="true">
              star
            </span>
            <span>Key Notes</span>
            <span
              id="highlight-pill"
              className="font-mono text-[10px] px-1.5 rounded-full bg-amber-100/80 text-amber-800 tabular-nums"
            >
              {highlights.length}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'outline'}
            onClick={() => setActiveTab('outline')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'outline'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] text-blue-600" aria-hidden="true">
              subject
            </span>
            <span>Study Outline</span>
          </button>
        </div>

        {(activeTab === 'notes' ? highlights.length > 0 : summary.summarySentences.length > 0) && (
          <button
            onClick={handleCopyAll}
            type="button"
            className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100 flex items-center gap-1 transition cursor-pointer"
            title="Copy to clipboard"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              {copyFeedback ? 'check' : 'content_copy'}
            </span>
            <span>{copyFeedback ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Live Auto-Detected Bilingual Topics Strip */}
      {summary.topKeywords.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Topics
          </span>
          {summary.topKeywords.slice(0, 6).map((topic) => {
            const active = filterQuery.toLowerCase() === topic.toLowerCase()
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setFilterQuery(active ? '' : topic)}
                aria-pressed={active}
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono transition cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:border-blue-300 hover:text-blue-700'
                }`}
                title={active ? 'Clear topic filter' : `Filter transcript by "${topic}"`}
              >
                #{topic}
              </button>
            )
          })}
        </div>
      )}

      {/* Body Content */}
      {activeTab === 'notes' ? (
        <div
          className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-white"
          id="highlights-container"
        >
          {highlights.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 select-none">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  star_outline
                </span>
              </div>
              <p className="font-semibold text-[13px] text-slate-800">No starred notes yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[230px] leading-relaxed">
                Click any sentence in the transcript to highlight and collect key study points
                without typing.
              </p>
            </div>
          ) : (
            highlights.map((h, idx) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 hover:border-amber-300 transition-all flex flex-col gap-1.5 group relative"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-mono font-bold text-amber-900 uppercase tracking-wide">
                      Note #{idx + 1}
                    </span>
                    {h.speaker && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/80 text-slate-600">
                        {h.speaker}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => scrollToSentence(h.id)}
                      type="button"
                      className="font-mono text-[10px] text-amber-800 hover:text-blue-600 transition-colors flex items-center gap-0.5 cursor-pointer tabular-nums"
                      aria-label={`Jump to note #${idx + 1} at ${formatTimestamp(h.startMs)}`}
                      title="Jump to sentence in transcript"
                    >
                      <span>{formatTimestamp(h.startMs)}</span>
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                        north_east
                      </span>
                    </button>

                    <button
                      onClick={() => removeHighlight(h.id)}
                      type="button"
                      className="text-slate-400 hover:text-rose-600 transition p-0.5 cursor-pointer"
                      aria-label={`Remove highlight #${idx + 1}`}
                      title="Unstar note"
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        close
                      </span>
                    </button>
                  </div>
                </div>

                <p className="text-[13px] text-slate-800 leading-relaxed">{h.text}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {/* Quick Offline Template Picker */}
          <div className="flex flex-wrap gap-1.5">
            {STUDY_TEMPLATES.map((tpl) => {
              const selected = (settings.summaryTemplate || 'executive') === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateSettings({ summaryTemplate: tpl.id as SummaryTemplate })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {tpl.label}
                </button>
              )
            })}
          </div>

          {summary.summarySentences.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Record or import a lecture to generate an instant on-device study outline (zero API
              keys).
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>
                  {summary.summarySentences.length} key points · {totalWords} words
                </span>
                <span>100% offline</span>
              </div>

              {(settings.summaryTemplate === 'definitions' && summary.definitionSentences.length > 0
                ? summary.definitionSentences
                : summary.summarySentences
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSentence(s.id)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/60 hover:border-blue-200 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-blue-600 font-semibold tabular-nums">
                      [{formatTimestamp(s.startMs)}]
                    </span>
                    {s.highlighted && (
                      <span className="text-[10px] font-mono text-amber-700 bg-amber-100/80 px-1.5 rounded">
                        Starred
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{s.text}</p>
                </button>
              ))}

              {onOpenExport && (
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="w-full mt-2 py-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    picture_as_pdf
                  </span>
                  <span>Export Full Template / PDF / SRT</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Anchored Quick-Pin Manual Note Composer */}
      <form
        onSubmit={handleAddManual}
        className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={manualNoteText}
          onChange={(e) => setManualNoteText(e.target.value)}
          placeholder="Add a quick note (Enter)..."
          aria-label="Add manual study note"
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!manualNoteText.trim()}
          className="h-8 px-3 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer shrink-0"
        >
          Pin
        </button>
      </form>
    </aside>
  )
}

export default KeyNotesPanel
