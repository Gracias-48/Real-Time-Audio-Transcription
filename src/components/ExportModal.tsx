import React, { useState } from 'react'
import { useAppStore } from '../lib/store'
import { generateMarkdownExport, generateJsonExport, downloadFile } from '../lib/export'
import { generateExtractiveSummary } from '../lib/summary'
import { formatTimestamp } from '../lib/text'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { sentences, metrics, settings, currentSessionTitle, currentSessionId } = useAppStore()
  const [activeTab, setActiveTab] = useState<'markdown' | 'json' | 'summary'>('markdown')
  const [copied, setCopied] = useState(false)

  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeHighlights, setIncludeHighlights] = useState(true)
  const [includeTranscript, setIncludeTranscript] = useState(true)

  if (!isOpen) return null

  const highlights = sentences.filter((s) => s.highlighted)

  const filteredSentences = sentences.filter((s) => {
    if (s.highlighted && !includeHighlights && !includeTranscript) return false
    if (!s.highlighted && !includeTranscript) return false
    return true
  })

  const payload = {
    sessionTitle: currentSessionTitle || 'Lecture Transcription Session',
    exportedAt: new Date().toLocaleString(),
    sentences: filteredSentences,
    metrics: includeMetadata ? metrics : [],
    settings,
  }

  const markdownContent = generateMarkdownExport(payload)
  const jsonContent = generateJsonExport(payload)
  const summary = generateExtractiveSummary(filteredSentences)

  const previewContent =
    activeTab === 'markdown'
      ? markdownContent
      : activeTab === 'json'
      ? jsonContent
      : `# Automatic Extractive Summary\n\n${summary.text}\n\n---\nKey Sentences:\n${summary.summarySentences
          .map((s) => `- [${formatTimestamp(s.startMs)}] ${s.text}`)
          .join('\n')}`

  const handleDownload = () => {
    if (activeTab === 'markdown') {
      downloadFile(markdownContent, `${currentSessionId}-transcript.md`, 'text/markdown')
    } else if (activeTab === 'json') {
      downloadFile(jsonContent, `${currentSessionId}-session.json`, 'application/json')
    } else {
      downloadFile(previewContent, `${currentSessionId}-summary.md`, 'text/markdown')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">file_download</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Export Lecture Notes
              </h3>
              <p className="text-xs text-slate-400">
                Generate study notes &amp; structured data directly on-device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div className="flex p-1 bg-slate-100/70 rounded-md gap-1">
            <button
              onClick={() => setActiveTab('markdown')}
              type="button"
              className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition cursor-pointer ${
                activeTab === 'markdown'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Markdown (.md)
            </button>
            <button
              onClick={() => setActiveTab('json')}
              type="button"
              className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition cursor-pointer ${
                activeTab === 'json'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              JSON (.json)
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              type="button"
              className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Extractive AI Summary
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="px-6 py-3 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTranscript}
              onChange={(e) => setIncludeTranscript(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Full Lecture Transcript</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHighlights}
              onChange={(e) => setIncludeHighlights(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Starred Notes ({highlights.length})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Acoustic Telemetry (Latency / RTF)</span>
          </label>
        </div>

        {/* Code Preview */}
        <div className="px-6 py-2">
          <div className="relative">
            <pre className="p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono max-h-60 overflow-y-auto leading-relaxed border border-slate-800">
              {previewContent}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {filteredSentences.length} sentences · 100% on-device
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              type="button"
              className="h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              type="button"
              className="h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportModal
