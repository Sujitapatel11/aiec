import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { adminLogin } from '../api'

const MAX_ATTEMPTS  = 5
const LOCKOUT_MS    = 5 * 60 * 1000  // 5 minutes
const IDLE_TIMEOUT  = 30 * 60 * 1000 // 30 minutes auto-logout

export default function Login() {
  const [form, setForm]         = useState({ username: '', password: '' })
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [attempts, setAttempts] = useState(() => Number(sessionStorage.getItem('login_attempts') || 0))
  const [lockedUntil, setLockedUntil] = useState(() => Number(sessionStorage.getItem('login_locked_until') || 0))
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
      // Success — clear lockout state
      sessionStorage.removeItem('login_attempts')
      sessionStorage.removeItem('login_locked_until')
      localStorage.setItem('aiec_token', res.data.token)
      localStorage.setItem('aiec_user', res.data.name)
      localStorage.setItem('aiec_role', res.data.is_superuser ? 'admin' : 'staff')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-900 px-8 py-8 text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-2xl p-2">
              <img src="/logo.png" alt="AIEC Logo" className="h-16 w-auto object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold">AIEC Admin</h1>
          <p className="text-blue-200 text-sm mt-1">Staff access only</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-4">

          {/* Lockout banner */}
          {isLocked && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-lg text-center">
              <p className="font-bold">🔒 Account Temporarily Locked</p>
              <p className="text-xs mt-1">Too many failed attempts. Try again in <span className="font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span></p>
            </div>
          )}

          {/* Error */}
          {error && !isLocked && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Username
            </label>
            <input
              className="input-field"
              placeholder="admin"
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
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
              : isLocked ? '🔒 Locked' : '🔐 Sign In'}
          </button>

          <p className="text-xs text-center text-gray-400 pt-2">
            Only AIEC staff members can access this panel.
          </p>
        </form>
      </div>
    </div>
  )
}
