/**
 * LeadDetail — full-screen slide-in drawer.
 *
 * Tabs:
 *   Overview    — contact/academic/questionnaire/notes + status/assignment/follow-up date (Phase 1.2)
 *   Activity    — existing LeadActivityFeed (Phase 1.2)
 *   Notes       — internal CounsellingNotes (Phase 1.3)
 *   Follow-ups  — FollowUpList (Phase 1.3)
 *   Tasks       — TaskList (Phase 1.3)
 *   Appointments — AppointmentList (Phase 1.3)
 *
 * All counselling tabs are staff/admin only — student role never renders this
 * component (it is gated at the Dashboard level).
 */
import React, { useState, useEffect } from 'react'
import { STATUS_OPTIONS } from './LeadFilters'
import LeadActivityFeed from './LeadActivityFeed'
import CounsellingNotes from '../counselling/CounsellingNotes'
import FollowUpList from '../counselling/FollowUpList'
import TaskList from '../counselling/TaskList'
import AppointmentList from '../counselling/AppointmentList'

const TABS = [
  { key: 'overview',      label: 'Overview',      icon: '📋' },
  { key: 'activity',      label: 'Activity',       icon: '📜' },
  { key: 'notes',         label: 'Notes',          icon: '🔒' },
  { key: 'followups',     label: 'Follow-ups',     icon: '📅' },
  { key: 'tasks',         label: 'Tasks',          icon: '✅' },
  { key: 'appointments',  label: 'Appointments',   icon: '🗓' },
]

