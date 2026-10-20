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
  const { sentences, metrics, settings } = useAppStore()
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
    sessionTitle: 'Speech Recognition & Lecture Notes Session',
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
      downloadFile(markdownContent, `lecture-transcript-${Date.now()}.md`, 'text/markdown')
    } else if (activeTab === 'json') {
      downloadFile(jsonContent, `lecture-session-${Date.now()}.json`, 'application/json')
    } else {
      downloadFile(previewContent, `lecture-summary-${Date.now()}.md`, 'text/markdown')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-surface-container-lowest/80 backdrop-blur-sm flex items-center justify-center p-space-md overflow-y-auto">
      {/* Modal Container: Carbon Strict Slate Geometry */}
      <div className="relative w-full max-w-4xl bg-surface-container-low shadow-2xl flex flex-col my-auto transition-all border border-[#353534]">
        {/* Modal Header */}
        <div className="p-space-lg bg-surface-container flex items-start justify-between border-b border-[#262626]">
          <div className="flex items-start gap-space-md min-w-0">
            <div className="w-10 h-10 bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 font-bold">
              <span className="material-symbols-outlined text-[24px]">ios_share</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-sm flex-wrap">
                <h2 className="font-sans text-xl font-semibold text-on-surface tracking-tight">
                  Export Lecture Notes &amp; Artifacts
                </h2>
                <span className="font-mono text-[10px] bg-surface-bright text-on-surface-variant px-1.5 py-0.5 uppercase">
                  Ready
                </span>
              </div>
              <p className="text-xs text-on-surface-variant pt-1 truncate font-mono">
                Session: COMP6822001 · {sentences.length} sentences · {highlights.length} key highlights
              </p>
            </div>
          </div>

          {/* Close Action */}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-bright transition-colors shrink-0 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabbed Format Switcher (IBM Carbon Style Tabs) */}
        <div className="flex items-center bg-surface-container-lowest px-space-lg border-b border-[#262626]">
          <button
            onClick={() => setActiveTab('markdown')}
            className={`group relative py-3 px-space-md font-mono text-xs font-semibold flex items-center gap-space-xs transition-colors cursor-pointer ${
              activeTab === 'markdown'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">description</span>
            <span>Markdown (.md)</span>
            {activeTab === 'markdown' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-container"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`group relative py-3 px-space-md font-mono text-xs font-semibold flex items-center gap-space-xs transition-colors cursor-pointer ${
              activeTab === 'json'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">data_object</span>
            <span>Structured JSON (.json)</span>
            {activeTab === 'json' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-container"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`group relative py-3 px-space-md font-mono text-xs font-semibold flex items-center gap-space-xs transition-colors cursor-pointer ${
              activeTab === 'summary'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            <span>Extractive AI Summary</span>
            <span className="font-mono text-[10px] bg-tertiary-container/30 text-tertiary px-1.5 py-0.2 ml-1">
              100% Local TF-IDF
            </span>
            {activeTab === 'summary' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-container"></span>
            )}
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-space-lg flex flex-col gap-space-lg max-h-[calc(85vh-200px)] overflow-y-auto">
          {/* Inclusion Filters */}
          <div className="flex flex-col gap-space-xs">
            <span className="font-mono text-[11px] uppercase tracking-wider text-outline font-semibold">
              Inclusion Filters &amp; Sanitization
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-xs">
              <label className="flex items-center gap-space-sm p-space-sm bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer select-none border border-[#2e2e2e]">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="w-4 h-4 accent-primary-container cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-on-surface font-medium">Session Metadata</span>
                  <span className="text-[11px] text-outline">Latency, RTF, hardware engine</span>
                </div>
              </label>

              <label className="flex items-center gap-space-sm p-space-sm bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer select-none border border-[#2e2e2e]">
                <input
                  type="checkbox"
                  checked={includeHighlights}
                  onChange={(e) => setIncludeHighlights(e.target.checked)}
                  className="w-4 h-4 accent-primary-container cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-on-surface font-medium">Key Takeaways</span>
                  <span className="text-[11px] text-secondary font-mono">{highlights.length} starred items</span>
                </div>
              </label>

              <label className="flex items-center gap-space-sm p-space-sm bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer select-none border border-[#2e2e2e]">
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                  className="w-4 h-4 accent-primary-container cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-on-surface font-medium">Full Transcript</span>
                  <span className="text-[11px] text-outline">{sentences.length} sentences</span>
                </div>
              </label>
            </div>
          </div>

          {/* Artifact Preview Box */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-outline font-semibold">
                Artifact Preview ({activeTab.toUpperCase()})
              </span>
              <div className="flex items-center gap-space-xs font-mono text-[11px] text-outline">
                <span>UTF-8 Encoded · Generated locally</span>
              </div>
            </div>
            <pre className="bg-surface-container-lowest p-space-md font-mono text-xs text-on-surface overflow-x-auto max-h-56 leading-relaxed select-text border border-[#262626]">
              {previewContent}
            </pre>
          </div>

          {/* Security & Local Privacy Banner */}
          <div className="p-space-md bg-tertiary-container/15 flex items-center justify-between flex-wrap gap-space-sm border border-tertiary-container/30">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-tertiary text-[20px]">verified_user</span>
              <div className="flex flex-col">
                <span className="font-mono text-xs text-tertiary font-semibold">
                  Destination: Local Browser File Download
                </span>
                <span className="text-xs text-on-surface-variant">
                  Zero Cloud Retention · 100% On-Device Processing
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-space-md bg-surface-container flex items-center justify-end gap-space-sm border-t border-[#262626]">
          <button
            onClick={onClose}
            className="px-space-md py-2 text-xs font-mono text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={handleCopy}
            className="px-space-md py-2 bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#424656]"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-space-lg py-2 bg-primary-container hover:bg-inverse-primary text-on-primary-container font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download Artifact</span>
          </button>
        </div>
      </div>
    </div>
  )
}
