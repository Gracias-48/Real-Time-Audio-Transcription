# Task: Build and deploy a prototype of "Real-Time Lecture Transcriber & Click-to-Highlight Note Assistant"

You are a senior full-stack engineer. Build a working, deployable prototype for a university Final Project (course COMP6822001, Speech Recognition) and prepare it for a live deployment on Vercel. Work autonomously, but follow the constraints and phases below. I attached a UI mockup image: match its layout, structure and color mood.

## 1. Product in one paragraph

A web app that listens to a lecturer through the microphone, shows live partial captions while they speak, auto-saves every completed sentence with a timestamp, and lets the student click any sentence to highlight it (yellow + star) and send it to a "Key Takeaways" panel without typing. The student can export the full transcript and highlighted notes at the end.

## 2. Hard constraints (do not violate)

1. **No external speech-to-text API.** No OpenAI, Google, Azure, Deepgram, AssemblyAI, etc. All ASR inference must run locally on the user's device.
2. **Vercel cannot run Python/Faster-Whisper in real time**, so inference runs **in the browser** (WebAssembly / WebGPU) inside a Web Worker. The Vercel deployment is a static frontend only. No backend server is needed.
3. **Audio never leaves the device.** The only network traffic allowed is downloading the model files and static assets (the model is cached in the browser after the first load). State this clearly in the UI and the README.
4. **True streaming behavior, not "record, stop, upload, wait".** Partial text must appear and update while the speaker is still talking.
5. Do not invent library APIs. Before using any library, check its installed version's docs/types and adapt. Verify that any Hugging Face model ID actually exists before hardcoding it.

## 3. Recommended stack

- Vite + React + TypeScript + Tailwind CSS (static build, zero-config on Vercel). State: Zustand.
- ASR: `@huggingface/transformers` (Transformers.js) running a Whisper ONNX model in a Web Worker. Try `device: "webgpu"` first and fall back to WASM (quantized). Default model: a small English Whisper (tiny.en); offer a settings dropdown to switch to base.en so we can compare accuracy vs latency/RTF.
- VAD: Silero VAD in the browser via `@ricky0123/vad-web` (needs its ONNX/WASM assets served from `public/` with the correct base paths).
- Tests: Vitest for pure logic (WER, text normalization, buffering).
- Stretch only (do NOT block the MVP on it): a second engine using sherpa-onnx WASM streaming (zipformer) behind the same `ASREngine` interface.

## 4. Pipeline and streaming strategy

Whisper is not a native streaming model, so implement pseudo-streaming:

