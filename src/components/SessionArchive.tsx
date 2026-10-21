import React, { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { ArchivedSession } from '../lib/store'
import { formatTimestamp } from '../lib/text'
import { downloadFile } from '../lib/export'

interface SessionArchiveProps {
  onOpenExport?: () => void
}

export const SessionArchive: React.FC<SessionArchiveProps> = () => {
  const {
    archivedSessions,
    currentSessionId,
    startNewSession,
    loadArchivedSession,
    deleteArchivedSession,
    renameArchivedSession,
    setCurrentTab,
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const filteredSessions = archivedSessions.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.title.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.sentences.some((st) => st.text.toLowerCase().includes(q))
    )
  })

  const handleStartRename = (session: ArchivedSession) => {
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      renameArchivedSession(id, editTitle.trim())
    }
    setEditingId(null)
  }

  const handleExportSession = (session: ArchivedSession, format: 'markdown' | 'json') => {
    const dateStr = new Date(session.createdAt).toLocaleDateString()
    if (format === 'markdown') {
      const fullTranscript = session.sentences
        .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
        .join('\n\n')

      const highlights = session.sentences
        .filter((s) => s.highlighted)
        .map((s) => `- [${formatTimestamp(s.startMs)}] **${s.text}**`)
        .join('\n')

      const md = `# ${session.title}\n\n**Date:** ${dateStr}  \n**Session ID:** \`${session.id}\`  \n**Total Sentences:** ${session.sentences.length}  \n**Starred Notes:** ${session.starredCount}\n\n---\n\n## Key Highlights\n\n${highlights || '_No starred highlights in this session._'}\n\n---\n\n## Full Lecture Transcript\n\n${fullTranscript || '_No speech recorded._'}\n`

      downloadFile(md, `${session.id}-transcript.md`, 'text/markdown')
    } else {
      const json = JSON.stringify(session, null, 2)
      downloadFile(json, `${session.id}-data.json`, 'application/json')
    }
  }

  return (
    <div className="max-w-5xl mx-auto pt-20 pb-28 px-4 sm:px-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">folder_open</span>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Session Archive &amp; History
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-medium">
              {archivedSessions.length} {archivedSessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          <p className="text-[13px] text-slate-500 mt-1 font-normal">
            Completed lecture sessions and generated study keynotes saved 100% locally on this device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCurrentTab('transcriber')
            }}
            className="h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-[12px] font-medium text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-slate-400">arrow_back</span>
            <span>Back to Live</span>
          </button>

          <button
            type="button"
            onClick={() => {
              startNewSession()
              setCurrentTab('transcriber')
            }}
            className="h-8 px-3.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>+ New Session</span>
          </button>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white rounded-lg border border-gray-200/70 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sessions by title, notes, or keywords..."
            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-gray-200/80 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Stored locally in IndexedDB / LocalStorage
        </div>
      </div>

      {/* Sessions Table Card */}
      <div className="bg-white rounded-lg border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">folder_off</span>
            </div>
            <div className="text-sm font-medium text-slate-700">
              {searchQuery ? 'No matching lecture sessions found' : 'No archived sessions yet'}
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'Try searching with a different keyword or clear the search filter.'
                : 'When you finish a lecture or close and reopen the app, your previous session is automatically saved here.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => {
                  startNewSession()
                  setCurrentTab('transcriber')
                }}
                className="mt-2 h-8 px-3 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover transition cursor-pointer"
              >
                Start Your First Lecture
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-slate-400 font-normal bg-slate-50/50">
                  <th className="py-3 px-4 font-normal">Session Title &amp; ID</th>
                  <th className="py-3 px-4 font-normal">Date &amp; Time</th>
                  <th className="py-3 px-4 font-normal text-center">Sentences</th>
                  <th className="py-3 px-4 font-normal text-center">Starred</th>
                  <th className="py-3 px-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-slate-600">
                {filteredSessions.map((session) => {
                  const isCurrent = currentSessionId === session.id
                  const date = new Date(session.createdAt)
                  const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  const formattedTime = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isCurrent ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Title & ID */}
                      <td className="py-3 px-4">
                        {editingId === session.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(session.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                              className="px-2 py-1 bg-white border border-blue-400 rounded text-xs text-slate-900 focus:outline-none w-56 font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(session.id)}
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                              title="Save Title"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="Cancel"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 group">
                              <span
                                onClick={() => loadArchivedSession(session.id)}
                                className="font-medium text-slate-900 hover:text-primary transition-colors cursor-pointer truncate max-w-sm"
                                title="Click to open this session"
                              >
                                {session.title}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-mono font-semibold">
                                  CURRENT
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartRename(session)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition p-0.5"
                                title="Rename title"
                              >
                                <span className="material-symbols-outlined text-[13px]">edit</span>
                              </button>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              {session.id} · {session.model} ({session.language.toUpperCase()})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        <div>{formattedDate}</div>
                        <div className="text-[10px] text-slate-400">{formattedTime}</div>
                      </td>

                      {/* Sentences & Word count */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-medium text-slate-800">
                          {session.sentences.length}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {session.totalWords || 0} words
                        </span>
                      </td>

                      {/* Starred Highlights */}
                      <td className="py-3 px-4 text-center">
                        {session.starredCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60 font-mono">
                            <span className="material-symbols-outlined text-[12px] text-amber-500">
                              star
                            </span>
                            {session.starredCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => loadArchivedSession(session.id)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition cursor-pointer flex items-center gap-1"
                            title="Open session in transcriber"
                          >
                            <span className="material-symbols-outlined text-[13px]">visibility</span>
                            <span>Open</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSession(session, 'markdown')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Download Markdown (.md)"
                          >
                            <span className="material-symbols-outlined text-[16px]">file_download</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete session "${session.title}" (${session.id}) from archive?`
                                )
                              ) {
                                deleteArchivedSession(session.id)
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete this session"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionArchive
