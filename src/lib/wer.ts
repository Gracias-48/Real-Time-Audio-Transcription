import { normalizeForWer, tokenize } from './text'

export type AlignOp =
  | { type: 'C'; ref: string; hyp: string }
  | { type: 'S'; ref: string; hyp: string }
  | { type: 'D'; ref: string }
  | { type: 'I'; hyp: string }

export interface WerResult {
  wer: number
  S: number
  D: number
  I: number
  C: number
  N: number
  ops: AlignOp[]
}

// Standard NIST sclite weights to align true word matches:
// 1 Sub (4) is preferred over Del + Ins (3 + 3 = 6),
// but Match (0) + Del (3) + Ins (3) = 6 is preferred over 2 Subs (4 + 4 = 8).
const COST_MATCH = 0
const COST_SUB = 4
const COST_DEL = 3
const COST_INS = 3

/**
 * Word Error Rate = (S + D + I) / N with NIST sclite standard word-level alignment.
 * Text is normalised (lowercase, punctuation stripped, whitespace collapsed) first.
 */
export function computeWer(reference: string, hypothesis: string): WerResult {
  const r = tokenize(reference)
  const h = tokenize(hypothesis)
  const n = r.length
  const m = h.length

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = 0; i <= n; i++) dp[i][0] = i * COST_DEL
  for (let j = 0; j <= m; j++) dp[0][j] = j * COST_INS

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = r[i - 1] === h[j - 1]
      const subCost = match ? COST_MATCH : COST_SUB
      const costSub = dp[i - 1][j - 1] + subCost
      const costDel = dp[i - 1][j] + COST_DEL
      const costIns = dp[i][j - 1] + COST_INS
      dp[i][j] = Math.min(costSub, costDel, costIns)
    }
  }

  // Backtrace
  const ops: AlignOp[] = []
  let i = n
  let j = m

  while (i > 0 || j > 0) {
    const current = dp[i][j]
    const match = i > 0 && j > 0 && r[i - 1] === h[j - 1]

    if (i > 0 && j > 0 && current === dp[i - 1][j - 1] + (match ? COST_MATCH : COST_SUB)) {
      if (match) {
        ops.push({ type: 'C', ref: r[i - 1], hyp: h[j - 1] })
      } else {
        ops.push({ type: 'S', ref: r[i - 1], hyp: h[j - 1] })
      }
      i--
      j--
    } else if (i > 0 && current === dp[i - 1][j] + COST_DEL) {
      ops.push({ type: 'D', ref: r[i - 1] })
      i--
    } else {
      ops.push({ type: 'I', hyp: h[j - 1] })
      j--
    }
  }

  ops.reverse()

  let S = 0
  let D = 0
  let I = 0
  let C = 0

  for (const op of ops) {
    if (op.type === 'S') S++
    else if (op.type === 'D') D++
    else if (op.type === 'I') I++
    else C++
  }

  const wer = (S + D + I) / Math.max(n, 1)

  return { wer, S, D, I, C, N: n, ops }
}

export interface GlossaryReport {
  term: string
  inReference: boolean
  recognized: boolean
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false
  return ` ${haystack} `.includes(` ${phrase} `)
}

/** For every glossary term present in the reference, check whether the hypothesis contains it. */
export function analyzeGlossary(reference: string, hypothesis: string, glossary: string[]): GlossaryReport[] {
  const ref = normalizeForWer(reference)
  const hyp = normalizeForWer(hypothesis)
  return glossary
    .map((t) => normalizeForWer(t))
    .filter(Boolean)
    .map((term) => {
      const inReference = containsPhrase(ref, term)
      return { term, inReference, recognized: inReference && containsPhrase(hyp, term) }
    })
    .filter((g) => g.inReference)
}
