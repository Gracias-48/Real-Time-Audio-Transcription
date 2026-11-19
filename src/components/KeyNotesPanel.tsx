import React, { useMemo, useState } from 'react'
import { useAppStore } from '../lib/store'
import { formatTimestamp } from '../lib/text'
import { generateExtractiveSummary, STUDY_TEMPLATES } from '../lib/summary'
import type { SummaryTemplate } from '../lib/types'

interface KeyNotesPanelProps {
  onOpenExport?: () => void
}

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

  const cleanTopics = summary.topKeywords.slice(0, 5)

  const scrollToSentence = (id: string) => {
    const el = document.getElementById(`sentence-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-1', 'ring-[#D97706]')
      setTimeout(() => el.classList.remove('ring-1', 'ring-[#D97706]'), 1400)
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
    setTimeout(() => setCopyFeedback(false), 1800)
  }

  const canCopy =
    activeTab === 'notes' ? highlights.length > 0 : summary.summarySentences.length > 0

  return (
    <aside
      aria-label="Notes and Study Outline Inspector"
      className="hidden md:flex w-[320px] shrink-0 bg-[#FAFAFA] border-l border-[#E6E6E3] flex-col h-full overflow-hidden"
    >
      {/* 44px Header with Clean Underline Tabs */}
      <div className="h-11 px-4 border-b border-[#E6E6E3] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-5 h-full" role="tablist" aria-label="Inspector tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
            className={`relative h-full inline-flex items-center gap-1.5 text-[12px] transition-colors duration-150 cursor-pointer ${
              activeTab === 'notes'
                ? 'text-[#141413] font-medium'
                : 'text-[#8E8E8A] hover:text-[#5C5C59]'
            }`}
          >
            <span>Key Notes</span>
            <span
              id="highlight-pill"
              className="font-mono text-[11px] text-[#8E8E8A] tabular-nums"
            >
              {highlights.length}
            </span>
            {activeTab === 'notes' && (
              <span className="absolute bottom-0 inset-x-0 h-[1.5px] bg-[#141413]" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outline'}
            onClick={() => setActiveTab('outline')}
            className={`relative h-full inline-flex items-center text-[12px] transition-colors duration-150 cursor-pointer ${
              activeTab === 'outline'
                ? 'text-[#141413] font-medium'
                : 'text-[#8E8E8A] hover:text-[#5C5C59]'
            }`}
          >
            <span>Study Outline</span>
            {activeTab === 'outline' && (
              <span className="absolute bottom-0 inset-x-0 h-[1.5px] bg-[#141413]" />
            )}
          </button>
        </div>

        {canCopy && (
          <button
            type="button"
            onClick={() => void handleCopyAll()}
            title="Copy all notes"
            aria-label="Copy all notes"
            className="h-6 px-1.5 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#EBEBE8] inline-flex items-center gap-1 text-[11px] transition-colors duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              {copyFeedback ? 'check' : 'content_copy'}
            </span>
            {copyFeedback && <span>Copied</span>}
          </button>
        )}
      </div>

      {/* Quiet Optional Topics Row (hidden cleanly if fewer than 2 meaningful topics) */}
      {cleanTopics.length >= 2 && (
        <div className="px-4 py-2.5 border-b border-[#E6E6E3] flex flex-wrap items-center gap-1.5 shrink-0">
          {cleanTopics.map((topic) => {
            const active = filterQuery.toLowerCase() === topic.toLowerCase()
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setFilterQuery(active ? '' : topic)}
                aria-pressed={active}
                title={active ? 'Clear topic filter' : `Filter transcript by "${topic}"`}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors duration-150 cursor-pointer ${
                  active
                    ? 'bg-[#141413] text-white'
                    : 'bg-[#EFEFED] text-[#5C5C59] hover:bg-[#E6E6E3] hover:text-[#141413]'
                }`}
              >
                {topic}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Inspector Body */}
      {activeTab === 'notes' ? (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2" id="highlights-container">
          {highlights.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 select-none">
              <span
                className="material-symbols-outlined text-[18px] text-[#B4B4B0] mb-2"
                aria-hidden="true"
              >
                star_outline
              </span>
              <p className="text-[13px] font-medium text-[#5C5C59]">No starred notes yet</p>
              <p className="text-[12px] text-[#8E8E8A] mt-1 max-w-[220px] leading-relaxed">
                Click any transcript segment or star icon to pin key takeaways here.
              </p>
            </div>
          ) : (
            highlights.map((h, idx) => (
              <div
                key={h.id}
                className="p-3 rounded-[6px] bg-white border border-[#E6E6E3] hover:border-[#D4D4D0] transition-colors duration-150 group"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="material-symbols-outlined text-[13px] text-[#D97706] shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      star
                    </span>
                    <button
                      onClick={() => scrollToSentence(h.id)}
                      type="button"
                      className="font-mono text-[11px] tabular-nums text-[#8E8E8A] hover:text-[#141413] inline-flex items-center gap-0.5 transition-colors duration-150 cursor-pointer"
                      aria-label={`Jump to note #${idx + 1} at ${formatShortTime(h.startMs)}`}
                    >
                      <span>{formatShortTime(h.startMs)}</span>
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                        north_east
                      </span>
                    </button>
                    {h.speaker && (
                      <span className="text-[10px] uppercase tracking-wider text-[#8E8E8A] truncate">
                        · {h.speaker}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeHighlight(h.id)}
                    type="button"
                    aria-label={`Remove starred note #${idx + 1}`}
                    title="Unstar"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#8E8E8A] hover:text-[#141413] p-0.5 rounded transition-opacity duration-150 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>

                <p className="text-[13px] text-[#1F1F1E] leading-[1.55]">{h.text}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* Compact Template Selector */}
          <div className="flex flex-wrap gap-1">
            {STUDY_TEMPLATES.map((tpl) => {
              const selected = (settings.summaryTemplate || 'executive') === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateSettings({ summaryTemplate: tpl.id as SummaryTemplate })}
                  className={`h-6 px-2 rounded-[6px] text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                    selected
                      ? 'bg-[#EBEBE8] text-[#141413]'
                      : 'text-[#5C5C59] hover:bg-[#F1F1EF] hover:text-[#141413]'
                  }`}
                >
                  {tpl.label}
                </button>
              )
            })}
          </div>

          {summary.summarySentences.length === 0 ? (
            <div className="py-16 text-center px-4 select-none">
              <p className="text-[13px] font-medium text-[#5C5C59]">No study outline yet</p>
              <p className="text-[12px] text-[#8E8E8A] mt-1 max-w-[220px] mx-auto leading-relaxed">
                Start a lecture or import audio to generate structured notes automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(settings.summaryTemplate === 'definitions' &&
              summary.definitionSentences.length > 0
                ? summary.definitionSentences
                : summary.summarySentences
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSentence(s.id)}
                  className="w-full text-left p-3 rounded-[6px] bg-white border border-[#E6E6E3] hover:border-[#D4D4D0] transition-colors duration-150 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-[#8E8E8A] tabular-nums">
                      {formatShortTime(s.startMs)}
                    </span>
                    {s.highlighted && (
                      <span
                        className="material-symbols-outlined text-[13px] text-[#D97706]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        star
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#1F1F1E] leading-[1.55]">{s.text}</p>
                </button>
              ))}

              {onOpenExport && (
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="w-full h-8 mt-1 rounded-[6px] bg-white border border-[#E6E6E3] hover:bg-[#F1F1EF] text-[#141413] text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px] text-[#5C5C59]" aria-hidden="true">
                    ios_share
                  </span>
                  <span>Export Markdown / PDF / SRT</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom Quick Note Composer */}
      <form
        onSubmit={handleAddManual}
        className="p-3 border-t border-[#E6E6E3] bg-[#FAFAFA] shrink-0"
      >
        <div className="bg-white border border-[#E6E6E3] focus-within:border-[#141413] rounded-lg px-3 py-1.5 flex items-center gap-2 transition-colors duration-150">
          <input
            type="text"
            value={manualNoteText}
            onChange={(e) => setManualNoteText(e.target.value)}
            placeholder="Add a note..."
            aria-label="Add a quick note"
            className="flex-1 bg-transparent text-[13px] text-[#141413] placeholder:text-[#8E8E8A] focus:outline-none min-w-0"
          />
          <button
            type="submit"
            disabled={!manualNoteText.trim()}
            aria-label="Pin note"
            title="Pin note (Enter)"
            className={`w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-150 ${
              manualNoteText.trim()
                ? 'bg-[#141413] text-white hover:bg-[#2A2A28] cursor-pointer'
                : 'bg-[#F1F1EF] text-[#B4B4B0] cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              arrow_upward
            </span>
          </button>
        </div>
      </form>
    </aside>
  )
}

export default KeyNotesPanel
