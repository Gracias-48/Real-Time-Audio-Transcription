import { describe, it, expect } from 'vitest'
import {
  generateExtractiveSummary,
  generateTemplateSummary,
  parseGlossaryTerms,
} from './summary'
import type { Sentence } from './types'

const SAMPLE_ID_LECTURE: Sentence[] = [
  {
    id: '1',
    startMs: 0,
    text: 'Selamat pagi semuanya, hari ini kita akan membahas tentang pembelajaran mesin.',
    highlighted: false,
    speaker: 'Lecturer',
  },
  {
    id: '2',
    startMs: 6500,
    text: 'Backpropagation adalah algoritma untuk menghitung gradien fungsi kerugian terhadap bobot jaringan saraf.',
    highlighted: true,
    speaker: 'Lecturer',
  },
  {
    id: '3',
    startMs: 14000,
    text: 'Konvolusi merupakan operasi matematis yang mengekstraksi fitur spasial dari spektrogram audio.',
    highlighted: false,
    speaker: 'Lecturer',
  },
  {
    id: '4',
    startMs: 22000,
    text: 'Kesimpulannya, algoritma pembelajaran mesin membutuhkan data yang bersih agar akurasi meningkat.',
    highlighted: true,
    speaker: 'Lecturer',
  },
]

describe('Bilingual Zero-API Study Summary & Templates', () => {
  it('parses glossary terms cleanly after instructional prefixes', () => {
    const terms = parseGlossaryTerms(
      'Transkripsi perkuliahan dalam bahasa Indonesia. Istilah: pembelajaran mesin, algoritma, basis data.'
    )
    expect(terms).toEqual(['pembelajaran mesin', 'algoritma', 'basis data'])
  })

  it('filters Indonesian and English stop words when extracting top keywords', () => {
    const res = generateExtractiveSummary(
      SAMPLE_ID_LECTURE,
      3,
      'Istilah: pembelajaran mesin, algoritma, backpropagation'
    )
    expect(res.topKeywords.length).toBeGreaterThan(0)
    expect(res.topKeywords).not.toContain('yang')
    expect(res.topKeywords).not.toContain('adalah')
    expect(res.topKeywords).not.toContain('untuk')
    expect(res.topKeywords).not.toContain('kita')
    expect(res.definitionSentences.length).toBeGreaterThanOrEqual(2)
  })

  it('generates all 4 deterministic study templates without external APIs', () => {
    const glossary = 'Istilah: pembelajaran mesin, algoritma, backpropagation'

    const exec = generateTemplateSummary(SAMPLE_ID_LECTURE, 'executive', glossary)
    expect(exec).toContain('## Executive Lecture Summary')
    expect(exec).toContain('[00:00:06]')

    const cornell = generateTemplateSummary(SAMPLE_ID_LECTURE, 'cornell', glossary)
    expect(cornell).toContain('## Cornell Study Notes')
    expect(cornell).toContain('| Cue / Keywords | Timestamped Lecture Notes |')

    const defs = generateTemplateSummary(SAMPLE_ID_LECTURE, 'definitions', glossary)
    expect(defs).toContain('## Key Definitions & Domain Concepts')
    expect(defs).toContain('Backpropagation adalah algoritma')

    const quiz = generateTemplateSummary(SAMPLE_ID_LECTURE, 'checklist', glossary)
    expect(quiz).toContain('## Exam Review Checklist & Self-Test')
    expect(quiz).toContain('__________')
    expect(quiz).toContain('### Answer Key')
  })

  it('handles empty transcripts gracefully', () => {
    const empty = generateExtractiveSummary([])
    expect(empty.text).toBe('')
    expect(empty.topKeywords).toEqual([])
    expect(generateTemplateSummary([], 'cornell')).toContain('No lecture transcript')
  })
})