1. Capture mic audio at 16 kHz mono (`getUserMedia` + AudioWorklet or the VAD library's capture), keep a rolling buffer for the current utterance.
2. Silero VAD detects speech start/end. Tune redemption/pause thresholds (roughly 500-700 ms of silence ends an utterance) and expose them in settings.
3. **While speech is active**, every ~800-1000 ms send the current utterance buffer to the ASR worker and render the result as the **partial** line (bottom "Live Partial Stream"). Never let two decodes overlap: drop or coalesce ticks if the worker is busy.
4. On speech end, or when an utterance exceeds ~15 s (force a commit), run a **final** decode and commit one sentence to the transcript with a session-relative timestamp (format `HH:MM:SS`, as in the mockup). Clear the partial line.
5. Define a clean interface so engines are swappable:
   ```ts
   interface ASREngine {
     load(onProgress: (p: number) => void): Promise<void>;
     transcribe(audio: Float32Array, opts: { final: boolean }): Promise<{ text: string; ms: number }>;
   }
   ```
6. Handle Whisper artifacts: filter empty output and common hallucinations on silence (for example repeated "Thank you." or "[BLANK_AUDIO]") and normalize whitespace.

## 5. UI requirements (match the attached mockup)

Theme: Dark Navy/Slate background, white text, Electric Blue accents, **Warm Yellow only for highlight**. Font: Inter (or Plus Jakarta Sans). Desktop-first, clean, readable from a distance.

- **Top bar:** status dot + text ("Listening - Local Model", "Loading model...", "Idle", "Error"), live **Latency** (rolling average, seconds) and **RTF**.
- **Left panel, Full Auto-Saved Transcript:** timestamped sentences, auto-scrolling to the newest one (pause auto-scroll if the user scrolls up). Clicking a sentence toggles highlight: yellow row + star. Keyboard accessible.
- **Right panel, Highlighted Key Notes:** a card per highlighted sentence (text + timestamp). Clicking a card scrolls to the source sentence. Allow removing a note (this un-highlights the sentence).
- **Bottom bar, Live Partial Stream:** the live changing partial text, plus **Start**, **Stop** and **Export** buttons.
- **First-load experience:** model download progress bar, a short "audio stays on your device" notice, and a clear message if the browser lacks mic permission, WebGPU or WASM support.
- **Demo mode:** a "Play sample lecture" option that streams a bundled short audio clip (or lets the user pick an audio file) through the exact same pipeline, so the app can be demonstrated without a microphone or in a noisy room.
- Persist the session transcript and highlights in IndexedDB or localStorage so a refresh does not lose notes.

## 6. Metrics (needed for the project's evaluation slide)

- **Latency:** time from the end of the audio chunk sent to the ASR to the moment its text is rendered (ms). Track partial and final separately; show the rolling average in the top bar.
- **RTF:** decode time / audio duration, rolling average.
- Log per-utterance metrics to an in-memory list and include them in the export (JSON).

## 7. Evaluation page (`/evaluate`)

A simple page to run the experiment plan:

- Choose a condition: **Baseline** (clean), **E1** (background noise), **E2** (fast speaking speed).
- Provide a reference sentence (or a list of 10-15 Computer Science sentences) and either record via mic or upload an audio file, then run it through the same ASR pipeline.
- Compute **WER = (S + D + I) / N** at word level (lowercase, strip punctuation, collapse whitespace) with a Levenshtein alignment, and show the S/D/I breakdown and a diff view (correct / substituted / deleted / inserted words).
- **Technical-term error analysis:** a configurable glossary (e.g. "backpropagation", "convolutional", "hash table", "latency"); list which glossary terms were missed or mis-transcribed.
- Show latency (ms) and RTF for each run, and a results table that can be exported as CSV (columns: condition, model, WER, S, D, I, latency_ms, RTF).
- Unit-test the WER function with Vitest (include edge cases: empty reference, identical strings, all-wrong).

## 8. Export

- **Markdown:** full transcript with timestamps, then a "Key Takeaways" section from highlights (highlighted lines marked clearly).
- **JSON:** transcript, highlights, settings, and per-utterance metrics.
- **Summary:** a lightweight **local extractive summary** (no LLM, no external API), for example sentence scoring by term frequency over the transcript, weighted toward highlighted sentences. Label it clearly as an automatic extractive summary.

## 9. Deployment on Vercel (static)

- The project must build with `npm run build` and run locally with `npm run dev`.
- Add `vercel.json` only if needed. If you use multithreaded WASM that needs `SharedArrayBuffer`, add the COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless` or `require-corp`) and verify that model and ONNX asset loading still works. Prefer single-threaded WASM if that causes problems.
- Microphone access needs HTTPS, which Vercel provides.
- If you cannot authenticate with Vercel from this environment, **do not pretend to deploy and do not invent a URL.** Instead: make sure the build passes, push-ready repo structure is in place, and give me the exact commands/steps (Git push + import into Vercel, or `npx vercel login` then `npx vercel --prod`). If you can deploy, report the real production URL.

## 10. Working method

Work in phases. After each phase, run it and fix errors before continuing.

1. Scaffold the app and build the full UI with mock data (no ASR yet); match the mockup.
2. Mic capture + Silero VAD; show speech start/end events.
3. ASR worker with model loading, final decode, then partial decode ticks; wire up the transcript and live partial line.
4. Click-to-highlight, Key Notes panel, persistence, export, local summary.
5. Metrics (latency, RTF), settings (model, VAD thresholds), demo mode.
6. `/evaluate` page with WER, glossary analysis, CSV export, and tests.
7. Production build, deployment preparation, README.

Do not claim something works unless you ran it. If something cannot be verified here (for example real microphone input), say so explicitly.

## 11. Deliverables and acceptance criteria

- [ ] `npm run build` succeeds with no TypeScript errors; `npm test` passes.
- [ ] Speaking into the mic produces partial text that updates while speaking, then a committed timestamped sentence after a pause.
- [ ] Clicking a sentence highlights it (yellow + star) and adds/removes it in Key Notes.
- [ ] No network request carries audio or text to any third-party ASR service (verify in the Network tab and mention the result).
- [ ] Top bar shows live Latency and RTF.
- [ ] Export produces Markdown and JSON; `/evaluate` computes WER and exports CSV.
- [ ] README with: architecture diagram (text/Mermaid), why inference runs in the browser, supported browsers, how to run, how to deploy, how to run the evaluation, known limitations (Whisper pseudo-streaming, first-load model download, accuracy on technical terms), and what was verified vs not verified.
- [ ] Deployment: live Vercel URL if possible, otherwise exact manual steps.