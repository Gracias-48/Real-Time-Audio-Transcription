import { describe, it, expect } from 'vitest'
import {
  generateSrtExport,
  generatePrintableHtml,
  generateMarkdownExport,
} from './export'
import { escapeHtml, formatSrtTimestamp, replaceTextOccurrences } from './text'
import { segmentAudioBySilence } from './pipeline'
import type { Sentence, Settings } from './types'

const MOCK_SETTINGS: Settings = {
  engine: 'browser',
  browserModel: 'base',
  pythonModel: 'base',
  language: 'id',
  device: 'auto',
  serverUrl: 'ws://127.0.0.1:8765',
  serverVad: false,
  vadThreshold: 0.35,
  redemptionMs: 700,
  minSpeechMs: 200,
  preSpeechPadMs: 400,
  partialIntervalMs: 800,
  maxUtteranceS: 15,
  glossaryPrompt: 'Istilah: hierarki sosial, algoritma',
  autoScroll: true,
  audioSource: 'mixed',
  micDeviceId: '',
  noiseConditioning: true,
  saveAudioRecording: true,
  summaryTemplate: 'cornell',
}

describe('Pro Exports, Text Replace & Audio Segmentation', () => {
  it('formats SRT timestamps accurately with comma milliseconds', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000')
    expect(formatSrtTimestamp(65_432)).toBe('00:01:05,432')
    expect(formatSrtTimestamp(3_661_005)).toBe('01:01:01,005')
  })

  it('generates valid SRT subtitle cues with speaker prefixes', () => {
    const sentences: Sentence[] = [
      { id: '1', startMs: 1000, text: 'Halo semuanya.', highlighted: false, speaker: 'Lecturer' },
      { id: '2', startMs: 5500, text: 'Hari ini kita bahas Whisper.', highlighted: true, speaker: 'You' },
    ]
    const srt = generateSrtExport(sentences)
    expect(srt).toContain('1\n00:00:01,000 --> ')
    expect(srt).toContain('[Lecturer] Halo semuanya.')
    expect(srt).toContain('2\n00:00:05,500 --> ')
    expect(srt).toContain('[You] Hari ini kita bahas Whisper.')
  })

  it('escapes untrusted HTML in printable PDF study sheet output', () => {
    const sentences: Sentence[] = [
      { id: '1', startMs: 0, text: 'Formula: x < 5 && <script>alert(1)</script>', highlighted: true },
    ]
    expect(escapeHtml('<script>"test"</script>')).toBe('&lt;script&gt;&quot;test&quot;&lt;/script&gt;')
    const html = generatePrintableHtml({
      sessionTitle: 'Lecture <1>',
      exportedAt: '2026-11-19',
      sentences,
      metrics: [],
      settings: MOCK_SETTINGS,
      template: 'cornell',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Lecture &lt;1&gt;')
  })

  it('generates Markdown using the selected study template', () => {
    const sentences: Sentence[] = [
      { id: '1', startMs: 0, text: 'Algoritma adalah langkah sistematis.', highlighted: true },
    ]
    const md = generateMarkdownExport({
      sessionTitle: 'CS101',
      exportedAt: '2026-11-19',
      sentences,
      metrics: [],
      settings: MOCK_SETTINGS,
      template: 'definitions',
    })
    expect(md).toContain('## Key Definitions & Domain Concepts')
    expect(md).toContain('Algoritma adalah langkah sistematis.')
  })

  it('safely replaces literal text occurrences including regex metacharacters', () => {
    const r1 = replaceTextOccurrences('Belajar C++ dan c++ hari ini.', 'c++', 'Rust', false)
    expect(r1.text).toBe('Belajar Rust dan Rust hari ini.')
    expect(r1.count).toBe(2)

    const r2 = replaceTextOccurrences('Belajar C++ dan c++ hari ini.', 'C++', 'Rust', true)
    expect(r2.text).toBe('Belajar Rust dan c++ hari ini.')
    expect(r2.count).toBe(1)
  })

  it('segments audio around silence valleys and skips pure silence', () => {
    const sr = 16000
    // Pure silence returns empty
    expect(segmentAudioBySilence(new Float32Array(sr * 5), sr)).toEqual([])

    // 16s synthetic audio: 5s tone + 1.5s silence + 5s tone
    const pcm = new Float32Array(sr * 12)
    for (let i = 0; i < sr * 5; i++) pcm[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sr)
    for (let i = sr * 6.5; i < sr * 11.5; i++) pcm[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sr)

    const segs = segmentAudioBySilence(pcm, sr, 3, 5, 8)
    expect(segs.length).toBeGreaterThanOrEqual(2)
    expect(segs[0].startMs).toBe(0)
    expect(segs[1].startMs).toBeGreaterThanOrEqual(5000)
  })
})
