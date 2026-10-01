import React from 'react'

export const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'contacted',    label: 'Contacted',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'applied',      label: 'Applied',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'visa_process', label: 'Visa Process', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'converted',    label: 'Converted',    color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost',         label: 'Lost',         color: 'bg-red-100 text-red-700 border-red-200' },
]

export default function LeadFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  countryFilter,
  setCountryFilter,
  courseFilter,
  setCourseFilter,
  countryOptions = [],
  courseOptions = [],
  onReset
}) {
  const hasActiveFilters = search || statusFilter || countryFilter || courseFilter

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Search box */}
      <div className="relative flex-1 min-w-[200px]">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-xs">
          🔍
        </div>
        <input
          type="text"
          placeholder="Search by name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-slate-800 transition-all outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 focus:bg-white focus:border-slate-800 outline-none transition-all"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Country */}
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 focus:bg-white focus:border-slate-800 outline-none transition-all max-w-[160px] truncate"
        >
          <option value="">All Countries</option>
          {countryOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Course */}
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 focus:bg-white focus:border-slate-800 outline-none transition-all max-w-[180px] truncate"
        >
          <option value="">All Courses</option>
          {courseOptions.map(cr => (
            <option key={cr} value={cr}>{cr}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-all"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  )
}
