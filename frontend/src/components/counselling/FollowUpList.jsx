/**
 * FollowUpList — shows a lead's follow-ups with inline create/update.
 * Overdue is detected dynamically: status=pending AND due_at < now.
 */
import React, { useState } from 'react'
import { createFollowUp, updateFollowUp, deleteFollowUp } from '../../api'

const STATUS_COLORS = {
  pending:   'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const PRIORITY_COLORS = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-slate-100 text-slate-600 border-slate-200',
}

function isOverdue(fu) {
  return fu.status === 'pending' && fu.due_at && new Date(fu.due_at) < new Date()
}

function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const EMPTY_FORM = { title: '', description: '', due_at: '', priority: 'medium', assigned_to: '' }

export default function FollowUpList({ leadId, studentId, followUps = [], staffUsers = [], onRefresh }) {
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState('')
  const [updatingId, setUpdatingId]   = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        due_at: form.due_at ? new Date(form.due_at).toISOString() : undefined,
        priority: form.priority,
        assigned_to: form.assigned_to || undefined,
      }
      if (studentId) payload.student = studentId
      else if (leadId) payload.lead = leadId
      await createFollowUp(payload)
      setForm(EMPTY_FORM)
      setShowForm(false)
      onRefresh()
    } catch (err) {
      const data = err.response?.data
      const msg = data?.due_at?.[0] || data?.title?.[0] || data?.error || 'Failed to create follow-up.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (fu, newStatus) => {
    if (updatingId === fu.id) return
    setUpdatingId(fu.id)
    try {
      await updateFollowUp(fu.id, { status: newStatus })
      onRefresh()
    } catch {
      alert('Failed to update follow-up status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (fuId) => {
    if (!window.confirm('Delete this follow-up?')) return
    try {
      await deleteFollowUp(fuId)
      onRefresh()
    } catch {
      alert('Failed to delete follow-up.')
    }
  }

  const pending   = followUps.filter(f => f.status === 'pending')
  const completed = followUps.filter(f => f.status !== 'pending')

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-gray-500 font-medium">
          {pending.length} pending · {completed.length} done
        </p>
        <button
          onClick={() => { setShowForm(v => !v); setFormError('') }}
          className="text-xs font-bold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
        >
          {showForm ? '✕ Cancel' : '+ New Follow-up'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          {formError && <p className="text-[11px] font-bold text-red-600">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Title *</label>
              <input
                required
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Call after IELTS result"
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Due Date & Time *</label>
              <input
                required
                type="datetime-local"
                value={form.due_at}
                onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {staffUsers.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Assign To</label>
                <select
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Description (optional)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional context..."
                className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-40"
            >
              {submitting ? 'Creating…' : 'Create Follow-up'}
            </button>
          </div>
        </form>
      )}

      {/* Follow-up cards */}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {followUps.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">No follow-ups scheduled.</p>
        ) : (
          followUps.map(fu => {
            const overdue = isOverdue(fu)
            const dueStr  = fu.due_at
              ? new Date(fu.due_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : ''

            return (
              <div
                key={fu.id}
                className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all ${
                  overdue ? 'border-red-300 bg-red-50/40' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-bold text-gray-900 truncate">{fu.title}</span>
                      {overdue && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse flex-shrink-0">
                          ⏰ OVERDUE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[fu.status] || ''}`}>
                        {fu.status}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[fu.priority] || ''}`}>
                        {fu.priority}
                      </span>
                      {fu.due_at && (
                        <span className="text-[10px] text-gray-500 font-mono">📅 {dueStr}</span>
                      )}
                      {fu.assigned_to_name && (
                        <span className="text-[10px] text-gray-500">👤 {fu.assigned_to_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Status actions */}
                  {fu.status === 'pending' && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleStatusChange(fu, 'completed')}
                        disabled={updatingId === fu.id}
                        className="text-[10px] font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-all disabled:opacity-40"
                        title="Mark completed"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleStatusChange(fu, 'cancelled')}
                        disabled={updatingId === fu.id}
                        className="text-[10px] font-bold px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all disabled:opacity-40"
                        title="Cancel"
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => handleDelete(fu.id)}
                        className="text-[10px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>

                {fu.description && (
                  <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{fu.description}</p>
                )}
                {fu.completed_at && (
                  <p className="text-[10px] text-emerald-600 mt-1 font-mono">
                    Completed: {new Date(fu.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
