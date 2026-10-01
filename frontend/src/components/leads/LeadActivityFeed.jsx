import React, { useState } from 'react'

const ACTIVITY_ICONS = {
  note: '📝',
  call: '📞',
  whatsapp: '💬',
  status_change: '🔄',
  assignment: '👤',
  followup: '📅',
}

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Counseling Note' },
  { value: 'call', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp Chat' },
  { value: 'followup', label: 'Follow-up Task' },
]

export default function LeadActivityFeed({ activities = [], onAddActivity }) {
  const [activityType, setActivityType] = useState('note')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setError('')
    setSubmitting(true)
    try {
      await onAddActivity({ activity_type: activityType, content: content.trim() })
      setContent('')
    } catch {
      setError('Failed to log activity.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Log New Activity Form */}
      <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Add Interaction Log
          </label>
          <div className="flex gap-1">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActivityType(t.value)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                  activityType === t.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {ACTIVITY_ICONS[t.value]} {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}

        <div className="flex gap-2">
          <textarea
            rows={2}
            required
            placeholder={`Log a ${activityType} note (e.g. Discussed visa requirements, sent program brochures...)`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 text-xs p-2.5 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="self-end px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-40"
          >
            {submitting ? '...' : 'Post Log'}
          </button>
        </div>
      </form>

      {/* Activity Timeline List */}
      <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">No activity logs recorded yet.</p>
        ) : (
          activities.map((act) => {
            const icon = ACTIVITY_ICONS[act.activity_type] || '📌'
            const formattedDate = act.created_at
              ? new Date(act.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''

            return (
              <div key={act.id} className="bg-white border border-gray-100 p-3 rounded-xl shadow-2xs flex items-start gap-3">
                <span className="text-sm p-1.5 bg-gray-50 rounded-lg border border-gray-100">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {act.author_name || 'System'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{formattedDate}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{act.content}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
