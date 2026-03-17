import React, { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { captureLead } from '../api'

/* ── Lead gate modal ──────────────────────────────────────────────── */
const COUNTRIES_LIST = [
  'India','Pakistan','Bangladesh','Nepal','Sri Lanka','Nigeria','Kenya','Ghana',
  'Philippines','Vietnam','Indonesia','Malaysia','China','UAE','Saudi Arabia',
  'Qatar','Kuwait','Bahrain','Oman','Jordan','Egypt','Ethiopia','Tanzania',
  'Uganda','Zimbabwe','Zambia','South Africa','Brazil','Mexico','Colombia',
  'Other',
]

function LeadGate({ recommendation, profile, onUnlock }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', country_of_residence: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.phone.trim()) e.phone = 'Phone / WhatsApp is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await captureLead({
        ...form,
        qualification:       profile?.qualification       || '',
        marks:               profile?.marks               ?? null,
        english_score:       profile?.english_score       ?? null,
        budget:              profile?.budget               ?? null,
        course_interest:     profile?.course_interest     || '',
        recommended_country: recommendation?.best_country || '',
        recommended_course:  recommendation?.recommended_course || '',
      })
    } catch {
      // Continue even if backend is down
    } finally {
      setLoading(false)
    }

    // Open WhatsApp with pre-filled student profile message
    const wa = import.meta.env.VITE_WHATSAPP || '919999999999'
    const msg = [
      `New Study Abroad Inquiry`,
      `Name: ${form.name}`,
      `Qualification: ${profile?.qualification || '—'}`,
      `Marks: ${profile?.marks ?? '—'}`,
      `English Score: ${profile?.english_score ?? '—'}`,
      `Budget: ${profile?.budget ? `$${profile.budget.toLocaleString()}` : '—'}`,
      `Preferred Course: ${profile?.course_interest || '—'}`,
      `Recommended Country: ${recommendation?.best_country || '—'}`,
    ].join('\n')
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank')

    onUnlock()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary-700 to-primary-900 px-8 py-7 text-white text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h2 className="text-xl font-extrabold mb-1">Your Results Are Ready!</h2>
          <p className="text-blue-200 text-sm">Enter your details to unlock your personalised study abroad recommendations.</p>
        </div>

        {/* Teaser — blurred preview */}
        <div className="relative mx-6 mt-5 rounded-xl overflow-hidden border border-gray-100">
          <div className="blur-sm pointer-events-none select-none bg-gray-50 px-5 py-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🥇</span>
              <div>
                <div className="h-3 w-24 bg-gray-300 rounded" />
                <div className="h-2 w-16 bg-gray-200 rounded mt-1" />
              </div>
              <span className="ml-auto text-xs font-bold text-yellow-500">96% Match</span>
            </div>
            <div className="h-2 bg-yellow-200 rounded-full w-full" />
            <div className="h-2 bg-gray-200 rounded w-3/4" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-2 shadow-md">
              <span className="text-lg">🔒</span>
              <span className="text-xs font-bold text-gray-700">Unlock your results below</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                className={`input-field text-sm ${errors.name ? 'border-red-400' : ''}`}
                placeholder="Full Name *"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div className="col-span-2">
              <input
                className={`input-field text-sm ${errors.email ? 'border-red-400' : ''}`}
                type="email"
                placeholder="Email Address *"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div className="col-span-2">
              <input
                className={`input-field text-sm ${errors.phone ? 'border-red-400' : ''}`}
                placeholder="Phone / WhatsApp *"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div className="col-span-2">
              <select
                className="input-field text-sm text-gray-600"
                value={form.country_of_residence}
                onChange={e => set('country_of_residence', e.target.value)}
              >
                <option value="">Country of Residence</option>
                {COUNTRIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-accent w-full text-base flex items-center justify-center gap-2"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              : <>🔓 Unlock My Results</>}
          </button>
          <p className="text-xs text-gray-400 text-center">
            No spam. Our counselor may reach out to help with your application.
          </p>
        </form>
      </div>
    </div>
  )
}

