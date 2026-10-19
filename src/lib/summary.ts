import type { Sentence } from './types'
import { normalizeForWer } from './text'

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s',
  'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you',
  'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
])

export interface ExtractiveSummaryResult {
  summarySentences: Sentence[]
  text: string
  highlightCount: number
  totalSentences: number
}

/**
 * Lightweight local extractive summarizer (no LLM, 100% on-device).
 * Uses Term Frequency (TF) sentence scoring weighted with bonus multiplier for user-highlighted sentences.
 */
export function generateExtractiveSummary(
  sentences: Sentence[],
  maxCount: number = 5
): ExtractiveSummaryResult {
  if (sentences.length === 0) {
    return { summarySentences: [], text: '', highlightCount: 0, totalSentences: 0 }
  }

  // 1. Calculate word frequencies across the whole transcript excluding stop words
  const termFrequencies = new Map<string, number>()
  for (const s of sentences) {
    const tokens = normalizeForWer(s.text).split(' ').filter((w) => w && !STOP_WORDS.has(w))
    for (const w of tokens) {
      termFrequencies.set(w, (termFrequencies.get(w) ?? 0) + 1)
    }
  }

  // 2. Score each sentence: average TF of constituent informative words + bonus if highlighted
  const scored = sentences.map((s, originalIndex) => {
    const words = normalizeForWer(s.text).split(' ').filter((w) => w && !STOP_WORDS.has(w))
    if (words.length === 0) {
      return { sentence: s, score: 0, originalIndex }
    }
    const rawScore = words.reduce((acc, w) => acc + (termFrequencies.get(w) ?? 0), 0) / words.length
    // Boost highlighted sentences by 2.5x to preserve student-selected key takeaways
    const highlightBoost = s.highlighted ? 2.5 : 1.0
    return {
      sentence: s,
      score: rawScore * highlightBoost,
      originalIndex,
    }
  })

  // 3. Pick top N sentences, then re-sort them chronologically by originalIndex
  const targetCount = Math.min(maxCount, sentences.length)
  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount)
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map((item) => item.sentence)

  const text = topSentences.map((s) => s.text).join(' ')
  const highlightCount = sentences.filter((s) => s.highlighted).length

  return {
    summarySentences: topSentences,
    text,
    highlightCount,
    totalSentences: sentences.length,
  }
}