export default function LeadDetail({
  lead,
  onClose,
  onStatusChange,
  onAssignChange,
  onFollowUpChange,
  onAddActivity,
  onSendWhatsApp,      // Phase A: (message) => Promise — dispatches real WhatsApp via backend
  onRefreshLead,       // Phase 1.3: called after counselling mutations to reload lead detail
  onConvertToStudent,
  staffUsers = [],
  isAdmin = false,
  currentUserId = 0,
}) {
  const [activeTab, setActiveTab]         = useState('overview')
  const [followUpDate, setFollowUpDate]   = useState('')
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false)

  useEffect(() => {
    if (lead?.next_follow_up) {
      const d = new Date(lead.next_follow_up)
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setFollowUpDate(isoLocal)
    } else {
      setFollowUpDate('')
    }
  }, [lead])

  // Reset to overview tab when a different lead is opened
  useEffect(() => {
    setActiveTab('overview')
  }, [lead?.id])

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
    ? new Date(lead.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  // Badge counts for tab labels
  const pendingFollowUps   = (lead.follow_ups    || []).filter(f => f.status === 'pending').length
  const activeTasks        = (lead.tasks         || []).filter(t => !['completed','cancelled'].includes(t.status)).length
  const upcomingAppts      = (lead.appointments  || []).filter(a => a.status === 'scheduled').length
  const notesCount         = (lead.counselling_notes || []).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
      <div
        className="relative bg-white w-full max-w-lg h-full overflow-hidden shadow-2xl animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-slate-900 px-6 py-5 text-white flex-shrink-0">
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

          {/* Status row */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusChange(lead.id, opt.value)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                  lead.status === opt.value
                    ? opt.color + ' ring-2 ring-offset-1 ring-white/40 scale-105'
                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {isOverdue && (
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-500/30 text-red-200 border border-red-400/40 animate-pulse">
                ⏰ OVERDUE
              </span>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 overflow-x-auto flex-shrink-0">
          {TABS.map(tab => {
            let badge = null
            if (tab.key === 'notes'        && notesCount > 0)         badge = notesCount
            if (tab.key === 'followups'    && pendingFollowUps > 0)   badge = pendingFollowUps
            if (tab.key === 'tasks'        && activeTasks > 0)        badge = activeTasks
            if (tab.key === 'appointments' && upcomingAppts > 0)      badge = upcomingAppts

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-3 text-[11px] font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-white/60'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {badge !== null && (
                  <span className="ml-0.5 text-[9px] font-extrabold bg-slate-900 text-white rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Staff Assignment & Follow-Up Date */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Internal CRM Management
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Assigned Staff */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Assigned Counselor
                    </label>
                    <select
                      value={lead.assigned_to || ''}
                      onChange={(e) =>
                        onAssignChange(lead.id, e.target.value ? Number(e.target.value) : null)
                      }
                      disabled={
                        !isAdmin && lead.assigned_to && lead.assigned_to !== currentUserId
                      }
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
                      <p className="text-[10px] text-amber-700 mt-1">
                        Reassignment restricted to Admin
                      </p>
                    )}
                  </div>

                  {/* Next Follow-up Date (legacy field) */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Next Follow-Up
                    </label>
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

              {lead.status !== 'converted' && onConvertToStudent && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onConvertToStudent(lead)}
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Convert to Student
                  </button>
                </div>
              )}

              {/* Contact Details */}
              <Section title="Contact Information">
                <Row label="Full Name"           value={lead.name} />
                <Row label="Email"               value={lead.email} />
                <Row label="Phone"               value={lead.phone} />
                <Row label="Country of Residence" value={lead.country_of_residence} />
                <Row label="Source"              value={lead.source} />
                <Row label="Created Date"        value={createdDate} />
              </Section>

              {/* Academic & Preferences */}
              <Section title="Academic Profile & Preferences">
                <Row label="Qualification"        value={lead.qualification} />
                <Row label="Marks / GPA"          value={lead.marks ? `${lead.marks}%` : null} />
                <Row label="English Score"        value={lead.english_score} />
                <Row label="Budget"               value={lead.budget ? `$${Number(lead.budget).toLocaleString()}` : null} />
                <Row label="Course Interest"      value={lead.course_interest} />
                <Row label="Recommended Country"  value={lead.recommended_country} />
                <Row label="Recommended Course"   value={lead.recommended_course} />
              </Section>

              {/* Questionnaire */}
              {lead.questionnaire && (
                <Section title="Questionnaire Submission Data">
                  <Row label="Education"          value={lead.questionnaire.education_level} />
                  <Row label="Field"              value={lead.questionnaire.field_of_interest} />
                  <Row label="Preferred Countries" value={lead.questionnaire.preferred_countries?.join(', ')} />
                  <Row label="Budget Range"       value={lead.questionnaire.budget_range} />
                  <Row label="English Proficiency" value={lead.questionnaire.english_proficiency} />
                  <Row label="Intake"             value={lead.questionnaire.target_intake} />
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
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {activeTab === 'activity' && (
            <LeadActivityFeed
              activities={lead.activities || []}
              onAddActivity={(data) => onAddActivity(lead.id, data)}
              onSendWhatsApp={async (message) => {
                // Dispatch the real WhatsApp send, then refresh activity list
                // so the new WhatsApp entry appears immediately.
                await onSendWhatsApp(lead.id, message)
                if (onRefreshLead) onRefreshLead(lead.id)
              }}
            />
          )}

          {/* ── COUNSELLING NOTES ── */}
          {activeTab === 'notes' && (
            <CounsellingNotes
              leadId={lead.id}
              notes={lead.counselling_notes || []}
              onRefresh={() => onRefreshLead(lead.id)}
              isAdmin={isAdmin}
            />
          )}

          {/* ── FOLLOW-UPS ── */}
          {activeTab === 'followups' && (
            <FollowUpList
              leadId={lead.id}
              followUps={lead.follow_ups || []}
              staffUsers={staffUsers}
              onRefresh={() => onRefreshLead(lead.id)}
            />
          )}

          {/* ── TASKS ── */}
          {activeTab === 'tasks' && (
            <TaskList
              leadId={lead.id}
              tasks={lead.tasks || []}
              staffUsers={staffUsers}
              onRefresh={() => onRefreshLead(lead.id)}
            />
          )}

          {/* ── APPOINTMENTS ── */}
          {activeTab === 'appointments' && (
            <AppointmentList
              leadId={lead.id}
              appointments={lead.appointments || []}
              staffUsers={staffUsers}
              onRefresh={() => onRefreshLead(lead.id)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Shared sub-components ────────────────────────────────────────── */
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