/* ── Country flag map ─────────────────────────────────────────────── */
const FLAGS = {
  'Canada': '🇨🇦', 'Australia': '🇦🇺', 'United Kingdom': '🇬🇧', 'UK': '🇬🇧',
  'USA': '🇺🇸', 'United States': '🇺🇸', 'Germany': '🇩🇪', 'Ireland': '🇮🇪',
  'New Zealand': '🇳🇿', 'Netherlands': '🇳🇱', 'France': '🇫🇷', 'Sweden': '🇸🇪',
  'Denmark': '🇩🇰', 'Norway': '🇳🇴', 'Finland': '🇫🇮', 'Switzerland': '🇨🇭',
  'Singapore': '🇸🇬', 'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'China': '🇨🇳',
  'Malaysia': '🇲🇾', 'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Portugal': '🇵🇹',
  'Poland': '🇵🇱', 'Czech Republic': '🇨🇿', 'Hungary': '🇭🇺', 'UAE': '🇦🇪',
  'Cyprus': '🇨🇾', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
}

const getFlag = (name) => {
  if (!name) return '🌍'
  for (const [key, flag] of Object.entries(FLAGS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return flag
  }
  return '🌍'
}

/* ── Rank config ──────────────────────────────────────────────────── */
const RANK_CONFIG = [
  { label: '1st', bg: 'from-yellow-400 to-amber-500',   border: 'border-yellow-400', badge: 'bg-yellow-400 text-yellow-900', matchPct: 96, icon: '🥇' },
  { label: '2nd', bg: 'from-slate-400 to-slate-500',    border: 'border-slate-400',  badge: 'bg-slate-400 text-white',       matchPct: 88, icon: '🥈' },
  { label: '3rd', bg: 'from-orange-400 to-orange-600',  border: 'border-orange-400', badge: 'bg-orange-400 text-white',      matchPct: 81, icon: '🥉' },
]

/* ── Animated match bar ───────────────────────────────────────────── */
function MatchBar({ pct, color }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-1000 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ── Country podium card ──────────────────────────────────────────── */
function CountryCard({ country, rank, isTop }) {
  const cfg = RANK_CONFIG[rank]
  const flag = getFlag(country.name || country.country || '')
  const name = country.name || country.country || 'Unknown'
  const reason = country.reason || ''
  const cost = country.avg_cost || country.estimated_cost || ''

  return (
    <div className={`relative bg-white rounded-2xl border-2 ${cfg.border} shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden ${isTop ? 'ring-2 ring-yellow-300 ring-offset-2' : ''}`}>
      {/* Rank ribbon */}
      <div className={`bg-gradient-to-r ${cfg.bg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cfg.icon}</span>
          <span className="text-white font-bold text-sm">{cfg.label} Choice</span>
        </div>
        <span className={`${cfg.badge} text-xs font-bold px-2 py-1 rounded-full`}>
          {cfg.matchPct - rank}% Match
        </span>
      </div>

      <div className="p-5">
        {/* Country name + flag */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{flag}</span>
          <div>
            <h3 className="font-extrabold text-gray-900 text-lg leading-tight">{name}</h3>
            {isTop && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Best Match</span>}
          </div>
        </div>

        {/* Match bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Profile Match</span>
            <span className="font-semibold text-gray-700">{cfg.matchPct - rank}%</span>
          </div>
          <MatchBar
            pct={cfg.matchPct - rank}
            color={rank === 0 ? 'bg-yellow-400' : rank === 1 ? 'bg-slate-400' : 'bg-orange-400'}
          />
        </div>

        {/* Reason */}
        {reason && <p className="text-sm text-gray-600 leading-relaxed mb-3">{reason}</p>}

        {/* Cost badge */}
        {cost && (
          <div className="flex items-center gap-2 bg-primary-50 rounded-lg px-3 py-2">
            <span className="text-base">💰</span>
            <span className="text-xs font-semibold text-primary-700">{cost}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── University card ──────────────────────────────────────────────── */
function UniversityCard({ name, index }) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500']
  const color = colors[index % colors.length]
  // parse "University Name (Country)" format
  const match = name.match(/^(.+?)\s*\((.+?)\)$/)
  const uniName = match ? match[1] : name
  const country = match ? match[2] : ''

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-primary-200 hover:shadow-md transition-all">
      <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
        {index + 1}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{uniName}</p>
        {country && <p className="text-xs text-gray-400 mt-0.5">{getFlag(country)} {country}</p>}
      </div>
    </div>
  )
}

/* ── Cost breakdown card ──────────────────────────────────────────── */
function CostCard({ cost }) {
  if (!cost) return null
  const tuition = cost.tuition_per_year_usd || cost.tuition || 0
  const living  = cost.living_expenses_usd  || cost.living  || 0
  const total   = cost.total_per_year_usd   || cost.total   || (tuition + living)
  const note    = cost.currency_note || ''
  const scholarship = cost.scholarship_possibilities || ''

  const fmt = (n) => typeof n === 'number' ? `$${n.toLocaleString()}` : n

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
        <h3 className="text-white font-bold text-base flex items-center gap-2">
          <span>💵</span> Estimated Yearly Cost
        </h3>
      </div>
      <div className="p-6">
        <div className="space-y-3 mb-4">
          {[
            { label: 'Tuition Fees',     value: fmt(tuition), icon: '🎓', color: 'text-blue-600' },
            { label: 'Living Expenses',  value: fmt(living),  icon: '🏠', color: 'text-purple-600' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span>{row.icon}</span>
                <span className="text-sm text-gray-600">{row.label}</span>
              </div>
              <span className={`font-bold text-sm ${row.color}`}>{row.value}/yr</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span className="text-sm font-bold text-gray-800">Total per Year</span>
            </div>
            <span className="font-extrabold text-lg text-green-600">{fmt(total)}</span>
          </div>
        </div>
        {scholarship && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800">
            🎯 <span className="font-semibold">Scholarship:</span> {scholarship}
          </div>
        )}
        {note && <p className="text-xs text-gray-400 mt-3 italic">{note}</p>}
      </div>
    </div>
  )
}

/* ── Main Results page ────────────────────────────────────────────── */
export default function Results() {
  const { state } = useLocation()
  const [showAll, setShowAll] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-600 mb-6 text-lg">No results found.</p>
          <Link to="/apply" className="btn-primary">Take Free Assessment</Link>
        </div>
      </div>
    )
  }

  /* Support both /api/recommend/ and /api/questionnaire/ response shapes */
  const rec   = state.recommendation || state.recommendations || {}
  const qId   = state.questionnaire_id || ''
  const profile = state.input_profile || {}
  const wa    = import.meta.env.VITE_WHATSAPP || '919999999999'
  const waMsg = encodeURIComponent(`Hi! I completed the AIEC assessment${qId ? ` (ID: ${qId})` : ''}. I'd like to discuss my recommendations.`)

  /* Normalise country list — handle both shapes */
  const bestCountry   = rec.best_country || ''
  const altCountries  = rec.alternative_countries || rec.countries || []
  const allCountries  = bestCountry
    ? [{ name: bestCountry, reason: rec.reason_for_recommendation, avg_cost: rec.estimated_cost?.total_per_year_usd ? `$${rec.estimated_cost.total_per_year_usd.toLocaleString()}/yr` : '' }, ...altCountries.map(c => typeof c === 'string' ? { name: c } : c)]
    : altCountries

  const top3          = allCountries.slice(0, 3)
  const course        = rec.recommended_course || rec.courses?.[0]?.name || ''
  const universities  = rec.top_universities || []
  const cost          = rec.estimated_cost || null
  const explanation   = rec.reason_for_recommendation || ''
  const eligibility   = rec.eligibility_notes || ''
  const nextSteps     = rec.next_steps || []
  const prAvailable   = rec.pr_pathway_available
  const method        = rec.processing_method || 'rule_based'
  const allScored     = rec.all_scored_countries || []

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Lead gate — shown until student submits contact info */}
      {!unlocked && (
        <LeadGate
          recommendation={rec}
          profile={profile}
          onUnlock={() => setUnlocked(true)}
        />
      )}

      {/* ── Hero banner ── */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {method === 'openai' ? 'AI-Powered Recommendation' : 'Smart Profile Analysis'}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Your Study Abroad Recommendations</h1>
          <p className="text-blue-200 text-base max-w-xl mx-auto">
            Based on your academic profile, budget, and goals — here are your best-matched destinations.
          </p>
          {prAvailable !== undefined && (
            <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-semibold ${prAvailable ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'}`}>
              {prAvailable ? '✅ PR Pathway Available' : 'ℹ️ No Direct PR Pathway'}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* ── Top 3 Country Cards ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">1</div>
            <h2 className="text-xl font-bold text-gray-900">Top Country Matches</h2>
          </div>
          {top3.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {top3.map((c, i) => (
                <CountryCard key={i} country={c} rank={i} isTop={i === 0} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No country data available.</p>
          )}
        </section>

        {/* ── Recommended Course + Cost (side by side) ── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Course card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-4">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <span>🎓</span> Recommended Course
              </h3>
            </div>
            <div className="p-6">
              <p className="text-xl font-extrabold text-gray-900 mb-3 leading-tight">{course || '—'}</p>
              {bestCountry && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{getFlag(bestCountry)}</span>
                  <span className="text-sm font-semibold text-primary-600">{bestCountry}</span>
                </div>
              )}
              {explanation && (
                <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4">{explanation}</p>
              )}
              {eligibility && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-800">
                  ℹ️ <span className="font-semibold">Eligibility:</span> {eligibility}
                </div>
              )}
            </div>
          </div>

          {/* Cost card */}
          <CostCard cost={cost} />
        </div>

        {/* ── Top Universities ── */}
        {universities.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">2</div>
              <h2 className="text-xl font-bold text-gray-900">Suggested Universities</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {universities.slice(0, 6).map((u, i) => (
                <UniversityCard key={i} name={u} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Next Steps ── */}
        {nextSteps.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">3</div>
              <h2 className="text-xl font-bold text-gray-900">Your Next Steps</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nextSteps.map((step, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── All scored countries (collapsible) ── */}
        {allScored.length > 3 && (
          <section>
            <button
              onClick={() => setShowAll(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors mb-4"
            >
              <svg className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showAll ? 'Hide' : 'Show'} all {allScored.length} scored countries
            </button>
            {showAll && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">Rank</th>
                      <th className="px-5 py-3 text-left">Country</th>
                      <th className="px-5 py-3 text-left">Score</th>
                      <th className="px-5 py-3 text-left">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allScored.map((row, i) => {
                      const maxScore = allScored[0]?.score || 1
                      const pct = Math.round((row.score / maxScore) * 100)
                      return (
                        <tr key={row.country} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-400 font-medium">#{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-gray-800">
                            {getFlag(row.country)} {row.country}
                          </td>
                          <td className="px-5 py-3 text-gray-600">{row.score}</td>
                          <td className="px-5 py-3 w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── CTA ── */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-900 rounded-2xl p-8 text-white text-center">
          <h3 className="text-xl font-bold mb-2">Ready to make it happen?</h3>
          <p className="text-blue-200 mb-6 text-sm">Our expert counselors will help you turn these recommendations into a real application plan.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`https://wa.me/${wa}?text=${waMsg}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat on WhatsApp
            </a>
            <Link to="/apply" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl transition-all">
              Retake Assessment
            </Link>
            <Link to="/" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl transition-all">
              Back to Home
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
