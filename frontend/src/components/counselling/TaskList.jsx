/**
 * TaskList — shows a lead's tasks with inline create/update.
 * Overdue: status in [pending, in_progress] AND due_at < now.
 */
import React, { useState } from 'react'
import { createTask, updateTask, deleteTask } from '../../api'

const STATUS_COLORS = {
  pending:     'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled:   'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABELS = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

const PRIORITY_COLORS = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-slate-100 text-slate-600 border-slate-200',
}

function isTaskOverdue(task) {
  return ['pending', 'in_progress'].includes(task.status) &&
    task.due_at &&
    new Date(task.due_at) < new Date()
}

const EMPTY_FORM = { title: '', description: '', due_at: '', priority: 'medium', assigned_to: '' }

export default function TaskList({ leadId, studentId, tasks = [], staffUsers = [], onRefresh }) {
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')
  const [updatingId, setUpdatingId] = useState(null)

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
      await createTask(payload)
      setForm(EMPTY_FORM)
      setShowForm(false)
      onRefresh()
    } catch (err) {
      const data = err.response?.data
      const msg = data?.title?.[0] || data?.error || 'Failed to create task.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (task, newStatus) => {
    if (updatingId === task.id) return
    setUpdatingId(task.id)
    try {
      await updateTask(task.id, { status: newStatus })
      onRefresh()
    } catch {
      alert('Failed to update task status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return
    try {
      await deleteTask(taskId)
      onRefresh()
    } catch {
      alert('Failed to delete task.')
    }
  }

  const active   = tasks.filter(t => !['completed', 'cancelled'].includes(t.status))
  const archived = tasks.filter(t =>  ['completed', 'cancelled'].includes(t.status))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-gray-500 font-medium">
          {active.length} active · {archived.length} done/cancelled
        </p>
        <button
          onClick={() => { setShowForm(v => !v); setFormError('') }}
          className="text-xs font-bold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
        >
          {showForm ? '✕ Cancel' : '+ New Task'}
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
                placeholder="e.g. Send university shortlist"
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Due Date (optional)</label>
              <input
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
                placeholder="Additional details..."
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
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Task cards */}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">No tasks yet.</p>
        ) : (
          tasks.map(task => {
            const overdue = isTaskOverdue(task)
            const dueStr  = task.due_at
              ? new Date(task.due_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : null

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-xl p-3.5 shadow-sm ${
                  overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-gray-900">{task.title}</span>
                      {overdue && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse flex-shrink-0">
                          ⏰ OVERDUE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[task.status] || ''}`}>
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[task.priority] || ''}`}>
                        {task.priority}
                      </span>
                      {dueStr && (
                        <span className="text-[10px] text-gray-500 font-mono">📅 {dueStr}</span>
                      )}
                      {task.assigned_to_name && (
                        <span className="text-[10px] text-gray-500">👤 {task.assigned_to_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for non-terminal tasks */}
                  {!['completed', 'cancelled'].includes(task.status) && (
                    <div className="flex gap-1 flex-shrink-0">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(task, 'in_progress')}
                          disabled={updatingId === task.id}
                          className="text-[10px] font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-all disabled:opacity-40"
                          title="Start task"
                        >
                          ▶
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(task, 'completed')}
                        disabled={updatingId === task.id}
                        className="text-[10px] font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-all disabled:opacity-40"
                        title="Complete"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleStatusChange(task, 'cancelled')}
                        disabled={updatingId === task.id}
                        className="text-[10px] font-bold px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all disabled:opacity-40"
                        title="Cancel"
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-[10px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>

                {task.description && (
                  <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{task.description}</p>
                )}
                {task.completed_at && (
                  <p className="text-[10px] text-emerald-600 mt-1 font-mono">
                    Completed: {new Date(task.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
