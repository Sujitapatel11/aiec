import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { adminLogin } from '../api'

const MAX_ATTEMPTS  = 5
const LOCKOUT_MS    = 5 * 60 * 1000  // 5 minutes

export default function Login() {
  const [activeTab, setActiveTab] = useState('staff') // 'staff' | 'admin'
  const [form, setForm]         = useState({ username: '', password: '' })
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [attempts, setAttempts] = useState(() => Number(sessionStorage.getItem('login_attempts') || 0))
  const [lockedUntil, setLockedUntil] = useState(() => {
    const until = Number(sessionStorage.getItem('login_locked_until') || 0)
    if (until && until < Date.now()) {
      sessionStorage.removeItem('login_locked_until')
      sessionStorage.removeItem('login_attempts')
      return 0
    }
    return until
  })
  const [countdown, setCountdown]     = useState(0)
  const navigate = useNavigate()

  // Already logged in
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) return
    setError('')

    // Client-side validation
    if (form.username.length < 3) return setError('Username must be at least 3 characters.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')

    setLoading(true)
    try {
      const res = await adminLogin(form)
      
      const userRole = res.data.is_superuser ? 'admin' : 'staff'
      
      // If user selected Admin portal but logged in with a staff account
      if (activeTab === 'admin' && !res.data.is_superuser) {
        setError('Access denied: "Admin Portal" requires Administrator privileges. Please switch to Staff Portal.')
        setLoading(false)
        return
      }

      // Success — clear lockout state & save credentials
      sessionStorage.removeItem('login_attempts')
      sessionStorage.removeItem('login_locked_until')
      localStorage.setItem('aiec_token', res.data.token)
      localStorage.setItem('aiec_user', res.data.name)
      localStorage.setItem('aiec_role', userRole)
      localStorage.setItem('aiec_last_active', Date.now().toString())
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

  const isAdminTab = activeTab === 'admin'

  return (
    <div className={`min-h-screen transition-colors duration-500 flex items-center justify-center px-4 py-8 ${
      isAdminTab
        ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950'
        : 'bg-gradient-to-br from-primary-900 via-primary-800 to-blue-900'
    }`}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20">

        {/* Portal Selector Tabs (University Style) */}
        <div className="bg-gray-100 p-1.5 flex gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setActiveTab('staff'); setError('') }}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'staff'
                ? 'bg-white text-primary-700 shadow-sm border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
            }`}
          >
            <span>👤</span> Staff Portal
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setError('') }}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-purple-950 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
            }`}
          >
            <span>🛡️</span> Admin Portal
          </button>
        </div>

        {/* Header */}
        <div className={`px-8 py-8 text-center text-white transition-all duration-500 ${
          isAdminTab
            ? 'bg-gradient-to-r from-purple-950 to-slate-900'
            : 'bg-gradient-to-r from-primary-700 to-primary-900'
        }`}>
          <div className="flex justify-center mb-3">
            <div className="bg-white rounded-2xl p-2 shadow-md">
              <img src="/logo.png" alt="AIEC Logo" className="h-14 w-auto object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold flex items-center justify-center gap-2">
            AIEC {isAdminTab ? 'Administrator' : 'Staff'} Portal
          </h1>
          <p className="text-blue-200 text-xs mt-1">
            {isAdminTab ? '🔒 Superuser & System Management Access' : '💼 Counsellor & Lead Management Access'}
          </p>
        </div>

        {/* Form */}
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
              <span className="flex-shrink-0">⚠️</span>
              <span className="text-xs leading-relaxed">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {isAdminTab ? 'Admin Username' : 'Staff Username'}
            </label>
            <input
              className="input-field"
              placeholder={isAdminTab ? 'admin' : 'sujitapatel5'}
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

          <button
            type="submit"
            disabled={loading || isLocked}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isAdminTab
                ? 'bg-purple-900 hover:bg-purple-950 focus:ring-2 focus:ring-purple-400'
                : 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-400'
            }`}
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Authenticating...</>
              : isLocked ? '🔒 Locked' : (isAdminTab ? '🛡️ Sign In as Admin' : '👤 Sign In as Staff')}
          </button>

          <div className="pt-2 text-center">
            <p className="text-xs text-gray-400">
              {isAdminTab
                ? 'Authorized administrators only. All logins are logged.'
                : 'AIEC Counsellors & Staff access portal.'}
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
