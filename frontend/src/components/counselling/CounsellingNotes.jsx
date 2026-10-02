/**
 * CounsellingNotes — internal staff/admin notes for a lead.
 * Students never see this component; it is only rendered inside the
 * LeadDetail drawer which is already staff/admin-gated.
 */
import React, { useState } from 'react'
import { createCounsellingNote, deleteCounsellingNote } from '../../api'

export default function CounsellingNotes({ leadId, notes = [], onRefresh, isAdmin = false }) {
  const [content, setContent]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setError('')
    setSubmitting(true)
    try {
      await createCounsellingNote({ lead: leadId, content: content.trim() })
      setContent('')
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.content?.[0] || err.response?.data?.error || 'Failed to save note.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (noteId) => {
    if (!window.confirm('Delete this counselling note? This cannot be undone.')) return
    try {
      await deleteCounsellingNote(noteId)
      onRefresh()
    } catch {
      alert('Failed to delete note.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form onSubmit={handleSubmit} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider">
          🔒 Internal Counselling Note
        </p>
        {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
        <textarea
          rows={3}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add an internal counselling note visible only to staff and admin..."
          className="w-full text-xs p-3 bg-white border border-amber-200 rounded-xl focus:border-amber-500 outline-none resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </form>

      {/* Notes list */}
      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
        {notes.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">No counselling notes yet.</p>
        ) : (
          notes.map((note) => {
            const dateStr = note.created_at
              ? new Date(note.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : ''
            const edited = note.updated_at && note.updated_at !== note.created_at

            return (
              <div key={note.id} className="bg-white border border-amber-100 rounded-xl p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-amber-900 truncate">
                      {note.author_name || 'Staff'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{dateStr}</span>
                    {edited && (
                      <span className="text-[10px] text-gray-400 italic flex-shrink-0">(edited)</span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-[10px] text-red-400 hover:text-red-600 font-bold flex-shrink-0 transition-colors"
                      title="Delete note"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
