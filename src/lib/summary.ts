import type { Sentence, SummaryTemplate } from './types'
import { formatTimestamp, normalizeForWer } from './text'

/** Bilingual English + Indonesian stop words for accurate on-device keyword & sentence scoring. */
const STOP_WORDS = new Set([
  // English stop words
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't",
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  "can't", 'cannot', 'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing', "don't",
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have',
  "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself',
  'him', 'himself', 'his', 'how', "how's", 'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into',
  'is', "isn't", 'it', "it's", 'its', 'itself', "let's", 'me', 'more', 'most', "mustn't", 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', "shan't", 'she', "she'd", "she'll", "she's", 'should',
  "shouldn't", 'so', 'some', 'such', 'than', 'that', "that's", 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're", "they've",
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', "wasn't", 'we', "we'd",
  "we'll", "we're", "we've", 'were', "weren't", 'what', "what's", 'when', "when's", 'where', "where's",
  'which', 'while', 'who', "who's", 'whom', 'why', "why's", 'with', "won't", 'would', "wouldn't", 'you',
  "you'd", "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves', 'just', 'like', 'also',
  // Common spoken English filler words so extracted topics stay meaningful
  'see', 'seen', 'saw', 'finally', 'choices', 'choice', 'actually', 'really', 'basically', 'going', 'gonna',
  'want', 'wanted', 'think', 'know', 'right', 'well', 'okay', 'yeah', 'look', 'looking', 'thing', 'things',
  'something', 'anything', 'everything', 'nothing', 'make', 'made', 'making', 'take', 'taken', 'get', 'got',
  'getting', 'say', 'said', 'saying', 'come', 'came', 'let', 'use', 'used', 'using', 'need', 'needed', 'even',
  'still', 'much', 'many', 'first', 'second', 'third', 'next', 'last', 'now', 'today', 'back', 'around',
  'kind', 'sort', 'lot', 'lots', 'maybe', 'probably', 'already', 'always', 'never', 'often', 'good', 'great',
  'better', 'best', 'little', 'big', 'new', 'old', 'different', 'able', 'sure', 'yes', 'one', 'two', 'three',
  'four', 'five', 'part', 'way', 'time', 'put', 'give', 'tell', 'talk', 'talking', 'mean', 'means', 'feel',
  // Indonesian stop words
  'ada', 'adalah', 'adapun', 'agak', 'agar', 'akan', 'aku', 'amat', 'anda', 'antara', 'apa', 'apabila',
  'apakah', 'apalagi', 'atau', 'awal', 'bagai', 'bagaimana', 'bagi', 'bahkan', 'bahwa', 'baik', 'banyak',
  'baru', 'bawah', 'beberapa', 'begini', 'begitu', 'belum', 'benar', 'berapa', 'berikut', 'bersama',
  'besar', 'betul', 'biasa', 'bila', 'bisa', 'boleh', 'buat', 'bukan', 'bulan', 'cara', 'cukup', 'cuma',
  'dalam', 'dan', 'dapat', 'dari', 'daripada', 'dekat', 'demi', 'demikian', 'dengan', 'depan', 'di',
  'dia', 'diberi', 'dibuat', 'digunakan', 'dilakukan', 'dimana', 'dirinya', 'disini', 'dong', 'dulu',
  'enggak', 'gak', 'gitu', 'guna', 'hal', 'hampir', 'hanya', 'hari', 'harus', 'hendak', 'hingga',
  'ia', 'ialah', 'ibu', 'ikut', 'ingin', 'ini', 'itu', 'jadi', 'jangan', 'jauh', 'jelas', 'jika',
  'jikalau', 'juga', 'jumlah', 'justru', 'kalau', 'kali', 'kami', 'kamu', 'kan', 'kapan', 'karena',
  'kata', 'ke', 'kecil', 'kedua', 'kemudian', 'kenapa', 'kepada', 'ketika', 'khusus', 'kini', 'kira',
  'kita', 'kok', 'kurang', 'lagi', 'lah', 'lain', 'lainnya', 'lalu', 'lama', 'langsung', 'lebih',
  'lewat', 'lima', 'luar', 'macam', 'maka', 'makin', 'malah', 'mampu', 'mana', 'masa', 'masih',
  'masing', 'masuk', 'mau', 'maupun', 'melainkan', 'melalui', 'memang', 'memberi', 'membuat',
  'memiliki', 'mempunyai', 'menjadi', 'menuju', 'menurut', 'mereka', 'merupakan', 'meski', 'meskipun',
  'mungkin', 'nah', 'naik', 'namun', 'nanti', 'nya', 'oleh', 'orang', 'pada', 'padahal', 'pak',
  'paling', 'para', 'pasti', 'per', 'perlu', 'pernah', 'pertama', 'pihak', 'pula', 'pun', 'punya',
  'rata', 'rupanya', 'saat', 'saja', 'saling', 'sama', 'sambil', 'sampai', 'sana', 'sangat', 'satu',
  'saya', 'sebab', 'sebagai', 'sebagian', 'sebaiknya', 'sebelum', 'sebenarnya', 'secara', 'sedang',
  'sedangkan', 'sedikit', 'segala', 'segera', 'sehingga', 'sejak', 'sekali', 'sekarang', 'sekitar',
  'selain', 'selalu', 'selama', 'seluruh', 'semakin', 'sementara', 'semua', 'semula', 'sendiri',
  'seolah', 'seorang', 'sepanjang', 'seperti', 'sering', 'serta', 'sesuai', 'sesuatu', 'setelah',
  'setiap', 'siapa', 'sih', 'sini', 'situ', 'suatu', 'sudah', 'supaya', 'tadi', 'tahu', 'tahun',
  'tak', 'tampa', 'tanpa', 'tapi', 'telah', 'tempat', 'tengah', 'tentang', 'tentu', 'terakhir',
  'terdapat', 'terhadap', 'terjadi', 'terlalu', 'termasuk', 'ternyata', 'tersebut', 'tertentu',
  'terus', 'terutama', 'tetap', 'tetapi', 'tiap', 'tidak', 'tiga', 'toh', 'tuh', 'turut', 'umum',
  'untuk', 'usai', 'utama', 'waktu', 'walau', 'walaupun', 'ya', 'yaitu', 'yakni', 'yang',
])

