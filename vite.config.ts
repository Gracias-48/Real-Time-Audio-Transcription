/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// All runtime assets (Silero VAD model, AudioWorklet, ONNX Runtime WASM) are self-hosted
// from our own origin, so the only third-party traffic is the one-time Whisper model download
// from the Hugging Face Hub.
const TJS_ORT = 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        // Silero VAD (vad-web) + its ONNX Runtime (1.30) single-threaded-capable WASM build
        { src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js', dest: 'vad', rename: { stripBase: true } },
        { src: 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx', dest: 'vad', rename: { stripBase: true } },
        { src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', dest: 'vad', rename: { stripBase: true } },
        { src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', dest: 'vad', rename: { stripBase: true } },
        // ONNX Runtime build bundled with Transformers.js (WebGPU + WASM via asyncify)
        { src: `${TJS_ORT}/ort-wasm-simd-threaded.asyncify.wasm`, dest: 'ort', rename: { stripBase: true } },
        { src: `${TJS_ORT}/ort-wasm-simd-threaded.asyncify.mjs`, dest: 'ort', rename: { stripBase: true } },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
