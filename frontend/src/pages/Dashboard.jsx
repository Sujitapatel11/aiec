import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLeads, getDashboardStats, updateLead, adminLogout,
  getStudents, getStudentDetail, enrollStudent, deleteStudent,
  addProcessStep, updateProcessStep, deleteProcessStep, addStepPayment
} from '../api'

/* ── Constants ─────────────────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted',    label: 'Contacted',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'applied',      label: 'Applied',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'visa_process', label: 'Visa Process', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'converted',    label: 'Converted',    color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost',         label: 'Lost',         color: 'bg-red-100 text-red-700 border-red-200' },
]

const STEP_STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending',     color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'completed',   label: 'Completed',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
]

const statusColor = (s) => STATUS_OPTIONS.find(o => o.value === s)?.color || 'bg-gray-100 text-gray-600'
const statusLabel = (s) => STATUS_OPTIONS.find(o => o.value === s)?.label || s

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
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Lead detail drawer ────────────────────────────────────────────── */
function LeadDrawer({ lead, onClose, onStatusChange }) {
  if (!lead) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-primary-700 to-primary-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">Lead Details</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xl font-extrabold">{lead.name}</p>
          <p className="text-blue-200 text-sm">{lead.email}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onStatusChange(lead.id, opt.value)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                    lead.status === opt.value
                      ? opt.color + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <Section title="Contact Info">
            <Row label="Phone" value={lead.phone} />
            <Row label="Country" value={lead.country_of_residence} />
            <Row label="Source" value={lead.source} />
          </Section>

          {/* Academic */}
          <Section title="Academic Profile">
            <Row label="Qualification" value={lead.qualification} />
            <Row label="GPA / Marks" value={lead.marks ? `${lead.marks}%` : null} />
            <Row label="English Score" value={lead.english_score} />
            <Row label="Budget" value={lead.budget ? `$${Number(lead.budget).toLocaleString()}` : null} />
            <Row label="Course Interest" value={lead.course_interest} />
          </Section>

          {/* Recommendations */}
          <Section title="AI Recommendations">
            <Row label="Recommended Country" value={lead.recommended_country} />
            <Row label="Recommended Course" value={lead.recommended_course} />
          </Section>

          {/* Questionnaire detail if available */}
          {lead.questionnaire && (
            <Section title="Questionnaire Submission">
              <Row label="Education" value={lead.questionnaire.education_level} />
              <Row label="Field" value={lead.questionnaire.field_of_interest} />
              <Row label="Countries" value={lead.questionnaire.preferred_countries?.join(', ')} />
              <Row label="Budget Range" value={lead.questionnaire.budget_range} />
              <Row label="English" value={lead.questionnaire.english_proficiency} />
              <Row label="Intake" value={lead.questionnaire.target_intake} />
              {lead.questionnaire.additional_info && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Additional Notes</p>
                  <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg">{lead.questionnaire.additional_info}</p>
                </div>
              )}
            </Section>
          )}

          {lead.notes && (
            <Section title="Lead Notes">
              <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg">{lead.notes}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800 font-mono">{value}</span>
    </div>
  )
}

