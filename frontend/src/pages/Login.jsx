import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { adminLogin } from '../api'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 5 * 60 * 1000  // 5 minutes

export default function Login() {
  const [selectedRole, setSelectedRole] = useState('staff') // 'admin' | 'staff' | 'student'
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
  const existingToken = localStorage.getItem('aiec_token')
  const existingRole  = localStorage.getItem('aiec_role')
  if (existingToken) {
    if (existingRole === 'student') return <Navigate to="/student-portal" replace />
    return <Navigate to="/dashboard" replace />
  }

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

  const handleRoleChange = (role) => {
    setSelectedRole(role)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) return
    setError('')

    // Basic client validation
    if (form.username.length < 3 || form.password.length < 4) {
      setError('Invalid credentials.')
      return
    }

    setLoading(true)
    try {
      const res = await adminLogin({
        username: form.username,
        password: form.password,
        role: selectedRole,
      })

      // Clear lockout state & save session
      sessionStorage.removeItem('login_attempts')
      sessionStorage.removeItem('login_locked_until')

      const userRole = res.data.role
      localStorage.setItem('aiec_token', res.data.token)
      localStorage.setItem('aiec_user', res.data.name || res.data.username)
      localStorage.setItem('aiec_role', userRole)
      localStorage.setItem('aiec_last_active', Date.now().toString())

      if (rememberMe) {
        localStorage.setItem('aiec_remember_username', form.username)
      } else {
        localStorage.removeItem('aiec_remember_username')
      }

      // Navigate based on returned role
      if (userRole === 'student') {
        navigate('/student-portal', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      sessionStorage.setItem('login_attempts', newAttempts)

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS
        setLockedUntil(until)
        sessionStorage.setItem('login_locked_until', until)
        setError('Too many failed attempts. Account locked for 5 minutes.')
      } else {
        // Generic error message only — no role leakage
        setError('Invalid credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const ROLES = [
    { id: 'admin',   label: 'Admin',   icon: '🛡️' },
    { id: 'staff',   label: 'Staff',   icon: '💼' },
    { id: 'student', label: 'Student', icon: '🎓' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col items-center justify-between px-4 py-8 font-sans selection:bg-amber-400 selection:text-slate-900">
      
      {/* Top Brand Header */}
      <header className="max-w-md w-full flex items-center justify-between pt-2">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="bg-white/95 backdrop-blur rounded-2xl p-1.5 shadow-lg border border-amber-400/30 group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="AIEC Logo" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <p className="text-white font-extrabold text-xs sm:text-sm tracking-tight leading-tight">
              Aaradhya International
            </p>
            <p className="text-amber-400 text-[10px] font-semibold tracking-wide">
              Education Consultancy
            </p>
          </div>
        </Link>

        <Link
          to="/"
          className="text-xs text-blue-200 hover:text-amber-300 transition-colors font-medium flex items-center gap-1 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/10"
        >
          <span>←</span> Main Site
        </Link>
      </header>

      {/* SINGLE UNIFIED LOGIN CARD */}
      <div className="w-full max-w-md my-auto py-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">

          {/* Card Header */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-8 pt-8 pb-6 text-center text-white relative">
            <div className="flex justify-center mb-3">
              <div className="bg-white rounded-2xl p-2 shadow-lg border border-amber-400/40">
                <img src="/logo.png" alt="AIEC Logo" className="h-12 w-auto object-contain" />
              </div>
            </div>

            <p className="text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-0.5">
              AIEC Enterprise Portal
            </p>
            <h1 className="text-xl font-extrabold text-white">
              Account Login
            </h1>
            <p className="text-blue-200/80 text-xs mt-1">
              Select your role and enter credentials to continue
            </p>
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">

            {/* 3-WAY SEGMENTED ROLE SELECTOR */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                {ROLES.map((r) => {
                  const active = selectedRole === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      id={`btn-role-${r.id}`}
                      onClick={() => handleRoleChange(r.id)}
                      className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-slate-900 text-white shadow-md scale-[1.02]'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="text-sm">{r.icon}</span>
                      <span>{r.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Lockout Banner */}
            {isLocked && (
              <div className="bg-red-50 border border-red-300 text-red-700 text-xs px-4 py-3 rounded-2xl text-center">
                <p className="font-bold text-sm">🔒 Account Temporarily Locked</p>
                <p className="mt-1">Too many failed attempts. Try again in <span className="font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span></p>
              </div>
            )}

            {/* Generic Error Notification */}
            {error && !isLocked && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
                <span className="text-base flex-shrink-0">⚠️</span>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Username / Email Field */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Username or Email
              </label>
              <input
                id="input-username"
                type="text"
                className="input-field"
                placeholder={selectedRole === 'admin' ? 'admin' : selectedRole === 'staff' ? 'staff_user' : 'student@example.com'}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
                disabled={isLocked}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                id="input-password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                disabled={isLocked}
                required
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 select-none">
                <input
                  id="checkbox-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-slate-900 rounded border-gray-300 focus:ring-slate-800"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                id="btn-forgot-password"
                onClick={() => setForgotModal(true)}
                className="text-slate-700 hover:text-slate-950 font-semibold hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-submit-login"
              disabled={loading || isLocked}
              className="w-full py-3 px-4 rounded-2xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 focus:ring-2 focus:ring-slate-950 transition-all shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : isLocked ? (
                '🔒 Account Locked'
              ) : (
                'Sign In'
              )}
            </button>

            <div className="pt-2 text-center border-t border-gray-100">
              <p className="text-[11px] text-gray-400">
                Official Management Portal · AIEC Birgunj, Nepal
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center text-xl mx-auto border border-slate-200">
              🔑
            </div>
            <h3 className="font-bold text-gray-900 text-base">Password Recovery</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Password resets for AIEC Admin, Staff, and Student accounts are managed by system administrators.
            </p>
            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200">
              Contact AIEC IT Support or email <span className="font-semibold text-gray-800">sujitapatel787@gmail.com</span> to reset credentials.
            </p>
            <button
              type="button"
              onClick={() => setForgotModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-md w-full text-center py-2 text-[11px] text-gray-400">
        © {new Date().getFullYear()} Aaradhya International Education Consultancy. All rights reserved.
      </footer>

    </div>
  )
}
