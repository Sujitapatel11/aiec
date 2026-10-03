import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLeads, createLead, getLead, getDashboardStats, updateLead, adminLogout,
  getStaffUsers, addLeadActivity,
  getStudents, getStudentDetail, enrollStudent, deleteStudent,
  updateStudentProfile, convertLeadToStudent,
  addProcessStep, updateProcessStep, deleteProcessStep, addStepPayment,
  getVideoTestimonials, uploadVideoTestimonial, updateVideoTestimonial, deleteVideoTestimonial,
  uploadStudentDocument, verifyStudentDocument, deleteStudentDocument,
  resetStudentPassword,
  sendLeadWhatsApp,
} from '../api'

import LeadFilters from '../components/leads/LeadFilters'
import LeadList from '../components/leads/LeadList'
import LeadForm from '../components/leads/LeadForm'
import LeadDetail from '../components/leads/LeadDetail'
import StudentDetail from '../components/students/StudentDetail'

/* ── Constants ─────────────────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted',    label: 'Contacted',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'applied',      label: 'Applied',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'visa_process', label: 'Visa Process', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'converted',    label: 'Converted',    color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost',         label: 'Lost',         color: 'bg-red-100 text-red-700 border-red-200' },
]

const LEAD_SOURCE_OPTIONS = [
  { value: 'crm_manual', label: 'CRM Manual' },
  { value: 'ai_assessment', label: 'AI Assessment' },
  { value: 'whatsapp_inquiry', label: 'WhatsApp Inquiry' },
  { value: 'chatbot', label: 'Chatbot' },
]

const EMPTY_LEAD_FORM = {
  name: '', email: '', phone: '', country_of_residence: '', qualification: '',
  marks: '', english_score: '', budget: '', course_interest: '',
  recommended_country: '', recommended_course: '', status: 'new',
  source: 'crm_manual', notes: '',
}

const STEP_STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending',     color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'completed',   label: 'Completed',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
]
const STUDENT_PAGE_SIZE = 20

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

/* ── Stat card ─────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 sm:p-5 flex items-center gap-2.5 sm:gap-4">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ${accent}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-lg sm:text-2xl font-extrabold text-gray-900 leading-tight truncate">{value}</p>
        <p className="text-[11px] sm:text-xs font-medium text-gray-500 truncate">{label}</p>
        {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Main Dashboard ────────────────────────────────────────────────── */
