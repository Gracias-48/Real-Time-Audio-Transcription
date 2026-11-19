import type { Sentence, UtteranceMetric, Settings, SummaryTemplate } from './types'
import { escapeHtml, formatSrtTimestamp, formatTimestamp } from './text'
import { generateExtractiveSummary, generateTemplateSummary, STUDY_TEMPLATES } from './summary'

export interface ExportDataPayload {
  sessionTitle: string
  exportedAt: string
  sentences: Sentence[]
  metrics: UtteranceMetric[]
  settings: Settings
  template?: SummaryTemplate
}

/**
 * Generates formatted Markdown string of the session with the chosen deterministic study template.
 */
export function generateMarkdownExport(payload: ExportDataPayload): string {
  const { sessionTitle, exportedAt, sentences, settings } = payload
  const template: SummaryTemplate = payload.template || settings.summaryTemplate || 'executive'
  const highlights = sentences.filter((s) => s.highlighted)
  const templateSection = generateTemplateSummary(sentences, template, settings.glossaryPrompt)

  const lines: string[] = []
  lines.push(`# ${sessionTitle || 'Lecture Transcription'}`)
  lines.push(`*Generated on ${exportedAt}*`)
  lines.push('')
  lines.push(
    `- **Engine:** ${settings.engine} (${settings.engine === 'browser' ? settings.browserModel : settings.pythonModel})`
  )
  lines.push(`- **Language:** ${settings.language.toUpperCase()}`)
  lines.push(`- **Total Sentences:** ${sentences.length}`)
  lines.push(`- **Highlighted Key Points:** ${highlights.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Key Takeaways (Student Highlights)')
  lines.push('')

  if (highlights.length === 0) {
    lines.push('_No key takeaways were manually highlighted during this session._')
  } else {
    for (const h of highlights) {
      const speakerTag = h.speaker ? ` [${h.speaker}]` : ''
      lines.push(`- **[${formatTimestamp(h.startMs)}]**${speakerTag} ⭐ ${h.text}`)
    }
  }

  lines.push('')
  lines.push(templateSection)
  lines.push('')
  lines.push('## Full Auto-Saved Transcript')
  lines.push('')

  if (sentences.length === 0) {
    lines.push('_Empty transcript._')
  } else {
    for (const s of sentences) {
      const star = s.highlighted ? ' ⭐ [KEY NOTE]' : ''
      const speakerTag = s.speaker ? `[${s.speaker}] ` : ''
      const editedTag = s.edited ? ' *(edited)*' : ''
      lines.push(`- **${formatTimestamp(s.startMs)}** | ${speakerTag}${s.text}${editedTag}${star}`)
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
  const summary = generateExtractiveSummary(
    payload.sentences,
    6,
    payload.settings.glossaryPrompt
  )
  const template: SummaryTemplate =
    payload.template || payload.settings.summaryTemplate || 'executive'

  const data = {
    metadata: {
      sessionTitle: payload.sessionTitle,
      exportedAt: payload.exportedAt,
      version: '2.0.0',
      course: 'COMP6822001 Speech Recognition Final Project',
      privacyNote: '100% On-Device Local Inference. Zero external APIs or subscriptions.',
      studyTemplate: template,
    },
    settings: payload.settings,
    summary: {
      template,
      topKeywords: summary.topKeywords,
      text: summary.text,
      sentences: summary.summarySentences.map((s) => ({
        timestamp: formatTimestamp(s.startMs),
        text: s.text,
        highlighted: s.highlighted,
        speaker: s.speaker,
      })),
    },
    highlights: highlights.map((h) => ({
      id: h.id,
      timestamp: formatTimestamp(h.startMs),
      startMs: h.startMs,
      text: h.text,
      speaker: h.speaker,
      highlightedAt: h.highlightedAt,
    })),
    transcript: payload.sentences.map((s) => ({
      id: s.id,
      timestamp: formatTimestamp(s.startMs),
      startMs: s.startMs,
      text: s.text,
      highlighted: s.highlighted,
      speaker: s.speaker,
      edited: Boolean(s.edited),
    })),
    metrics: payload.metrics,
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Generates industry-standard SubRip (.srt) subtitles for recorded lectures or video editors.
 */
export function generateSrtExport(sentences: Sentence[]): string {
  if (sentences.length === 0) return ''
  const blocks: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    const curr = sentences[i]
    const next = sentences[i + 1]
    const startMs = Math.max(0, curr.startMs)
    // Estimate cue end from next sentence or word-count reading speed (~2.5 words/sec, min 2s, max 12s)
    const words = curr.text.trim().split(/\s+/).filter(Boolean).length
    const estimatedDurMs = Math.min(12000, Math.max(2000, words * 420))
    const endMs =
      next && next.startMs > startMs + 500
        ? Math.min(next.startMs - 100, startMs + estimatedDurMs)
        : startMs + estimatedDurMs

    const prefix = curr.speaker ? `[${curr.speaker}] ` : ''
    blocks.push(
      `${i + 1}\n${formatSrtTimestamp(startMs)} --> ${formatSrtTimestamp(Math.max(startMs + 500, endMs))}\n${prefix}${curr.text}`
    )
  }

  return blocks.join('\n\n') + '\n'
}

/**
 * Builds an XSS-safe, cleanly styled academic HTML study sheet ready for Print / Save as PDF.
 */
export function generatePrintableHtml(payload: ExportDataPayload): string {
  const { sessionTitle, exportedAt, sentences, settings } = payload
  const template: SummaryTemplate = payload.template || settings.summaryTemplate || 'executive'
  const templateInfo = STUDY_TEMPLATES.find((t) => t.id === template) || STUDY_TEMPLATES[0]
  const summary = generateExtractiveSummary(sentences, 6, settings.glossaryPrompt)
  const highlights = sentences.filter((s) => s.highlighted)

  const keywordsHtml = summary.topKeywords
    .map((kw) => `<span class="chip">${escapeHtml(kw)}</span>`)
    .join(' ')

  const highlightsHtml =
    highlights.length === 0
      ? '<p class="muted">No starred highlights recorded in this session.</p>'
      : `<ul>${highlights
          .map(
            (h) =>
              `<li><span class="ts">[${escapeHtml(formatTimestamp(h.startMs))}]</span> ${
                h.speaker ? `<span class="spk">${escapeHtml(h.speaker)}</span> ` : ''
              }<strong>${escapeHtml(h.text)}</strong></li>`
          )
          .join('')}</ul>`

  const summaryRowsHtml =
    summary.summarySentences.length === 0
      ? '<p class="muted">Insufficient transcript for summary.</p>'
      : template === 'cornell'
      ? `<table><thead><tr><th scope="col">Cue Keywords</th><th scope="col">Timestamped Study Note</th></tr></thead><tbody>${summary.summarySentences
          .map((s) => {
            const cue = escapeHtml(s.text.split(/\s+/).slice(0, 3).join(' '))
            return `<tr><td><strong>${cue}…</strong></td><td><span class="ts">[${escapeHtml(
              formatTimestamp(s.startMs)
            )}]</span> ${escapeHtml(s.text)}</td></tr>`
          })
          .join('')}</tbody></table>`
      : `<ul>${summary.summarySentences
          .map(
            (s) =>
              `<li><span class="ts">[${escapeHtml(formatTimestamp(s.startMs))}]</span> ${escapeHtml(
                s.text
              )}</li>`
          )
          .join('')}</ul>`

  const transcriptHtml =
    sentences.length === 0
      ? '<p class="muted">Empty transcript.</p>'
      : sentences
          .map(
            (s) =>
              `<div class="row${s.highlighted ? ' starred' : ''}"><span class="ts">[${escapeHtml(
                formatTimestamp(s.startMs)
              )}]</span> ${
                s.speaker ? `<span class="spk">${escapeHtml(s.speaker)}</span> ` : ''
              }<span>${escapeHtml(s.text)}</span></div>`
          )
          .join('')

  return `<!DOCTYPE html>
<html lang="${escapeHtml(settings.language === 'id' ? 'id' : 'en')}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sessionTitle || 'Lecture Study Sheet')}</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.55; font-size: 11pt; margin: 0; padding: 24px; max-width: 820px; margin-inline: auto; }
    h1 { font-size: 18pt; margin: 0 0 6px; letter-spacing: -0.02em; }
    h2 { font-size: 12.5pt; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    .meta { font-size: 9pt; color: #475569; margin-bottom: 14px; display: flex; flex-wrap: wrap; gap: 14px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
    .chip { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 7px; font-size: 8.5pt; font-family: monospace; color: #334155; }
    .ts { font-family: monospace; color: #2563eb; font-size: 9pt; margin-right: 6px; }
    .spk { font-family: monospace; font-size: 8pt; background: #e2e8f0; color: #334155; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; }
    ul { padding-left: 18px; margin: 6px 0; }
    li { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .row { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
    .row.starred { background: #fffbeb; border-left: 3px solid #d97706; }
    .muted { color: #64748b; font-style: italic; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8.5pt; color: #64748b; }
  </style>
</head>
<body>
  <h1>${escapeHtml(sessionTitle || 'Lecture Transcription Study Sheet')}</h1>
  <div class="meta">
    <span><strong>Date:</strong> ${escapeHtml(exportedAt)}</span>
    <span><strong>Template:</strong> ${escapeHtml(templateInfo.label)}</span>
    <span><strong>Sentences:</strong> ${sentences.length}</span>
    <span><strong>Starred:</strong> ${highlights.length}</span>
    <span><strong>ASR:</strong> Local ${escapeHtml(settings.engine === 'browser' ? settings.browserModel : settings.pythonModel)}</span>
  </div>
  ${keywordsHtml ? `<div class="chips">${keywordsHtml}</div>` : ''}
  <h2>Starred Key Takeaways</h2>
  ${highlightsHtml}
  <h2>${escapeHtml(templateInfo.label)} (100% On-Device)</h2>
  ${summaryRowsHtml}
  <h2>Full Lecture Transcript</h2>
  ${transcriptHtml}
  <div class="footer">Generated 100% locally on-device by TranscribeNote — zero external APIs or cloud transmission.</div>
</body>
</html>`
}

/** Opens a print preview window to save as PDF cleanly (works 100% offline). */
export function printStudySheetPdf(payload: ExportDataPayload): boolean {
  const html = generatePrintableHtml(payload)
  const win = window.open('', '_blank', 'width=900,height=720')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
  }, 250)
  return true
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
