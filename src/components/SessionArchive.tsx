import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import type { ArchivedSession } from '../lib/store'
import { formatTimestamp } from '../lib/text'
import { downloadFile, generateSrtExport } from '../lib/export'
import { formatBytes, getAudioStorageUsage } from '../lib/audioStore'

interface SessionArchiveProps {
  onOpenExport?: () => void
  onImportAudio?: (file: File) => void
}

export const SessionArchive: React.FC<SessionArchiveProps> = ({ onImportAudio }) => {
  const {
    archivedSessions,
    currentSessionId,
    startNewSession,
    loadArchivedSession,
    deleteArchivedSession,
    renameArchivedSession,
    setCurrentTab,
    audioVersion,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [audioSessionIds, setAudioSessionIds] = useState<Set<string>>(new Set())
  const [audioStorageLabel, setAudioStorageLabel] = useState('0 KB')

  useEffect(() => {
    let active = true
    void getAudioStorageUsage().then((stats) => {
      if (!active) return
      setAudioSessionIds(new Set(stats.sessionIds))
      setAudioStorageLabel(formatBytes(stats.totalBytes))
    })
    return () => {
      active = false
    }
  }, [archivedSessions.length, audioVersion])

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

  const handleExportSession = (session: ArchivedSession, format: 'markdown' | 'json' | 'srt') => {
    const dateStr = new Date(session.createdAt).toLocaleDateString()
    if (format === 'srt') {
      const srt = generateSrtExport(session.sentences)
      downloadFile(srt, `${session.id}-subtitles.srt`, 'application/x-subrip')
    } else if (format === 'markdown') {
      const fullTranscript = session.sentences
        .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
        .join('\n\n')

      const highlights = session.sentences
        .filter((s) => s.highlighted)
        .map((s) => `- [${formatTimestamp(s.startMs)}] **${s.text}**`)
        .join('\n')

      const md = `# ${session.title}\n\n**Date:** ${dateStr}  \n**Session ID:** \`${session.id}\`  \n**Total Segments:** ${session.sentences.length}  \n**Starred Notes:** ${session.starredCount}\n\n---\n\n## Key Highlights\n\n${highlights || '_No starred highlights in this session._'}\n\n---\n\n## Full Lecture Transcript\n\n${fullTranscript || '_No speech recorded._'}\n`

      downloadFile(md, `${session.id}-transcript.md`, 'text/markdown')
    } else {
      const json = JSON.stringify(session, null, 2)
      downloadFile(json, `${session.id}-data.json`, 'application/json')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-8 pb-16 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E6E6E3]">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#141413]">
            Session Archive
          </h1>
          <p className="text-[13px] text-[#8E8E8A] mt-1 font-mono tabular-nums">
            {archivedSessions.length} {archivedSessions.length === 1 ? 'session' : 'sessions'} ·{' '}
            Local audio {audioStorageLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onImportAudio && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onImportAudio(file)
                  e.target.value = ''
                }}
                className="hidden"
                aria-label="Import recorded audio file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 rounded-[6px] border border-[#E6E6E3] bg-white hover:bg-[#F7F7F5] text-[12px] font-medium text-[#141413] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#5C5C59]" aria-hidden="true">
                  upload_file
                </span>
                <span>Import Audio</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              startNewSession()
              setCurrentTab('transcriber')
            }}
            className="h-8 px-3 rounded-[6px] bg-[#141413] hover:bg-[#2A2A28] text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              add
            </span>
            <span>New Lecture</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span
          className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8E8A] text-[16px]"
          aria-hidden="true"
        >
          search
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter archived sessions"
          placeholder="Search lectures, keywords, or notes..."
          className="w-full h-8 pl-8 pr-3 bg-[#FAFAFA] border border-[#E6E6E3] rounded-[6px] text-[13px] text-[#141413] placeholder:text-[#8E8E8A] focus:outline-none focus:border-[#141413] focus:bg-white transition-colors duration-150"
        />
      </div>

      {/* Clean Hairline Table */}
      <div className="border-t border-[#E6E6E3]">
        {filteredSessions.length === 0 ? (
          <div className="py-16 text-center space-y-2 select-none">
            <span className="material-symbols-outlined text-[22px] text-[#B4B4B0]" aria-hidden="true">
              folder_off
            </span>
            <p className="text-[13px] font-medium text-[#5C5C59]">
              {searchQuery ? 'No matching sessions found' : 'No archived sessions yet'}
            </p>
            <p className="text-[12px] text-[#8E8E8A] max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different search keyword.'
                : 'Completed lectures are automatically archived here when you start a new session.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#E6E6E3] text-[#8E8E8A] text-[11px] uppercase tracking-[0.05em]">
                  <th scope="col" className="py-2.5 pr-4 font-medium">Lecture</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Date</th>
                  <th scope="col" className="py-2.5 px-3 font-medium text-right">Segments</th>
                  <th scope="col" className="py-2.5 px-3 font-medium text-right">Starred</th>
                  <th scope="col" className="py-2.5 pl-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E3]">
                {filteredSessions.map((session) => {
                  const isCurrent = currentSessionId === session.id
                  const hasSavedAudio = Boolean(session.hasAudio) || audioSessionIds.has(session.id)
                  const date = new Date(session.createdAt)
                  const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  const formattedTime = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr
                      key={session.id}
                      className={`group transition-colors duration-150 ${
                        isCurrent ? 'bg-[#FAFAFA]' : 'hover:bg-[#F9F9F8]'
                      }`}
                    >
                      <td className="py-3 pr-4">
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
                              aria-label="Edit session title"
                              className="h-7 px-2 bg-white border border-[#141413] rounded-[6px] text-[13px] text-[#141413] focus:outline-none w-56"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(session.id)}
                              className="w-6 h-6 rounded-[6px] text-[#141413] hover:bg-[#EBEBE8] flex items-center justify-center cursor-pointer"
                              aria-label="Save session title"
                            >
                              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                                check
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="w-6 h-6 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#EBEBE8] flex items-center justify-center cursor-pointer"
                              aria-label="Cancel renaming"
                            >
                              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                                close
                              </span>
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => loadArchivedSession(session.id)}
                                className="font-medium text-[#141413] hover:underline truncate max-w-sm text-left cursor-pointer"
                              >
                                {session.title}
                              </button>
                              {isCurrent && (
                                <span className="text-[11px] text-[#8E8E8A] font-mono">
                                  · open
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartRename(session)}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#8E8E8A] hover:text-[#141413] p-0.5 transition-opacity duration-150 cursor-pointer"
                                aria-label={`Rename ${session.title}`}
                              >
                                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                                  edit
                                </span>
                              </button>
                            </div>
                            <div className="text-[11px] font-mono text-[#8E8E8A] mt-0.5">
                              {session.model} · {session.language.toUpperCase()}
                              {hasSavedAudio ? ' · Audio saved' : ''}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[#5C5C59] font-mono text-[11px] tabular-nums whitespace-nowrap">
                        {formattedDate}, {formattedTime}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-[12px] text-[#5C5C59] tabular-nums">
                        {session.sentences.length}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-[12px] tabular-nums">
                        {session.starredCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[#141413]">
                            <span
                              className="material-symbols-outlined text-[13px] text-[#D97706]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                              aria-hidden="true"
                            >
                              star
                            </span>
                            {session.starredCount}
                          </span>
                        ) : (
                          <span className="text-[#D4D4D0]">—</span>
                        )}
                      </td>

                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => loadArchivedSession(session.id)}
                            className="h-7 px-2.5 rounded-[6px] border border-[#E6E6E3] bg-white hover:bg-[#F1F1EF] text-[#141413] font-medium text-[12px] transition-colors duration-150 cursor-pointer"
                            aria-label={`Open ${session.title}`}
                          >
                            Open
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSession(session, 'srt')}
                            className="w-7 h-7 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#F1F1EF] inline-flex items-center justify-center transition-colors duration-150 cursor-pointer"
                            aria-label={`Download SRT subtitles for ${session.title}`}
                            title="Download .srt"
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              subtitles
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSession(session, 'markdown')}
                            className="w-7 h-7 rounded-[6px] text-[#8E8E8A] hover:text-[#141413] hover:bg-[#F1F1EF] inline-flex items-center justify-center transition-colors duration-150 cursor-pointer"
                            aria-label={`Download Markdown for ${session.title}`}
                            title="Download .md"
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              download
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete session "${session.title}" and its saved audio from archive?`
                                )
                              ) {
                                deleteArchivedSession(session.id)
                              }
                            }}
                            className="w-7 h-7 rounded-[6px] text-[#8E8E8A] hover:text-[#DC2626] hover:bg-[#F1F1EF] inline-flex items-center justify-center transition-colors duration-150 cursor-pointer"
                            aria-label={`Delete ${session.title}`}
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              delete
                            </span>
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
