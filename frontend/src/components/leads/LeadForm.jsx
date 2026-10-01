import React, { useState } from 'react'
import { STATUS_OPTIONS } from './LeadFilters'

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '',
  country_of_residence: '',
  qualification: '',
  marks: '',
  english_score: '',
  budget: '',
  course_interest: '',
  recommended_country: '',
  recommended_course: '',
  status: 'new',
  source: 'crm_manual',
  notes: '',
}

export default function LeadForm({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        ...form,
        marks: form.marks === '' ? null : Number(form.marks),
        english_score: form.english_score === '' ? null : Number(form.english_score),
        budget: form.budget === '' ? null : Number(form.budget),
      })
      setForm(INITIAL_FORM)
      onClose()
    } catch (err) {
      const resp = err.response?.data
      if (resp) {
        if (resp.error) {
          setError(resp.error)
        } else if (typeof resp === 'object') {
          const firstErr = Object.values(resp).flat()[0]
          setError(typeof firstErr === 'string' ? firstErr : 'Failed to create lead.')
        } else {
          setError('Failed to create lead. Please check inputs.')
        }
      } else {
        setError('Network error or server unavailable.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 rounded-t-3xl flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold">Create New CRM Lead</h2>
            <p className="text-xs text-amber-400">Manual Entry · Source: crm_manual</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white font-bold p-1">
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-2xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Contact Details */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. aarav@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +977 98000 12345"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Country of Residence</label>
                <input
                  type="text"
                  placeholder="e.g. Nepal"
                  value={form.country_of_residence}
                  onChange={(e) => setForm({ ...form, country_of_residence: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Academic Background */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Academic Background</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Highest Qualification</label>
                <input
                  type="text"
                  placeholder="e.g. Bachelor's Degree"
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Marks / GPA (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 80"
                  value={form.marks}
                  onChange={(e) => setForm({ ...form, marks: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">English Score (IELTS/PTE)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="9"
                  placeholder="e.g. 7.0"
                  value={form.english_score}
                  onChange={(e) => setForm({ ...form, english_score: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Study Preferences */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Study Preferences & Budget</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Budget (USD)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Course Interest</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={form.course_interest}
                  onChange={(e) => setForm({ ...form, course_interest: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Recommended Country</label>
                <input
                  type="text"
                  placeholder="e.g. Canada"
                  value={form.recommended_country}
                  onChange={(e) => setForm({ ...form, recommended_country: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Initial Status & Notes */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Initial Lead Status & Notes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none font-semibold"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Source</label>
                <input
                  type="text"
                  disabled
                  value="crm_manual"
                  className="w-full text-xs px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-mono"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Initial Counselor Notes</label>
              <textarea
                rows={3}
                placeholder="Enter counseling notes or specific requirements..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Creating Lead...' : '➕ Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
