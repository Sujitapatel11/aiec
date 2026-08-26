import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { adminLogin } from '../api'

const MAX_ATTEMPTS  = 5
const LOCKOUT_MS    = 5 * 60 * 1000  // 5 minutes

export default function Login() {
  const [selectedRole, setSelectedRole] = useState(null) // null | 'admin' | 'staff' | 'student'
  const [form, setForm]                 = useState({ username: '', password: '' })
  const [rememberMe, setRememberMe]     = useState(true)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [forgotModal, setForgotModal]   = useState(false)
  const [attempts, setAttempts]         = useState(() => Number(sessionStorage.getItem('login_attempts') || 0))
  const [lockedUntil, setLockedUntil]   = useState(() => {
    const until = Number(sessionStorage.getItem('login_locked_until') || 0)
    if (until && until < Date.now()) {
      sessionStorage.removeItem('login_locked_until')
      sessionStorage.removeItem('login_attempts')
      return 0
    }
    return until
  })
  const [countdown, setCountdown]       = useState(0)
  const navigate = useNavigate()

  // Redirect if already logged in
  if (localStorage.getItem('aiec_token')) return <Navigate to="/dashboard" replace />

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const remaining = Math.max(0, lockedUntil - Date.now())
      setCountdown(Math.ceil(remaining / 1000))
      if (remaining === 0) {
        setLockedUntil(0)
        setAttempts(0)
        sessionStorage.removeItem('login_locked_until')
        sessionStorage.removeItem('login_attempts')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const isLocked = lockedUntil > Date.now()

  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setError('')
    setForm({ username: '', password: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) return
    setError('')

    // Client-side validation
    if (form.username.length < 3) return setError('Username/Email must be at least 3 characters.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')

    // Student Portal Special Handler
    if (selectedRole === 'student') {
      setError('Student Portal account registration is managed by AIEC Counsellors upon application. If you have not received your student credentials, please contact your counsellor or submit an online assessment.')
      return
    }

    setLoading(true)
    try {
      const res = await adminLogin(form)
      const isSuperuser = res.data.is_superuser
      const userRole    = isSuperuser ? 'admin' : 'staff'

      // Role check: If user selected Admin portal but logged in with a staff account
      if (selectedRole === 'admin' && !isSuperuser) {
        setError('Access denied: "Admin Portal" requires Administrator privileges. Please select Staff / Counsellor Portal.')
        setLoading(false)
        return
      }

      // Clear lockout state & save session
      sessionStorage.removeItem('login_attempts')
      sessionStorage.removeItem('login_locked_until')
      localStorage.setItem('aiec_token', res.data.token)
      localStorage.setItem('aiec_user', res.data.name)
      localStorage.setItem('aiec_role', userRole)
      localStorage.setItem('aiec_last_active', Date.now().toString())
      
      if (rememberMe) {
        localStorage.setItem('aiec_remember_username', form.username)
      } else {
        localStorage.removeItem('aiec_remember_username')
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      sessionStorage.setItem('login_attempts', newAttempts)

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS
        setLockedUntil(until)
        sessionStorage.setItem('login_locked_until', until)
        setError(`Too many failed attempts. Account locked for 5 minutes.`)
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts
        setError(`${err.response?.data?.error || 'Invalid credentials.'} (${remaining} attempt${remaining !== 1 ? 's' : ''} left)`)
      }
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 1: ROLE SELECTION / PORTAL CHOICE SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-gray-800 flex flex-col justify-between px-4 py-8 font-sans selection:bg-amber-400 selection:text-slate-900">
        
        {/* Top Header */}
        <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/95 backdrop-blur rounded-2xl p-2 shadow-lg border border-amber-400/30">
              <img src="/logo.png" alt="AIEC Logo" className="h-10 sm:h-12 w-auto object-contain" />
            </div>
            <div>
              <p className="text-white font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                Aaradhya International
              </p>
              <p className="text-amber-400/90 text-xs font-semibold tracking-wide">
                Education Consultancy Pvt. Ltd.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur border border-white/10 px-4 py-2 rounded-full text-xs text-blue-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Official Management Portal
          </div>
        </header>

        {/* Hero Section & Cards */}
        <main className="max-w-6xl mx-auto w-full my-auto py-8 space-y-10">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              ✨ Enterprise Management System
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Welcome to Aaradhya International
            </h1>
            <p className="text-blue-200/90 text-sm sm:text-base font-medium">
              Select your portal to continue
            </p>
          </div>

          {/* 3 Portal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            
            {/* CARD 1: ADMIN PORTAL */}
            <div 
              id="admin-portal-card"
              onClick={() => handleRoleSelect('admin')}
              className="group bg-slate-900/80 backdrop-blur-md rounded-3xl p-7 border border-white/10 hover:border-amber-400/60 shadow-xl hover:shadow-amber-500/10 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
              
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-950 border border-purple-400/30 flex items-center justify-center text-2xl shadow-inner mb-5 group-hover:scale-110 transition-transform">
                  🛡️
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                      Admin Portal
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      System
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    Manage the entire consultancy, staff, universities, applications and system settings.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5">
                <button
                  type="button"
                  id="btn-admin-portal"
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-purple-800 to-indigo-900 hover:from-purple-700 hover:to-indigo-800 text-white shadow-md transition-all flex items-center justify-center gap-2 group-hover:shadow-purple-900/50"
                >
                  <span>Login as Admin</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            </div>

            {/* CARD 2: STAFF / COUNSELLOR PORTAL */}
            <div 
              id="staff-portal-card"
              onClick={() => handleRoleSelect('staff')}
              className="group bg-slate-900/80 backdrop-blur-md rounded-3xl p-7 border border-white/10 hover:border-amber-400/60 shadow-xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between cursor-pointer relative overflow-hidden ring-1 ring-blue-500/20"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
              
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 border border-blue-400/30 flex items-center justify-center text-2xl shadow-inner mb-5 group-hover:scale-110 transition-transform">
                  💼
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                      Staff / Counsellor
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Counselling
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    Manage students, applications, counselling, documents and follow-ups.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5">
                <button
                  type="button"
                  id="btn-staff-portal"
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md transition-all flex items-center justify-center gap-2 group-hover:shadow-blue-900/50"
                >
                  <span>Login as Staff</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            </div>

            {/* CARD 3: STUDENT PORTAL */}
            <div 
              id="student-portal-card"
              onClick={() => handleRoleSelect('student')}
              className="group bg-slate-900/80 backdrop-blur-md rounded-3xl p-7 border border-white/10 hover:border-amber-400/60 shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
              
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-950 to-slate-900 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner mb-5 group-hover:scale-110 transition-transform">
                  🎓
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                      Student Portal
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Students
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    Track applications, documents, university offers and application status.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5">
                <button
                  type="button"
                  id="btn-student-portal"
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md transition-all flex items-center justify-center gap-2 group-hover:shadow-emerald-900/50"
                >
                  <span>Login as Student</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="max-w-6xl mx-auto w-full text-center py-4 border-t border-white/10 text-xs text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Aaradhya International Education Consultancy Pvt. Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4 text-gray-400">
            <Link to="/" className="hover:text-amber-400 transition-colors">Main Website</Link>
            <span>•</span>
            <Link to="/apply" className="hover:text-amber-400 transition-colors">Free Assessment</Link>
          </div>
        </footer>

      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 2: DEDICATED ROLE LOGIN FORM
  // ─────────────────────────────────────────────────────────────────────────
  const roleTitleMap = {
    admin:   'Admin Portal',
    staff:   'Staff / Counsellor Portal',
    student: 'Student Portal',
  }

  const roleBadgeMap = {
    admin:   '🛡️ System Administrator',
    staff:   '💼 Counsellor Access',
    student: '🎓 Student Access',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col items-center justify-center px-4 py-8 font-sans selection:bg-amber-400 selection:text-slate-900">
      
      {/* Back button */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          type="button"
          id="btn-back-to-portal-selection"
          onClick={() => setSelectedRole(null)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-amber-300 transition-colors bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/10"
        >
          <span>←</span> Back to Portal Selection
        </button>

        <span className="text-xs text-amber-400 font-semibold tracking-wide">
          {roleTitleMap[selectedRole]}
        </span>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-fade-in">

        {/* Card Header with Branding */}
        <div className={`px-8 py-8 text-center text-white relative ${
          selectedRole === 'admin'
            ? 'bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950'
            : selectedRole === 'staff'
            ? 'bg-gradient-to-r from-primary-900 via-blue-950 to-slate-900'
            : 'bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900'
        }`}>
          <div className="flex justify-center mb-3">
            <div className="bg-white rounded-2xl p-2.5 shadow-lg border border-amber-400/40">
              <img src="/logo.png" alt="Aaradhya International Logo" className="h-14 w-auto object-contain" />
            </div>
          </div>

          <p className="text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
            Aaradhya International Education Consultancy
          </p>
          
          <h1 className="text-xl font-extrabold flex items-center justify-center gap-2">
            {roleTitleMap[selectedRole]}
          </h1>

          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 border border-white/10 text-xs text-blue-100 font-medium">
            {roleBadgeMap[selectedRole]}
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">

          {/* Lockout banner */}
          {isLocked && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl text-center">
              <p className="font-bold">🔒 Account Temporarily Locked</p>
              <p className="text-xs mt-1">Too many failed attempts. Try again in <span className="font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span></p>
            </div>
          )}

          {/* Error */}
          {error && !isLocked && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span className="flex-shrink-0 text-base">⚠️</span>
              <span className="text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* Student Portal Information Notice */}
          {selectedRole === 'student' && !error && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl leading-relaxed">
              <p className="font-bold text-emerald-900 mb-1">🎓 Student Login Notice</p>
              Student accounts are issued directly by AIEC Counsellors after application submission. If you are a new applicant, please complete our free AI Assessment or contact us via WhatsApp.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Email / Username
            </label>
            <input
              id="input-username"
              className="input-field"
              placeholder={selectedRole === 'admin' ? 'admin' : selectedRole === 'staff' ? 'sujitapatel5' : 'student@example.com'}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
              disabled={isLocked}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              id="input-password"
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              disabled={isLocked}
              required
            />
          </div>

          {/* Remember me & Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-gray-600 select-none">
              <input
                id="checkbox-remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              id="btn-forgot-password"
              onClick={() => setForgotModal(true)}
              className="text-primary-600 hover:text-primary-800 font-semibold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-submit-login"
            disabled={loading || isLocked}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedRole === 'admin'
                ? 'bg-purple-900 hover:bg-purple-950 focus:ring-2 focus:ring-purple-400'
                : selectedRole === 'staff'
                ? 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-400'
                : 'bg-emerald-700 hover:bg-emerald-800 focus:ring-2 focus:ring-emerald-400'
            }`}
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Authenticating...</>
              : isLocked ? '🔒 Account Locked' : `🔐 Secure Login as ${selectedRole === 'admin' ? 'Admin' : selectedRole === 'staff' ? 'Staff' : 'Student'}`}
          </button>

          <div className="pt-2 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Official Management Portal · Aaradhya International Education Consultancy
            </p>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto">
                🔑
              </div>
              <h3 className="font-bold text-gray-900 text-base">Password Recovery</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                For security reasons, password resets for AIEC Staff & Admin accounts are managed by the System Administrator.
              </p>
              <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                Please contact the IT Admin or send an email to <span className="font-semibold text-gray-800">sujitapatel787@gmail.com</span> to reset your credentials.
              </p>
              <button
                type="button"
                onClick={() => setForgotModal(false)}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl transition-all mt-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
