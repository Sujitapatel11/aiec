import React from 'react'
import { STATUS_OPTIONS } from './LeadFilters'

const SOURCE_BADGES = {
  crm_manual: 'bg-slate-100 text-slate-700 border-slate-200',
  ai_assessment: 'bg-purple-100 text-purple-700 border-purple-200',
  whatsapp_inquiry: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  chatbot: 'bg-blue-100 text-blue-700 border-blue-200',
}

const statusColor = (s) => STATUS_OPTIONS.find(o => o.value === s)?.color || 'bg-gray-100 text-gray-600'
const statusLabel = (s) => STATUS_OPTIONS.find(o => o.value === s)?.label || s

export default function LeadList({
  leads = [],
  loading = false,
  page = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
  onSelectLead,
  onCreateClick
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header / Action Banner */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-gray-900 text-base">Student Leads & Inquiries</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? 'Loading leads...' : `${totalCount} leads match query · Click lead row to open full CRM details`}
          </p>
        </div>

        <button
          onClick={onCreateClick}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <span>➕</span> Add CRM Lead
        </button>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
              <th className="py-3.5 px-6">Lead / Contact</th>
              <th className="py-3.5 px-4">Course & Country</th>
              <th className="py-3.5 px-4">Source</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Assigned Staff</th>
              <th className="py-3.5 px-4">Follow-Up</th>
              <th className="py-3.5 px-4 text-right">Created</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-xs">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-32 mb-1" /><div className="h-3 bg-gray-100 rounded w-24" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                  <td className="py-4 px-4 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto" /></td>
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-xl mx-auto mb-2 border border-slate-100">
                    📥
                  </div>
                  <p className="font-bold text-gray-800 text-sm">No leads found</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search terms.</p>
                </td>
              </tr>
            ) : (
              leads.map((l) => {
                const isOverdue = l.is_overdue || (
                  l.next_follow_up &&
                  new Date(l.next_follow_up) < new Date() &&
                  !['converted', 'lost'].includes(l.status)
                )

                const followUpStr = l.next_follow_up
                  ? new Date(l.next_follow_up).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'None'

                const createdStr = l.created_at
                  ? new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : ''

                return (
                  <tr
                    key={l.id}
                    onClick={() => onSelectLead(l)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Contact */}
                    <td className="py-3.5 px-6">
                      <p className="font-bold text-gray-900 group-hover:text-slate-950 transition-colors">{l.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{l.email} · {l.phone}</p>
                    </td>

                    {/* Course & Country */}
                    <td className="py-3.5 px-4 font-medium text-gray-700">
                      <p className="font-semibold">{l.course_interest || l.recommended_course || 'General'}</p>
                      <p className="text-[11px] text-gray-400">{l.recommended_country || l.country_of_residence || '-'}</p>
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SOURCE_BADGES[l.source] || 'bg-gray-100 text-gray-600'}`}>
                        {l.source || 'crm_manual'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${statusColor(l.status)}`}>
                        {statusLabel(l.status)}
                      </span>
                    </td>

                    {/* Assigned Staff */}
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      {l.assigned_to_name ? (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-slate-800">{l.assigned_to_name}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Follow Up */}
                    <td className="py-3.5 px-4">
                      {isOverdue ? (
                        <span className="text-[10px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span>⏰</span> Overdue ({followUpStr})
                        </span>
                      ) : l.next_follow_up ? (
                        <span className="text-[11px] font-semibold text-slate-700">
                          📅 {followUpStr}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-right text-gray-400 text-[11px] font-mono">
                      {createdStr}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-xs text-gray-500 font-medium">
            Page <strong className="text-gray-800">{page}</strong> of <strong className="text-gray-800">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ← Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
