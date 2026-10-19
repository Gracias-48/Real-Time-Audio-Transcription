import { describe, it, expect } from 'vitest'
import { cleanWhisperText, formatTimestamp, normalizeForWer, finalizeSentence } from './text'

describe('Text processing and Whisper sanitization', () => {
  it('strips Whisper bracketed hallucination markers', () => {
    expect(cleanWhisperText('[BLANK_AUDIO]')).toBe('')
    expect(cleanWhisperText('(coughing) hello world [laughter]')).toBe('hello world')
    expect(cleanWhisperText('♪ background music ♪')).toBe('')
  })

  it('filters repetitive silence hallucinations', () => {
    expect(cleanWhisperText('Thank you.')).toBe('')
    expect(cleanWhisperText('Thanks for watching!')).toBe('')
    expect(cleanWhisperText('Please subscribe.')).toBe('')
  })

  it('collapses pathological word loops', () => {
    expect(cleanWhisperText('the the the the the the lecture')).toBe('the lecture')
  })

  it('formats timestamps properly', () => {
    expect(formatTimestamp(0)).toBe('00:00:00')
    expect(formatTimestamp(12_000)).toBe('00:00:12')
    expect(formatTimestamp(45_000)).toBe('00:00:45')
    expect(formatTimestamp(78_000)).toBe('00:01:18')
    expect(formatTimestamp(3665_000)).toBe('01:01:05')
  })

  it('normalizes text for WER', () => {
    expect(normalizeForWer('Hello, World! It\'s 2026.')).toBe("hello world it's 2026")
    expect(normalizeForWer('  state-of-the-art   ')).toBe('state of the art')
  })

  it('finalizes sentence capitalization and ending punctuation', () => {
    expect(finalizeSentence('today we discuss speech')).toBe('Today we discuss speech.')
    expect(finalizeSentence('already punctuated!')).toBe('Already punctuated!')
  })
})
