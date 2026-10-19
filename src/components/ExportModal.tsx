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

  if (!isOpen) return null

  const payload = {
    sessionTitle: 'Speech Recognition & Cognitive Focus Lecture Notes',
    exportedAt: new Date().toLocaleString(),
    sentences,
    metrics,
    settings,
  }

  const markdownContent = generateMarkdownExport(payload)
  const jsonContent = generateJsonExport(payload)
  const summary = generateExtractiveSummary(sentences)

  const handleDownload = () => {
    if (activeTab === 'markdown') {
      downloadFile(markdownContent, `lecture-transcript-${Date.now()}.md`, 'text/markdown')
    } else if (activeTab === 'json') {
      downloadFile(jsonContent, `lecture-session-${Date.now()}.json`, 'application/json')
    } else {
      const summaryMd = `# Automatic Extractive Summary\n\n${summary.text}\n\n---\nKey sentences:\n${summary.summarySentences.map((s) => `- [${formatTimestamp(s.startMs)}] ${s.text}`).join('\n')}`
      downloadFile(summaryMd, `lecture-summary-${Date.now()}.md`, 'text/markdown')
    }
  }

  const handleCopy = () => {
    const textToCopy =
      activeTab === 'markdown' ? markdownContent : activeTab === 'json' ? jsonContent : summary.text
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0b1325] border border-[#1e2d47] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b263b] bg-[#0c1426]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📥</span>
            <h3 className="text-base font-bold text-slate-100">Export Lecture Notes &amp; Data</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 border-b border-[#1b263b]/60 bg-[#090f1d]">
          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'markdown'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Markdown (.md)
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Session JSON (+ Metrics)
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Extractive Summary
          </button>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-slate-300 bg-[#070c17]">
          {activeTab === 'markdown' && (
            <pre className="whitespace-pre-wrap select-all">{markdownContent}</pre>
          )}
          {activeTab === 'json' && (
            <pre className="whitespace-pre-wrap select-all">{jsonContent}</pre>
          )}
          {activeTab === 'summary' && (
            <div className="font-sans space-y-4">
              <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-xl text-blue-200 text-xs leading-relaxed">
                ℹ️ <strong>Automatic Extractive Summary:</strong> Computed 100% locally using word term-frequencies weighted towards student highlights. No external LLM or cloud API was called.
              </div>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-100 text-sm">Key Extract:</h4>
                <p className="text-slate-200 leading-relaxed text-sm">{summary.text || 'No speech data available to summarize.'}</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">Top Weighted Sentences:</h4>
                <ul className="space-y-1.5">
                  {summary.summarySentences.map((s) => (
                    <li key={s.id} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="font-mono text-blue-400">[{formatTimestamp(s.startMs)}]</span>
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1b263b] bg-[#0c1426]">
          <span className="text-xs text-slate-400">
            {sentences.length} sentences · {metrics.length} logged metrics
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleDownload}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
