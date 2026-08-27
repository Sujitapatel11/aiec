import React from 'react'
import { useNavigate, Navigate } from 'react-router-dom'

export default function StudentPortal() {
  const navigate = useNavigate()
  const token = localStorage.getItem('aiec_token')
  const user = localStorage.getItem('aiec_user') || 'Student'
  const role = localStorage.getItem('aiec_role')

  // Route Protection: must be authenticated and have role === 'student'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white flex flex-col justify-between p-4 sm:p-8 font-sans">
      
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-2xl p-2 shadow-lg border border-amber-400/30">
            <img src="/logo.png" alt="AIEC Logo" className="h-10 sm:h-12 w-auto object-contain" />
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
          <span>🚪 Logout</span>
        </button>
      </header>

      {/* Main Content Box */}
      <main className="max-w-2xl mx-auto w-full my-auto py-10">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl space-y-6 text-center">
          
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-400/30 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-inner">
            🎓
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              Student Account Active
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Welcome, {user}!
            </h2>
            <p className="text-gray-400 text-sm">
              Student Application & Document Tracking Portal
            </p>
          </div>

          <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-5 text-left text-xs sm:text-sm text-amber-200 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-base">
              <span>🚀</span> Student Portal Coming Soon
            </div>
            <p>
              We are enhancing our digital student platform to provide real-time application tracking, document uploads, university offer letters, and visa status updates.
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-5 text-left text-xs sm:text-sm text-gray-300 space-y-3 border border-white/5">
            <h3 className="font-bold text-white text-sm">Need Immediate Assistance?</h3>
            <ul className="space-y-2 text-gray-400">
              <li className="flex items-center gap-2">
                <span>📍</span> Visit us: Ranighat-24, Birgunj, Nepal
              </li>
              <li className="flex items-center gap-2">
                <span>📞</span> Call Counsellor: +977 9802020575 / 9766350770
              </li>
              <li className="flex items-center gap-2">
                <span>📧</span> Email: aaradhyainternationaleducation@gmail.com
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg"
            >
              Sign Out of Portal
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-white/10 text-xs text-gray-400">
        © {new Date().getFullYear()} Aaradhya International Education Consultancy Pvt. Ltd.
      </footer>

    </div>
  )
}
