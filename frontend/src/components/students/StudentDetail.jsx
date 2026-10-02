/**
 * StudentDetail — slide-in drawer for a single enrolled student.
 *
 * Tabs (Phase 1.4):
 *   Overview       — profile info, status selector, cost summary
 *   Checklist      — process steps + payments (all existing behaviour preserved)
 *   Documents      — staff upload + verify/reject flow (all existing behaviour preserved)
 *   Activity       — CounsellingNotes, FollowUps, Tasks, Appointments
 *                    (reuses the same counselling components used in LeadDetail)
 *
 * Props:
 *   student                  — selected StudentProfile (full detail object)
 *   onClose                  — () => void
 *   onStepStatusChange       — (stepId, newStatus) => Promise
 *   onAddStep                — () => void  (opens step modal in parent)
 *   onAddPayment             — (step) => void  (opens payment modal in parent)
 *   onDeleteStep             — (stepId) => void
 *   onVerifyDocument         — (docId, status, reason?) => Promise
 *   onRejectDocument         — (doc) => void  (opens reject modal in parent)
 *   onDeleteDocument         — (docId) => void
 *   onStaffDocUpload         — (e) => Promise  (form submit handler)
 *   onResetPassword          — (student) => void  (opens reset modal in parent)
 *   onDeleteStudent          — (studentId) => void
 *   onUpdateStatus           — (studentId, newStatus) => Promise  (Phase 1.4)
 *   onRefresh                — () => void  (refresh student + list after activity mutations)
 *   isAdmin                  — bool
 *   canResetPassword         — bool  (evaluated by parent)
 *   staffDocType             — string state
 *   setStaffDocType          — setter
 *   staffDocFile             — File | null state
 *   setStaffDocFile          — setter
 *   staffDocUploading        — bool state
 *   staffDocError            — string state
 *   stepStatusOptions        — array of { value, label, color }
 *   flag                     — (name) => emoji string
 *   staffUsers               — array of { id, name, username }
 */
import React, { useState } from 'react'
import CounsellingNotes from '../counselling/CounsellingNotes'
import FollowUpList from '../counselling/FollowUpList'
import TaskList from '../counselling/TaskList'
import AppointmentList from '../counselling/AppointmentList'

// ── Student lifecycle status config ──────────────────────────────────────

export const STUDENT_STATUS_OPTIONS = [
  { value: 'active',    label: 'Active',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'on_hold',   label: 'On Hold',   color: 'bg-amber-100   text-amber-800   border-amber-200'   },
  { value: 'graduated', label: 'Graduated', color: 'bg-blue-100    text-blue-800    border-blue-200'    },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-red-100     text-red-800     border-red-200'     },
  { value: 'deferred',  label: 'Deferred',  color: 'bg-purple-100  text-purple-800  border-purple-200'  },
]

const statusBadgeColor = (s) =>
  STUDENT_STATUS_OPTIONS.find(o => o.value === s)?.color || 'bg-gray-100 text-gray-600 border-gray-200'

// ── Tabs definition ───────────────────────────────────────────────────────

const TABS = [
  { key: 'overview',   label: 'Overview',   icon: '📋' },
  { key: 'checklist',  label: 'Checklist',  icon: '✅' },
  { key: 'documents',  label: 'Documents',  icon: '📄' },
  { key: 'activity',   label: 'Activity',   icon: '📜' },
]

// ── Component ─────────────────────────────────────────────────────────────

