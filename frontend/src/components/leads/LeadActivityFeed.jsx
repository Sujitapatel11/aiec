/**
 * LeadActivityFeed — Phase A
 *
 * Activity interaction tabs:
 *   Counseling Note | Phone Call | Follow-up Task
 *     → manual journal log (existing behaviour, unchanged)
 *
 *   WhatsApp Chat
 *     → real compose + send via POST /api/leads/<id>/send-whatsapp/
 *     → on success: clears composer, calls onActivitySent() so parent
 *       can refresh the activity list, shows success banner
 *     → on failure: shows a safe user-facing error (never Twilio details)
 *
 * Props:
 *   activities      {Array}    – activity list from parent
 *   onAddActivity   {Function} – (data) → Promise  — for manual log tabs
 *   onSendWhatsApp  {Function} – (message) → Promise  — for WhatsApp tab
 *                                 resolves to axios response
 */
import React, { useState } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────

const ACTIVITY_ICONS = {
  note:             '📝',
  call:             '📞',
  whatsapp:         '💬',
  status_change:    '🔄',
  assignment:       '👤',
  followup:         '📅',
  counselling_note: '🔒',
  task:             '✅',
  appointment:      '🗓',
}

// Tabs that use the simple manual journal textarea
const LOG_TABS = [
  { value: 'note',    label: 'Counseling Note' },
  { value: 'call',    label: 'Phone Call' },
  { value: 'followup', label: 'Follow-up' },
]

const WHATSAPP_TAB = { value: 'whatsapp', label: 'WhatsApp Chat' }

// Match backend WHATSAPP_MAX_MESSAGE_LENGTH so we give live feedback
// before hitting the server.
const WA_MAX_LENGTH = 1000

// ── Component ──────────────────────────────────────────────────────────────