const DEFINITION_PATTERN =
  /\b(adalah|merupakan|artinya|definisi|didefinisikan|disebut|berfungsi untuk|bertujuan untuk|yaitu|yakni|is defined as|refers to|means that|stands for|consists of|is a type of|is the process)\b/i

const CUE_PHRASE_PATTERN =
  /\b(kesimpulannya|kesimpulan|penting|ingat|catatan|rumus|prinsip|utama|ujian|contohnya|misalnya|kunci|intinya|in conclusion|importantly|remember|key point|key takeaway|therefore|summary|formula|exam|for example)\b/i

export interface ExtractiveSummaryResult {
  summarySentences: Sentence[]
  definitionSentences: Sentence[]
  topKeywords: string[]
  text: string
  highlightCount: number
  totalSentences: number
}

export interface StudyTemplateInfo {
  id: SummaryTemplate
  label: string
  shortDescription: string
}

export const STUDY_TEMPLATES: StudyTemplateInfo[] = [
  {
    id: 'executive',
    label: 'Executive Summary',
    shortDescription: 'Top key topics, chronological takeaways & starred highlights',
  },
  {
    id: 'cornell',
    label: 'Cornell Notes',
    shortDescription: 'Cue keywords & questions paired with timestamped lecture notes',
  },
  {
    id: 'definitions',
    label: 'Key Definitions',
    shortDescription: 'Extracts glossary concepts and definition statements automatically',
  },
  {
    id: 'checklist',
    label: 'Exam Self-Test',
    shortDescription: 'Study review checklist + fill-in-the-blank cloze quiz with answer key',
  },
]

/** Extracts normalized domain glossary terms from the user's glossaryPrompt string. */
export function parseGlossaryTerms(glossaryPrompt: string): string[] {
  if (!glossaryPrompt.trim()) return []
  // Strip instructional prefix before ":" if present (e.g. "Transkripsi perkuliahan... Istilah: a, b, c")
  const colonIdx = glossaryPrompt.lastIndexOf(':')
  const rawList = colonIdx !== -1 ? glossaryPrompt.slice(colonIdx + 1) : glossaryPrompt
  return rawList
    .split(/[,;\n]+/)
    .map((t) => normalizeForWer(t))
    .filter((t) => t.length >= 2)
}