export default function StudentDetail({
  student,
  onClose,
  onStepStatusChange,
  onAddStep,
  onAddPayment,
  onDeleteStep,
  onVerifyDocument,
  onRejectDocument,
  onDeleteDocument,
  onStaffDocUpload,
  onResetPassword,
  onDeleteStudent,
  onUpdateStatus,
  onRefresh,
  isAdmin,
  canResetPassword,
  staffDocType,
  setStaffDocType,
  staffDocFile,
  setStaffDocFile,
  staffDocUploading,
  staffDocError,
  stepStatusOptions = [],
  flag = () => '',
  staffUsers = [],
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  if (!student) return null

  const handleStatusChange = async (newStatus) => {
    if (newStatus === student.status) return
    setUpdatingStatus(true)
    try {
      await onUpdateStatus(student.id, newStatus)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const docsCount = student.documents?.length || 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full max-w-2xl h-full overflow-hidden shadow-2xl animate-fade-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="bg-slate-900 text-white px-6 py-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-amber-400 text-slate-950 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                {student.student_id || `#${student.id}`}
              </span>
              {/* Student lifecycle status badge */}
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusBadgeColor(student.status)}`}>
                {STUDENT_STATUS_OPTIONS.find(o => o.value === student.status)?.label || student.status || 'Active'}
              </span>
              {canResetPassword && (
                <button
                  onClick={() => onResetPassword(student)}
                  className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 shadow-sm"
                  title="Reset Student Password"
                >
                  🔑 Reset Password
                </button>
              )}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-lg font-bold flex-shrink-0">✕</button>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold">{student.full_name}</h2>
              <p className="text-slate-300 text-xs">@{student.username} · {student.email} · {student.phone}</p>
              {student.lead_name && (
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  🔗 Converted from Lead: <span className="font-bold">{student.lead_name}</span>
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xs bg-white/10 border border-white/20 px-3 py-1 rounded-full font-bold">
                {flag(student.destination_country)}{student.destination_country}
              </span>
            </div>
          </div>

          {/* Cost Summary Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-center">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Estimated</p>
              <p className="text-sm font-extrabold text-white">${Number(student.total_estimated_cost || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Paid</p>
              <p className="text-sm font-extrabold text-emerald-400">${Number(student.total_paid || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Balance Due</p>
              <p className="text-sm font-extrabold text-amber-400">${Number(student.pending_balance || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
          {TABS.map(tab => {
            let badge = null
            if (tab.key === 'documents' && docsCount > 0) badge = docsCount

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-3 text-[11px] font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-white/60'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {badge !== null && (
                  <span className="ml-0.5 text-[9px] font-extrabold bg-slate-900 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Tab content ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">

              {/* Lifecycle Status Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Student Status</p>
                <div className="flex flex-wrap gap-2">
                  {STUDENT_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      disabled={updatingStatus}
                      onClick={() => handleStatusChange(opt.value)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all disabled:opacity-60 ${
                        student.status === opt.value
                          ? opt.color + ' ring-2 ring-offset-1 ring-slate-400/40 scale-105'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
                <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Profile Information</p>
                {[
                  ['Full Name',           student.full_name],
                  ['Username',            student.username ? `@${student.username}` : null],
                  ['Email',               student.email],
                  ['Phone',               student.phone],
                  ['Destination Country', student.destination_country ? `${flag(student.destination_country)}${student.destination_country}` : null],
                  ['Student ID',          student.student_id],
                  ['Enrolled Date',       student.enrollment_date],
                  ['Enrolled By',         student.enrolled_by_name],
                  ['Source Lead',         student.lead_name],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <span className="font-semibold text-gray-900 font-mono">{value}</span>
                  </div>
                ))}
                {student.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-1">Notes</p>
                    <p className="text-xs text-gray-700 bg-white p-2.5 rounded-xl border border-gray-100 whitespace-pre-wrap">{student.notes}</p>
                  </div>
                )}
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => { onClose(); onDeleteStudent(student.id) }}
                    className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-2 rounded-xl border border-red-200 transition-all"
                  >
                    🗑️ Delete Student Record (Admin Only)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── CHECKLIST TAB ────────────────────────────────────── */}
          {activeTab === 'checklist' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-base">Visa Process Checklist & Payments</h3>
                <button
                  onClick={onAddStep}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 transition-all"
                >
                  ➕ Add Custom Step
                </button>
              </div>

              <div className="space-y-3">
                {student.process_steps?.map((st, idx) => (
                  <div key={st.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{st.step_name}</p>
                          <p className="text-xs text-slate-400">
                            Est: ${Number(st.estimated_cost).toLocaleString()} · Paid: ${Number(st.total_paid).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={st.status}
                          onChange={e => onStepStatusChange(st.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer ${
                            stepStatusOptions.find(o => o.value === st.status)?.color
                          }`}
                        >
                          {stepStatusOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => onAddPayment(st)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          + Pay
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onDeleteStep(st.id)}
                            className="text-xs text-red-500 hover:text-red-700 p-1 font-bold"
                            title="Delete Step (Admin Only)"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                    {st.payments?.length > 0 && (
                      <div className="bg-white rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                        <p className="font-bold text-slate-500 text-[10px] uppercase">Recorded Payments</p>
                        {st.payments.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-slate-700">
                            <span>${Number(p.amount).toLocaleString()} ({p.payment_date}) · <span className="text-slate-400">{p.recorded_by_name}</span></span>
                            <span className="text-slate-500 italic">{p.notes}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {(!student.process_steps || student.process_steps.length === 0) && (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
                    No process steps yet. Click "Add Custom Step" to add the first one.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DOCUMENTS TAB ────────────────────────────────────── */}
          {activeTab === 'documents' && (
            <div className="p-6 space-y-5">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <span>📄 Student Documents Compliance</span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                    {docsCount} Documents
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Review uploaded documents, verify/reject status, or upload on student behalf</p>
              </div>

              {/* Upload On-Behalf-Of Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  ➕ Upload Document on Behalf of Student
                </p>
                {staffDocError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
                    ⚠️ {staffDocError}
                  </div>
                )}
                <form onSubmit={onStaffDocUpload} className="grid sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Document Type *</label>
                    <select
                      value={staffDocType}
                      onChange={e => setStaffDocType(e.target.value)}
                      className="input-field text-xs py-2 px-3"
                    >
                      <option value="Passport">Passport</option>
                      <option value="10th Marksheet">10th Marksheet</option>
                      <option value="12th Marksheet">12th Marksheet</option>
                      <option value="IELTS/English Score">IELTS/English Score</option>
                      <option value="Bank Statement">Bank Statement</option>
                      <option value="Photo">Passport Photo</option>
                      <option value="Other">Other Document</option>
                    </select>
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Select File (PDF, JPG, PNG) *</label>
                    <input
                      id="staff-doc-file-input"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      required
                      onChange={e => setStaffDocFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={staffDocUploading}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {staffDocUploading ? (
                        <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading...</>
                      ) : <>📤 Upload Doc</>}
                    </button>
                  </div>
                </form>
              </div>

              {/* Documents list */}
              <div className="space-y-3">
                {docsCount === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
                    📄 No documents uploaded yet. Use the form above or ask the student to upload via their portal.
                  </div>
                ) : (
                  student.documents.map(doc => (
                    <div
                      key={doc.id}
                      className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{doc.document_type}</span>
                          {doc.verification_status === 'pending' ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">⏳ Pending Review</span>
                          ) : doc.verification_status === 'verified' ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">✅ Verified ({doc.verified_by_name})</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">❌ Rejected</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="font-mono text-[11px]">📎 {doc.file_name || 'Document'}</span>
                          <span>· Uploaded by: <strong className="text-slate-700">{doc.uploaded_by_name}</strong></span>
                          <span>· {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        {doc.verification_status === 'rejected' && doc.rejection_reason && (
                          <p className="text-xs text-red-700 bg-red-50 p-2 rounded-xl border border-red-200 mt-1">
                            ⚠️ <strong>Rejection Reason:</strong> {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:self-center flex-wrap">
                        <a href={doc.file_url} target="_blank" rel="noreferrer"
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl border border-slate-200 transition-all">
                          👁️ View
                        </a>
                        {doc.verification_status !== 'verified' && (
                          <button onClick={() => onVerifyDocument(doc.id, 'verified')}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm">
                            ✅ Verify
                          </button>
                        )}
                        {doc.verification_status !== 'rejected' && (
                          <button onClick={() => onRejectDocument(doc)}
                            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-xl border border-amber-200 transition-all">
                            ❌ Reject
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => onDeleteDocument(doc.id)}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1.5 rounded-xl border border-red-200 transition-all"
                            title="Delete Document (Admin Only)">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── ACTIVITY TAB ─────────────────────────────────────── */}
          {activeTab === 'activity' && (
            <div className="p-5 space-y-4">
              <CounsellingNotes
                studentId={student.id}
                notes={student.counselling_notes || []}
                onRefresh={onRefresh}
                isAdmin={isAdmin}
              />
              <FollowUpList
                studentId={student.id}
                followUps={student.follow_ups || []}
                staffUsers={staffUsers}
                onRefresh={onRefresh}
              />
              <TaskList
                studentId={student.id}
                tasks={student.tasks || []}
                staffUsers={staffUsers}
                onRefresh={onRefresh}
              />
              <AppointmentList
                studentId={student.id}
                appointments={student.appointments || []}
                staffUsers={staffUsers}
                onRefresh={onRefresh}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
