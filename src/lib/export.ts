import type { Sentence, UtteranceMetric, Settings } from './types'
import { formatTimestamp } from './text'
import { generateExtractiveSummary } from './summary'

export interface ExportDataPayload {
  sessionTitle: string
  exportedAt: string
  sentences: Sentence[]
  metrics: UtteranceMetric[]
  settings: Settings
}

/**
 * Generates formatted Markdown string of the session.
 */
export function generateMarkdownExport(payload: ExportDataPayload): string {
  const { sessionTitle, exportedAt, sentences, settings } = payload
  const highlights = sentences.filter((s) => s.highlighted)
  const summary = generateExtractiveSummary(sentences)

  const lines: string[] = []
  lines.push(`# ${sessionTitle || 'Lecture Transcription'}`)
  lines.push(`*Generated on ${exportedAt}*`)
  lines.push('')
  lines.push(`- **Engine:** ${settings.engine} (${settings.engine === 'browser' ? settings.browserModel : settings.pythonModel})`)
  lines.push(`- **Total Sentences:** ${sentences.length}`)
  lines.push(`- **Highlighted Key Points:** ${highlights.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 🌟 Key Takeaways (Student Highlights)')
  lines.push('')

  if (highlights.length === 0) {
    lines.push('_No key takeaways were manually highlighted during this session._')
  } else {
    for (const h of highlights) {
      lines.push(`- **[${formatTimestamp(h.startMs)}]** ⭐ ${h.text}`)
    }
  }

  lines.push('')
  lines.push('## 📝 Automatic Extractive Summary')
  lines.push('> *Note: Generated 100% locally on-device using frequency scoring weighted towards student highlights. No cloud LLMs used.*')
  lines.push('')
  if (!summary.text) {
    lines.push('_Insufficient transcript to generate summary._')
  } else {
    for (const s of summary.summarySentences) {
      lines.push(`- [${formatTimestamp(s.startMs)}] ${s.text}`)
    }
  }

  lines.push('')
  lines.push('## 📜 Full Auto-Saved Transcript')
  lines.push('')

  if (sentences.length === 0) {
    lines.push('_Empty transcript._')
  } else {
    for (const s of sentences) {
      const star = s.highlighted ? ' ⭐ [KEY NOTE]' : ''
      lines.push(`- **${formatTimestamp(s.startMs)}** | ${s.text}${star}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Generates formatted JSON representation of the session.
 */
export function generateJsonExport(payload: ExportDataPayload): string {
  const highlights = payload.sentences.filter((s) => s.highlighted)
  const summary = generateExtractiveSummary(payload.sentences)

  const data = {
    metadata: {
      sessionTitle: payload.sessionTitle,
      exportedAt: payload.exportedAt,
      version: '1.0.0',
      course: 'COMP6822001 Speech Recognition Final Project',
      privacyNote: '100% On-Device Local Inference. Audio never left user hardware.'
    },
    settings: payload.settings,
    summary: {
      text: summary.text,
      sentences: summary.summarySentences.map((s) => ({
        timestamp: formatTimestamp(s.startMs),
        text: s.text,
        highlighted: s.highlighted
      }))
    },
    highlights: highlights.map((h) => ({
      id: h.id,
      timestamp: formatTimestamp(h.startMs),
      startMs: h.startMs,
      text: h.text,
      highlightedAt: h.highlightedAt
    })),
    transcript: payload.sentences.map((s) => ({
      id: s.id,
      timestamp: formatTimestamp(s.startMs),
      startMs: s.startMs,
      text: s.text,
      highlighted: s.highlighted
    })),
    metrics: payload.metrics
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Triggers a browser file download.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
