/** Text utilities: Whisper output cleanup, WER normalisation, timestamp formatting. */

const HALLUCINATIONS = new Set(
  [
    'thank you',
    'thanks for watching',
    'thank you for watching',
    'thank you so much for watching',
    'please subscribe',
    'subtitles by the amara org community',
    'background music',
    'music',
    'you',
    'bye',
    'okay',
  ].map((s) => s),
)

/**
 * Clean raw Whisper output: drop bracketed non-speech tags ([BLANK_AUDIO], (music), *cough*),
 * strip musical symbols (♪, ♫), collapse whitespace, drop silence hallucinations, and collapse runaway repetition loops.
 * Returns '' if nothing meaningful remains.
 */
export function cleanWhisperText(raw: string): string {
  let t = raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/[♪♫♩♬]+/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const key = t.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!key || HALLUCINATIONS.has(key)) return ''
  // "the the the the" -> "the"
  t = t.replace(/\b(\w+)(?:[\s,]+\1\b){3,}/gi, '$1')
  // Same sentence repeated back-to-back ("Hello. Hello. Hello.")
  t = t.replace(/(\b[^.!?]{4,}[.!?])(?:\s*\1){2,}/gi, '$1')
  return t.trim()
}

/** Normalisation used for WER: lowercase, strip punctuation, collapse whitespace. */
export function normalizeForWer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]+/gu, ' ')
    .replace(/(^|\s)['-]+|['-]+(?=\s|$)/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(s: string): string[] {
  const n = normalizeForWer(s)
  return n ? n.split(' ') : []
}

/** ms -> "HH:MM:SS" (as in the mockup). */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/** Capitalise first letter and make sure a committed sentence ends with punctuation. */
export function finalizeSentence(t: string): string {
  const s = t.trim()
  if (!s) return s
  const cap = s.charAt(0).toUpperCase() + s.slice(1)
  return /[.!?…"']$/.test(cap) ? cap : `${cap}.`
}
