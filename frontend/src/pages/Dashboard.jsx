import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getDashboardStats, updateLead, adminLogout } from '../api'

/* ── Constants ─────────────────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted',    label: 'Contacted',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'applied',      label: 'Applied',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'visa_process', label: 'Visa Process', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'converted',    label: 'Converted',    color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost',         label: 'Lost',         color: 'bg-red-100 text-red-700 border-red-200' },
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
            <Row label="Marks" value={lead.marks ? `${lead.marks}%` : null} />
            <Row label="English Score" value={lead.english_score ? `${lead.english_score} IELTS` : null} />
            <Row label="Budget" value={lead.budget ? `$${Number(lead.budget).toLocaleString()}/yr` : null} />
            <Row label="Course Interest" value={lead.course_interest} />
          </Section>

          {/* AI Recommendation */}
          <Section title="AI Recommendation">
            <Row label="Country" value={lead.recommended_country ? flag(lead.recommended_country) + lead.recommended_country : null} />
            <Row label="Course" value={lead.recommended_course} />
          </Section>

          <p className="text-xs text-gray-400">
            Created: {new Date(lead.created_at).toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>
      <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

/* ── Main Dashboard ────────────────────────────────────────────────── */
export default function Dashboard() {
  const [stats, setStats]           = useState(null)
  const [leads, setLeads]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedLead, setSelectedLead] = useState(null)

  // Filters
  const [search, setSearch]         = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCourse, setFilterCourse]   = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterOptions, setFilterOptions] = useState({ countries: [], courses: [] })

  const navigate  = useNavigate()
  const adminName = localStorage.getItem('aiec_user') || 'Admin'
  const isAdmin   = localStorage.getItem('aiec_role') === 'admin'

  // ── Idle auto-logout (30 min) ──────────────────────────────────────────
  useEffect(() => {
    const IDLE_MS = 30 * 60 * 1000
    let timer = setTimeout(doLogout, IDLE_MS)
    const reset = () => {
      localStorage.setItem('aiec_last_active', Date.now().toString())
      clearTimeout(timer)
      timer = setTimeout(doLogout, IDLE_MS)
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [])

  async function doLogout() {
    try { await adminLogout() } catch { /* ignore */ }
    localStorage.removeItem('aiec_token')
    localStorage.removeItem('aiec_user')
    localStorage.removeItem('aiec_role')
    localStorage.removeItem('aiec_last_active')
    navigate('/login', { replace: true })
  }

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page })
      if (search)        params.set('search', search)
      if (filterCountry) params.set('country', filterCountry)
      if (filterCourse)  params.set('course', filterCourse)
      if (filterStatus)  params.set('status', filterStatus)

      const res = await import('../api').then(m => m.default.get(`/leads/?${params}`))
      setLeads(res.data.results || res.data)
      if (res.data.count !== undefined) {
        setTotalCount(res.data.count)
        setTotalPages(Math.ceil(res.data.count / 20))
      }
    } catch {
      /* handled silently */
    } finally {
      setLoading(false)
    }
  }, [page, search, filterCountry, filterCourse, filterStatus])

  useEffect(() => {
    getDashboardStats().then(res => {
      setStats(res.data)
      setFilterOptions(res.data.filter_options || { countries: [], courses: [] })
    }).catch(() => {})
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, filterCountry, filterCourse, filterStatus])

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateLead(id, { status: newStatus })
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
      if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, status: newStatus }))
    } catch { /* ignore */ }
  }

  const statCards = [
    { icon: '👥', label: 'Total Leads',   value: stats?.total_leads || 0,                        accent: 'bg-blue-50' },
    { icon: '🆕', label: 'New',           value: stats?.status_breakdown?.new || 0,               accent: 'bg-sky-50' },
    { icon: '📞', label: 'Contacted',     value: stats?.status_breakdown?.contacted || 0,         accent: 'bg-yellow-50' },
    { icon: '📋', label: 'Applied',       value: stats?.status_breakdown?.applied || 0,           accent: 'bg-purple-50' },
    { icon: '✈️', label: 'Visa Process',  value: stats?.status_breakdown?.visa_process || 0,      accent: 'bg-orange-50' },
    { icon: '✅', label: 'Converted',     value: stats?.status_breakdown?.converted || 0,         accent: 'bg-green-50' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AIEC" className="h-8 w-auto object-contain" />
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">AIEC Dashboard</p>
              <p className="text-xs text-gray-400">Lead Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">👤 {adminName}</span>
            {isAdmin && (
              <button
                onClick={() => navigate('/staff')}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 border border-primary-200 hover:border-primary-300 px-3 py-1.5 rounded-lg transition-all"
              >
                👥 Manage Staff
              </button>
            )}
            <button
              onClick={doLogout}
              className="text-sm font-semibold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-all"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Filters + Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Name, email, phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                />
              </div>
            </div>

            {/* Country filter */}
            <div className="min-w-[160px]">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Country</label>
              <select
                value={filterCountry}
                onChange={e => setFilterCountry(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-white"
              >
                <option value="">All Countries</option>
                {filterOptions.countries.map(c => <option key={c} value={c}>{flag(c)}{c}</option>)}
              </select>
            </div>

            {/* Course filter */}
            <div className="min-w-[160px]">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Course</label>
              <select
                value={filterCourse}
                onChange={e => setFilterCourse(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-white"
              >
                <option value="">All Courses</option>
                {filterOptions.courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Status filter */}
            <div className="min-w-[150px]">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-white"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Clear */}
            {(search || filterCountry || filterCourse || filterStatus) && (
              <button
                onClick={() => { setSearch(''); setFilterCountry(''); setFilterCourse(''); setFilterStatus('') }}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Leads table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Student Leads</h2>
              {!loading && <p className="text-xs text-gray-400 mt-0.5">{totalCount} total · click a row for details</p>}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
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
                        <div className="text-4xl mb-3">🔍</div>
                        No leads found.
                      </td>
                    </tr>
                  )}
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-primary-50/40 cursor-pointer transition-colors"
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
                          ? <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2 py-1 rounded-full whitespace-nowrap">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 border border-gray-200 px-4 py-1.5 rounded-lg transition-all"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 border border-gray-200 px-4 py-1.5 rounded-lg transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lead detail drawer */}
      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