export default function LeadActivityFeed({
  activities = [],
  onAddActivity,   // (data) => Promise  — manual log tabs
  onSendWhatsApp,  // (message) => Promise — WhatsApp tab
}) {
  // Which interaction tab is selected
  const [activeTab, setActiveTab] = useState('note')

  // ── Manual log state ────────────────────────────────────────────────
  const [logContent, setLogContent]     = useState('')
  const [logSubmitting, setLogSubmitting] = useState(false)
  const [logError, setLogError]         = useState('')

  // ── WhatsApp compose state ───────────────────────────────────────────
  const [waMessage, setWaMessage]       = useState('')
  const [waSending, setWaSending]       = useState(false)
  const [waSuccess, setWaSuccess]       = useState('')
  const [waError, setWaError]           = useState('')

  // ── Handlers ────────────────────────────────────────────────────────

  const handleLogSubmit = async (e) => {
    e.preventDefault()
    if (!logContent.trim()) return
    setLogError('')
    setLogSubmitting(true)
    try {
      await onAddActivity({ activity_type: activeTab, content: logContent.trim() })
      setLogContent('')
    } catch {
      setLogError('Failed to log activity. Please try again.')
    } finally {
      setLogSubmitting(false)
    }
  }

  const handleWaSend = async (e) => {
    e.preventDefault()
    const trimmed = waMessage.trim()
    if (!trimmed) return

    setWaError('')
    setWaSuccess('')
    setWaSending(true)

    try {
      await onSendWhatsApp(trimmed)
      // Success — clear composer and show confirmation
      setWaMessage('')
      setWaSuccess('WhatsApp message sent successfully.')
      // Auto-dismiss success banner after 5 s
      setTimeout(() => setWaSuccess(''), 5000)
    } catch (err) {
      // Extract safe user-facing error — never expose Twilio internals
      const serverError =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        null

      if (err?.response?.status === 429) {
        setWaError(
          serverError ||
          'Too many messages sent recently. Please wait a moment before retrying.'
        )
      } else if (err?.response?.status === 503) {
        setWaError(
          serverError ||
          'WhatsApp service is temporarily unavailable. Contact your administrator.'
        )
      } else if (err?.response?.status === 400) {
        setWaError(serverError || 'Message could not be sent. Please check the lead\'s phone number.')
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        setWaError('You do not have permission to send WhatsApp messages.')
      } else {
        setWaError(
          serverError ||
          'Failed to send WhatsApp message. Please try again.'
        )
      }
    } finally {
      setWaSending(false)
    }
  }

  const waCharsLeft = WA_MAX_LENGTH - waMessage.length
  const waOverLimit = waCharsLeft < 0

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Interaction type selector ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Add Interaction
          </label>
          <div className="flex flex-wrap gap-1">
            {/* Manual log tabs */}
            {LOG_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveTab(t.value)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                  activeTab === t.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {ACTIVITY_ICONS[t.value]} {t.label}
              </button>
            ))}

            {/* WhatsApp send tab — visually distinct */}
            <button
              type="button"
              onClick={() => setActiveTab(WHATSAPP_TAB.value)}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                activeTab === WHATSAPP_TAB.value
                  ? 'bg-green-700 text-white ring-2 ring-green-400/40'
                  : 'bg-white text-green-700 border border-green-300 hover:bg-green-50'
              }`}
            >
              💬 {WHATSAPP_TAB.label}
            </button>
          </div>
        </div>

        {/* ── Manual journal form (note / call / followup) ── */}
        {activeTab !== 'whatsapp' && (
          <form onSubmit={handleLogSubmit} className="space-y-2">
            {logError && (
              <p className="text-[11px] font-bold text-red-600">{logError}</p>
            )}
            <div className="flex gap-2">
              <textarea
                rows={2}
                required
                placeholder={`Log a ${activeTab} note (e.g. Discussed visa requirements, sent program brochures…)`}
                value={logContent}
                onChange={(e) => setLogContent(e.target.value)}
                className="flex-1 text-xs p-2.5 bg-white border border-gray-200 rounded-xl focus:border-slate-800 outline-none resize-none"
              />
              <button
                type="submit"
                disabled={logSubmitting || !logContent.trim()}
                className="self-end px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-40"
              >
                {logSubmitting ? '…' : 'Post Log'}
              </button>
            </div>
          </form>
        )}

        {/* ── WhatsApp compose & send form ── */}
        {activeTab === 'whatsapp' && (
          <form onSubmit={handleWaSend} className="space-y-2">

            {/* Info banner */}
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-2.5">
              <span className="text-base leading-none mt-0.5">💬</span>
              <p className="text-[11px] text-green-800 leading-relaxed">
                This will send a real WhatsApp message from the{' '}
                <span className="font-bold">AIEC Business number</span> to the
                lead's registered phone. The message will appear on the lead's
                WhatsApp.
              </p>
            </div>

            {/* Success banner */}
            {waSuccess && (
              <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-xl px-3 py-2">
                <span className="text-green-700 text-sm">✓</span>
                <p className="text-[11px] font-bold text-green-800">{waSuccess}</p>
              </div>
            )}

            {/* Error banner */}
            {waError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <span className="text-red-500 text-sm">✕</span>
                <p className="text-[11px] font-bold text-red-700">{waError}</p>
              </div>
            )}

            {/* Message textarea */}
            <textarea
              rows={4}
              required
              placeholder="Type your WhatsApp message here…"
              value={waMessage}
              onChange={(e) => {
                setWaMessage(e.target.value)
                // Clear banners on new input
                if (waError) setWaError('')
                if (waSuccess) setWaSuccess('')
              }}
              disabled={waSending}
              className={`w-full text-xs p-2.5 bg-white border rounded-xl outline-none resize-none transition-colors ${
                waOverLimit
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-200 focus:border-green-600'
              } disabled:bg-gray-50 disabled:text-gray-400`}
            />

            {/* Char count + send button row */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-mono ${
                  waOverLimit
                    ? 'text-red-600 font-bold'
                    : waCharsLeft <= 100
                    ? 'text-amber-600'
                    : 'text-gray-400'
                }`}
              >
                {waOverLimit
                  ? `${Math.abs(waCharsLeft)} chars over limit`
                  : `${waCharsLeft} / ${WA_MAX_LENGTH} chars remaining`}
              </span>

              <button
                type="submit"
                disabled={waSending || !waMessage.trim() || waOverLimit}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white font-bold text-xs rounded-xl transition-all disabled:cursor-not-allowed"
              >
                {waSending ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>💬 Send via AIEC WhatsApp</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Activity timeline list ── */}
      <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">
            No activity logs recorded yet.
          </p>
        ) : (
          activities.map((act) => {
            const icon = ACTIVITY_ICONS[act.activity_type] || '📌'
            const formattedDate = act.created_at
              ? new Date(act.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''

            // Highlight real dispatched WhatsApp messages differently from
            // manual journal entries. Backend prefixes with "[Sent via AIEC WhatsApp]".
            const isRealWaSend =
              act.activity_type === 'whatsapp' &&
              act.content?.startsWith('[Sent via AIEC WhatsApp]')

            return (
              <div
                key={act.id}
                className={`border p-3 rounded-xl shadow-2xs flex items-start gap-3 ${
                  isRealWaSend
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-100'
                }`}
              >
                <span
                  className={`text-sm p-1.5 rounded-lg border flex-shrink-0 ${
                    isRealWaSend
                      ? 'bg-green-100 border-green-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  {icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {act.author_name || 'System'}
                      </span>
                      {isRealWaSend && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-green-700 text-white rounded-full flex-shrink-0">
                          SENT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                      {formattedDate}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {act.content}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
