import React, { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { getStudentPortalMe, uploadStudentDocument } from '../api'

const REQUIRED_DOC_TYPES = [
  { type: 'Passport', label: 'Valid Passport', desc: 'Front & back bio pages' },
  { type: '10th Marksheet', label: '10th Marksheet / SLC', desc: 'Secondary school mark sheet' },
  { type: '12th Marksheet', label: '12th Marksheet / Transcript', desc: 'Higher secondary certificate' },
  { type: 'IELTS/English Score', label: 'English Proficiency Test', desc: 'IELTS / PTE / TOEFL score sheet' },
  { type: 'Bank Statement', label: 'Bank Financial Statement', desc: 'Proof of funds for visa' },
  { type: 'Photo', label: 'Passport Photo', desc: 'Recent passport-size photo' },
  { type: 'Other', label: 'Additional Documents', desc: 'SOP, recommendation letters, work exp' },
]

const FLAGS = {
  Canada:'🇨🇦', Australia:'🇦🇺', 'United Kingdom':'🇬🇧', UK:'🇬🇧',
  USA:'🇺🇸', Germany:'🇩🇪', Ireland:'🇮🇪', 'New Zealand':'🇳🇿',
  Netherlands:'🇳🇱', France:'🇫🇷', Sweden:'🇸🇪', Denmark:'🇩🇰',
  Norway:'🇳🇴', Finland:'🇫🇮', Switzerland:'🇨🇭', Singapore:'🇸🇬',
  Japan:'🇯🇵', 'South Korea':'🇰🇷', China:'🇨🇳', Malaysia:'🇲🇾',
  Italy:'🇮🇹', Spain:'🇪🇸', Portugal:'🇵🇹', Poland:'🇵🇱', UAE:'🇦🇪',
}
const flag = (name) => {
  if (!name) return ''
  for (const [k, f] of Object.entries(FLAGS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return f + ' '
  }
  return '🌍 '
}

const STEP_STATUS_BADGES = {
  pending:     { label: 'Pending',     color: 'bg-slate-700/60 text-slate-300 border-slate-600', icon: '⏳' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: '⚡' },
  completed:   { label: 'Completed',   color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: '✅' },
}

const APPLICATION_STATUS_LABELS = {
  draft: 'Draft',
  applied: 'Applied',
  under_review: 'Under Review',
  offer_received: 'Offer Received',
  conditional_offer: 'Conditional Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  enrolled: 'Enrolled',
}

const formatApplicationDate = (value) => {
  if (!value) return 'Not set'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const getDeadlineSummary = (application) => {
  if (application.deadline_status === 'upcoming') {
    return `${application.days_until_deadline} days remaining`
  }
  if (application.deadline_status === 'due_today') return 'Due Today'
  if (application.deadline_status === 'overdue') {
    return `Overdue by ${Math.abs(application.days_until_deadline)} days`
  }
  return 'No Deadline'
}

const CONSULTANCY_NAME = import.meta.env.VITE_CONSULTANCY_NAME || 'Aaradhya International Education Consultancy'
const CONSULTANCY_SHORT_NAME = import.meta.env.VITE_CONSULTANCY_SHORT_NAME || 'Aaradhya International'
const CONSULTANCY_LOGO = import.meta.env.VITE_CONSULTANCY_LOGO || '/logo.png'
const CONSULTANCY_CITY = import.meta.env.VITE_CONSULTANCY_CITY || 'Birgunj, Nepal'
const CONSULTANCY_PHONE = import.meta.env.VITE_CONSULTANCY_PHONE || '+977 9802020575'
const CONSULTANCY_EMAIL = import.meta.env.VITE_CONSULTANCY_EMAIL || 'aaradhyainternationaleducation@gmail.com'

export default function StudentPortal() {
  const navigate = useNavigate()
  const token = localStorage.getItem('aiec_token')
  const role = localStorage.getItem('aiec_role')

  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Document upload state
  const [uploadingDocType, setUploadingDocType] = useState(null)
  const [uploadNotice, setUploadNotice]         = useState('')
  const [uploadError, setUploadError]           = useState('')

  const handleDocumentUpload = async (docType, file) => {
    if (!file) return
    setUploadNotice('')
    setUploadError('')

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      setUploadError(`Invalid document format (${ext}). Only PDF, JPG, and PNG files are supported.`)
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File size exceeds 15MB limit (${(file.size / (1024*1024)).toFixed(1)}MB).`)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', docType)
    if (profile?.id) {
      formData.append('student_id', profile.id)
    }

    setUploadingDocType(docType)
    try {
      await uploadStudentDocument(formData)
      setUploadNotice(`${docType} document uploaded successfully!`)
      setTimeout(() => setUploadNotice(''), 4000)
      const res = await getStudentPortalMe()
      setProfile(res.data)
    } catch (err) {
      setUploadError(err.response?.data?.error || `Failed to upload ${docType} document.`)
    } finally {
      setUploadingDocType(null)
    }
  }

  useEffect(() => {
    if (!token || role !== 'student') return

    const loadProfile = async () => {
      try {
        const res = await getStudentPortalMe()
        setProfile(res.data)
      } catch (err) {
        setError(err.response?.data?.error || `Unable to load student profile. Please contact ${CONSULTANCY_NAME} support.`)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [token, role])

  if (!token) {
    return <Navigate to="/login" replace />
  }
  if (role !== 'student') {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogout = () => {
    localStorage.removeItem('aiec_token')
    localStorage.removeItem('aiec_user')
    localStorage.removeItem('aiec_role')
    localStorage.removeItem('aiec_last_active')
    navigate('/login', { replace: true })
  }

  const totalSteps = profile?.process_steps?.length || 0
  const completedSteps = profile?.process_steps?.filter(s => s.status === 'completed')?.length || 0
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white flex flex-col justify-between font-sans selection:bg-amber-400 selection:text-slate-900">

      {/* Header */}
      <header className="max-w-5xl mx-auto w-full px-4 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-2xl p-1.5 shadow-lg border border-amber-400/30">
            <img src={CONSULTANCY_LOGO} alt={`${CONSULTANCY_NAME} logo`} className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight text-white">
              {CONSULTANCY_SHORT_NAME}
            </h1>
            <p className="text-amber-400 text-xs font-semibold">
              Student Portal
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
        >
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8 flex-1">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 font-medium">Loading your profile & visa process tracker...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto bg-red-500/10 border border-red-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="text-3xl">⚠️</div>
            <h3 className="text-lg font-bold text-white">Access Warning</h3>
            <p className="text-xs text-red-200">{error}</p>
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <>
            {/* Student Profile Hero Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                    🎓
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        Enrolled Student Portal
                      </span>
                      {profile.student_id && (
                        <span className="text-[10px] font-mono font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-md">
                          ID: {profile.student_id}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {profile.full_name}
                    </h2>
                    <p className="text-xs text-gray-400">
                      @{profile.username} · {profile.email} · {profile.phone}
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-2xl text-left sm:text-right">
                  <span className="text-xs text-slate-400 font-semibold block">Destination Country</span>
                  <span className="text-sm font-extrabold text-amber-300">
                    {flag(profile.destination_country)}{profile.destination_country}
                  </span>
                </div>
              </div>

              {/* Process Progress Bar */}
              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/10 font-display">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Overall Visa & Enrollment Progress</span>
                  <span className="font-extrabold text-amber-400">{progressPct}% ({completedSteps}/{totalSteps} Steps Completed)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
              <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-lg">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Estimated Cost</p>
                <p className="text-2xl font-black text-white mt-1">
                  ${Number(profile.total_estimated_cost || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Sum of process steps</p>
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-lg">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Total Paid Amount</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  ${Number(profile.total_paid || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-emerald-500/80 mt-1">Verified payments</p>
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-lg">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending Balance</p>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  ${Number(profile.pending_balance || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-amber-500/80 mt-1">Remaining balance due</p>
              </div>
            </div>

            {/* Read-only university application statuses */}
            <section className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-xl font-extrabold text-white">My University Applications</h3>
                <p className="text-xs text-gray-400 mt-0.5">Application progress shared by your counselor</p>
              </div>
              {!profile.applications?.length ? (
                <p className="text-sm text-gray-400">No university applications have been added yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.applications.map(application => (
                    <article key={application.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                      <div>
                        <h4 className="font-bold text-white">{application.university_name}</h4>
                        <p className="text-sm text-gray-300">{application.course_name}</p>
                      </div>
                      {application.country_name && (
                        <p className="text-xs text-gray-400">{application.country_name}</p>
                      )}
                      <p className="text-sm text-amber-300">
                        <span className="text-gray-400">Application Status: </span>
                        {APPLICATION_STATUS_LABELS[application.status] || application.status}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-xs">
                        <div>
                          <span className="block text-gray-500">Intake</span>
                          <span className="font-semibold text-gray-200">{application.intake || 'Not specified'}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500">Applied</span>
                          <span className="font-semibold text-gray-200">{formatApplicationDate(application.applied_date)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-gray-500">Deadline</span>
                          <span className="font-semibold text-gray-200">
                            {formatApplicationDate(application.deadline)}
                            <span className={`ml-2 ${
                              application.deadline_status === 'overdue' ? 'text-red-300' :
                                application.deadline_status === 'due_today' ? 'text-amber-300' :
                                  'text-gray-400'
                            }`}>
                              {getDeadlineSummary(application)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* My Documents & Compliance Checklist */}
            <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
                <div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <span>📄 My Documents & Compliance</span>
                    <span className="text-xs bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-bold">
                      PDF, JPG, PNG (Max 15MB)
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Upload required admission and visa documents for verification</p>
                </div>
              </div>

              {uploadNotice && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold px-4 py-3 rounded-2xl flex items-center justify-between">
                  <span>✅ {uploadNotice}</span>
                  <button onClick={() => setUploadNotice('')} className="text-emerald-300 font-extrabold">✕</button>
                </div>
              )}

              {uploadError && (
                <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold px-4 py-3 rounded-2xl flex items-center justify-between">
                  <span>⚠️ {uploadError}</span>
                  <button onClick={() => setUploadError('')} className="text-red-300 font-extrabold">✕</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_DOC_TYPES.map((docItem) => {
                  const existingDoc = profile.documents?.find(d => d.document_type === docItem.type)
                  const isUploading = uploadingDocType === docItem.type

                  return (
                    <div
                      key={docItem.type}
                      className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 hover:border-white/20 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-white text-sm">{docItem.label}</h4>
                            <p className="text-[11px] text-gray-400">{docItem.desc}</p>
                          </div>

                          {/* Status Badge */}
                          {!existingDoc ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                              Not Uploaded
                            </span>
                          ) : existingDoc.verification_status === 'pending' ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap flex items-center gap-1">
                              <span>⏳</span> Pending Review
                            </span>
                          ) : existingDoc.verification_status === 'verified' ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap flex items-center gap-1">
                              <span>✅</span> Verified
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 whitespace-nowrap flex items-center gap-1">
                              <span>❌</span> Rejected
                            </span>
                          )}
                        </div>

                        {/* Existing File Info */}
                        {existingDoc && (
                          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/10 text-xs flex items-center justify-between gap-2">
                            <span className="text-gray-300 font-mono text-[11px] truncate max-w-[130px] sm:max-w-[180px]">
                              📎 {existingDoc.file_name || 'Uploaded Document'}
                            </span>
                            <a
                              href={existingDoc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline whitespace-nowrap"
                            >
                              View File ↗
                            </a>
                          </div>
                        )}

                        {/* Rejection Reason Alert */}
                        {existingDoc?.verification_status === 'rejected' && (
                          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl space-y-1">
                            <p className="text-[11px] font-extrabold text-red-300 uppercase tracking-wider flex items-center gap-1">
                              <span>⚠️</span> Counselor Feedback / Rejection Reason:
                            </p>
                            <p className="text-xs text-red-200 bg-red-950/40 p-2 rounded-lg border border-red-500/20">
                              {existingDoc.rejection_reason || 'Please re-upload a clear, readable copy of this document.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* File Upload Controls */}
                      <div className="pt-2 border-t border-white/10">
                        {existingDoc?.verification_status === 'verified' ? (
                          <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <span>🔒</span> Document verified by counselor. No further action needed.
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              disabled={isUploading}
                              id={`file-input-${docItem.type}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleDocumentUpload(docItem.type, file)
                              }}
                              className="hidden"
                            />
                            <label
                              htmlFor={`file-input-${docItem.type}`}
                              className={`w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/20 cursor-pointer text-center flex items-center justify-center gap-2 ${
                                isUploading ? 'opacity-50 pointer-events-none' : ''
                              }`}
                            >
                              {isUploading ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : existingDoc?.verification_status === 'rejected' ? (
                                <span>🔄 Re-upload {docItem.label}</span>
                              ) : existingDoc ? (
                                <span>📤 Replace {docItem.label}</span>
                              ) : (
                                <span>📤 Upload {docItem.label}</span>
                              )}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Read-Only Process Checklist */}
            <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Application & Visa Process Checklist</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Real-time status updates tracked by your counselor</p>
                </div>

                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full font-bold">
                  Read-Only Student View
                </span>
              </div>

              <div className="space-y-4">
                {profile.process_steps?.map((step, idx) => {
                  const badge = STEP_STATUS_BADGES[step.status] || STEP_STATUS_BADGES.pending
                  return (
                    <div
                      key={step.id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-sm sm:text-base">{step.step_name}</h4>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                              {badge.icon} {badge.label}
                            </span>
                          </div>

                          <p className="text-xs text-gray-400 mt-1">
                            Estimated Cost: ${Number(step.estimated_cost).toLocaleString()}
                            {step.due_date && ` · Due Date: ${step.due_date}`}
                            {step.completed_at && ` · Completed: ${new Date(step.completed_at).toLocaleDateString()}`}
                          </p>

                          {step.notes && (
                            <p className="text-xs text-amber-200/90 bg-amber-400/10 p-2 rounded-xl mt-2 border border-amber-400/20">
                              ℹ️ Counselor Note: {step.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Payment details for this step */}
                      {step.payments?.length > 0 && (
                        <div className="bg-slate-950/80 p-3 rounded-xl border border-white/10 text-xs space-y-1 w-full sm:w-auto sm:min-w-[180px]">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Payments Logged</p>
                          {step.payments.map(p => (
                            <div key={p.id} className="flex justify-between text-gray-300">
                              <span className="font-bold text-emerald-400">${Number(p.amount).toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400">{p.payment_date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Assistance Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-xs text-gray-300 space-y-3">
              <h3 className="font-bold text-white text-sm">Have Questions About Your Application?</h3>
              <p className="text-gray-400">
                Your educational counselor is monitoring your process steps daily. If you need to submit new documents or ask questions about fees, contact your support team:
              </p>
              <div className="flex flex-wrap gap-4 text-amber-300 font-semibold pt-1">
                <span>📍 {CONSULTANCY_CITY}</span>
                <span>📞 {CONSULTANCY_PHONE}</span>
                <span>📧 {CONSULTANCY_EMAIL}</span>
              </div>
            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center py-4 border-t border-white/10 text-xs text-gray-500">
        © {new Date().getFullYear()} {CONSULTANCY_NAME}. All rights reserved.
      </footer>

    </div>
  )
}
