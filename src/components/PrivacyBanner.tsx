import React, { useState } from 'react'
import { useAppStore } from '../lib/store'

export const PrivacyBanner: React.FC = () => {
  const { downloadProgress } = useAppStore()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed && downloadProgress === null) return null

  return (
    <div className="w-full bg-[#0a1120] border-b border-blue-900/30 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 text-[11px] font-bold">
          🛡️
        </span>
        <span>
          <strong className="text-slate-100">100% On-Device Privacy:</strong> Microphone audio is processed entirely locally using client-side WebGPU/WASM or local WebSocket. Audio is never transmitted to cloud ASR APIs.
        </span>
      </div>

      {downloadProgress !== null && (
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-36 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-blue-400 font-semibold">{downloadProgress}%</span>
        </div>
      )}

      {downloadProgress === null && (
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