export default function Dashboard() {
  const [activeTab, setActiveTab]         = useState('leads') // 'leads' | 'students'
  const [leads, setLeads]                 = useState([])
  const [stats, setStats]                 = useState(null)
  const [loading, setLoading]             = useState(true)

  // Pagination & filter
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [totalCount, setTotalCount]       = useState(0)
  const [statusFilter, setStatusFilter]   = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [courseFilter, setCourseFilter]   = useState('')
  const [search, setSearch]               = useState('')
  const [selectedLead, setSelectedLead]   = useState(null)
  const [leadModal, setLeadModal]         = useState(false)
  const [leadForm, setLeadForm]           = useState(EMPTY_LEAD_FORM)
  const [leadFormError, setLeadFormError] = useState('')
  const [leadSaving, setLeadSaving]       = useState(false)

  // Students tab state
  const [students, setStudents]           = useState([])
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentError, setStudentError]   = useState('')
  const [studentPage, setStudentPage]     = useState(1)
  const [studentTotalPages, setStudentTotalPages] = useState(1)
  const [studentTotalCount, setStudentTotalCount] = useState(0)
  const [studentSearch, setStudentSearch]   = useState('')
  const [studentStatusFilter, setStudentStatusFilter] = useState('') // Phase 1.4
  const studentRequestId = useRef(0)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [enrollModal, setEnrollModal]     = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [generatedStudentId, setGeneratedStudentId] = useState('')
  const [copied, setCopied]               = useState(false)

  // Convert Lead → Student modal state (Phase 1.4)
  const [convertModal, setConvertModal]   = useState(null) // holds lead object when open
  const [convertForm, setConvertForm]     = useState({ username: '', destination_country: '', notes: '' })
  const [convertError, setConvertError]   = useState('')
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertResult, setConvertResult]   = useState(null) // holds response on success
  const [convertCopied, setConvertCopied] = useState(false)
  const convertRequestInFlight = useRef(false)

  // Custom step modal & payment modal
  const [stepModal, setStepModal]         = useState(false)
  const [paymentModalStep, setPaymentModalStep] = useState(null)

  // Form states
  const [enrollForm, setEnrollForm]       = useState({ full_name: '', username: '', email: '', phone: '', destination_country: '', notes: '' })
  const [enrollError, setEnrollError]     = useState('')
  const [stepForm, setStepForm]           = useState({ step_name: '', estimated_cost: 0, due_date: '', notes: '' })
  const [paymentForm, setPaymentForm]     = useState({ amount: '', notes: '' })
  const [actionNotice, setActionNotice]   = useState('')

  // Document management state
  const [rejectModalDoc, setRejectModalDoc]   = useState(null)
  const [rejectReasonInput, setRejectReasonInput] = useState('')
  const [staffDocType, setStaffDocType]     = useState('Passport')
  const [staffDocFile, setStaffDocFile]     = useState(null)
  const [staffDocUploading, setStaffDocUploading] = useState(false)
  const [staffDocError, setStaffDocError]   = useState('')

  // Reset student password state
  const [resetStudentModal, setResetStudentModal] = useState(null)
  const [resetStudentPasswordInput, setResetStudentPasswordInput] = useState('')
  const [resetStudentError, setResetStudentError] = useState('')
  const [resetStudentLoading, setResetStudentLoading] = useState(false)

  const navigate = useNavigate()

  const userName = localStorage.getItem('aiec_user') || 'Admin'
  const userRole = localStorage.getItem('aiec_role') || 'staff'
  const isAdmin  = userRole === 'admin'
  const currentUserId = Number(localStorage.getItem('aiec_user_id') || 0)
  const currentUserName = localStorage.getItem('aiec_user') || ''

  const canResetStudentPassword = (st) => {
    if (!st) return false
    if (isAdmin) return true
    if (st.enrolled_by && Number(st.enrolled_by) === currentUserId) return true
    if (st.enrolled_by_name && st.enrolled_by_name === currentUserName) return true
    return false
  }

  const handleResetStudentSubmit = async (e) => {
    e.preventDefault()
    if (!resetStudentModal) return
    setResetStudentError('')
    setResetStudentLoading(true)
    try {
      const res = await resetStudentPassword(resetStudentModal.id, { new_password: resetStudentPasswordInput })
      setActionNotice(res.data?.message || `Password for student '${resetStudentModal.full_name}' has been reset successfully.`)
      setTimeout(() => setActionNotice(''), 4000)
      setResetStudentModal(null)
      setResetStudentPasswordInput('')
    } catch (err) {
      setResetStudentError(err.response?.data?.error || 'Failed to reset student password.')
    } finally {
      setResetStudentLoading(false)
    }
  }

  const fetchStats = useCallback(async () => {
    try {
      const res = await getDashboardStats()
      setStats(res.data)
    } catch {
      // stats error fallback
    }
  }, [])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLeads(page, {
        status: statusFilter || undefined,
        search: search || undefined,
        country: countryFilter || undefined,
        course: courseFilter || undefined,
      })
      const data = res.data
      setLeads(data.results || data)
      setTotalCount(data.count || (data.results || data).length)
      setTotalPages(Math.ceil((data.count || 1) / 10))
    } catch {
      // Lead list falls back to its existing empty/loading presentation.
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search, countryFilter, courseFilter])

  const fetchStudents = useCallback(async () => {
    const requestId = ++studentRequestId.current
    setStudentLoading(true)
    setStudentError('')
    try {
      const params = { page: studentPage, page_size: STUDENT_PAGE_SIZE }
      if (studentStatusFilter) params.status = studentStatusFilter
      if (studentSearch)       params.search = studentSearch
      const res = await getStudents(params)
      const data = res.data
      const results = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      const responseCount = data?.count == null ? NaN : Number(data.count)
      const count = Array.isArray(data) || !Number.isFinite(responseCount) ? results.length : responseCount
      const totalPages = Array.isArray(data)
        ? 1
        : Math.max(1, Number(data?.total_pages) || Math.ceil(count / STUDENT_PAGE_SIZE))
      if (requestId !== studentRequestId.current) return
      setStudents(results)
      setStudentTotalCount(count)
      setStudentTotalPages(totalPages)
      if (studentPage > totalPages) setStudentPage(totalPages)
    } catch (err) {
      if (requestId === studentRequestId.current) {
        setStudentError(err.response?.data?.error || 'Failed to load enrolled students.')
      }
    } finally {
      if (requestId === studentRequestId.current) setStudentLoading(false)
    }
  }, [studentPage, studentStatusFilter, studentSearch])

  // Video Testimonials tab state
  const [videoTestimonials, setVideoTestimonials]   = useState([])
  const [videoLoading, setVideoLoading]             = useState(false)
  const [uploadingVideo, setUploadingVideo]         = useState(false)
  const [videoFile, setVideoFile]                   = useState(null)
  const [studentNameInput, setStudentNameInput]     = useState('')
  const [videoUploadError, setVideoUploadError]     = useState('')

  const fetchVideoTestimonials = useCallback(async () => {
    setVideoLoading(true)
    try {
      const res = await getVideoTestimonials()
      setVideoTestimonials(res.data)
    } catch {
      // video fetch fallback
    } finally {
      setVideoLoading(false)
    }
  }, [])

  const [staffUsers, setStaffUsers]       = useState([])

  const fetchStaffUsers = useCallback(async () => {
    try {
      const res = await getStaffUsers()
      setStaffUsers(res.data)
    } catch {
      // silent fallback
    }
  }, [])

  const handleSelectLead = async (leadSummary) => {
    try {
      const res = await getLead(leadSummary.id)
      setSelectedLead(res.data)
    } catch {
      setSelectedLead(leadSummary)
    }
  }

  const handleAssignChange = async (leadId, staffUserId) => {
    try {
      await updateLead(leadId, { assigned_to: staffUserId })
      setActionNotice('Staff assignment updated successfully.')
      setTimeout(() => setActionNotice(''), 3000)
      fetchLeads()
      handleSelectLead({ id: leadId })
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update lead assignment.')
    }
  }

  const handleFollowUpChange = async (leadId, followUpDateStr) => {
    try {
      await updateLead(leadId, { next_follow_up: followUpDateStr })
      setActionNotice('Follow-up schedule updated.')
      setTimeout(() => setActionNotice(''), 3000)
      fetchLeads()
      handleSelectLead({ id: leadId })
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update follow-up date.')
    }
  }

  const handleAddActivity = async (leadId, data) => {
    try {
      await addLeadActivity(leadId, data)
      setActionNotice('Interaction logged successfully.')
      setTimeout(() => setActionNotice(''), 3000)
      handleSelectLead({ id: leadId })
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to log activity.')
    }
  }

  // Phase A — real outbound WhatsApp dispatch
  // Throws on failure so LeadActivityFeed can show its own inline error.
  const handleSendWhatsApp = async (leadId, message) => {
    const res = await sendLeadWhatsApp(leadId, message)
    // Refresh lead detail so the new WhatsApp activity appears in the feed.
    handleSelectLead({ id: leadId })
    return res
  }

  useEffect(() => {
    fetchStats()
    fetchLeads()
    fetchStudents()
    fetchVideoTestimonials()
    fetchStaffUsers()
  }, [fetchStats, fetchLeads, fetchStudents, fetchVideoTestimonials, fetchStaffUsers])

  const handleVideoUpload = async (e) => {
    e.preventDefault()
    setVideoUploadError('')

    if (!videoFile) {
      setVideoUploadError('Please select a video file.')
      return
    }

    // Client-side format check
    const ext = videoFile.name.substring(videoFile.name.lastIndexOf('.')).toLowerCase()
    const allowed = ['.mp4', '.mov', '.webm', '.avi', '.mkv']
    if (!allowed.includes(ext)) {
      setVideoUploadError(`Invalid file format (${ext}). Supported: MP4, MOV, WEBM, AVI, MKV.`)
      return
    }

    // Client-side size check (100MB)
    if (videoFile.size > 100 * 1024 * 1024) {
      setVideoUploadError(`File size exceeds 100MB limit (${(videoFile.size / (1024*1024)).toFixed(1)}MB). Please choose a smaller video.`)
      return
    }

    const formData = new FormData()
    formData.append('file', videoFile)
    if (studentNameInput.trim()) {
      formData.append('student_name', studentNameInput.trim())
    }

    setUploadingVideo(true)
    try {
      await uploadVideoTestimonial(formData)
      setVideoFile(null)
      setStudentNameInput('')
      const fileInput = document.getElementById('video-file-input')
      if (fileInput) fileInput.value = ''
      setActionNotice('Video testimonial uploaded successfully to Cloudinary!')
      setTimeout(() => setActionNotice(''), 4000)
      fetchVideoTestimonials()
    } catch (err) {
      setVideoUploadError(err.response?.data?.error || 'Failed to upload video testimonial.')
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleTogglePublishVideo = async (video) => {
    try {
      await updateVideoTestimonial(video.id, { is_published: !video.is_published })
      fetchVideoTestimonials()
      setActionNotice(`Video status set to ${!video.is_published ? 'Published' : 'Draft'}.`)
      setTimeout(() => setActionNotice(''), 3000)
    } catch {
      alert('Failed to update video testimonial status.')
    }
  }

  const handleDeleteVideo = async (videoId) => {
    if (!isAdmin) return
    if (!window.confirm('Are you sure you want to delete this video testimonial? This will remove the Cloudinary file and record permanently.')) return
    try {
      await deleteVideoTestimonial(videoId)
      fetchVideoTestimonials()
      setActionNotice('Video testimonial deleted permanently.')
      setTimeout(() => setActionNotice(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete video testimonial.')
    }
  }

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await updateLead(leadId, { status: newStatus })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
      if (selectedLead?.id === leadId) setSelectedLead(prev => ({ ...prev, status: newStatus }))
      fetchStats()
    } catch {
      alert('Failed to update status.')
    }
  }

  const handleLeadSubmit = async (e) => {
    e.preventDefault()
    setLeadFormError('')
    setLeadSaving(true)
    try {
      await createLead({
        ...leadForm,
        marks: leadForm.marks === '' ? null : leadForm.marks,
        english_score: leadForm.english_score === '' ? null : leadForm.english_score,
        budget: leadForm.budget === '' ? null : leadForm.budget,
      })
      setLeadModal(false)
      setLeadForm({ ...EMPTY_LEAD_FORM })
      setActionNotice('Lead created successfully.')
      setTimeout(() => setActionNotice(''), 3000)
      fetchLeads()
      fetchStats()
    } catch (err) {
      const details = err.response?.data?.details
      const detailMessage = details && typeof details === 'object'
        ? Object.values(details).flat()[0]
        : null
      const responseData = err.response?.data
      const fieldMessage = responseData && typeof responseData === 'object'
        ? Object.entries(responseData)
            .filter(([key]) => key !== 'details' && key !== 'error')
            .flatMap(([, value]) => Array.isArray(value) ? value : [value])[0]
        : null
      setLeadFormError(detailMessage || fieldMessage || responseData?.error || 'Unable to create lead.')
    } finally {
      setLeadSaving(false)
    }
  }

  const handleLogout = async () => {
    try { await adminLogout() } catch { /* ok */ }
    localStorage.removeItem('aiec_token')
    localStorage.removeItem('aiec_user')
    localStorage.removeItem('aiec_role')
    navigate('/login')
  }

  // Enrollment
  const handleEnrollSubmit = async (e) => {
    e.preventDefault()
    setEnrollError('')
    try {
      const res = await enrollStudent(enrollForm)
      setGeneratedPassword(res.data.generated_password)
      setGeneratedStudentId(res.data.student_id || '')
      fetchStudents()
    } catch (err) {
      setEnrollError(err.response?.data?.username?.[0] || err.response?.data?.email?.[0] || 'Enrollment failed. Please check inputs.')
    }
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseEnrollModal = () => {
    setEnrollModal(false)
    setGeneratedPassword('')
    setGeneratedStudentId('')
    setEnrollForm({ full_name: '', username: '', email: '', phone: '', destination_country: '', notes: '' })
    setEnrollError('')
  }

  // Student Detail refresh
  const refreshStudentDetail = async (studentId) => {
    try {
      const res = await getStudentDetail(studentId)
      setSelectedStudent(res.data)
      fetchStudents()
    } catch {
      alert('Failed to refresh student record.')
    }
  }

  // Phase 1.4 — update student lifecycle status
  const handleUpdateStudentStatus = async (studentId, newStatus) => {
    try {
      await updateStudentProfile(studentId, { status: newStatus })
      refreshStudentDetail(studentId)
    } catch (err) {
      alert(err.response?.data?.status?.[0] || err.response?.data?.error || 'Failed to update student status.')
    }
  }

  // Phase 1.4 — open "Convert to Student" modal, pre-fill from lead
  const handleOpenConvertModal = (lead) => {
    if (!lead || lead.status === 'converted') return
    setConvertError('')
    setConvertResult(null)
    setConvertCopied(false)
    setConvertForm({
      username: '',
      destination_country: lead.recommended_country || lead.country_of_residence || '',
      notes: '',
    })
    setConvertModal(lead)
  }

  const handleCloseConvertModal = () => {
    if (convertRequestInFlight.current) return
    setConvertModal(null)
    setConvertForm({ username: '', destination_country: '', notes: '' })
    setConvertError('')
    setConvertResult(null)
    setConvertLoading(false)
    setConvertCopied(false)
  }

  const handleConvertSubmit = async (e) => {
    e.preventDefault()
    if (!convertModal || convertLoading || convertResult || convertRequestInFlight.current) return
    convertRequestInFlight.current = true
    setConvertError('')
    setConvertLoading(true)
    try {
      const res = await convertLeadToStudent(convertModal.id, {
        username:            convertForm.username.trim(),
        destination_country: convertForm.destination_country.trim(),
        notes:               convertForm.notes.trim(),
      })
      setConvertResult(res.data)
      // Refresh lead detail and student list
      await handleSelectLead({ id: convertModal.id })
      fetchLeads()
      fetchStats()
      fetchStudents()
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 409) {
        setConvertError(data?.error || 'This lead has already been converted to a student.')
      } else {
        const fieldError = data && typeof data === 'object'
          ? Object.values(data).flat().find(value => typeof value === 'string')
          : null
        setConvertError(data?.error || fieldError || 'Conversion failed. Please check the inputs.')
      }
    } finally {
      convertRequestInFlight.current = false
      setConvertLoading(false)
    }
  }

  const handleCopyConvertedPassword = async () => {
    if (!convertResult?.generated_password) return
    try {
      await navigator.clipboard.writeText(convertResult.generated_password)
      setConvertCopied(true)
      setTimeout(() => setConvertCopied(false), 2000)
    } catch {
      setConvertError('Unable to copy the password. Select and copy it manually.')
    }
  }

  // Update step status
  const handleStepStatusChange = async (stepId, newStatus) => {
    try {
      const res = await updateProcessStep(stepId, { status: newStatus })
      if (res.data.whatsapp_notification) {
        setActionNotice(`Step marked complete! WhatsApp notification: ${res.data.whatsapp_notification.sent ? 'Sent' : 'Logged fallback'}`)
        setTimeout(() => setActionNotice(''), 4000)
      }
      if (selectedStudent) {
        refreshStudentDetail(selectedStudent.id)
      }
    } catch {
      alert('Failed to update step status.')
    }
  }

  // Add custom step
  const handleAddStepSubmit = async (e) => {
    e.preventDefault()
    if (!selectedStudent) return
    try {
      await addProcessStep(selectedStudent.id, stepForm)
      setStepModal(false)
      setStepForm({ step_name: '', estimated_cost: 0, due_date: '', notes: '' })
      refreshStudentDetail(selectedStudent.id)
    } catch {
      alert('Failed to add process step.')
    }
  }

  // Add payment
  const handleAddPaymentSubmit = async (e) => {
    e.preventDefault()
    if (!paymentModalStep) return
    try {
      await addStepPayment(paymentModalStep.id, paymentForm)
      setPaymentModalStep(null)
      setPaymentForm({ amount: '', notes: '' })
      if (selectedStudent) {
        refreshStudentDetail(selectedStudent.id)
      }
    } catch {
      alert('Failed to record payment.')
    }
  }

  // Document verification handlers
  const handleVerifyDocument = async (docId, status, reason = '') => {
    try {
      await verifyStudentDocument(docId, { verification_status: status, rejection_reason: reason })
      if (selectedStudent) {
        refreshStudentDetail(selectedStudent.id)
      }
      setRejectModalDoc(null)
      setRejectReasonInput('')
      setActionNotice(`Document verification status updated to '${status}'.`)
      setTimeout(() => setActionNotice(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update document status.')
    }
  }

  const handleDeleteDocument = async (docId) => {
    if (!isAdmin) return
    if (!window.confirm('Are you sure you want to delete this student document? This will delete the DB record and Cloudinary asset permanently.')) return
    try {
      await deleteStudentDocument(docId)
      if (selectedStudent) {
        refreshStudentDetail(selectedStudent.id)
      }
      setActionNotice('Document deleted successfully.')
      setTimeout(() => setActionNotice(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete document.')
    }
  }

  const handleStaffDocUpload = async (e) => {
    e.preventDefault()
    setStaffDocError('')
    if (!staffDocFile || !selectedStudent) {
      setStaffDocError('Please select a file to upload.')
      return
    }

    const ext = staffDocFile.name.substring(staffDocFile.name.lastIndexOf('.')).toLowerCase()
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      setStaffDocError(`Invalid document format (${ext}). Supported: PDF, JPG, PNG.`)
      return
    }

    if (staffDocFile.size > 15 * 1024 * 1024) {
      setStaffDocError(`File size exceeds 15MB limit (${(staffDocFile.size / (1024*1024)).toFixed(1)}MB).`)
      return
    }

    const formData = new FormData()
    formData.append('file', staffDocFile)
    formData.append('document_type', staffDocType)
    formData.append('student_id', selectedStudent.id)

    setStaffDocUploading(true)
    try {
      await uploadStudentDocument(formData)
      setStaffDocFile(null)
      const fileInput = document.getElementById('staff-doc-file-input')
      if (fileInput) fileInput.value = ''
      setActionNotice('Document uploaded successfully on behalf of student!')
      setTimeout(() => setActionNotice(''), 4000)
      refreshStudentDetail(selectedStudent.id)
    } catch (err) {
      setStaffDocError(err.response?.data?.error || 'Failed to upload document.')
    } finally {
      setStaffDocUploading(false)
    }
  }

  // Delete student (ADMIN ONLY)
  const handleDeleteStudent = async (studentId) => {
    if (!isAdmin) return
    if (!window.confirm('Are you sure you want to delete this student record? This cannot be undone.')) return
    try {
      await deleteStudent(studentId)
      setSelectedStudent(null)
      fetchStudents()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete student.')
    }
  }

  // Delete step (ADMIN ONLY)
  const handleDeleteStep = async (stepId) => {
    if (!isAdmin) return
    if (!window.confirm('Are you sure you want to delete this checklist step?')) return
    try {
      await deleteProcessStep(stepId)
      if (selectedStudent) {
        refreshStudentDetail(selectedStudent.id)
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete step.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 selection:bg-amber-400 selection:text-slate-900 font-sans">

      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="bg-white rounded-xl p-1 sm:p-1.5 shadow-md flex-shrink-0">
            <img src="/logo.png" alt="AIEC Logo" className="h-6 sm:h-7 w-auto object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-xs sm:text-base leading-tight truncate">UrmiNexus Dashboard</h1>
            <p className="text-[10px] sm:text-[11px] text-amber-400 font-semibold truncate">AIEC Consultancy Tenant</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{userName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isAdmin ? 'bg-amber-400 text-slate-950' : 'bg-blue-500 text-white'}`}>
              {userRole}
            </span>
          </div>

          {isAdmin && (
            <button
              onClick={() => navigate('/staff')}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/20 transition-all flex items-center gap-1"
            >
              ⚙️ <span className="hidden sm:inline">Manage </span>Staff
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* Global Action Toast Notification */}
        {actionNotice && (
          <div className="bg-emerald-500 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
            <span>✅ {actionNotice}</span>
            <button onClick={() => setActionNotice('')} className="text-white/80 hover:text-white font-extrabold">✕</button>
          </div>
        )}

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon="📥" label="Total Leads" value={stats.total_leads} accent="bg-blue-50 text-blue-600" />
            <StatCard icon="🎓" label="Enrolled Students" value={studentTotalCount} accent="bg-emerald-50 text-emerald-600" />
            <StatCard icon="⚡" label="Visa Process" value={stats.status_breakdown?.visa_process || 0} accent="bg-amber-50 text-amber-600" />
            <StatCard icon="✅" label="Converted Students" value={stats.status_breakdown?.converted || 0} accent="bg-green-50 text-green-600" />
          </div>
        )}

        {/* TAB CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 gap-3 pb-2 sm:pb-0">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full">
            <button
              onClick={() => setActiveTab('leads')}
              className={`pb-3 px-2 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'leads' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>📥 Leads Management</span>
              <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{totalCount}</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`pb-3 px-2 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'students' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🎓 Enrolled Students</span>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">{studentTotalCount}</span>
            </button>

            <button
              onClick={() => setActiveTab('videos')}
              className={`pb-3 px-2 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'videos' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🎥 Video Testimonials</span>
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-bold">{videoTestimonials.length}</span>
            </button>
          </div>

          {activeTab === 'students' && (
            <button
              onClick={() => setEnrollModal(true)}
              className="mb-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 self-start sm:self-auto flex-shrink-0"
            >
              <span>➕</span> Enroll New Student
            </button>
          )}
        </div>

        {/* ── TAB 1: LEADS ────────────────────────────────────────── */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <LeadFilters
              search={search}
              setSearch={(val) => { setSearch(val); setPage(1) }}
              statusFilter={statusFilter}
              setStatusFilter={(val) => { setStatusFilter(val); setPage(1) }}
              countryFilter={countryFilter}
              setCountryFilter={(val) => { setCountryFilter(val); setPage(1) }}
              courseFilter={courseFilter}
              setCourseFilter={(val) => { setCourseFilter(val); setPage(1) }}
              countryOptions={stats?.filter_options?.countries || []}
              courseOptions={stats?.filter_options?.courses || []}
              onReset={() => {
                setSearch('')
                setStatusFilter('')
                setCountryFilter('')
                setCourseFilter('')
                setPage(1)
              }}
            />

            <LeadList
              leads={leads}
              loading={loading}
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={(p) => setPage(p)}
              onSelectLead={handleSelectLead}
              onCreateClick={() => setLeadModal(true)}
            />

            <LeadForm
              isOpen={leadModal}
              onClose={() => setLeadModal(false)}
              onSubmit={handleLeadSubmit}
            />

            <LeadDetail
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
              onStatusChange={handleStatusChange}
              onAssignChange={handleAssignChange}
              onFollowUpChange={handleFollowUpChange}
              onAddActivity={handleAddActivity}
              onSendWhatsApp={handleSendWhatsApp}
              onRefreshLead={handleSelectLead}
              onConvertToStudent={handleOpenConvertModal}
              staffUsers={staffUsers}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* ── TAB 2: STUDENTS ──────────────────────────────────────── */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900">Enrolled Students & Visa Process Tracking</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{studentTotalCount} student records · Admin & Staff Access</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Status filter — Phase 1.4 */}
                  <select
                    value={studentStatusFilter}
                    onChange={e => { setStudentStatusFilter(e.target.value); setStudentPage(1) }}
                    className="input-field text-xs py-1.5 px-3 flex-1 min-w-[120px]"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="graduated">Graduated</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="deferred">Deferred</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); setStudentPage(1) }}
                    className="input-field text-xs py-1.5 px-3 flex-1 min-w-[140px]"
                  />
                </div>
              </div>
            </div>

            {studentError ? (
              <div className="px-6 py-12 text-center" role="alert">
                <p className="text-sm font-semibold text-red-700">{studentError}</p>
                <button
                  onClick={fetchStudents}
                  className="mt-3 text-xs font-bold text-slate-800 underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : studentLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-5 py-3 text-left">Student Profile</th>
                        <th className="px-5 py-3 text-left">Status</th>
                        <th className="px-5 py-3 text-left">Phone / WhatsApp</th>
                        <th className="px-5 py-3 text-left">Destination</th>
                        <th className="px-5 py-3 text-left">Enrolled Date</th>
                        <th className="px-5 py-3 text-left">Total Estimated</th>
                        <th className="px-5 py-3 text-left">Total Paid</th>
                        <th className="px-5 py-3 text-left">Pending Balance</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-16 text-center text-gray-400">
                            {studentTotalCount === 0 && !studentSearch && !studentStatusFilter
                              ? 'No enrolled students found. Click "Enroll New Student" to get started.'
                              : 'No students match the selected filters.'}
                          </td>
                        </tr>
                      )}
                      {students.map(st => (
                        <tr
                          key={st.id}
                          onClick={() => setSelectedStudent(st)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">{st.full_name}</p>
                              {st.student_id && (
                                <span className="text-[10px] font-mono font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-md">
                                  {st.student_id}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">@{st.username} · {st.email}</p>
                          </td>
                          {/* Phase 1.4 — student status badge */}
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              st.status === 'active'    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              st.status === 'on_hold'   ? 'bg-amber-100   text-amber-800   border-amber-200'   :
                              st.status === 'graduated' ? 'bg-blue-100    text-blue-800    border-blue-200'    :
                              st.status === 'withdrawn' ? 'bg-red-100     text-red-800     border-red-200'     :
                              st.status === 'deferred'  ? 'bg-purple-100  text-purple-800  border-purple-200'  :
                              'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                              {st.status ? st.status.replace('_', ' ') : 'active'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{st.phone}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                              {flag(st.destination_country)}{st.destination_country}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs">{st.enrollment_date}</td>
                          <td className="px-5 py-3.5 font-semibold text-gray-700">${Number(st.total_estimated_cost || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 font-bold text-emerald-600">${Number(st.total_paid || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 font-bold text-amber-600">${Number(st.pending_balance || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-right space-x-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedStudent(st)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg transition-all"
                            >
                              View Detail
                            </button>
                            {canResetStudentPassword(st) && (
                              <button
                                onClick={() => { setResetStudentError(''); setResetStudentPasswordInput(''); setResetStudentModal(st) }}
                                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1.5 rounded-lg border border-amber-200 transition-all"
                                title="Reset Student Password"
                              >
                                🔑
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteStudent(st.id)}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1.5 rounded-lg border border-red-200 transition-all"
                                title="Delete Student Record (Admin Only)"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View */}
                <div className="md:hidden divide-y divide-gray-100">
                  {students.length === 0 && (
                    <div className="px-6 py-12 text-center text-gray-400 text-xs">
                      {studentTotalCount === 0 && !studentSearch && !studentStatusFilter
                        ? 'No enrolled students found. Click "Enroll New Student" to get started.'
                        : 'No students match the selected filters.'}
                    </div>
                  )}
                  {students.map(st => (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStudent(st)}
                      className="p-4 hover:bg-slate-50 cursor-pointer space-y-2.5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm">{st.full_name}</p>
                            {st.student_id && (
                              <span className="text-[10px] font-mono font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80 px-1.5 py-0.5 rounded-md">
                                {st.student_id}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">@{st.username} · {st.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          st.status === 'active'    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          st.status === 'on_hold'   ? 'bg-amber-100   text-amber-800   border-amber-200'   :
                          st.status === 'graduated' ? 'bg-blue-100    text-blue-800    border-blue-200'    :
                          st.status === 'withdrawn' ? 'bg-red-100     text-red-800     border-red-200'     :
                          st.status === 'deferred'  ? 'bg-purple-100  text-purple-800  border-purple-200'  :
                          'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {st.status ? st.status.replace('_', ' ') : 'active'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 pt-0.5">
                        <span className="font-bold bg-slate-50 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                          {flag(st.destination_country)}{st.destination_country}
                        </span>
                        <span className="font-mono text-gray-500">{st.phone}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center text-xs border border-slate-100">
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Est.</p>
                          <p className="font-semibold text-gray-700">${Number(st.total_estimated_cost || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Paid</p>
                          <p className="font-bold text-emerald-600">${Number(st.total_paid || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Due</p>
                          <p className="font-bold text-amber-600">${Number(st.pending_balance || 0).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1" onClick={e => e.stopPropagation()}>
                        <span className="text-[11px] text-gray-400 font-mono">Enrolled: {st.enrollment_date}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedStudent(st)}
                            className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg transition-all"
                          >
                            View Detail
                          </button>
                          {canResetStudentPassword(st) && (
                            <button
                              onClick={() => { setResetStudentError(''); setResetStudentPasswordInput(''); setResetStudentModal(st) }}
                              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2 py-1.5 rounded-lg border border-amber-200 transition-all"
                              title="Reset Student Password"
                            >
                              🔑
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteStudent(st.id)}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1.5 rounded-lg border border-red-200 transition-all"
                              title="Delete Student Record (Admin Only)"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!studentError && !studentLoading && (
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 text-xs">
                <span className="text-gray-500">
                  {studentTotalCount === 0
                    ? '0 students'
                    : `${(studentPage - 1) * STUDENT_PAGE_SIZE + 1}–${Math.min(studentPage * STUDENT_PAGE_SIZE, studentTotalCount)} of ${studentTotalCount}`}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">Page {studentPage} of {studentTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setStudentPage(pageNumber => Math.max(1, pageNumber - 1))}
                    disabled={studentPage <= 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg font-bold text-gray-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentPage(pageNumber => Math.min(studentTotalPages, pageNumber + 1))}
                    disabled={studentPage >= studentTotalPages}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg font-bold text-gray-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: VIDEO TESTIMONIALS ───────────────────────────── */}
        {activeTab === 'videos' && (
          <div className="space-y-8">
            {/* Upload Box */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <span>🎥 Upload New Video Testimonial</span>
                  <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full">Cloudinary Permanent Storage</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Upload short student video testimonials (MP4, MOV, WEBM — Max 100MB). Accessible to Admin & Staff.
                </p>
              </div>

              {videoUploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-4 flex items-start justify-between">
                  <div>
                    <span className="font-bold block">Upload Notice / Error:</span>
                    <span>{videoUploadError}</span>
                  </div>
                  <button onClick={() => setVideoUploadError('')} className="font-bold text-red-800 ml-2">✕</button>
                </div>
              )}

              <form onSubmit={handleVideoUpload} className="grid sm:grid-cols-12 gap-4 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Select Video File *</label>
                  <input
                    id="video-file-input"
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                    required
                    onChange={e => setVideoFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Accepted: .mp4, .mov, .webm, .mkv (Max 100MB)</p>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Student Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Aarav Sharma, Canada Student"
                    value={studentNameInput}
                    onChange={e => setStudentNameInput(e.target.value)}
                    className="input-field text-xs py-2 px-3"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave blank for anonymous client choice</p>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={uploadingVideo}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {uploadingVideo ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>☁️ Upload Video</>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Video Testimonials List / Grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900">Uploaded Video Testimonials</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{videoTestimonials.length} total videos · Admin (Delete) & Staff (Upload/Toggle)</p>
                </div>
              </div>

              {videoLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : videoTestimonials.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-3xl mb-2">🎥</p>
                  <p className="font-bold text-slate-800 text-sm">No video testimonials uploaded yet</p>
                  <p className="text-xs text-gray-400 mt-1">Use the upload form above to add your first student video testimonial.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videoTestimonials.map((v) => (
                    <div key={v.id} className="bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        {/* Video Thumbnail / Player */}
                        <div className="relative aspect-video bg-black flex items-center justify-center group overflow-hidden">
                          <video
                            src={v.video_url}
                            poster={v.thumbnail_url}
                            controls
                            className="w-full h-full object-cover"
                            preload="none"
                          />
                          <div className="absolute top-2 right-2 z-10">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              v.is_published ? 'bg-emerald-500 text-white shadow-sm' : 'bg-amber-400 text-slate-900 shadow-sm'
                            }`}>
                              {v.is_published ? 'Live / Published' : 'Draft / Hidden'}
                            </span>
                          </div>
                        </div>

                        {/* Card Meta */}
                        <div className="p-4 space-y-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {v.student_name || 'Anonymous Student'}
                          </h4>
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span>Uploaded by: <strong className="text-gray-600">{v.uploaded_by_name}</strong></span>
                            <span>{new Date(v.uploaded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="p-3 bg-white border-t border-slate-200/60 flex items-center justify-between gap-2">
                        {/* Toggle Publish (Admin + Staff) */}
                        <button
                          onClick={() => handleTogglePublishVideo(v)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                            v.is_published
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {v.is_published ? '👁️ Set Draft' : '🚀 Publish Live'}
                        </button>

                        {/* Delete Button (ADMIN ONLY) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteVideo(v.id)}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-xl border border-red-200 transition-all"
                            title="Delete permanently from Cloudinary & DB (Admin Only)"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── ENROLL STUDENT MODAL ──────────────────────────────────────── */}
      {enrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">

            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg">Enroll New Student</h3>
                <p className="text-blue-200 text-xs">Creates Student User account + default 7-step checklist</p>
              </div>
              <button onClick={handleCloseEnrollModal} className="text-white/70 hover:text-white text-lg font-bold">✕</button>
            </div>

            {!generatedPassword ? (
              <form onSubmit={handleEnrollSubmit} className="p-6 space-y-4">
                {enrollError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-2xl">
                    ⚠️ {enrollError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="input-field text-sm"
                    placeholder="e.g. Aarav Sharma"
                    value={enrollForm.full_name}
                    onChange={e => setEnrollForm({ ...enrollForm, full_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      className="input-field text-sm"
                      placeholder="aarav_sharma"
                      value={enrollForm.username}
                      onChange={e => setEnrollForm({ ...enrollForm, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      className="input-field text-sm"
                      placeholder="aarav@example.com"
                      value={enrollForm.email}
                      onChange={e => setEnrollForm({ ...enrollForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Phone / WhatsApp *</label>
                    <input
                      type="text"
                      required
                      className="input-field text-sm"
                      placeholder="9801234567"
                      value={enrollForm.phone}
                      onChange={e => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Destination Country *</label>
                    <input
                      type="text"
                      required
                      className="input-field text-sm"
                      placeholder="Canada"
                      value={enrollForm.destination_country}
                      onChange={e => setEnrollForm({ ...enrollForm, destination_country: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    className="input-field text-sm resize-none"
                    placeholder="Initial consultation notes..."
                    value={enrollForm.notes}
                    onChange={e => setEnrollForm({ ...enrollForm, notes: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-all shadow-md mt-2"
                >
                  Confirm & Generate Password
                </button>
              </form>
            ) : (
              /* ONE-TIME PASSWORD DISPLAY BOX */
              <div className="p-6 space-y-4 text-center">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-emerald-200">
                  🎉
                </div>

                <h4 className="text-lg font-extrabold text-slate-900">Student Enrolled Successfully!</h4>
                <p className="text-xs text-gray-500">
                  Below is the generated password for <span className="font-bold text-gray-900">{enrollForm.full_name}</span> (@{enrollForm.username}).
                </p>

                {generatedStudentId && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-center space-y-0.5 shadow-sm">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                      🎓 Assigned Student ID
                    </p>
                    <p className="font-mono font-black text-xl text-emerald-950">
                      {generatedStudentId}
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    🔒 One-Time Generated Password
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono font-extrabold text-xl text-slate-900 bg-white px-4 py-2 rounded-xl border border-amber-200 shadow-inner">
                      {generatedPassword}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-md"
                    >
                      {copied ? 'Copied! ✓' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    ⚠️ <strong>IMPORTANT:</strong> Save and share this password with the student now! It is PBKDF2 hashed in the database and will <strong>NOT</strong> be displayed again.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseEnrollModal}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── STUDENT DETAIL DRAWER (Phase 1.4 — extracted component) ── */}
      {selectedStudent && (
        <StudentDetail
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onStepStatusChange={handleStepStatusChange}
          onAddStep={() => setStepModal(true)}
          onAddPayment={(step) => setPaymentModalStep(step)}
          onDeleteStep={handleDeleteStep}
          onVerifyDocument={handleVerifyDocument}
          onRejectDocument={(doc) => setRejectModalDoc(doc)}
          onDeleteDocument={handleDeleteDocument}
          onStaffDocUpload={handleStaffDocUpload}
          onResetPassword={(st) => { setResetStudentError(''); setResetStudentPasswordInput(''); setResetStudentModal(st) }}
          onDeleteStudent={handleDeleteStudent}
          onUpdateStatus={handleUpdateStudentStatus}
          onRefresh={() => refreshStudentDetail(selectedStudent.id)}
          isAdmin={isAdmin}
          canResetPassword={canResetStudentPassword(selectedStudent)}
          staffDocType={staffDocType}
          setStaffDocType={setStaffDocType}
          staffDocFile={staffDocFile}
          setStaffDocFile={setStaffDocFile}
          staffDocUploading={staffDocUploading}
          staffDocError={staffDocError}
          stepStatusOptions={STEP_STATUS_OPTIONS}
          flag={flag}
          staffUsers={staffUsers}
        />
      )}
      {/* ── ADD LEAD MODAL ─────────────────────────────────────────────── */}
      {leadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-base">Add Lead</h3>
              <button
                type="button"
                onClick={() => setLeadModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl"
                aria-label="Close add lead form"
              >
                ×
              </button>
            </div>

            {leadFormError && (
              <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {leadFormError}
              </div>
            )}

            <form onSubmit={handleLeadSubmit} className="space-y-3 text-xs">
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['name', 'Name *', 'text', true],
                  ['email', 'Email *', 'email', true],
                  ['phone', 'Phone *', 'text', true],
                  ['country_of_residence', 'Country of residence', 'text', false],
                  ['qualification', 'Qualification', 'text', false],
                  ['marks', 'Marks', 'number', false],
                  ['english_score', 'English score', 'number', false],
                  ['budget', 'Budget', 'number', false],
                  ['course_interest', 'Course interest', 'text', false],
                  ['recommended_country', 'Recommended country', 'text', false],
                  ['recommended_course', 'Recommended course', 'text', false],
                ].map(([field, label, type, required]) => (
                  <label key={field} className="block font-bold text-gray-500 uppercase">
                    {label}
                    <input
                      type={type}
                      required={required}
                      min={field === 'marks' ? 0 : field === 'english_score' ? 0 : field === 'budget' ? 0 : undefined}
                      max={field === 'marks' ? 100 : field === 'english_score' ? 9 : undefined}
                      step={field === 'marks' || field === 'english_score' ? '0.1' : undefined}
                      className="input-field text-xs mt-1 normal-case font-normal"
                      value={leadForm[field]}
                      onChange={e => setLeadForm({ ...leadForm, [field]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="block font-bold text-gray-500 uppercase">
                  Status
                  <select
                    className="input-field text-xs mt-1 normal-case font-normal"
                    value={leadForm.status}
                    onChange={e => setLeadForm({ ...leadForm, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block font-bold text-gray-500 uppercase">
                  Source
                  <select
                    className="input-field text-xs mt-1 normal-case font-normal"
                    value={leadForm.source}
                    onChange={e => setLeadForm({ ...leadForm, source: e.target.value })}
                  >
                    {LEAD_SOURCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block font-bold text-gray-500 uppercase">
                Notes
                <textarea
                  rows={3}
                  className="input-field text-xs mt-1 normal-case font-normal resize-none"
                  value={leadForm.notes}
                  onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
                />
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeadModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadSaving}
                  className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl disabled:opacity-60"
                >
                  {leadSaving ? 'Saving...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {convertModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg">
                  {convertResult ? 'Student Created' : 'Convert Lead to Student'}
                </h3>
                <p className="text-blue-200 text-xs">{convertModal.name} · {convertModal.email}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseConvertModal}
                disabled={convertLoading}
                className="text-white/70 hover:text-white text-lg font-bold disabled:opacity-40"
                aria-label="Close conversion dialog"
              >
                ✕
              </button>
            </div>

            {convertResult ? (
              <div className="p-6 space-y-4 text-center">
                <p className="text-sm font-bold text-emerald-700">Lead converted successfully.</p>
                {convertError && <p role="alert" className="text-xs text-red-700">{convertError}</p>}
                {convertResult.student_id && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold uppercase text-emerald-800">Student ID</p>
                    <p className="font-mono font-black text-lg text-emerald-950">{convertResult.student_id}</p>
                  </div>
                )}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase text-amber-800">One-time password</p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <code className="font-mono font-bold text-slate-900 bg-white px-3 py-2 rounded-lg border border-amber-200 break-all">
                      {convertResult.generated_password}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyConvertedPassword}
                      className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs px-3 py-2 rounded-lg"
                    >
                      {convertCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800">This password is shown once. Share it securely with the student.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseConvertModal}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConvertSubmit} className="p-6 space-y-4">
                {convertError && (
                  <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
                    {convertError}
                  </div>
                )}
                <label className="block text-[11px] font-bold text-gray-600 uppercase">
                  Student username *
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={convertForm.username}
                    onChange={event => {
                      setConvertForm(form => ({ ...form, username: event.target.value }))
                      setConvertError('')
                    }}
                    className="input-field text-sm mt-1 normal-case font-normal"
                  />
                </label>
                <label className="block text-[11px] font-bold text-gray-600 uppercase">
                  Destination country *
                  <input
                    type="text"
                    required
                    value={convertForm.destination_country}
                    onChange={event => {
                      setConvertForm(form => ({ ...form, destination_country: event.target.value }))
                      setConvertError('')
                    }}
                    className="input-field text-sm mt-1 normal-case font-normal"
                  />
                </label>
                <label className="block text-[11px] font-bold text-gray-600 uppercase">
                  Notes
                  <textarea
                    rows={3}
                    value={convertForm.notes}
                    onChange={event => {
                      setConvertForm(form => ({ ...form, notes: event.target.value }))
                      setConvertError('')
                    }}
                    className="input-field text-sm mt-1 normal-case font-normal resize-none"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseConvertModal}
                    disabled={convertLoading}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={convertLoading}
                    className="w-1/2 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl disabled:opacity-50"
                  >
                    {convertLoading ? 'Converting…' : 'Convert to Student'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── ADD CUSTOM STEP MODAL ─────────────────────────────────────── */}
      {stepModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Add Custom Process Step</h3>

            <form onSubmit={handleAddStepSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Step Name *</label>
                <input
                  type="text"
                  required
                  className="input-field text-xs"
                  placeholder="e.g. Health Insurance Payment"
                  value={stepForm.step_name}
                  onChange={e => setStepForm({ ...stepForm, step_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Estimated Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field text-xs"
                  placeholder="0.00"
                  value={stepForm.estimated_cost}
                  onChange={e => setStepForm({ ...stepForm, estimated_cost: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Notes</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="Optional notes..."
                  value={stepForm.notes}
                  onChange={e => setStepForm({ ...stepForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStepModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                >
                  Save Step
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ──────────────────────────────────────── */}
      {paymentModalStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">
              Record Payment for "{paymentModalStep.step_name}"
            </h3>

            <form onSubmit={handleAddPaymentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  className="input-field text-xs"
                  placeholder="e.g. 250.00"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Payment Notes / Receipt #</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="e.g. Cash deposit #1042"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalStep(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── REJECT DOCUMENT REASON MODAL ─────────────────────────────── */}
      {rejectModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <span>❌ Reject Document</span>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                  {rejectModalDoc.document_type}
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Specify feedback / reason for rejecting this document. This note will be displayed directly to the student in their portal.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleVerifyDocument(rejectModalDoc.id, 'rejected', rejectReasonInput)
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Rejection Reason / Counselor Feedback *</label>
                <textarea
                  rows={3}
                  required
                  className="input-field text-xs resize-none"
                  placeholder="e.g. Scan is blurry, please re-upload clear page"
                  value={rejectReasonInput}
                  onChange={e => setRejectReasonInput(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalDoc(null)
                    setRejectReasonInput('')
                  }}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET STUDENT PASSWORD MODAL ────────────────────────────── */}
      {resetStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <span>🔑 Reset Student Password</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Direct password reset for <strong className="text-slate-900">{resetStudentModal.full_name}</strong> (@{resetStudentModal.username}).
              </p>
            </div>

            <form onSubmit={handleResetStudentSubmit} className="space-y-4 text-xs">
              {resetStudentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{resetStudentError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  autoFocus
                  className="input-field text-xs"
                  placeholder="Enter new strong password"
                  value={resetStudentPasswordInput}
                  onChange={e => { setResetStudentPasswordInput(e.target.value); setResetStudentError('') }}
                />

                {/* Password Strength Indicator */}
                {resetStudentPasswordInput.length > 0 && (
                  <div className="mt-2 space-y-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Strength:</span>
                      <span className={`font-bold ${
                        resetStudentPasswordInput.length >= 8 && /[A-Za-z]/.test(resetStudentPasswordInput) && /[0-9]/.test(resetStudentPasswordInput) && !['1234', '12345', '123456', '12345678', '123456789', 'password', 'password123', 'admin123'].includes(resetStudentPasswordInput.toLowerCase())
                          ? 'text-green-600'
                          : resetStudentPasswordInput.length >= 6
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}>
                        {resetStudentPasswordInput.length >= 8 && /[A-Za-z]/.test(resetStudentPasswordInput) && /[0-9]/.test(resetStudentPasswordInput) && !['1234', '12345', '123456', '12345678', '123456789', 'password', 'password123', 'admin123'].includes(resetStudentPasswordInput.toLowerCase())
                          ? 'Strong'
                          : resetStudentPasswordInput.length >= 6
                          ? 'Medium'
                          : 'Weak'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          resetStudentPasswordInput.length >= 8 && /[A-Za-z]/.test(resetStudentPasswordInput) && /[0-9]/.test(resetStudentPasswordInput) && !['1234', '12345', '123456', '12345678', '123456789', 'password', 'password123', 'admin123'].includes(resetStudentPasswordInput.toLowerCase())
                            ? 'bg-green-500'
                            : resetStudentPasswordInput.length >= 6
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: resetStudentPasswordInput.length >= 8 && /[A-Za-z]/.test(resetStudentPasswordInput) && /[0-9]/.test(resetStudentPasswordInput)
                            ? '100%'
                            : resetStudentPasswordInput.length >= 6
                            ? '66%'
                            : '33%'
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-1 text-[11px] pt-1">
                      <span className={`flex items-center gap-1 ${resetStudentPasswordInput.length >= 8 ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                        {resetStudentPasswordInput.length >= 8 ? '✓' : '○'} 8+ characters
                      </span>
                      <span className={`flex items-center gap-1 ${/[A-Za-z]/.test(resetStudentPasswordInput) && /[0-9]/.test(resetStudentPasswordInput) ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                        {/[A-Za-z]/.test(resetStudentPasswordInput) && /[0-9]/.test(resetStudentPasswordInput) ? '✓' : '○'} Letters & numbers
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setResetStudentModal(null); setResetStudentPasswordInput(''); setResetStudentError('') }}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetStudentLoading}
                  className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {resetStudentLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
