import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { confirmPasswordReset } from '../api'

/* ── Password strength helpers (mirror server-side rules) ─────────────── */
const WEAK_BLACKLIST = new Set([
  '1234', '12345', '123456', '12345678', '123456789',
  'password', 'password123', 'admin123', 'qwerty123',
  'letmein123', 'welcome123', 'staff123', 'admin',
])

function evaluatePassword(pwd) {
  const checks = {
    length:  pwd.length >= 8,
    letter:  /[A-Za-z]/.test(pwd),
    number:  /\d/.test(pwd),
    noBlacklist: !WEAK_BLACKLIST.has(pwd.toLowerCase()),
  }
  const passed = Object.values(checks).filter(Boolean).length
  const strong = Object.values(checks).every(Boolean)
  return { checks, passed, strong }
}

const REQ_LABELS = [
  { key: 'length',      text: 'At least 8 characters' },
  { key: 'letter',      text: 'Contains a letter' },
  { key: 'number',      text: 'Contains a number' },
  { key: 'noBlacklist', text: 'Not a commonly used password' },
]

function StrengthBar({ passed }) {
  const pct  = Math.round((passed / 4) * 100)
  const color =
    passed <= 1 ? 'bg-red-500' :
    passed === 2 ? 'bg-amber-500' :
    passed === 3 ? 'bg-yellow-400' :
    'bg-emerald-500'
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-1.5 rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ── Eye icon toggle ──────────────────────────────────────────────────── */
function EyeIcon({ visible }) {
  return visible ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function ResetPassword() {
  const { uidb64, token } = useParams()
  const navigate = useNavigate()

  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showNew,    setShowNew]    = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [state,      setState]      = useState('idle') // 'idle' | 'success' | 'invalid'
  const [error,      setError]      = useState('')
  const [countdown,  setCountdown]  = useState(5)

  const { checks, passed, strong } = evaluatePassword(newPwd)
  const mismatch = confirmPwd.length > 0 && newPwd !== confirmPwd

  /* Validate params on mount — catch obviously broken links immediately */
  useEffect(() => {
    if (!uidb64 || !token ||
        uidb64.trim() === '' || token.trim() === '' ||
        token.length < 20) {
      setState('invalid')
    }
  }, [uidb64, token])

  /* Countdown redirect after success */
  useEffect(() => {
    if (state !== 'success') return
    if (countdown <= 0) { navigate('/login', { replace: true }); return }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [state, countdown, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!strong) {
      setError('Password does not meet all requirements listed below.')
      return
    }
    if (newPwd !== confirmPwd) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await confirmPasswordReset({
        uidb64,
        token,
        new_password:     newPwd,
        confirm_password: confirmPwd,
      })
      setState('success')
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.'
      // Invalid/expired token → show invalid state
      if (
        err.response?.status === 400 &&
        (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired'))
      ) {
        setState('invalid')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Invalid / expired token screen ── */
  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-4 py-12 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
          <div className="bg-gradient-to-r from-red-700 to-red-900 px-5 sm:px-8 pt-8 pb-6 text-center text-white">
            <div className="text-5xl mb-3">⛔</div>
            <h1 className="text-xl font-extrabold">Link Invalid or Expired</h1>
            <p className="text-red-200 text-xs mt-1">This password reset link cannot be used</p>
          </div>
          <div className="px-5 sm:px-8 py-7 space-y-4 text-center">
            <p className="text-sm text-gray-600 leading-relaxed">
              This reset link has either already been used, has expired (links are valid for 1 hour),
              or is malformed.
            </p>
            <p className="text-xs text-gray-400">
              Please request a new password reset link from the login page.
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-all text-center mt-2"
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ── Success screen ── */
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-4 py-12 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-800 px-5 sm:px-8 pt-8 pb-6 text-center text-white">
            <div className="text-5xl mb-3">✅</div>
            <h1 className="text-xl font-extrabold">Password Reset Successful</h1>
            <p className="text-emerald-200 text-xs mt-1">Your new password is active</p>
          </div>
          <div className="px-5 sm:px-8 py-7 space-y-4 text-center">
            <p className="text-sm text-gray-700 leading-relaxed">
              Your AIEC Portal password has been updated. You can now log in with your new password.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-emerald-700 font-semibold">
                Redirecting to login in <span className="font-extrabold text-emerald-900">{countdown}</span> second{countdown !== 1 ? 's' : ''}…
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-all text-center"
            >
              Go to Login Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main reset form ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col items-center justify-between px-4 py-8 font-sans selection:bg-amber-400 selection:text-slate-900">

      {/* Brand header */}
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
          to="/login"
          className="text-xs text-blue-200 hover:text-amber-300 transition-colors font-medium flex items-center gap-1 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/10"
        >
          <span>←</span> Login
        </Link>
      </header>

      {/* Card */}
      <div className="w-full max-w-md my-auto py-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">

          {/* Card header */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-5 sm:px-8 pt-8 pb-6 text-center text-white">
            <div className="flex justify-center mb-3">
              <div className="bg-white rounded-2xl p-2 shadow-lg border border-amber-400/40">
                <img src="/logo.png" alt="AIEC Logo" className="h-12 w-auto object-contain" />
              </div>
            </div>
            <p className="text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-0.5">
              UrmiNexus Portal · AIEC Tenant
            </p>
            <h1 className="text-xl font-extrabold">Set New Password</h1>
            <p className="text-blue-200/80 text-xs mt-1">
              Enter a strong new password for your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-4 sm:px-7 py-6 space-y-5" noValidate>

            {/* Global error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
                <span className="text-base flex-shrink-0">⚠️</span>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* New password */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Enter new password"
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setError('') }}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon visible={showNew} />
                </button>
              </div>

              {/* Strength bar */}
              {newPwd.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <StrengthBar passed={passed} />
                  <p className={`text-[11px] font-bold ${
                    passed <= 1 ? 'text-red-600' :
                    passed === 2 ? 'text-amber-600' :
                    passed === 3 ? 'text-yellow-600' :
                    'text-emerald-600'
                  }`}>
                    {passed <= 1 ? 'Weak' : passed === 2 ? 'Fair' : passed === 3 ? 'Good' : 'Strong'}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  className={`input-field pr-10 ${mismatch ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  placeholder="Re-enter new password"
                  value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); setError('') }}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showConf ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon visible={showConf} />
                </button>
              </div>
              {mismatch && (
                <p className="text-xs text-red-600 font-semibold mt-1">Passwords do not match.</p>
              )}
              {!mismatch && confirmPwd.length > 0 && newPwd === confirmPwd && (
                <p className="text-xs text-emerald-600 font-semibold mt-1">✓ Passwords match</p>
              )}
            </div>

            {/* Requirements checklist */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-1.5">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Password Requirements
              </p>
              {REQ_LABELS.map(({ key, text }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`text-sm flex-shrink-0 ${checks[key] ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {checks[key] ? '✅' : '○'}
                  </span>
                  <span className={`text-xs ${checks[key] ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !strong || mismatch || confirmPwd.length === 0}
              className="w-full py-3 px-4 rounded-2xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 focus:ring-2 focus:ring-slate-950 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating Password…
                </>
              ) : (
                '🔒 Reset Password'
              )}
            </button>

            <div className="pt-1 text-center border-t border-gray-100">
              <p className="text-[11px] text-gray-400">
                Remember your password?{' '}
                <Link to="/login" className="text-slate-700 font-semibold hover:underline">
                  Back to Login
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-md w-full text-center py-2 text-[11px] text-gray-400">
        © {new Date().getFullYear()} Aaradhya International Education Consultancy. All rights reserved.
      </footer>
    </div>
  )
}
