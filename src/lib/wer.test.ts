import { describe, it, expect } from 'vitest'
import { computeWer, analyzeGlossary } from './wer'

describe('Word Error Rate (WER) computation', () => {
  it('handles identical strings (WER = 0)', () => {
    const ref = 'convolutional neural network for speech recognition'
    const hyp = 'Convolutional neural network for speech recognition.'
    const result = computeWer(ref, hyp)
    expect(result.wer).toBe(0)
    expect(result.S).toBe(0)
    expect(result.D).toBe(0)
    expect(result.I).toBe(0)
    expect(result.C).toBe(6)
    expect(result.N).toBe(6)
  })

  it('handles completely disjoint / all-wrong strings', () => {
    const ref = 'cat dog bird'
    const hyp = 'apple orange banana'
    const result = computeWer(ref, hyp)
    expect(result.wer).toBe(1.0)
    expect(result.S).toBe(3)
    expect(result.D).toBe(0)
    expect(result.I).toBe(0)
    expect(result.C).toBe(0)
    expect(result.N).toBe(3)
  })

  it('handles empty reference string gracefully', () => {
    const ref = ''
    const hyp = 'speech recognition'
    const result = computeWer(ref, hyp)
    // 2 insertions against empty reference -> 2 / 1 = 2
    expect(result.I).toBe(2)
    expect(result.N).toBe(0)
  })

  it('handles empty hypothesis string (all deletions)', () => {
    const ref = 'machine learning lecture'
    const hyp = ''
    const result = computeWer(ref, hyp)
    expect(result.wer).toBe(1.0)
    expect(result.D).toBe(3)
    expect(result.S).toBe(0)
    expect(result.I).toBe(0)
    expect(result.N).toBe(3)
  })

  it('correctly calculates mixed substitutions, deletions, and insertions', () => {
    // ref:  the   quick brown fox jumps
    // hyp:  a     quick       fox leaps over
    // S: the->a, D: brown, C: quick, C: fox, S: jumps->leaps, I: over
    const ref = 'the quick brown fox jumps'
    const hyp = 'a quick fox leaps over'
    const result = computeWer(ref, hyp)
    // N = 5
    // Ops:
    // the -> a (S)
    // quick -> quick (C)
    // brown -> deleted (D)
    // fox -> fox (C)
    // jumps -> leaps (S)
    // over -> inserted (I)
    // S=2, D=1, I=1 => total errors = 4. WER = 4/5 = 0.8
    expect(result.N).toBe(5)
    expect(result.S).toBe(2)
    expect(result.D).toBe(1)
    expect(result.I).toBe(1)
    expect(result.C).toBe(2)
    expect(result.wer).toBeCloseTo(0.8, 4)
  })

  it('analyzes technical terms from glossary', () => {
    const ref = 'today we examine backpropagation in convolutional neural networks and latency tradeoffs'
    const hyp = 'today we examine back propagation in convolution networks and latency trade offs'
    const glossary = ['backpropagation', 'convolutional', 'latency', 'hash table']

    const report = analyzeGlossary(ref, hyp, glossary)
    // 'hash table' is not in reference, so excluded
    expect(report.length).toBe(3)

    const backprop = report.find((r) => r.term === 'backpropagation')
    const conv = report.find((r) => r.term === 'convolutional')
    const latency = report.find((r) => r.term === 'latency')

    expect(backprop?.recognized).toBe(false) // mis-transcribed as 'back propagation'
    expect(conv?.recognized).toBe(false) // mis-transcribed as 'convolution'
    expect(latency?.recognized).toBe(true)
  })
})
