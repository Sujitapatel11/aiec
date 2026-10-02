/**
 * AppointmentList — shows a lead's appointments with inline scheduling.
 */
import React, { useState } from 'react'
import { createAppointment, updateAppointment, deleteAppointment } from '../../api'

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  no_show:   'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show:   'No Show',
}

const MODE_OPTIONS = [
  'In-Person Office',
  'Phone Call',
  'WhatsApp',
  'Zoom / Video',
  'Microsoft Teams',
  'Google Meet',
  'Other',
]

const EMPTY_FORM = {
  title: '',
  appointment_date: '',
  duration_minutes: 30,
  location_mode: 'In-Person Office',
  notes: '',
  assigned_to: '',
}

export default function AppointmentList({ leadId, appointments = [], staffUsers = [], onRefresh }) {
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
      await createAppointment({
        lead: leadId,
        title: form.title.trim(),
        appointment_date: new Date(form.appointment_date).toISOString(),
        duration_minutes: Number(form.duration_minutes),
        location_mode: form.location_mode,
        notes: form.notes.trim(),
        assigned_to: form.assigned_to || undefined,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      onRefresh()
    } catch (err) {
      const data = err.response?.data
      const msg = data?.appointment_date?.[0] || data?.title?.[0] || data?.error || 'Failed to schedule appointment.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (appt, newStatus) => {
    if (updatingId === appt.id) return
    setUpdatingId(appt.id)
    try {
      await updateAppointment(appt.id, { status: newStatus })
      onRefresh()
    } catch {
      alert('Failed to update appointment.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (apptId) => {
    if (!window.confirm('Delete this appointment?')) return
    try {
      await deleteAppointment(apptId)
      onRefresh()
    } catch {
      alert('Failed to delete appointment.')
    }
  }

  const upcoming = appointments.filter(a => a.status === 'scheduled')
  const past     = appointments.filter(a => a.status !== 'scheduled')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-gray-500 font-medium">
          {upcoming.length} upcoming · {past.length} past
        </p>
        <button
          onClick={() => { setShowForm(v => !v); setFormError('') }}
          className="text-xs font-bold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
        >
          {showForm ? '✕ Cancel' : '+ Schedule Appointment'}
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
                placeholder="e.g. University Selection & Visa Consultation"
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Date & Time *</label>
              <input
                required
                type="datetime-local"
                value={form.appointment_date}
                onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))}
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Mode / Location</label>
              <select
                value={form.location_mode}
                onChange={e => setForm(f => ({ ...f, location_mode: e.target.value }))}
                className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none"
              >
                {MODE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {staffUsers.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Counsellor</label>
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
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Notes (optional)</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Agenda, preparation notes..."
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
              {submitting ? 'Scheduling…' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      )}

      {/* Appointment cards */}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {appointments.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">No appointments scheduled.</p>
        ) : (
          appointments.map(appt => {
            const dateStr = appt.appointment_date
              ? new Date(appt.appointment_date).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : ''
            const isPast = appt.appointment_date && new Date(appt.appointment_date) < new Date()

            return (
              <div
                key={appt.id}
                className={`bg-white border rounded-xl p-3.5 shadow-sm ${
                  appt.status === 'scheduled' && !isPast
                    ? 'border-blue-100'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{appt.title}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[appt.status] || ''}`}>
                        {STATUS_LABELS[appt.status] || appt.status}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">🕐 {dateStr}</span>
                      <span className="text-[10px] text-gray-500">{appt.duration_minutes}min</span>
                      <span className="text-[10px] text-gray-500 font-medium">{appt.location_mode}</span>
                      {appt.assigned_to_name && (
                        <span className="text-[10px] text-gray-500">👤 {appt.assigned_to_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for scheduled appointments */}
                  {appt.status === 'scheduled' && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleStatusChange(appt, 'completed')}
                        disabled={updatingId === appt.id}
                        className="text-[10px] font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-all disabled:opacity-40"
                        title="Mark completed"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleStatusChange(appt, 'no_show')}
                        disabled={updatingId === appt.id}
                        className="text-[10px] font-bold px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg transition-all disabled:opacity-40"
                        title="No show"
                      >
                        👻
                      </button>
                      <button
                        onClick={() => handleStatusChange(appt, 'cancelled')}
                        disabled={updatingId === appt.id}
                        className="text-[10px] font-bold px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all disabled:opacity-40"
                        title="Cancel"
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => handleDelete(appt.id)}
                        className="text-[10px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>

                {appt.notes && (
                  <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{appt.notes}</p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
