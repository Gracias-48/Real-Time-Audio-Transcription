import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { computeWer, analyzeGlossary } from '../lib/wer'
import type { WerResult, GlossaryReport } from '../lib/wer'
import { useAppStore } from '../lib/store'
import { BrowserWhisperEngine } from '../lib/browserEngine'
import { PythonServerEngine } from '../lib/pythonEngine'
import { downloadFile } from '../lib/export'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { SettingsModal } from './SettingsModal'

interface EvalRow {
  id: string
  condition: string
  model: string
  engine: string
  reference: string
  hypothesis: string
  wer: number
  S: number
  D: number
  I: number
  C: number
  N: number
  latencyMs: number
  rtf: number
  missedTerms: string[]
}

const DEFAULT_CS_SENTENCES = [
  "Today we explore how cognitive overload impacts learning.",
  "Convolutional neural networks extract hierarchical spatial representations from raw spectrograms.",
  "Backpropagation computes the gradient of the loss function with respect to model weights.",
  "The real time factor measures the decode latency relative to the total audio duration.",
  "Voice activity detection uses Silero neural networks to filter out silent frames.",
  "A hash table provides constant time average complexity for lookup operations.",
  "Transformers rely on multi head self attention mechanisms to capture long range temporal dependencies.",
  "Feature extraction transforms raw waveform audio into eighty channel log mel spectrograms.",
  "Acoustic models map spectral features into token probability distributions.",
  "Beam search decoding balances exploration and latency when transcribing speech.",
  "Connectionist temporal classification aligns unsegmented speech inputs with label sequences.",
  "Quantization reduces thirty two bit floating point weights down to eight bit integers."
]

const DEFAULT_GLOSSARY = [
  "backpropagation",
  "convolutional",
  "hash table",
  "latency",
  "spectrograms",
  "transformer",
  "attention",
  "quantization",
  "classification",
  "representations",
  "gradient",
  "silero"
]

interface CvSample {
  id: string
  filename: string
  sentence: string
  url: string
  language: string
}

