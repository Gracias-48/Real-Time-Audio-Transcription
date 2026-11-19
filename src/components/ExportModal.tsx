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
      ? srtContent || 'No timestamped sentences available for SRT export yet.'
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
      setPrintNotice('Pop-up blocked — allow pop-ups for this site to print/save PDF.')
      setTimeout(() => setPrintNotice(null), 4000)
    }
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(previewContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-modal w-full max-w-2xl"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xl w-full flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                file_download
              </span>
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-semibold tracking-tight text-slate-900">
                Export Study Notes &amp; Subtitles
              </h2>
              <p className="text-xs text-slate-400">
                100% on-device structured templates — zero API keys or subscriptions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close export dialog"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Study Template Selector (Zero-API Deterministic Templates) */}
          <div className="px-6 pt-4 pb-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono mb-2">
              Study Notes Template (Offline Bilingual ID + EN)
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
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      active
                        ? 'bg-blue-50/70 border-blue-500 text-slate-900'
                        : 'bg-white border-gray-200 hover:border-gray-300 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {tpl.label}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                      {tpl.shortDescription}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Format Tab Switcher */}
          <div className="px-6 pt-2">
            <div className="flex p-1 bg-slate-100/70 rounded-md gap-1">
              {(
                [
                  { id: 'markdown', label: 'Markdown (.md)' },
                  { id: 'summary', label: 'Study Template' },
                  { id: 'srt', label: 'Subtitles (.srt)' },
                  { id: 'json', label: 'JSON (.json)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="px-6 py-3 flex flex-wrap items-center gap-5 text-xs text-slate-600">
            <label htmlFor="export-inc-transcript" className="flex items-center gap-2 cursor-pointer">
              <input
                id="export-inc-transcript"
                type="checkbox"
                checked={includeTranscript}
                onChange={(e) => setIncludeTranscript(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Full Lecture Transcript</span>
            </label>

            <label htmlFor="export-inc-highlights" className="flex items-center gap-2 cursor-pointer">
              <input
                id="export-inc-highlights"
                type="checkbox"
                checked={includeHighlights}
                onChange={(e) => setIncludeHighlights(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Starred Notes ({highlights.length})</span>
            </label>

            <label htmlFor="export-inc-meta" className="flex items-center gap-2 cursor-pointer">
              <input
                id="export-inc-meta"
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Acoustic Telemetry (Latency / RTF)</span>
            </label>
          </div>

          {/* Code Preview */}
          <div className="px-6 pb-3">
            <pre className="p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono max-h-56 overflow-y-auto leading-relaxed border border-slate-800 whitespace-pre-wrap">
              {previewContent}
            </pre>
            {printNotice && (
              <p className="mt-2 text-xs text-rose-600 font-medium">{printNotice}</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            {filteredSentences.length} sentences · 100% local
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrintPdf}
              type="button"
              className="h-8 px-3 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Open formatted academic study sheet for Print / Save as PDF"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                picture_as_pdf
              </span>
              <span>Print / PDF</span>
            </button>
            <button
              onClick={handleCopy}
              type="button"
              className="h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              type="button"
              className="h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
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
