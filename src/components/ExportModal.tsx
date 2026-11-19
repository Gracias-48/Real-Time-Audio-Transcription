import React, { useId, useState } from 'react'
import { useAppStore } from '../lib/store'
import { useModalDialog } from '../lib/useModalDialog'
import {
  generateMarkdownExport,
  generateJsonExport,
  generateSrtExport,
  printStudySheetPdf,
  downloadFile,
} from '../lib/export'
import { generateTemplateSummary, STUDY_TEMPLATES } from '../lib/summary'
import type { SummaryTemplate } from '../lib/types'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const {
    sentences,
    metrics,
    settings,
    updateSettings,
    currentSessionTitle,
    currentSessionId,
  } = useAppStore()
  const dialogRef = useModalDialog(isOpen, onClose)
  const titleId = useId()

  const [activeTab, setActiveTab] = useState<'markdown' | 'summary' | 'srt' | 'json'>('markdown')
  const [copied, setCopied] = useState(false)
  const [printNotice, setPrintNotice] = useState<string | null>(null)

  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeHighlights, setIncludeHighlights] = useState(true)
  const [includeTranscript, setIncludeTranscript] = useState(true)
  const [exportedAt] = useState(() => new Date().toLocaleString())

  const selectedTemplate: SummaryTemplate = settings.summaryTemplate || 'executive'
  const highlights = sentences.filter((s) => s.highlighted)

  const filteredSentences = sentences.filter((s) => {
    if (s.highlighted && !includeHighlights && !includeTranscript) return false
    if (!s.highlighted && !includeTranscript) return false
    return true
  })

  const payload = {
    sessionTitle: currentSessionTitle || 'Lecture Transcription Session',
    exportedAt,
    sentences: filteredSentences,
    metrics: includeMetadata ? metrics : [],
    settings,
    template: selectedTemplate,
  }

  const markdownContent = generateMarkdownExport(payload)
  const jsonContent = generateJsonExport(payload)
  const srtContent = generateSrtExport(filteredSentences)
  const summaryTemplateContent = generateTemplateSummary(
    filteredSentences,
    selectedTemplate,
    settings.glossaryPrompt
  )

  const previewContent =
    activeTab === 'markdown'
      ? markdownContent
      : activeTab === 'json'
      ? jsonContent
      : activeTab === 'srt'
      ? srtContent || 'No timestamped segments available for SRT export yet.'
      : summaryTemplateContent

  const handleDownload = () => {
    if (activeTab === 'markdown') {
      downloadFile(markdownContent, `${currentSessionId}-${selectedTemplate}.md`, 'text/markdown')
    } else if (activeTab === 'json') {
      downloadFile(jsonContent, `${currentSessionId}-session.json`, 'application/json')
    } else if (activeTab === 'srt') {
      downloadFile(srtContent, `${currentSessionId}-subtitles.srt`, 'application/x-subrip')
    } else {
      downloadFile(
        summaryTemplateContent,
        `${currentSessionId}-${selectedTemplate}-notes.md`,
        'text/markdown'
      )
    }
  }

  const handlePrintPdf = () => {
    const ok = printStudySheetPdf(payload)
    if (!ok) {
      setPrintNotice('Pop-up blocked — allow pop-ups for this site to print or save PDF.')
      setTimeout(() => setPrintNotice(null), 4000)
    }
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(previewContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-modal w-full max-w-2xl"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="bg-white rounded-xl border border-[#E6E6E3] shadow-[0_12px_40px_rgba(0,0,0,0.12)] w-full flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#E6E6E3] flex items-center justify-between">
          <div>
            <h2 id={titleId} className="text-[14px] font-semibold tracking-[-0.01em] text-[#141413]">
              Export Lecture Notes
            </h2>
            <p className="text-[12px] text-[#8E8E8A] mt-0.5">
              Markdown, structured study templates, SRT subtitles, JSON, or printable PDF
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close export dialog"
            className="w-7 h-7 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#F1F1EF] flex items-center justify-center transition-colors duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Study Template Selector */}
          <div className="px-5 pt-4 pb-2">
            <span className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#8E8E8A] mb-2">
              Study Template
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STUDY_TEMPLATES.map((tpl) => {
                const active = selectedTemplate === tpl.id
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateSettings({ summaryTemplate: tpl.id })}
                    className={`p-2.5 rounded-[6px] border text-left transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'bg-[#F7F7F5] border-[#141413] text-[#141413]'
                        : 'bg-white border-[#E6E6E3] hover:bg-[#FAFAFA] text-[#5C5C59]'
                    }`}
                  >
                    <div className="text-[12px] font-medium text-[#141413] truncate">
                      {tpl.label}
                    </div>
                    <div className="text-[11px] text-[#8E8E8A] leading-snug mt-0.5 line-clamp-2">
                      {tpl.shortDescription}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Format Tab Switcher */}
          <div className="px-5 pt-2">
            <div className="flex p-0.5 bg-[#F1F1EF] rounded-[6px] gap-0.5">
              {(
                [
                  { id: 'markdown', label: 'Markdown (.md)' },
                  { id: 'summary', label: 'Study Outline' },
                  { id: 'srt', label: 'Subtitles (.srt)' },
                  { id: 'json', label: 'JSON (.json)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  className={`flex-1 h-7 px-2 rounded-[4px] text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-[#141413] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                      : 'text-[#5C5C59] hover:text-[#141413]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-5 text-[12px] text-[#5C5C59]">
            <label htmlFor="export-inc-transcript" className="flex items-center gap-2 cursor-pointer">
              <input
                id="export-inc-transcript"
                type="checkbox"
                checked={includeTranscript}
                onChange={(e) => setIncludeTranscript(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#E6E6E3] accent-[#141413]"
              />
              <span>Full Transcript</span>
            </label>

            <label htmlFor="export-inc-highlights" className="flex items-center gap-2 cursor-pointer">
              <input
                id="export-inc-highlights"
                type="checkbox"
                checked={includeHighlights}
                onChange={(e) => setIncludeHighlights(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#E6E6E3] accent-[#141413]"
              />
              <span>Starred Notes ({highlights.length})</span>
            </label>

            <label htmlFor="export-inc-meta" className="flex items-center gap-2 cursor-pointer">
              <input
                id="export-inc-meta"
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#E6E6E3] accent-[#141413]"
              />
              <span>Telemetry (Lat / RTF)</span>
            </label>
          </div>

          {/* Preview */}
          <div className="px-5 pb-3">
            <pre className="p-3.5 bg-[#FAFAFA] text-[#1F1F1E] rounded-lg text-[12px] font-mono max-h-56 overflow-y-auto leading-relaxed border border-[#E6E6E3] whitespace-pre-wrap">
              {previewContent}
            </pre>
            {printNotice && (
              <p className="mt-2 text-[12px] text-[#DC2626] font-medium">{printNotice}</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#E6E6E3] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-[#8E8E8A] font-mono tabular-nums">
            {filteredSentences.length} segments
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrintPdf}
              type="button"
              className="h-8 px-3 rounded-[6px] border border-[#E6E6E3] bg-white hover:bg-[#F1F1EF] text-[12px] font-medium text-[#141413] transition-colors duration-150 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-[#5C5C59]" aria-hidden="true">
                picture_as_pdf
              </span>
              <span>Print / PDF</span>
            </button>
            <button
              onClick={handleCopy}
              type="button"
              className="h-8 px-3 rounded-[6px] border border-[#E6E6E3] bg-white hover:bg-[#F1F1EF] text-[12px] font-medium text-[#141413] transition-colors duration-150 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-[#5C5C59]" aria-hidden="true">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              type="button"
              className="h-8 px-3.5 rounded-[6px] bg-[#141413] hover:bg-[#2A2A28] text-white text-[12px] font-medium transition-colors duration-150 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                download
              </span>
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

export default ExportModal