/* ── Main Dashboard ────────────────────────────────────────────────── */
export default function Dashboard() {
  const [activeTab, setActiveTab]         = useState('leads') // 'leads' | 'students'
  const [leads, setLeads]                 = useState([])
  const [stats, setStats]                 = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  // Pagination & filter
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [totalCount, setTotalCount]       = useState(0)
  const [statusFilter, setStatusFilter]   = useState('')
  const [search, setSearch]               = useState('')
  const [selectedLead, setSelectedLead]   = useState(null)

  // Students tab state
  const [students, setStudents]           = useState([])
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentSearch, setStudentSearch]   = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [enrollModal, setEnrollModal]     = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied]               = useState(false)

  // Custom step modal & payment modal
  const [stepModal, setStepModal]         = useState(false)
  const [paymentModalStep, setPaymentModalStep] = useState(null)

  // Form states
  const [enrollForm, setEnrollForm]       = useState({ full_name: '', username: '', email: '', phone: '', destination_country: 'Canada', notes: '' })
  const [enrollError, setEnrollError]     = useState('')
  const [stepForm, setStepForm]           = useState({ step_name: '', estimated_cost: 0, due_date: '', notes: '' })
  const [paymentForm, setPaymentForm]     = useState({ amount: '', notes: '' })
  const [actionNotice, setActionNotice]   = useState('')

  const navigate = useNavigate()

  const userName = localStorage.getItem('aiec_user') || 'Admin'
  const userRole = localStorage.getItem('aiec_role') || 'staff'
  const isAdmin  = userRole === 'admin'

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
    setError('')
    try {
      let url = `/leads/?page=${page}`
      if (statusFilter) url += `&status=${statusFilter}`
      if (search)       url += `&search=${encodeURIComponent(search)}`

      const res = await getLeads(page) // backend handles basic search/filter if updated
      const data = res.data
      setLeads(data.results || data)
      setTotalCount(data.count || (data.results || data).length)
      setTotalPages(Math.ceil((data.count || 1) / 10))
    } catch {
      setError('Failed to fetch leads. Make sure you are logged in.')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  const fetchStudents = useCallback(async () => {
    setStudentLoading(true)
    try {
      const res = await getStudents()
      setStudents(res.data)
    } catch {
      setError('Failed to load enrolled students.')
    } finally {
      setStudentLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchLeads()
    fetchStudents()
  }, [fetchStats, fetchLeads, fetchStudents])

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
    setEnrollForm({ full_name: '', username: '', email: '', phone: '', destination_country: 'Canada', notes: '' })
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

  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.username?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.destination_country?.toLowerCase().includes(studentSearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 selection:bg-amber-400 selection:text-slate-900 font-sans">

      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1.5 shadow-md">
            <img src="/logo.png" alt="AIEC Logo" className="h-7 w-auto object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base leading-tight">AIEC Portal Dashboard</h1>
            <p className="text-[11px] text-amber-400 font-semibold">Birgunj, Nepal · Official CRM</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{userName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isAdmin ? 'bg-amber-400 text-slate-950' : 'bg-blue-500 text-white'}`}>
              {userRole}
            </span>
          </div>

          {isAdmin && (
            <button
              onClick={() => navigate('/staff')}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/20 transition-all hidden sm:block"
            >
              ⚙️ Manage Staff
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Global Action Toast Notification */}
        {actionNotice && (
          <div className="bg-emerald-500 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
            <span>✅ {actionNotice}</span>
            <button onClick={() => setActionNotice('')} className="text-white/80 hover:text-white font-extrabold">✕</button>
          </div>
        )}

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon="📥" label="Total Leads" value={stats.total_leads} accent="bg-blue-50 text-blue-600" />
            <StatCard icon="🎓" label="Enrolled Students" value={students.length} accent="bg-emerald-50 text-emerald-600" />
            <StatCard icon="⚡" label="Visa Process" value={stats.status_breakdown?.visa_process || 0} accent="bg-amber-50 text-amber-600" />
            <StatCard icon="✅" label="Converted Students" value={stats.status_breakdown?.converted || 0} accent="bg-green-50 text-green-600" />
          </div>
        )}

        {/* TAB CONTROLS */}
        <div className="flex items-center justify-between border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('leads')}
              className={`pb-3 px-2 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'leads' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>📥 Leads Management</span>
              <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{totalCount}</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`pb-3 px-2 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'students' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🎓 Enrolled Students</span>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">{students.length}</span>
            </button>
          </div>

          {activeTab === 'students' && (
            <button
              onClick={() => setEnrollModal(true)}
              className="mb-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <span>➕</span> Enroll New Student
            </button>
          )}
        </div>

        {/* ── TAB 1: LEADS ────────────────────────────────────────── */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900">Student Inquiries & Leads</h2>
                {!loading && <p className="text-xs text-gray-400 mt-0.5">{totalCount} total leads · Click row for details</p>}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field text-xs py-1.5 px-3 w-48"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">Name</th>
                      <th className="px-5 py-3 text-left">Phone</th>
                      <th className="px-5 py-3 text-left">Course</th>
                      <th className="px-5 py-3 text-left">Budget</th>
                      <th className="px-5 py-3 text-left">Rec. Country</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                          No leads found.
                        </td>
                      </tr>
                    )}
                    {leads.map(lead => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-900">{lead.name}</p>
                          <p className="text-xs text-gray-400">{lead.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{lead.phone || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-600 max-w-[160px] truncate">{lead.course_interest || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-600">
                          {lead.budget ? `$${Number(lead.budget).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {lead.recommended_country
                            ? <span className="text-xs bg-slate-100 text-slate-800 font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                                {flag(lead.recommended_country)}{lead.recommended_country}
                              </span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <select
                            value={lead.status}
                            onChange={e => handleStatusChange(lead.id, e.target.value)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${statusColor(lead.status)}`}
                          >
                            {STATUS_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: STUDENTS ──────────────────────────────────────── */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900">Enrolled Students & Visa Process Tracking</h2>
                <p className="text-xs text-gray-400 mt-0.5">{filteredStudents.length} student records · Admin & Staff Access</p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filter student profiles..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="input-field text-xs py-1.5 px-3 w-56"
                />
              </div>
            </div>

            {studentLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">Student Profile</th>
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
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                          No enrolled students found. Click "Enroll New Student" to get started.
                        </td>
                      </tr>
                    )}
                    {filteredStudents.map(st => (
                      <tr
                        key={st.id}
                        onClick={() => setSelectedStudent(st)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-gray-900">{st.full_name}</p>
                          <p className="text-xs text-gray-400">@{st.username} · {st.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{st.phone}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs bg-navy-50 text-navy-800 font-bold px-2.5 py-1 rounded-full">
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
                            Checklist & Payments
                          </button>
                          {/* DELETE ACTION IS VISIBLE ONLY FOR ADMIN */}
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
            )}
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

                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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

      {/* ── STUDENT DETAIL & CHECKLIST DRAWER ─────────────────────────── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedStudent(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-6 border-b border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded-full uppercase">
                  Student Record #{selectedStudent.id}
                </span>
                <button onClick={() => setSelectedStudent(null)} className="text-white/70 hover:text-white text-lg font-bold">✕</button>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold">{selectedStudent.full_name}</h2>
                  <p className="text-slate-300 text-xs">@{selectedStudent.username} · {selectedStudent.email} · {selectedStudent.phone}</p>
                </div>

                <div className="text-right">
                  <span className="text-xs bg-white/10 border border-white/20 px-3 py-1 rounded-full font-bold">
                    {flag(selectedStudent.destination_country)}{selectedStudent.destination_country}
                  </span>
                </div>
              </div>

              {/* Cost Summary Bar */}
              <div className="grid grid-cols-3 gap-2 mt-5 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Estimated Cost</p>
                  <p className="text-sm font-extrabold text-white">${Number(selectedStudent.total_estimated_cost || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Total Paid</p>
                  <p className="text-sm font-extrabold text-emerald-400">${Number(selectedStudent.total_paid || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Balance Due</p>
                  <p className="text-sm font-extrabold text-amber-400">${Number(selectedStudent.pending_balance || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* Section Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-base">Visa Process Checklist & Payments</h3>
                <button
                  onClick={() => setStepModal(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 transition-all"
                >
                  ➕ Add Custom Step
                </button>
              </div>

              {/* Checklist Steps */}
              <div className="space-y-3">
                {selectedStudent.process_steps?.map((st, idx) => (
                  <div key={st.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center">
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
                        {/* Status Select */}
                        <select
                          value={st.status}
                          onChange={e => handleStepStatusChange(st.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer ${
                            STEP_STATUS_OPTIONS.find(o => o.value === st.status)?.color
                          }`}
                        >
                          {STEP_STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>

                        {/* Add Payment Button */}
                        <button
                          onClick={() => setPaymentModalStep(st)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          + Pay
                        </button>

                        {/* DELETE STEP (ADMIN ONLY) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteStep(st.id)}
                            className="text-xs text-red-500 hover:text-red-700 p-1 font-bold"
                            title="Delete Step (Admin Only)"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Notes or Payments List */}
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
              </div>

            </div>
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

    </div>
  )
}
