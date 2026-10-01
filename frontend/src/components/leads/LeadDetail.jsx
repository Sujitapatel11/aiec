import React, { useState, useEffect } from 'react'
import { STATUS_OPTIONS } from './LeadFilters'
import LeadActivityFeed from './LeadActivityFeed'

export default function LeadDetail({
  lead,
  onClose,
  onStatusChange,
  onAssignChange,
  onFollowUpChange,
  onAddActivity,
  staffUsers = [],
  isAdmin = false,
  currentUserId = 0
}) {
  const [followUpDate, setFollowUpDate] = useState('')
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false)

  useEffect(() => {
    if (lead?.next_follow_up) {
      // Format ISO to YYYY-MM-DDTHH:mm for datetime-local input
      const d = new Date(lead.next_follow_up)
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setFollowUpDate(isoLocal)
    } else {
      setFollowUpDate('')
    }
  }, [lead])

  if (!lead) return null

  const handleSaveFollowUp = async (e) => {
    e.preventDefault()
    setUpdatingFollowUp(true)
    try {
      const val = followUpDate ? new Date(followUpDate).toISOString() : null
      await onFollowUpChange(lead.id, val)
    } finally {
      setUpdatingFollowUp(false)
    }
  }

  const isOverdue = lead.is_overdue || (
    lead.next_follow_up &&
    new Date(lead.next_follow_up) < new Date() &&
    !['converted', 'lost'].includes(lead.status)
  )

  const createdDate = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
      <div
        className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Lead #{lead.id} · {lead.source || 'crm_manual'}
            </span>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 text-lg font-bold">
              ✕
            </button>
          </div>
          <h2 className="text-xl font-extrabold truncate">{lead.name}</h2>
          <p className="text-xs text-blue-200 truncate">{lead.email} · {lead.phone}</p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">

          {/* CRM Status & Overdue Alert */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lead Status</p>
              {isOverdue && (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  ⏰ OVERDUE FOLLOW-UP
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onStatusChange(lead.id, opt.value)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                    lead.status === opt.value
                      ? opt.color + ' ring-2 ring-offset-1 ring-slate-800 scale-105'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Assignment & Follow-Up Date */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Internal CRM Management</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Assigned Staff */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Assigned Counselor</label>
                <select
                  value={lead.assigned_to || ''}
                  onChange={(e) => onAssignChange(lead.id, e.target.value ? Number(e.target.value) : null)}
                  disabled={!isAdmin && lead.assigned_to && lead.assigned_to !== currentUserId}
                  className="w-full text-xs py-2 px-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-800 focus:border-slate-800 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
                {!isAdmin && lead.assigned_to && lead.assigned_to !== currentUserId && (
                  <p className="text-[10px] text-amber-700 mt-1">Reassignment restricted to Admin</p>
                )}
              </div>

              {/* Next Follow-up Date */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Next Follow-Up</label>
                <form onSubmit={handleSaveFollowUp} className="flex gap-1">
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-2 bg-white border border-gray-200 rounded-xl font-mono text-gray-800 focus:border-slate-800 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={updatingFollowUp}
                    className="px-2.5 py-1.5 bg-slate-900 text-white font-bold text-[11px] rounded-xl hover:bg-slate-800 transition-all flex-shrink-0"
                  >
                    Set
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <Section title="Contact Information">
            <Row label="Full Name" value={lead.name} />
            <Row label="Email" value={lead.email} />
            <Row label="Phone" value={lead.phone} />
            <Row label="Country of Residence" value={lead.country_of_residence} />
            <Row label="Source" value={lead.source} />
            <Row label="Created Date" value={createdDate} />
          </Section>

          {/* Academic & Preferences */}
          <Section title="Academic Profile & Preferences">
            <Row label="Qualification" value={lead.qualification} />
            <Row label="Marks / GPA" value={lead.marks ? `${lead.marks}%` : null} />
            <Row label="English Score" value={lead.english_score} />
            <Row label="Budget" value={lead.budget ? `$${Number(lead.budget).toLocaleString()}` : null} />
            <Row label="Course Interest" value={lead.course_interest} />
            <Row label="Recommended Country" value={lead.recommended_country} />
            <Row label="Recommended Course" value={lead.recommended_course} />
          </Section>

          {/* Questionnaire Details if present */}
          {lead.questionnaire && (
            <Section title="Questionnaire Submission Data">
              <Row label="Education" value={lead.questionnaire.education_level} />
              <Row label="Field" value={lead.questionnaire.field_of_interest} />
              <Row label="Preferred Countries" value={lead.questionnaire.preferred_countries?.join(', ')} />
              <Row label="Budget Range" value={lead.questionnaire.budget_range} />
              <Row label="English Proficiency" value={lead.questionnaire.english_proficiency} />
              <Row label="Intake" value={lead.questionnaire.target_intake} />
            </Section>
          )}

          {/* Lead Notes */}
          {lead.notes && (
            <Section title="Initial Lead Notes">
              <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-wrap">
                {lead.notes}
              </p>
            </Section>
          )}

          {/* Activity Timeline & Log Entry */}
          <div className="pt-2">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-3">Activity & Counseling History</h3>
            <LeadActivityFeed
              activities={lead.activities || []}
              onAddActivity={(data) => onAddActivity(lead.id, data)}
            />
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
      <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="font-semibold text-gray-900 font-mono">{value}</span>
    </div>
  )
}