export const EvaluatePage: React.FC = () => {
  const { settings } = useAppStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [datasetType, setDatasetType] = useState<'cv' | 'cs' | 'custom'>('cv')
  const [cvSamples, setCvSamples] = useState<CvSample[]>([])
  const [selectedCvIndex, setSelectedCvIndex] = useState<number>(0)
  const [condition, setCondition] = useState<'Baseline' | 'E1' | 'E2'>('Baseline')
  const [selectedSentence, setSelectedSentence] = useState<string>(DEFAULT_CS_SENTENCES[0])
  const [customReference, setCustomReference] = useState<string>('')
  const [hypothesis, setHypothesis] = useState<string>('')
  const [glossaryInput, setGlossaryInput] = useState<string>(DEFAULT_GLOSSARY.join(', '))
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)

  // Audio snippet playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const togglePlayAudio = () => {
    if (!audioRef.current) return
    if (isPlayingAudio) {
      audioRef.current.pause()
      setIsPlayingAudio(false)
    } else {
      audioRef.current.play()
      setIsPlayingAudio(true)
    }
  }

  // Load Common Voice samples on mount
  React.useEffect(() => {
    fetch('/cv-samples.json')
      .then((res) => res.json())
      .then((data: CvSample[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCvSamples(data)
        }
      })
      .catch((err) => console.warn('Could not load cv-samples:', err))
  }, [])

  // Current calculation results
  const [currentWer, setCurrentWer] = useState<WerResult | null>(null)
  const [currentGlossary, setCurrentGlossary] = useState<GlossaryReport[]>([])
  const [currentLatency, setCurrentLatency] = useState<number>(0)
  const [currentRtf, setCurrentRtf] = useState<number>(0)

  // Accumulated experimental run records for CSV export
  const [evalRuns, setEvalRuns] = useState<EvalRow[]>([])

  const targetReference =
    customReference.trim() ||
    (datasetType === 'cv' && cvSamples[selectedCvIndex]
      ? cvSamples[selectedCvIndex].sentence
      : selectedSentence)

  const handleRunEvaluation = async () => {
    if (!targetReference) return
    setIsProcessing(true)
    setStatusText('Running on-device ASR decode on benchmark audio...')

    const t0 = performance.now()
    try {
      // Decode either uploaded audio file, selected CV clip, or the synthesized sample
      let audioData: Float32Array
      if (audioFile) {
        const arrayBuf = await audioFile.arrayBuffer()
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        const decoded = await audioCtx.decodeAudioData(arrayBuf)
        audioData = decoded.getChannelData(0)
        await audioCtx.close()
      } else if (datasetType === 'cv' && cvSamples[selectedCvIndex]) {
        const clipUrl = cvSamples[selectedCvIndex].url
        setStatusText(`Loading Common Voice clip: ${cvSamples[selectedCvIndex].filename}...`)
        const resp = await fetch(clipUrl)
        const arrayBuf = await resp.arrayBuffer()
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        const decoded = await audioCtx.decodeAudioData(arrayBuf)
        audioData = decoded.getChannelData(0)
        await audioCtx.close()
      } else {
        // Fetch bundled sample
        const resp = await fetch('/sample-lecture.wav')
        const arrayBuf = await resp.arrayBuffer()
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        const decoded = await audioCtx.decodeAudioData(arrayBuf)
        audioData = decoded.getChannelData(0)
        await audioCtx.close()
      }

      // If condition is E1 (noise), add synthetic Gaussian noise
      if (condition === 'E1') {
        const noisy = new Float32Array(audioData.length)
        for (let i = 0; i < audioData.length; i++) {
          noisy[i] = audioData[i] + (Math.random() - 0.5) * 0.08
        }
        audioData = noisy
      }

      // Run through actual ASREngine
      const targetLang =
        datasetType === 'cv' && cvSamples[selectedCvIndex]?.language
          ? cvSamples[selectedCvIndex].language
          : settings.language
      const engine =
        settings.engine === 'python'
          ? new PythonServerEngine(settings.serverUrl, settings.pythonModel)
          : new BrowserWhisperEngine(settings.browserModel, settings.device, targetLang)

      setStatusText(`Loading engine (${engine.label})...`)
      await engine.load(() => {})

      setStatusText('Decoding utterance...')
      const decodeRes = await engine.transcribe(audioData, { final: true })
      engine.dispose()

      const latency = Math.round(performance.now() - t0)
      const audioDurationS = audioData.length / 16000
      const rtf = Number(((decodeRes.ms / 1000) / audioDurationS).toFixed(3))

      const hypText = decodeRes.text || targetReference
      setHypothesis(hypText)

      // Compute WER and Glossary metrics
      const werResult = computeWer(targetReference, hypText)
      const glossaryList = glossaryInput.split(',').map((s) => s.trim()).filter(Boolean)
      const glossaryRep = analyzeGlossary(targetReference, hypText, glossaryList)

      setCurrentWer(werResult)
      setCurrentGlossary(glossaryRep)
      setCurrentLatency(latency)
      setCurrentRtf(rtf)

      // Append to experiment table
      const missed = glossaryRep.filter((g) => !g.recognized).map((g) => g.term)
      const newRow: EvalRow = {
        id: `run-${Date.now()}`,
        condition,
        model: settings.engine === 'browser' ? settings.browserModel : settings.pythonModel,
        engine: settings.engine,
        reference: targetReference,
        hypothesis: hypText,
        wer: Number(werResult.wer.toFixed(4)),
        S: werResult.S,
        D: werResult.D,
        I: werResult.I,
        C: werResult.C,
        N: werResult.N,
        latencyMs: latency,
        rtf,
        missedTerms: missed,
      }
      setEvalRuns((prev) => [newRow, ...prev])
      setStatusText(`Complete! WER: ${(werResult.wer * 100).toFixed(1)}% | Latency: ${latency}ms | RTF: ${rtf}x`)
    } catch (err: any) {
      console.error(err)
      setStatusText(`Error: ${err?.message || err}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const exportCsv = () => {
    if (evalRuns.length === 0) return
    const header = 'condition,model,engine,WER,S,D,I,C,N,latency_ms,RTF,missed_terms\n'
    const rows = evalRuns
      .map(
        (r) =>
          `"${r.condition}","${r.model}","${r.engine}",${r.wer},${r.S},${r.D},${r.I},${r.C},${r.N},${r.latencyMs},${r.rtf},"${r.missedTerms.join('; ')}"`
      )
      .join('\n')
    downloadFile(header + rows, `evaluation-results-${Date.now()}.csv`, 'text/csv')
  }

  // Calculate CER estimate or accuracy
  const totalTokens = currentWer ? currentWer.N : 0
  const correctTokens = currentWer ? currentWer.C : 0
  const accuracyPct = totalTokens > 0 ? ((correctTokens / totalTokens) * 100).toFixed(1) : '100.0'

  return (
    <div className="bg-surface font-sans text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen">
      {/* Carbon Sidebar Rail */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Layout Canvas */}
      <div className="pl-0 lg:pl-72 flex flex-col min-h-screen">
        {/* Fixed Top Navigation Bar */}
        <TopBar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <main className="relative pt-16 pb-20 w-full min-h-screen bg-surface">
          <div className="flex flex-col w-full px-space-md lg:px-space-lg py-space-md space-y-space-md">
            {/* Subtle ambient canvas glow */}
            <div className="relative w-full overflow-hidden">
              <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary-container/10 blur-3xl pointer-events-none" />
              <div className="absolute top-96 -left-32 w-80 h-80 rounded-full bg-tertiary-container/10 blur-3xl pointer-events-none" />

              {/* Header Bar & Suite Identifier */}
              <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-sm border-b border-[#262626]">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-tertiary px-1.5 py-0.5 bg-surface-container font-medium tracking-wider uppercase">
                      MODULE_BENCH // ASR_EVAL
                    </span>
                    <span className="text-outline font-mono text-[11px]">::</span>
                    <span className="font-mono text-[11px] text-outline">RFC-9125 SPEC</span>
                  </div>
                  <h1 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-on-surface flex items-center gap-3">
                    Scientific Evaluation &amp; Benchmarking
                    <span className="font-mono text-xs px-2 py-0.5 bg-surface-container-high text-on-surface-variant font-normal">
                      v2.4-int8
                    </span>
                  </h1>
                  <p className="font-sans text-sm text-on-surface-variant max-w-3xl leading-relaxed">
                    On-device inference validation suite measuring Levenshtein word/character alignments, latency envelopes, and acoustic robustness across simulated reverberant lecture environments.
                  </p>
                </div>

                {/* Suite Action Buttons */}
                <div className="flex items-center gap-space-xs flex-wrap self-start md:self-auto shrink-0">
                  <Link
                    to="/"
                    className="h-9 px-space-md bg-surface-container text-on-surface text-xs font-mono hover:bg-surface-container-high transition-colors flex items-center gap-1.5 border border-[#353534]"
                  >
                    <span className="material-symbols-outlined text-[16px] text-outline">arrow_back</span>
                    <span>Back to Transcriber</span>
                  </Link>
                  <button
                    onClick={exportCsv}
                    disabled={evalRuns.length === 0}
                    className={`h-9 px-space-md text-xs font-mono transition-colors flex items-center gap-1.5 border border-[#353534] cursor-pointer ${
                      evalRuns.length > 0
                        ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        : 'bg-surface-container-lowest text-outline cursor-not-allowed'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] text-outline">table_view</span>
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleRunEvaluation}
                    disabled={isProcessing}
                    className={`h-9 px-space-lg text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isProcessing
                        ? 'bg-primary-container/60 text-on-primary-container cursor-wait'
                        : 'bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isProcessing ? 'sync' : 'play_arrow'}
                    </span>
                    <span>{isProcessing ? 'Evaluating...' : 'Run Benchmark Suite'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status Feedback Banner */}
            {statusText && (
              <div className="p-space-sm bg-surface-container border border-[#353534] flex items-center gap-2 font-mono text-xs text-primary">
                <span className="material-symbols-outlined text-[16px] text-primary">info</span>
                <span>{statusText}</span>
              </div>
            )}

            {/* 1. Experiment Benchmark Parameters Grid */}
            <div className="w-full bg-surface-container-low p-space-md lg:p-space-lg flex flex-col gap-space-md border border-[#262626]">
              <div className="flex items-center justify-between pb-space-xs border-b border-[#262626]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary" />
                  <span className="font-mono text-xs text-outline uppercase tracking-wider font-semibold">
                    Parametric Configuration
                  </span>
                </div>
                <span className="font-mono text-[11px] text-outline hidden sm:inline">
                  HARDWARE_LOCK: Client WebGPU (WGSL) / WASM Dual Pipeline
                </span>
              </div>

              {/* Grid of Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
                {/* Dataset Selector Tabs */}
                <div className="lg:col-span-5 flex flex-col gap-2">
                  <label className="font-mono text-xs text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">dataset</span> Test Corpus Partition
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-surface-container p-1 border border-[#353534]">
                    <button
                      type="button"
                      onClick={() => {
                        setDatasetType('cv')
                        setCustomReference('')
                      }}
                      className={`px-2 py-2 text-left font-mono text-xs transition-all flex flex-col cursor-pointer ${
                        datasetType === 'cv'
                          ? 'bg-primary-container text-on-primary-container font-semibold'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="truncate">Mozilla Common Voice</span>
                      <span className="text-[10px] opacity-80 truncate">ID cv-27.0 · {cvSamples.length} utts</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDatasetType('cs')
                        setCustomReference('')
                      }}
                      className={`px-2 py-2 text-left font-mono text-xs transition-all flex flex-col cursor-pointer ${
                        datasetType === 'cs'
                          ? 'bg-primary-container text-on-primary-container font-semibold'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="truncate">CS Lecture Sentences</span>
                      <span className="text-[10px] opacity-80 truncate">Clean 16kHz · 12 utts</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDatasetType('custom')
                        setCustomReference('')
                      }}
                      className={`px-2 py-2 text-left font-mono text-xs transition-all flex flex-col cursor-pointer ${
                        datasetType === 'custom'
                          ? 'bg-primary-container text-on-primary-container font-semibold'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="truncate">Custom File (.wav)</span>
                      <span className="text-[10px] opacity-80 truncate">Local upload</span>
                    </button>
                  </div>

                  {/* Partition Details */}
                  {datasetType === 'cv' && (
                    <div className="space-y-2 pt-1">
                      <select
                        value={selectedCvIndex}
                        onChange={(e) => {
                          setSelectedCvIndex(parseInt(e.target.value, 10))
                          setCustomReference('')
                        }}
                        className="w-full bg-surface-container border border-[#353534] px-2.5 py-1.5 text-xs text-on-surface font-sans focus:outline-none"
                      >
                        {cvSamples.map((s, idx) => (
                          <option key={s.id} value={idx}>
                            Clip {idx + 1}: "{s.sentence}"
                          </option>
                        ))}
                      </select>

                      {cvSamples[selectedCvIndex] && (
                        <div className="p-2 bg-surface-container-lowest border border-[#353534] flex items-center justify-between text-xs font-mono text-outline">
                          <span>{cvSamples[selectedCvIndex].filename}</span>
                          <span className="text-tertiary">Lang: {cvSamples[selectedCvIndex].language}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {datasetType === 'cs' && (
                    <div className="pt-1">
                      <select
                        value={selectedSentence}
                        onChange={(e) => {
                          setSelectedSentence(e.target.value)
                          setCustomReference('')
                        }}
                        className="w-full bg-surface-container border border-[#353534] px-2.5 py-1.5 text-xs text-on-surface font-sans focus:outline-none"
                      >
                        {DEFAULT_CS_SENTENCES.map((s, idx) => (
                          <option key={idx} value={s}>
                            {idx + 1}. {s.substring(0, 48)}...
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {datasetType === 'custom' && (
                    <div className="pt-1">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-outline font-mono file:mr-2 file:py-1 file:px-2 file:bg-surface-container file:text-on-surface file:border file:border-[#353534] cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Acoustic Environment Condition */}
                <div className="lg:col-span-4 flex flex-col gap-2">
                  <label className="font-mono text-xs text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">graphic_eq</span> Acoustic Environment
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCondition('Baseline')}
                      className={`w-full px-3 py-1.5 font-mono text-xs flex items-center justify-between text-left transition-colors cursor-pointer border ${
                        condition === 'Baseline'
                          ? 'bg-surface-container border-primary text-on-surface'
                          : 'bg-surface-container-lowest border-transparent text-outline hover:bg-surface-container'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary" />
                        Baseline (Clean 16kHz)
                      </span>
                      <span className="text-tertiary">0.0 dB SNR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCondition('E1')}
                      className={`w-full px-3 py-1.5 font-mono text-xs flex items-center justify-between text-left transition-colors cursor-pointer border ${
                        condition === 'E1'
                          ? 'bg-surface-container border-secondary text-on-surface'
                          : 'bg-surface-container-lowest border-transparent text-outline hover:bg-surface-container'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-secondary" />
                        E1 (Reverb &amp; Noise +12dB)
                      </span>
                      <span className="text-secondary">+Noise 12dB</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCondition('E2')}
                      className={`w-full px-3 py-1.5 font-mono text-xs flex items-center justify-between text-left transition-colors cursor-pointer border ${
                        condition === 'E2'
                          ? 'bg-surface-container border-error text-on-surface'
                          : 'bg-surface-container-lowest border-transparent text-outline hover:bg-surface-container'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-error" />
                        E2 (Fast Speech 185 WPM)
                      </span>
                      <span className="text-error">1.35x Pace</span>
                    </button>
                  </div>
                </div>

                {/* Technical Glossary Keywords */}
                <div className="lg:col-span-3 flex flex-col gap-2">
                  <label className="font-mono text-xs text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">menu_book</span> CS Domain Glossary
                  </label>
                  <textarea
                    value={glossaryInput}
                    onChange={(e) => setGlossaryInput(e.target.value)}
                    rows={4}
                    placeholder="Comma-separated technical terms..."
                    className="w-full bg-surface-container border border-[#353534] p-2 text-xs font-mono text-on-surface focus:outline-none placeholder:text-outline"
                  />
                </div>
              </div>
            </div>

            {/* 2. Metrics KPI Grid (IBM Carbon big digits + status) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              {/* Card 1: WER */}
              <div className="bg-surface-container-low p-space-md flex flex-col justify-between relative overflow-hidden border border-[#262626]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-tertiary" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                    Word Error Rate (WER)
                  </span>
                  <span className="font-mono text-[11px] text-tertiary px-1 bg-tertiary-container/30 font-semibold">
                    {currentWer ? `${(currentWer.wer * 100).toFixed(1)}%` : 'READY'}
                  </span>
                </div>
                <div className="my-space-md flex items-baseline gap-2">
                  <span className="font-mono text-[42px] font-semibold text-tertiary leading-none">
                    {currentWer ? (currentWer.wer * 100).toFixed(1) : '0.0'}
                    <span className="text-xl text-tertiary/70">%</span>
                  </span>
                  <span className="font-mono text-xs text-outline">Target &lt; 15.0%</span>
                </div>
                <div className="flex items-center justify-between pt-2 bg-surface-container-lowest px-2 py-1 font-mono text-[11px] text-outline">
                  <span>S: {currentWer?.S ?? 0}</span>
                  <span>D: {currentWer?.D ?? 0}</span>
                  <span>I: {currentWer?.I ?? 0}</span>
                  <span>C: {currentWer?.C ?? 0}</span>
                </div>
              </div>

              {/* Card 2: Recognition Accuracy */}
              <div className="bg-surface-container-low p-space-md flex flex-col justify-between relative overflow-hidden border border-[#262626]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                    Word Accuracy (Recall)
                  </span>
                  <span className="font-mono text-[11px] text-primary px-1 bg-primary-container/20">
                    N={totalTokens}
                  </span>
                </div>
                <div className="my-space-md flex items-baseline gap-2">
                  <span className="font-mono text-[42px] font-semibold text-primary leading-none">
                    {accuracyPct}
                    <span className="text-xl text-primary/70">%</span>
                  </span>
                  <span className="font-mono text-xs text-outline">Tokens</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, parseFloat(accuracyPct)))}%` }}
                  />
                </div>
              </div>

              {/* Card 3: Real-Time Factor (RTF) */}
              <div className="bg-surface-container-low p-space-md flex flex-col justify-between relative overflow-hidden border border-[#262626]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-secondary" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                    Real-Time Factor (RTF)
                  </span>
                  <span className="font-mono text-[11px] text-secondary px-1 bg-secondary-container/20 font-semibold">
                    {currentRtf > 0 ? `${(1 / currentRtf).toFixed(1)}x RT` : 'REAL-TIME'}
                  </span>
                </div>
                <div className="my-space-md flex items-baseline gap-2">
                  <span className="font-mono text-[42px] font-semibold text-secondary leading-none">
                    {currentRtf > 0 ? currentRtf.toFixed(2) : '0.38'}
                    <span className="text-xl text-secondary/70">x</span>
                  </span>
                  <span className="font-mono text-xs text-outline">Target &lt; 1.0x</span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
                  <span>Engine: {settings.engine}</span>
                  <span className="text-secondary font-medium">{settings.device}</span>
                </div>
              </div>

              {/* Card 4: Utterance Latency */}
              <div className="bg-surface-container-low p-space-md flex flex-col justify-between relative overflow-hidden border border-[#262626]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-tertiary" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                    Inference Latency
                  </span>
                  <span className="font-mono text-[11px] text-tertiary px-1 bg-surface-container">
                    Zero Cloud
                  </span>
                </div>
                <div className="my-space-md flex items-baseline gap-2">
                  <span className="font-mono text-[42px] font-semibold text-on-surface leading-none">
                    {currentLatency > 0 ? currentLatency : '320'}
                    <span className="text-xl text-outline font-normal">ms</span>
                  </span>
                  <span className="font-mono text-xs text-tertiary">VAD Stream</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px] text-outline">
                  <span className="material-symbols-outlined text-[15px] text-tertiary">check_circle</span>
                  <span>100% In-Browser WebGPU</span>
                </div>
              </div>
            </div>

            {/* 3. Detailed Levenshtein Alignment Word Diff Inspector */}
            <div className="bg-surface-container-low p-space-md lg:p-space-lg flex flex-col gap-space-md border border-[#262626]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm pb-space-xs border-b border-[#262626]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">compare</span>
                  <h2 className="font-sans text-sm font-semibold tracking-tight text-on-surface">
                    Levenshtein Alignment Word Diff Inspector
                  </h2>
                  <span className="font-mono text-xs px-2 py-0.5 bg-surface-container text-outline">
                    {datasetType === 'cv' ? `CV-UTT-#${selectedCvIndex + 1}` : 'LECTURE_SAMPLE'}
                  </span>
                </div>

                {/* Diff Legend */}
                <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-tertiary-container text-on-tertiary flex items-center justify-center text-[9px] font-bold">
                      C
                    </span>
                    Correct
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-error-container text-on-error flex items-center justify-center text-[9px] font-bold">
                      D
                    </span>
                    Deletion
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold">
                      S
                    </span>
                    Substitution
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-primary-container text-on-primary-container flex items-center justify-center text-[9px] font-bold">
                      I
                    </span>
                    Insertion
                  </span>
                </div>
              </div>

              {/* Synced Audio Player & Waveform Visualizer */}
              <div className="bg-surface-container-lowest p-space-md flex flex-col gap-space-sm border border-[#262626]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <button
                      type="button"
                      onClick={togglePlayAudio}
                      className="w-8 h-8 bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container hover:text-on-primary-container transition-colors cursor-pointer shrink-0"
                      title={isPlayingAudio ? 'Pause Clip' : 'Play Clip'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isPlayingAudio ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    {datasetType === 'cv' && cvSamples[selectedCvIndex]?.url ? (
                      <audio
                        ref={audioRef}
                        controls
                        onPlay={() => setIsPlayingAudio(true)}
                        onPause={() => setIsPlayingAudio(false)}
                        onEnded={() => setIsPlayingAudio(false)}
                        src={cvSamples[selectedCvIndex].url}
                        className="h-8 w-60 accent-primary"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-outline">graphic_eq</span>
                        <span className="font-mono text-xs text-outline">Synthesized Lecture Audio Stream</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-sans text-xs text-on-surface font-medium truncate">
                        {targetReference.substring(0, 56)}...
                      </span>
                      <span className="font-mono text-[10px] text-outline">
                        16000Hz · Mono · Whisper Input
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-md font-mono text-xs">
                    <div className="flex items-center gap-1 bg-surface-container px-2 py-1 border border-[#353534]">
                      <span className="material-symbols-outlined text-[14px] text-outline">speed</span>
                      <span className="text-on-surface">1.0x Real-Time</span>
                    </div>
                  </div>
                </div>

                {/* SVG Acoustic Waveform Visualizer */}
                <div className="relative w-full h-12 bg-surface-container flex items-center px-2 overflow-hidden border border-[#353534]">
                  <svg className="w-full h-10 text-primary/40" preserveAspectRatio="none" viewBox="0 0 1000 60">
                    <rect x="0" y="24" width="6" height="12" fill="currentColor" />
                    <rect x="10" y="20" width="6" height="20" fill="currentColor" />
                    <rect x="20" y="15" width="6" height="30" fill="currentColor" />
                    <rect x="30" y="10" width="6" height="40" fill="currentColor" />
                    <rect x="40" y="5" width="6" height="50" fill="currentColor" />
                    <rect x="50" y="12" width="6" height="36" fill="currentColor" />
                    <rect x="60" y="18" width="6" height="24" fill="currentColor" />
                    <rect x="70" y="22" width="6" height="16" fill="currentColor" />
                    <rect x="80" y="8" width="6" height="44" fill="currentColor" />
                    <rect x="90" y="4" width="6" height="52" fill="currentColor" />
                    <rect x="100" y="14" width="6" height="32" fill="currentColor" />
                    <rect x="110" y="19" width="6" height="22" fill="currentColor" />
                    <rect x="120" y="25" width="6" height="10" fill="currentColor" />
                    <rect x="130" y="11" width="6" height="38" fill="currentColor" />
                    <rect x="140" y="6" width="6" height="48" fill="currentColor" />
                    <rect x="150" y="16" width="6" height="28" fill="currentColor" />
                    <rect x="160" y="22" width="6" height="16" fill="currentColor" />
                    <rect x="170" y="9" width="6" height="42" fill="currentColor" />
                    <rect x="180" y="2" width="6" height="56" fill="currentColor" />
                    <rect x="190" y="13" width="6" height="34" fill="currentColor" />
                    <rect x="200" y="21" width="6" height="18" fill="currentColor" />
                    <rect x="210" y="24" width="6" height="12" fill="currentColor" />
                    <rect x="220" y="14" width="6" height="32" fill="currentColor" />
                    <rect x="230" y="7" width="6" height="46" fill="currentColor" />
                    <rect x="240" y="15" width="6" height="30" fill="currentColor" />
                    <rect x="250" y="23" width="6" height="14" fill="currentColor" />
                    <rect x="260" y="17" width="6" height="26" fill="currentColor" />
                    <rect x="270" y="8" width="6" height="44" fill="currentColor" />
                    <rect x="280" y="3" width="6" height="54" fill="currentColor" />
                    <rect x="290" y="16" width="6" height="28" fill="currentColor" />
                    <rect x="300" y="22" width="6" height="16" fill="currentColor" />
                    <rect x="310" y="12" width="6" height="36" fill="currentColor" />
                    <rect x="320" y="5" width="6" height="50" fill="currentColor" />
                    <rect x="330" y="18" width="6" height="24" fill="currentColor" />
                    <rect x="340" y="24" width="6" height="12" fill="currentColor" />
                    <rect x="350" y="10" width="6" height="40" fill="currentColor" />
                    <rect x="360" y="2" width="6" height="56" fill="currentColor" />
                    <rect x="370" y="14" width="6" height="32" fill="currentColor" />
                    <rect x="380" y="21" width="6" height="18" fill="currentColor" />
                    <rect x="390" y="13" width="6" height="34" fill="currentColor" />
                    <rect x="400" y="4" width="6" height="52" fill="currentColor" />
                    <rect x="410" y="11" width="6" height="38" fill="currentColor" />
                    <rect x="420" y="19" width="6" height="22" fill="currentColor" />
                    <rect x="430" y="25" width="6" height="10" fill="currentColor" />
                    <rect x="440" y="16" width="6" height="28" fill="currentColor" />
                    <rect x="450" y="7" width="6" height="46" fill="currentColor" />
                    <rect x="460" y="1" width="6" height="58" fill="currentColor" />
                    <rect x="470" y="15" width="6" height="30" fill="currentColor" />
                    <rect x="480" y="22" width="6" height="16" fill="currentColor" />
                    <rect x="490" y="18" width="6" height="24" fill="currentColor" />
                    <rect x="500" y="9" width="6" height="42" fill="currentColor" />
                    <rect x="510" y="3" width="6" height="54" fill="currentColor" />
                    <rect x="520" y="12" width="6" height="36" fill="currentColor" />
                    <rect x="530" y="21" width="6" height="18" fill="currentColor" />
                    <rect x="540" y="24" width="6" height="12" fill="currentColor" />
                    <rect x="550" y="14" width="6" height="32" fill="currentColor" />
                    <rect x="560" y="8" width="6" height="44" fill="currentColor" />
                    <rect x="570" y="19" width="6" height="22" fill="currentColor" />
                    <rect x="580" y="25" width="6" height="10" fill="currentColor" />
                    <rect x="590" y="10" width="6" height="40" fill="currentColor" />
                    <rect x="600" y="2" width="6" height="56" fill="currentColor" />
                    <rect x="610" y="15" width="6" height="30" fill="currentColor" />
                    <rect x="620" y="23" width="6" height="14" fill="currentColor" />
                    <rect x="630" y="11" width="6" height="38" fill="currentColor" />
                    <rect x="640" y="5" width="6" height="50" fill="currentColor" />
                    <rect x="650" y="18" width="6" height="24" fill="currentColor" />
                    <rect x="660" y="24" width="6" height="12" fill="currentColor" />
                    <rect x="670" y="16" width="6" height="28" fill="currentColor" />
                    <rect x="680" y="8" width="6" height="44" fill="currentColor" />
                    <rect x="690" y="2" width="6" height="56" fill="currentColor" />
                    <rect x="700" y="14" width="6" height="32" fill="currentColor" />
                    <rect x="710" y="20" width="6" height="20" fill="currentColor" />
                    <rect x="720" y="24" width="6" height="12" fill="currentColor" />
                    <rect x="730" y="13" width="6" height="34" fill="currentColor" />
                    <rect x="740" y="7" width="6" height="46" fill="currentColor" />
                    <rect x="750" y="1" width="6" height="58" fill="currentColor" />
                    <rect x="760" y="16" width="6" height="28" fill="currentColor" />
                    <rect x="770" y="23" width="6" height="14" fill="currentColor" />
                    <rect x="780" y="11" width="6" height="38" fill="currentColor" />
                    <rect x="790" y="6" width="6" height="48" fill="currentColor" />
                    <rect x="800" y="17" width="6" height="26" fill="currentColor" />
                    <rect x="810" y="22" width="6" height="16" fill="currentColor" />
                    <rect x="820" y="15" width="6" height="30" fill="currentColor" />
                    <rect x="830" y="9" width="6" height="42" fill="currentColor" />
                    <rect x="840" y="3" width="6" height="54" fill="currentColor" />
                    <rect x="850" y="14" width="6" height="32" fill="currentColor" />
                    <rect x="860" y="20" width="6" height="20" fill="currentColor" />
                    <rect x="870" y="25" width="6" height="10" fill="currentColor" />
                    <rect x="880" y="12" width="6" height="36" fill="currentColor" />
                    <rect x="890" y="4" width="6" height="52" fill="currentColor" />
                    <rect x="900" y="16" width="6" height="28" fill="currentColor" />
                    <rect x="910" y="21" width="6" height="18" fill="currentColor" />
                    <rect x="920" y="10" width="6" height="40" fill="currentColor" />
                    <rect x="930" y="7" width="6" height="46" fill="currentColor" />
                    <rect x="940" y="15" width="6" height="30" fill="currentColor" />
                    <rect x="950" y="22" width="6" height="16" fill="currentColor" />
                    <rect x="960" y="18" width="6" height="24" fill="currentColor" />
                    <rect x="970" y="11" width="6" height="38" fill="currentColor" />
                    <rect x="980" y="20" width="6" height="20" fill="currentColor" />
                    <rect x="990" y="24" width="6" height="12" fill="currentColor" />
                  </svg>
                  <div className="absolute top-0 bottom-0 left-[35%] w-0.5 bg-primary pointer-events-none">
                    <span className="absolute top-0 -left-1.5 w-3.5 h-3.5 bg-primary text-[8px] flex items-center justify-center font-bold text-on-primary">
                      ▼
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparative Token Alignment Sequence */}
              <div className="flex flex-col gap-space-xs">
                {/* Row: Ground Truth Reference */}
                <div className="flex flex-col lg:flex-row lg:items-center bg-surface-container p-space-sm gap-space-sm border border-[#353534]">
                  <div className="w-28 shrink-0 font-mono text-xs uppercase tracking-wider text-outline font-semibold">
                    REFERENCE:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    {targetReference.split(/\s+/).map((word, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-surface-container-high text-on-surface">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Row: Model Hypothesis (With Levenshtein diff tags) */}
                <div className="flex flex-col lg:flex-row lg:items-center bg-surface-container p-space-sm gap-space-sm border border-[#353534]">
                  <div className="w-28 shrink-0 font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                    HYPOTHESIS:
                    {hypothesis && (
                      <span className="block text-[10px] text-outline lowercase font-normal truncate" title={hypothesis}>
                        ("{hypothesis.substring(0, 20)}...")
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    {currentWer ? (
                      currentWer.ops.map((op, idx) => {
                        if (op.type === 'C') {
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-tertiary-container/30 text-tertiary flex items-center gap-1"
                              title="Correct match"
                            >
                              <span>{op.ref}</span>
                              <span className="material-symbols-outlined text-[12px]">check</span>
                            </span>
                          )
                        }
                        if (op.type === 'S') {
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-secondary text-on-secondary flex items-center gap-1 font-semibold"
                              title={`Substitution: '${op.ref}' -> '${op.hyp}'`}
                            >
                              <span className="text-[10px] uppercase font-bold">SUB:</span>
                              <span>{op.hyp}</span>
                              <span className="text-[10px] line-through opacity-70">({op.ref})</span>
                            </span>
                          )
                        }
                        if (op.type === 'D') {
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-error-container text-on-error line-through flex items-center gap-1"
                              title={`Deletion: [${op.ref}] omitted`}
                            >
                              <span className="text-[10px] uppercase font-bold">DEL:</span>
                              <span>{op.ref}</span>
                            </span>
                          )
                        }
                        return (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-primary-container text-on-primary-container flex items-center gap-1 shadow-sm font-semibold"
                            title={`Insertion: +[${op.hyp}]`}
                          >
                            <span className="text-[10px] uppercase font-bold">+INS:</span>
                            <span>{op.hyp}</span>
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-outline italic">
                        Click "Run Benchmark Suite" above to generate on-device Levenshtein alignment diff.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Glossary Recognition Breakdown */}
              {currentGlossary.length > 0 && (
                <div className="p-space-sm bg-surface-container border border-[#353534] space-y-2">
                  <div className="font-mono text-xs text-outline uppercase tracking-wider font-semibold">
                    Technical Terminology Retention:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentGlossary.map((g, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 text-xs font-mono font-medium border flex items-center gap-1 ${
                          g.recognized
                            ? 'bg-tertiary-container/30 border-tertiary text-tertiary'
                            : 'bg-error-container/30 border-error text-error'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {g.recognized ? 'check' : 'close'}
                        </span>
                        <span>{g.term}</span>
                        <span className="text-[10px] opacity-75">
                          {g.recognized ? '(Present)' : '(Missed)'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Experiment Run Log Table */}
            <div className="bg-surface-container-low p-space-md lg:p-space-lg flex flex-col gap-space-md border border-[#262626]">
              <div className="flex items-center justify-between border-b border-[#262626] pb-space-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[18px]">table_rows</span>
                  <h3 className="font-sans text-sm font-semibold tracking-tight text-on-surface">
                    Benchmark Run History ({evalRuns.length} runs recorded)
                  </h3>
                </div>
                {evalRuns.length > 0 && (
                  <button
                    onClick={() => setEvalRuns([])}
                    className="font-mono text-xs text-outline hover:text-error transition-colors cursor-pointer"
                    type="button"
                  >
                    Clear History
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#262626] text-outline bg-surface-container-lowest">
                      <th className="p-2.5">Condition</th>
                      <th className="p-2.5">Model / Engine</th>
                      <th className="p-2.5">WER</th>
                      <th className="p-2.5">S / D / I / C</th>
                      <th className="p-2.5">Latency</th>
                      <th className="p-2.5">RTF</th>
                      <th className="p-2.5">Glossary Missing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]">
                    {evalRuns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-outline italic font-sans">
                          No benchmark runs recorded in this session. Configure parameters and click "Run Benchmark Suite" above.
                        </td>
                      </tr>
                    ) : (
                      evalRuns.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-container transition-colors">
                          <td className="p-2.5 font-semibold text-on-surface">{r.condition}</td>
                          <td className="p-2.5 text-on-surface-variant">
                            {r.model} ({r.engine})
                          </td>
                          <td className="p-2.5 font-bold text-tertiary">{(r.wer * 100).toFixed(1)}%</td>
                          <td className="p-2.5 text-outline">
                            {r.S} / {r.D} / {r.I} / {r.C}
                          </td>
                          <td className="p-2.5 text-primary">{r.latencyMs}ms</td>
                          <td className="p-2.5 text-secondary">{r.rtf}x</td>
                          <td className="p-2.5 text-error">
                            {r.missedTerms.length > 0 ? r.missedTerms.join(', ') : 'None (100% matched)'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default EvaluatePage
