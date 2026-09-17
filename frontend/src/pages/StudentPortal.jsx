import React, { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { getStudentPortalMe } from '../api'

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

export default function StudentPortal() {
  const navigate = useNavigate()
  const token = localStorage.getItem('aiec_token')
  const role = localStorage.getItem('aiec_role')

  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!token || role !== 'student') return

    const loadProfile = async () => {
      try {
        const res = await getStudentPortalMe()
        setProfile(res.data)
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load student profile. Please contact AIEC support.')
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
            <img src="/logo.png" alt="AIEC Logo" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight text-white">
              Aaradhya International
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Enrolled Student Portal
                    </span>
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

            {/* Read-Only Process Checklist */}
            <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Application & Visa Process Checklist</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Real-time status updates tracked by your AIEC counselor</p>
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
                        <div className="bg-slate-950/80 p-3 rounded-xl border border-white/10 text-xs space-y-1 sm:min-w-[200px]">
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
                Your educational counselor at AIEC is monitoring your process steps daily. If you need to submit new documents or ask questions about fees, contact our team:
              </p>
              <div className="flex flex-wrap gap-4 text-amber-300 font-semibold pt-1">
                <span>📍 Birgunj, Nepal</span>
                <span>📞 +977 9802020575</span>
                <span>📧 aaradhyainternationaleducation@gmail.com</span>
              </div>
            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center py-4 border-t border-white/10 text-xs text-gray-500">
        © {new Date().getFullYear()} Aaradhya International Education Consultancy. All rights reserved.
      </footer>

    </div>
  )
}
