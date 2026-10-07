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
import React, { useEffect, useState } from 'react'
import {
  createStudentApplication,
  completeApplicationWorkflowStep,
  deleteStudentApplication,
  getApplicationCountries,
  getApplicationDocumentChecklist,
  getCourses,
  getStudentApplications,
  linkApplicationDocument,
  updateStudentApplication,
  createApplicationOffer,
  updateApplicationOffer,
  deleteApplicationOffer,
  createApplicationTimelineEvent,
} from '../../api'
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

const APPLICATION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'offer_received', label: 'Offer Received' },
  { value: 'conditional_offer', label: 'Conditional Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'enrolled', label: 'Enrolled' },
]

const APPLICATION_STATUS_TRANSITIONS = {
  draft: ['applied', 'withdrawn'],
  applied: ['under_review', 'withdrawn'],
  under_review: ['offer_received', 'rejected', 'withdrawn'],
  offer_received: ['conditional_offer', 'rejected', 'withdrawn'],
  conditional_offer: ['enrolled', 'rejected', 'withdrawn'],
  rejected: [],
  withdrawn: [],
  enrolled: [],
}

const formatApplicationDate = (value) => {
  if (!value) return 'Not set'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
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

const EMPTY_APPLICATION = {
  course: '',
  university_name: '',
  course_name: '',
  country: '',
  country_name: '',
  status: 'draft',
  intake: '',
  applied_date: '',
  deadline: '',
  notes: '',
}

// ── Tabs definition ───────────────────────────────────────────────────────

const TABS = [
  { key: 'overview',   label: 'Overview',   icon: '📋' },
  { key: 'applications', label: 'Applications', icon: '🎓' },
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
  const [applications, setApplications] = useState(student?.applications || [])
  const [courses, setCourses] = useState([])
  const [countries, setCountries] = useState([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [countriesLoaded, setCountriesLoaded] = useState(false)
  const [applicationForm, setApplicationForm] = useState(EMPTY_APPLICATION)
  const [editingApplicationId, setEditingApplicationId] = useState(null)
  const [applicationFormOpen, setApplicationFormOpen] = useState(false)
  const [applicationLoading, setApplicationLoading] = useState(false)
  const [applicationError, setApplicationError] = useState('')
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null)
  const [updatingWorkflowStepId, setUpdatingWorkflowStepId] = useState(null)
  const [selectedApplicationDocuments, setSelectedApplicationDocuments] = useState({})
  const [linkingDocumentKey, setLinkingDocumentKey] = useState(null)
  const canManageApplicationWorkflow = isAdmin || localStorage.getItem('aiec_role') === 'staff'

  const [activeOfferApp, setActiveOfferApp] = useState(null)
  const [editingOffer, setEditingOffer] = useState(null)
  const [offerFormOpen, setOfferFormOpen] = useState(false)
  const [offerFormLoading, setOfferFormLoading] = useState(false)
  const [offerFormError, setOfferFormError] = useState('')
  const [timelineFormApplicationId, setTimelineFormApplicationId] = useState(null)
  const [timelineTitle, setTimelineTitle] = useState('')
  const [timelineDescription, setTimelineDescription] = useState('')
  const [timelineSaving, setTimelineSaving] = useState(false)
  const [timelineError, setTimelineError] = useState('')
  const [offerFormData, setOfferFormData] = useState({
    offer_type: 'conditional',
    acceptance_status: 'pending',
    received_date: '',
    response_deadline: '',
    tuition_fee: '0.00',
    deposit_amount: '0.00',
    deposit_deadline: '',
    currency: 'USD',
    conditions: '',
    notes: '',
    offer_document: '',
  })

  const startOfferForm = (app, offer = null) => {
    setActiveOfferApp(app)
    setEditingOffer(offer)
    setOfferFormError('')
    if (offer) {
      setOfferFormData({
        offer_type: offer.offer_type || 'conditional',
        acceptance_status: offer.acceptance_status || offer.status || 'pending',
        received_date: offer.received_date || '',
        response_deadline: offer.response_deadline || '',
        tuition_fee: offer.tuition_fee ? String(offer.tuition_fee) : '0.00',
        deposit_amount: offer.deposit_amount ? String(offer.deposit_amount) : '0.00',
        deposit_deadline: offer.deposit_deadline || '',
        currency: offer.currency || 'USD',
        conditions: offer.conditions || '',
        notes: offer.notes || '',
        offer_document: offer.offer_document || offer.offer_document_detail?.id || '',
      })
    } else {
      setOfferFormData({
        offer_type: 'conditional',
        acceptance_status: 'pending',
        received_date: '',
        response_deadline: '',
        tuition_fee: '0.00',
        deposit_amount: '0.00',
        deposit_deadline: '',
        currency: 'USD',
        conditions: '',
        notes: '',
        offer_document: '',
      })
    }
    setOfferFormOpen(true)
  }

  const handleOfferSubmit = async (e) => {
    e.preventDefault()
    if (!activeOfferApp) return
    setOfferFormLoading(true)
    setOfferFormError('')

    const payload = {
      ...offerFormData,
      offer_document: offerFormData.offer_document ? Number(offerFormData.offer_document) : null,
    }

    try {
      if (editingOffer) {
        await updateApplicationOffer(activeOfferApp.id, editingOffer.id, payload)
      } else {
        await createApplicationOffer(activeOfferApp.id, payload)
      }
      setOfferFormOpen(false)
      const { data } = await getStudentApplications(student.id)
      setApplications(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setOfferFormError(err.response?.data?.detail || err.response?.data?.offer_document?.[0] || 'Failed to save offer.')
    } finally {
      setOfferFormLoading(false)
    }
  }

  const handleOfferDelete = async (app, offerId) => {
    if (!window.confirm('Are you sure you want to delete this offer?')) return
    try {
      await deleteApplicationOffer(app.id, offerId)
      const { data } = await getStudentApplications(student.id)
      setApplications(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      alert('Could not delete offer.')
    }
  }

  useEffect(() => {
    setApplications(student?.applications || [])
  }, [student?.id, student?.applications])

  useEffect(() => {
    if (!student || activeTab !== 'applications' || (coursesLoaded && countriesLoaded)) return
    let cancelled = false
    const loadAllPages = async (fetchPage) => {
      const results = []
      let page = 1
      let hasNextPage = true
      while (hasNextPage) {
        const { data } = await fetchPage({ page })
        if (Array.isArray(data)) {
          results.push(...data)
          hasNextPage = false
        } else {
          results.push(...(data.results || []))
          hasNextPage = Boolean(data.next)
          page += 1
        }
      }
      return results
    }
    const loadCatalogue = async () => {
      const [allCourses, allCountries] = await Promise.all([
        loadAllPages(getCourses),
        loadAllPages(getApplicationCountries),
      ])
      if (!cancelled) {
        setCourses(allCourses)
        setCoursesLoaded(true)
        setCountries(allCountries)
        setCountriesLoaded(true)
      }
    }
    loadCatalogue()
      .catch((err) => {
        if (!cancelled) {
          setApplicationError(err.response?.data?.detail || 'Could not load application catalogues.')
        }
      })
    return () => { cancelled = true }
  }, [activeTab, coursesLoaded, countriesLoaded])

  useEffect(() => {
    if (!student || activeTab !== 'applications') return
    let cancelled = false
    getStudentApplications(student.id)
      .then(({ data }) => { if (!cancelled) setApplications(data) })
      .catch((err) => {
        if (!cancelled) {
          setApplicationError(err.response?.data?.detail || 'Could not load applications.')
        }
      })
    return () => { cancelled = true }
  }, [activeTab, student?.id])

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

  const startApplicationForm = (application = null) => {
    setApplicationError('')
    setEditingApplicationId(application?.id || null)
    setApplicationForm(application ? {
      course: application.course || '',
      university_name: application.university_name || '',
      course_name: application.course_name || '',
      country: application.country || '',
      country_name: application.country_name || '',
      status: application.status || 'draft',
      intake: application.intake || '',
      applied_date: application.applied_date || '',
      deadline: application.deadline || '',
      notes: application.notes || '',
    } : EMPTY_APPLICATION)
    setApplicationFormOpen(true)
  }

  const handleCourseChange = (courseId) => {
    const course = courses.find(item => String(item.id) === String(courseId))
    setApplicationForm(current => ({
      ...current,
      course: courseId,
      university_name: course?.university || current.university_name,
      course_name: course?.name || current.course_name,
      country: course?.country || current.country,
      country_name: course?.country_name || current.country_name,
    }))
  }

  const handleApplicationCountryChange = (countryId) => {
    const country = countries.find(item => String(item.id) === String(countryId))
    setApplicationForm(current => {
      const course = courses.find(item => String(item.id) === String(current.course))
      const courseMatchesCountry = country && course && String(course.country) === String(country.id)
      return {
        ...current,
        course: courseMatchesCountry ? current.course : '',
        country: countryId,
        country_name: country?.name || current.country_name,
      }
    })
  }

  const handleApplicationSubmit = async (event) => {
    event.preventDefault()
    setApplicationLoading(true)
    setApplicationError('')
    const payload = {
      ...applicationForm,
      course: applicationForm.course || null,
      country: applicationForm.country || null,
    }
    try {
      const response = editingApplicationId
        ? await updateStudentApplication(editingApplicationId, payload)
        : await createStudentApplication(student.id, payload)
      if (editingApplicationId) {
        setApplications(current => current.map(item => item.id === editingApplicationId ? response.data : item))
      } else {
        setApplications(current => [response.data, ...current])
      }
      setApplicationFormOpen(false)
      setEditingApplicationId(null)
      if (onRefresh) onRefresh()
    } catch (err) {
      const errors = err.response?.data
      setApplicationError(
        typeof errors === 'string' ? errors :
          errors?.status?.join(' ') ||
          errors?.non_field_errors?.join(' ') ||
          errors?.detail ||
          Object.entries(errors || {}).map(([field, messages]) =>
            `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`
          ).join(' ') ||
          'Could not save the application.'
      )
    } finally {
      setApplicationLoading(false)
    }
  }

  const handleApplicationStatusChange = async (application, newStatus) => {
    setUpdatingApplicationId(application.id)
    setApplicationError('')
    try {
      const { data } = await updateStudentApplication(application.id, { status: newStatus })
      setApplications(current => current.map(item => item.id === application.id ? data : item))
      if (onRefresh) onRefresh()
    } catch (err) {
      const statusError = err.response?.data?.status
      setApplicationError(
        Array.isArray(statusError) ? statusError.join(' ') :
          err.response?.data?.detail || 'Could not update application status.'
      )
    } finally {
      setUpdatingApplicationId(null)
    }
  }

  const handleWorkflowStepComplete = async (application, step) => {
    setUpdatingWorkflowStepId(`${application.id}:${step.id}`)
    setApplicationError('')
    try {
      const { data } = await completeApplicationWorkflowStep(application.id, step.id)
      setApplications(current => current.map(item => item.id === application.id ? data : item))
      if (onRefresh) onRefresh()
    } catch (err) {
      setApplicationError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Could not update application progress.'
      )
    } finally {
      setUpdatingWorkflowStepId(null)
    }
  }

  const refreshApplicationChecklist = async (applicationId) => {
    const { data } = await getApplicationDocumentChecklist(applicationId)
    setApplications(current => current.map(application => (
      application.id === applicationId
        ? { ...application, document_checklist: data }
        : application
    )))
  }

  const handleLinkApplicationDocument = async (application, requirement) => {
    const key = `${application.id}:${requirement.id}`
    const documentId = selectedApplicationDocuments[key]
    if (!documentId) return
    setLinkingDocumentKey(key)
    setApplicationError('')
    try {
      await linkApplicationDocument(application.id, requirement.id, documentId)
      await refreshApplicationChecklist(application.id)
      if (onRefresh) onRefresh()
    } catch (err) {
      setApplicationError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Could not link the student document.'
      )
    } finally {
      setLinkingDocumentKey(null)
    }
  }

  const handleApplicationDelete = async (application) => {
    if (!isAdmin || !window.confirm(`Delete the application to ${application.university_name}?`)) return
    setApplicationError('')
    try {
      await deleteStudentApplication(application.id)
      setApplications(current => current.filter(item => item.id !== application.id))
      if (onRefresh) onRefresh()
    } catch (err) {
      setApplicationError(err.response?.data?.detail || 'Could not delete application.')
    }
  }

  const handleTimelineSubmit = async (event, application) => {
    event.preventDefault()
    setTimelineError('')
    setTimelineSaving(true)
    try {
      const { data } = await createApplicationTimelineEvent(application.id, {
        title: timelineTitle,
        description: timelineDescription,
      })
      setApplications(current => current.map(item => (
        item.id === application.id
          ? {
              ...item,
              timeline_events: [...(item.timeline_events || []), data].sort(
                (left, right) => new Date(left.created_at) - new Date(right.created_at)
              ),
            }
          : item
      )))
      setTimelineTitle('')
      setTimelineDescription('')
      setTimelineFormApplicationId(null)
    } catch (err) {
      setTimelineError(
        err.response?.data?.detail ||
        err.response?.data?.title?.[0] ||
        'Could not add the timeline entry.'
      )
    } finally {
      setTimelineSaving(false)
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
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-6 border-b border-slate-800 flex-shrink-0">
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
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-extrabold truncate">{student.full_name}</h2>
              <p className="text-slate-300 text-xs truncate">@{student.username} · {student.email} · {student.phone}</p>
              {student.lead_name && (
                <p className="text-[11px] text-amber-300/80 mt-0.5 truncate">
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
              <p className="text-xs sm:text-sm font-extrabold text-white">${Number(student.total_estimated_cost || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Paid</p>
              <p className="text-xs sm:text-sm font-extrabold text-emerald-400">${Number(student.total_paid || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Balance Due</p>
              <p className="text-xs sm:text-sm font-extrabold text-amber-400">${Number(student.pending_balance || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 overflow-x-auto no-scrollbar scrollbar-none flex-shrink-0">
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

          {/* ── APPLICATIONS TAB ─────────────────────────────────── */}
          {activeTab === 'applications' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">University Applications</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Manage independent applications for this student.</p>
                </div>
                <button
                  onClick={() => startApplicationForm()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all flex-shrink-0"
                >
                  + Add Application
                </button>
              </div>

              {applicationError && (
                <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                  {applicationError}
                </p>
              )}

              {applicationFormOpen && (
                <form onSubmit={handleApplicationSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">{editingApplicationId ? 'Edit Application' : 'New Application'}</h4>
                    <button type="button" onClick={() => setApplicationFormOpen(false)} className="text-gray-500 hover:text-gray-800 text-sm" aria-label="Close application form">✕</button>
                  </div>
                  <label className="block text-xs font-semibold text-gray-600">
                    Course from catalogue (optional)
                    <select
                      value={applicationForm.course}
                      onChange={e => handleCourseChange(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                    >
                      <option value="">Enter course details manually</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.name} — {course.university}{course.country_name ? ` (${course.country_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Country workflow (optional)
                    <select
                      value={applicationForm.country}
                      onChange={e => handleApplicationCountryChange(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                    >
                      <option value="">No platform workflow</option>
                      {countries.map(country => (
                        <option key={country.id} value={country.id}>{country.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      ['university_name', 'University', true],
                      ['course_name', 'Course / Program', true],
                      ['country_name', 'Country', false],
                      ['intake', 'Intake', false],
                    ].map(([field, label, required]) => (
                      <label key={field} className="block text-xs font-semibold text-gray-600">
                        {label}
                        <input
                          required={required}
                          maxLength={field === 'university_name' || field === 'course_name' ? 200 : field === 'intake' ? 50 : 100}
                          value={applicationForm[field]}
                          onChange={e => setApplicationForm(current => ({
                            ...current,
                            [field]: e.target.value,
                            ...(field === 'country_name' ? { course: '', country: '' } : {}),
                          }))}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                        />
                      </label>
                    ))}
                    <label className="block text-xs font-semibold text-gray-600">
                      Status
                      <select
                        value={applicationForm.status}
                        onChange={e => setApplicationForm(current => ({ ...current, status: e.target.value }))}
                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                      >
                        {APPLICATION_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    {[
                      ['applied_date', 'Applied date'],
                      ['deadline', 'Deadline'],
                    ].map(([field, label]) => (
                      <label key={field} className="block text-xs font-semibold text-gray-600">
                        {label}
                        <input
                          type="date"
                          value={applicationForm[field]}
                          onChange={e => setApplicationForm(current => ({ ...current, [field]: e.target.value }))}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block text-xs font-semibold text-gray-600">
                    Notes
                    <textarea
                      value={applicationForm.notes}
                      onChange={e => setApplicationForm(current => ({ ...current, notes: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={applicationLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-xl"
                  >
                    {applicationLoading ? 'Saving…' : (editingApplicationId ? 'Save Changes' : 'Create Application')}
                  </button>
                </form>
              )}

              {applications.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
                  No university applications yet. Add the first one above.
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map(application => (
                    <article key={application.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-extrabold text-slate-900">{application.university_name}</h4>
                          <p className="text-sm text-slate-600">{application.course_name}</p>
                          {application.country_name && (
                            <p className="text-xs text-slate-400 mt-1">{application.country_name}</p>
                          )}
                        </div>
                        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                          Status
                          <select
                            aria-label={`Status for ${application.university_name}`}
                            value={application.status}
                            disabled={updatingApplicationId === application.id}
                            onChange={e => handleApplicationStatusChange(application, e.target.value)}
                            className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-60"
                          >
                            {APPLICATION_STATUS_OPTIONS
                              .filter(option => option.value === application.status || APPLICATION_STATUS_TRANSITIONS[application.status]?.includes(option.value))
                              .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                        <div>
                          <span className="block text-slate-400">Intake</span>
                          <span className="font-semibold text-slate-700">{application.intake || 'Not specified'}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400">Applied</span>
                          <span className="font-semibold text-slate-700">{formatApplicationDate(application.applied_date)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-slate-400">Deadline</span>
                          <span className="font-semibold text-slate-700">
                            {formatApplicationDate(application.deadline)}
                            <span className={`ml-2 ${
                              application.deadline_status === 'overdue' ? 'text-red-600' :
                                application.deadline_status === 'due_today' ? 'text-amber-700' :
                                  'text-slate-500'
                            }`}>
                              {getDeadlineSummary(application)}
                            </span>
                          </span>
                        </div>
                      </div>
                      {application.workflow_steps?.length > 0 && (
                        <div className="border-t border-slate-100 pt-3">
                          <h5 className="text-xs font-bold text-slate-700 mb-2">
                            {application.workflow_name || 'Country application milestones'}
                          </h5>
                          <ol className="space-y-2">
                            {application.workflow_steps.map(step => (
                              <li key={step.id} className="flex items-center justify-between gap-3 text-xs">
                                <span className={step.completed ? 'text-emerald-700' : 'text-slate-600'}>
                                  {step.completed ? '✓' : '○'} {step.name}
                                  {step.completed_by_name && (
                                    <span className="text-slate-400"> · {step.completed_by_name}</span>
                                  )}
                                </span>
                                {canManageApplicationWorkflow && !step.completed && (
                                  <button
                                    type="button"
                                    disabled={updatingWorkflowStepId === `${application.id}:${step.id}`}
                                    onClick={() => handleWorkflowStepComplete(application, step)}
                                    className="flex-shrink-0 text-[11px] font-bold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                                  >
                                    {updatingWorkflowStepId === `${application.id}:${step.id}` ? 'Saving…' : 'Mark complete'}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {application.document_checklist?.status === 'available' ? (
                        <div className="border-t border-slate-100 pt-3">
                          {(() => {
                            const requirements = application.document_checklist.requirements || []
                            const requiredRequirements = requirements.filter(item => item.required)
                            const verifiedRequired = requiredRequirements.filter(item => item.status === 'verified').length
                            return (
                              <>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <h5 className="text-xs font-bold text-slate-700">Application Documents</h5>
                                  <span className="text-[11px] text-slate-500">
                                    {verifiedRequired} / {requiredRequirements.length} required verified
                                  </span>
                                </div>
                                <ol className="space-y-3">
                                  {requirements.map(requirement => {
                                    const linkedDocument = requirement.document
                                    const matchingDocuments = (student.documents || []).filter(
                                      document => document.document_type === requirement.document_type
                                    )
                                    const key = `${application.id}:${requirement.id}`
                                    const badge = {
                                      missing: ['○', 'Missing', 'text-slate-500'],
                                      submitted: ['⏳', 'Pending Review', 'text-amber-700'],
                                      verified: ['✅', 'Verified', 'text-emerald-700'],
                                      rejected: ['❌', 'Rejected', 'text-red-700'],
                                    }[requirement.status] || ['○', requirement.status, 'text-slate-500']
                                    return (
                                      <li key={requirement.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div>
                                            <p className="font-semibold text-slate-800">
                                              {requirement.label}
                                              {!requirement.required && <span className="ml-1 text-slate-400">(Optional)</span>}
                                            </p>
                                            {requirement.description && (
                                              <p className="mt-0.5 text-slate-500">{requirement.description}</p>
                                            )}
                                          </div>
                                          <span className={`font-bold ${badge[2]}`}>{badge[0]} {badge[1]}</span>
                                        </div>
                                        {linkedDocument && (
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <a
                                              href={linkedDocument.file_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="font-semibold text-blue-700 underline"
                                            >
                                              {linkedDocument.file_name || 'View submitted document'}
                                            </a>
                                            {canManageApplicationWorkflow && requirement.status !== 'verified' && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => onVerifyDocument(linkedDocument.id, 'verified')}
                                                  className="font-bold text-emerald-700 hover:text-emerald-900"
                                                >
                                                  Verify
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => onRejectDocument(linkedDocument)}
                                                  className="font-bold text-red-700 hover:text-red-900"
                                                >
                                                  Reject
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                        {requirement.status === 'rejected' && linkedDocument?.rejection_reason && (
                                          <p className="mt-2 text-red-700">
                                            Rejection reason: {linkedDocument.rejection_reason}
                                          </p>
                                        )}
                                        {canManageApplicationWorkflow && ['missing', 'rejected'].includes(requirement.status) && matchingDocuments.length > 0 && (
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <select
                                              aria-label={`Existing ${requirement.label} document`}
                                              value={selectedApplicationDocuments[key] || ''}
                                              onChange={event => setSelectedApplicationDocuments(current => ({
                                                ...current,
                                                [key]: event.target.value,
                                              }))}
                                              className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                                            >
                                              <option value="">Link existing student document</option>
                                              {matchingDocuments.map(document => (
                                                <option key={document.id} value={document.id}>
                                                  {document.file_name || `Document ${document.id}`} ({document.verification_status})
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              disabled={!selectedApplicationDocuments[key] || linkingDocumentKey === key}
                                              onClick={() => handleLinkApplicationDocument(application, requirement)}
                                              className="font-bold text-blue-700 disabled:opacity-50"
                                            >
                                              {linkingDocumentKey === key ? 'Linking…' : 'Link'}
                                            </button>
                                          </div>
                                        )}
                                      </li>
                                    )
                                  })}
                                </ol>
                              </>
                            )
                          })()}
                        </div>
                      ) : null}
                      {/* ── OFFERS TRACKING SECTION ── */}
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-700">University Offers</h5>
                          {canManageApplicationWorkflow && (
                            <button
                              type="button"
                              onClick={() => startOfferForm(application)}
                              className="text-[11px] font-bold text-blue-700 hover:text-blue-900"
                            >
                              + Add Offer
                            </button>
                          )}
                        </div>
                        {(!application.offers || application.offers.length === 0) ? (
                          <p className="text-[11px] text-slate-400 italic">No offers logged yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {application.offers.map(offer => (
                              <div key={offer.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-900">
                                      {offer.offer_type === 'conditional' ? 'Conditional Offer' :
                                       offer.offer_type === 'unconditional' ? 'Unconditional Offer' :
                                       offer.offer_type === 'deferred' ? 'Deferred Offer' : offer.offer_type}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      offer.acceptance_status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                                      offer.acceptance_status === 'declined' ? 'bg-red-100 text-red-800' :
                                      offer.acceptance_status === 'expired' ? 'bg-slate-200 text-slate-700' :
                                      'bg-amber-100 text-amber-800'
                                    }`}>
                                      {(offer.acceptance_status || offer.status || 'PENDING').toUpperCase()}
                                    </span>
                                  </div>
                                  {canManageApplicationWorkflow && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startOfferForm(application, offer)}
                                        className="font-bold text-slate-600 hover:text-slate-900 text-[11px]"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOfferDelete(application, offer.id)}
                                        className="font-bold text-red-600 hover:text-red-800 text-[11px]"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
                                  {offer.received_date && (
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Received</span>
                                      <span className="font-semibold">{formatApplicationDate(offer.received_date)}</span>
                                    </div>
                                  )}
                                  {offer.response_deadline && (
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Response Deadline</span>
                                      <span className="font-semibold text-amber-800">{formatApplicationDate(offer.response_deadline)}</span>
                                    </div>
                                  )}
                                  {Number(offer.tuition_fee) > 0 && (
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Tuition Fee</span>
                                      <span className="font-semibold">{offer.currency || 'USD'} {Number(offer.tuition_fee).toLocaleString()}</span>
                                    </div>
                                  )}
                                  {Number(offer.deposit_amount) > 0 && (
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Deposit Amount</span>
                                      <span className="font-semibold">{offer.currency || 'USD'} {Number(offer.deposit_amount).toLocaleString()}</span>
                                    </div>
                                  )}
                                  {offer.deposit_deadline && (
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Deposit Deadline</span>
                                      <span className="font-semibold">{formatApplicationDate(offer.deposit_deadline)}</span>
                                    </div>
                                  )}
                                </div>

                                {offer.conditions && (
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Conditions</span>
                                    <p className="text-slate-700 whitespace-pre-line text-xs">{offer.conditions}</p>
                                  </div>
                                )}

                                {offer.offer_document_detail && (
                                  <div className="pt-1">
                                    <a
                                      href={offer.offer_document_detail.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-bold text-blue-700 hover:underline flex items-center gap-1"
                                    >
                                      📄 Offer Letter ({offer.offer_document_detail.file_name})
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <section className="border-t border-slate-100 pt-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-slate-700">Application Timeline</h5>
                          {canManageApplicationWorkflow && (
                            <button
                              type="button"
                              onClick={() => {
                                setTimelineError('')
                                setTimelineFormApplicationId(
                                  timelineFormApplicationId === application.id ? null : application.id
                                )
                              }}
                              className="text-[11px] font-bold text-blue-700 hover:text-blue-900"
                            >
                              {timelineFormApplicationId === application.id ? 'Cancel' : '+ Add Entry'}
                            </button>
                          )}
                        </div>
                        {timelineError && timelineFormApplicationId === application.id && (
                          <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{timelineError}</p>
                        )}
                        {timelineFormApplicationId === application.id && (
                          <form onSubmit={event => handleTimelineSubmit(event, application)} className="space-y-2 rounded-xl bg-slate-50 p-3">
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Title
                              <input
                                required
                                maxLength={200}
                                value={timelineTitle}
                                onChange={event => setTimelineTitle(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                              />
                            </label>
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Description
                              <textarea
                                value={timelineDescription}
                                onChange={event => setTimelineDescription(event.target.value)}
                                rows={2}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                              />
                            </label>
                            <button
                              type="submit"
                              disabled={timelineSaving}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                            >
                              {timelineSaving ? 'Saving…' : 'Add Timeline Entry'}
                            </button>
                          </form>
                        )}
                        {!application.timeline_events?.length ? (
                          <p className="text-[11px] italic text-slate-400">No timeline events recorded yet.</p>
                        ) : (
                          <ol className="space-y-3 border-l border-slate-200 pl-3">
                            {application.timeline_events.map(item => (
                              <li key={item.id} className="relative text-xs">
                                <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-amber-400" />
                                <p className="font-bold text-slate-800">{item.title}</p>
                                {item.description && <p className="mt-0.5 whitespace-pre-line text-slate-600">{item.description}</p>}
                                <p className="mt-1 text-[10px] text-slate-400">
                                  {new Date(item.created_at).toLocaleString()}
                                  {item.actor_name ? ` · ${item.actor_name}` : ''}
                                </p>
                              </li>
                            ))}
                          </ol>
                        )}
                      </section>

                      {application.notes && <p className="text-xs text-gray-600 whitespace-pre-wrap">{application.notes}</p>}
                      <div className="flex gap-2 border-t border-gray-100 pt-2">
                        <button onClick={() => startApplicationForm(application)} className="text-xs font-bold text-slate-700 hover:text-slate-900">Edit</button>
                        {isAdmin && (
                          <button onClick={() => handleApplicationDelete(application)} className="text-xs font-bold text-red-600 hover:text-red-700">Delete</button>
                        )}
                      </div>
                    </article>
                  ))}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
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

      {/* ── OFFER MODAL ────────────────────────────────────── */}
      {offerFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingOffer ? 'Edit University Offer' : 'Add University Offer'}
              </h3>
              <button
                type="button"
                onClick={() => setOfferFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            {offerFormError && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {offerFormError}
              </p>
            )}
            <form onSubmit={handleOfferSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Offer Type</span>
                  <select
                    value={offerFormData.offer_type}
                    onChange={e => setOfferFormData(prev => ({ ...prev, offer_type: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2 bg-white font-semibold"
                  >
                    <option value="conditional">Conditional Offer</option>
                    <option value="unconditional">Unconditional Offer</option>
                    <option value="deferred">Deferred Offer</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Acceptance Status</span>
                  <select
                    value={offerFormData.acceptance_status}
                    onChange={e => setOfferFormData(prev => ({ ...prev, acceptance_status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2 bg-white font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Received Date</span>
                  <input
                    type="date"
                    value={offerFormData.received_date}
                    onChange={e => setOfferFormData(prev => ({ ...prev, received_date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Response Deadline</span>
                  <input
                    type="date"
                    value={offerFormData.response_deadline}
                    onChange={e => setOfferFormData(prev => ({ ...prev, response_deadline: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block space-y-1 col-span-2">
                  <span className="font-bold text-slate-700">Tuition Fee</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={offerFormData.tuition_fee}
                    onChange={e => setOfferFormData(prev => ({ ...prev, tuition_fee: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Currency</span>
                  <input
                    type="text"
                    value={offerFormData.currency}
                    onChange={e => setOfferFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2 uppercase"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Deposit Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={offerFormData.deposit_amount}
                    onChange={e => setOfferFormData(prev => ({ ...prev, deposit_amount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-700">Deposit Deadline</span>
                  <input
                    type="date"
                    value={offerFormData.deposit_deadline}
                    onChange={e => setOfferFormData(prev => ({ ...prev, deposit_deadline: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-bold text-slate-700">Conditions</span>
                <textarea
                  rows="2"
                  value={offerFormData.conditions}
                  onChange={e => setOfferFormData(prev => ({ ...prev, conditions: e.target.value }))}
                  placeholder="e.g. IELTS 6.5, Final Degree Certificate"
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-bold text-slate-700">Offer Document (Letter)</span>
                <select
                  value={offerFormData.offer_document}
                  onChange={e => setOfferFormData(prev => ({ ...prev, offer_document: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 p-2 bg-white"
                >
                  <option value="">No document attached</option>
                  {(student.documents || []).map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.file_name || `Document ${doc.id}`} ({doc.document_type})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-bold text-slate-700">Internal Staff Notes</span>
                <textarea
                  rows="2"
                  value={offerFormData.notes}
                  onChange={e => setOfferFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Staff only internal notes"
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOfferFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offerFormLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {offerFormLoading ? 'Saving...' : editingOffer ? 'Save Offer' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