function getInformativeTokens(text: string): string[] {
  return normalizeForWer(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/**
 * Lightweight zero-API local extractive summarizer (100% on-device, zero subscriptions).
 * Combines bilingual (ID + EN) Term Frequency scoring, academic cue-phrase detection,
 * domain glossary boosting, and student highlight weighting.
 */
export function generateExtractiveSummary(
  sentences: Sentence[],
  maxCount: number = 5,
  glossaryPrompt: string = ''
): ExtractiveSummaryResult {
  if (sentences.length === 0) {
    return {
      summarySentences: [],
      definitionSentences: [],
      topKeywords: [],
      text: '',
      highlightCount: 0,
      totalSentences: 0,
    }
  }

  const glossaryTerms = parseGlossaryTerms(glossaryPrompt)

  // 1. Calculate bilingual term frequencies excluding stop words
  const termFrequencies = new Map<string, number>()
  for (const s of sentences) {
    const tokens = getInformativeTokens(s.text)
    for (const w of tokens) {
      termFrequencies.set(w, (termFrequencies.get(w) ?? 0) + 1)
    }
  }

  // Extract top keywords (prioritizing glossary matches + highest frequency terms)
  const sortedKeywords = [...termFrequencies.entries()]
    .sort((a, b) => {
      const aGloss = glossaryTerms.some((g) => g.includes(a[0])) ? 2 : 1
      const bGloss = glossaryTerms.some((g) => g.includes(b[0])) ? 2 : 1
      return b[1] * bGloss - a[1] * aGloss
    })
    .slice(0, 8)
    .map(([word]) => word)

  // 2. Score each sentence with TF + highlight + glossary + academic cue signals
  const definitionSentences: Sentence[] = []
  const scored = sentences.map((s, originalIndex) => {
    const normalized = normalizeForWer(s.text)
    const words = getInformativeTokens(s.text)
    const hasDef = DEFINITION_PATTERN.test(s.text)
    const hasCue = CUE_PHRASE_PATTERN.test(s.text)
    const hasGlossary = glossaryTerms.some((g) => normalized.includes(g))

    if (hasDef || hasGlossary) {
      definitionSentences.push(s)
    }

    if (words.length === 0) {
      return { sentence: s, score: s.highlighted ? 1.5 : 0, originalIndex }
    }

    const rawTf = words.reduce((acc, w) => acc + (termFrequencies.get(w) ?? 0), 0) / words.length
    const highlightBoost = s.highlighted ? 2.5 : 1.0
    const glossaryBoost = hasGlossary ? 1.5 : 1.0
    const cueBoost = hasDef || hasCue ? 1.35 : 1.0

    return {
      sentence: s,
      score: rawTf * highlightBoost * glossaryBoost * cueBoost,
      originalIndex,
    }
  })

  // 3. Pick top N sentences, then re-sort chronologically
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
    definitionSentences: definitionSentences.slice(0, 12),
    topKeywords: sortedKeywords,
    text,
    highlightCount,
    totalSentences: sentences.length,
  }
}

/**
 * Generates structured Markdown study notes using one of 4 deterministic, zero-API templates.
 */
export function generateTemplateSummary(
  sentences: Sentence[],
  template: SummaryTemplate = 'executive',
  glossaryPrompt: string = ''
): string {
  const result = generateExtractiveSummary(sentences, 6, glossaryPrompt)
  const highlights = sentences.filter((s) => s.highlighted)
  const glossaryTerms = parseGlossaryTerms(glossaryPrompt)

  if (sentences.length === 0) {
    return '_No lecture transcript available yet. Record or import audio to generate structured study notes._'
  }

  const keywordChips =
    result.topKeywords.length > 0
      ? result.topKeywords.map((k) => `\`${k}\``).join(' · ')
      : '_None detected_'

  if (template === 'cornell') {
    const lines: string[] = [
      '## Cornell Study Notes',
      '> *Generated 100% locally (deterministic extractive engine — zero API keys or cloud LLMs).*',
      '',
      `**Key Topics:** ${keywordChips}`,
      '',
      '| Cue / Keywords | Timestamped Lecture Notes |',
      '| :--- | :--- |',
    ]

    const notePool =
      highlights.length >= 3 ? highlights : result.summarySentences
    for (const s of notePool) {
      const tokens = getInformativeTokens(s.text)
      const cues = [...new Set(tokens)].slice(0, 3).join(', ') || 'Key Point'
      const star = s.highlighted ? ' ⭐' : ''
      const safeText = s.text.replace(/\|/g, '\\|')
      lines.push(`| **${cues}** | **[${formatTimestamp(s.startMs)}]** ${safeText}${star} |`)
    }

    lines.push('')
    lines.push('### Bottom Synthesis')
    lines.push(result.text || '_Insufficient content for synthesis._')
    return lines.join('\n')
  }

  if (template === 'definitions') {
    const lines: string[] = [
      '## Key Definitions & Domain Concepts',
      '> *Automatically extracted from definition cues and glossary terms (100% offline).*',
      '',
      `**Detected Terms:** ${keywordChips}`,
      '',
    ]

    if (result.definitionSentences.length === 0) {
      lines.push(
        '_No explicit definition sentences ("adalah", "merupakan", "is defined as") or glossary terms were detected in this lecture._'
      )
      lines.push('')
      lines.push('### Closest High-Signal Sentences')
      for (const s of result.summarySentences) {
        lines.push(`- **[${formatTimestamp(s.startMs)}]** ${s.text}`)
      }
    } else {
      for (const s of result.definitionSentences) {
        const norm = normalizeForWer(s.text)
        const matched = glossaryTerms.filter((g) => norm.includes(g))
        const tag = matched.length > 0 ? ` \`${matched.join(', ')}\`` : ''
        const star = s.highlighted ? ' ⭐' : ''
        lines.push(`- **[${formatTimestamp(s.startMs)}]**${tag} ${s.text}${star}`)
      }
    }

    return lines.join('\n')
  }

  if (template === 'checklist') {
    const lines: string[] = [
      '## Exam Review Checklist & Self-Test',
      '> *Deterministic cloze quiz built locally from your top & starred lecture sentences.*',
      '',
      '### Study Checklist',
    ]

    const reviewItems = highlights.length > 0 ? highlights : result.summarySentences
    for (const s of reviewItems) {
      lines.push(`- [ ] **[${formatTimestamp(s.startMs)}]** ${s.text}`)
    }

    lines.push('')
    lines.push('### Fill-in-the-Blank Self-Test')

    const answers: string[] = []
    let qNum = 1
    for (const s of result.summarySentences.slice(0, 5)) {
      // Choose the longest informative word in this sentence that is also a salient term
      const tokens = getInformativeTokens(s.text)
      const targetWord =
        tokens.find((w) => result.topKeywords.includes(w)) ||
        tokens.sort((a, b) => b.length - a.length)[0]
      if (!targetWord) continue
      const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const blanked = s.text.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '__________')
      if (blanked !== s.text) {
        lines.push(`${qNum}. (${formatTimestamp(s.startMs)}) ${blanked}`)
        answers.push(`${qNum}. **${targetWord}**`)
        qNum += 1
      }
    }

    if (answers.length > 0) {
      lines.push('')
      lines.push('### Answer Key')
      lines.push(answers.join(' · '))
    }

    return lines.join('\n')
  }

  // Default: 'executive'
  const lines: string[] = [
    '## Executive Lecture Summary',
    '> *Generated 100% locally on-device (bilingual ID/EN frequency + glossary + highlight weighting, zero API keys).*',
    '',
    `**Key Topics:** ${keywordChips}`,
    `**Coverage:** ${result.summarySentences.length} key points extracted from ${result.totalSentences} sentences (${result.highlightCount} starred)`,
    '',
    '### Chronological Key Points',
  ]

  for (const s of result.summarySentences) {
    const star = s.highlighted ? ' ⭐' : ''
    const speakerTag = s.speaker ? ` *[${s.speaker}]*` : ''
    lines.push(`- **[${formatTimestamp(s.startMs)}]**${speakerTag} ${s.text}${star}`)
  }

  return lines.join('\n')
}
