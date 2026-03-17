import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileRecommend } from '../api';

const STEPS = [
  { id: 'personal',     title: 'Personal Info' },
  { id: 'education',    title: 'Education' },
  { id: 'preferences',  title: 'Preferences' },
  { id: 'goals',        title: 'Goals' },
];

/* ── Full world country list ──────────────────────────────────────── */
const ALL_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin',
  'Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Cambodia','Cameroon','Canada','Chile','China','Colombia','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Ecuador','Egypt','El Salvador',
  'Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala',
  'Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos',
  'Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Maldives','Malta',
  'Mauritius','Mexico','Moldova','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Nigeria','North Macedonia',
  'Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Singapore',
  'Slovakia','Slovenia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan',
  'Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Tunisia',
  'Turkey','Turkmenistan','UAE','Uganda','Ukraine','United Kingdom','Uruguay','USA',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

const BUDGET_OPTIONS = [
  { label: 'Under $10,000/yr',    value: 8000 },
  { label: '$10,000–$20,000/yr',  value: 15000 },
  { label: '$20,000–$35,000/yr',  value: 27000 },
  { label: '$35,000–$50,000/yr',  value: 42000 },
  { label: 'Above $50,000/yr',    value: 60000 },
];

const INTAKE_OPTIONS = [
  'January 2025','May 2025','September 2025',
  'January 2026','May 2026','September 2026',
];

const initialForm = {
  name: '', email: '', phone: '', city: '',
  education_level: '', field_of_interest: '',
  english_proficiency: '', work_experience_years: 0,
  marks: '',
  preferred_countries: [],
  budget_range: '', budget_value: 0,
  target_intake: '', pr_preference: false,
  additional_info: '',
};

/* ── Searchable country picker ────────────────────────────────────── */
function CountryPicker({ selected, onChange }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const filtered = query.trim()
    ? ALL_COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : ALL_COUNTRIES;

  const toggle = (c) => {
    onChange(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c]);
  };

  return (
    <div>
      {/* Search box */}
      <div className="relative mb-2">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search countries..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
        />
      </div>

      {/* Scrollable grid */}
      <div className="border border-gray-200 rounded-xl overflow-y-auto" style={{ maxHeight: '220px' }}>
        <div className="grid grid-cols-2 gap-1 p-2">
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selected.includes(c)
                  ? 'bg-primary-600 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {c}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 text-center text-gray-400 text-sm py-4">No countries found</p>
          )}
        </div>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(c => (
            <span key={c} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {c}
              <button type="button" onClick={() => toggle(c)} className="hover:text-primary-900 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function Questionnaire() {
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate              = useNavigate();

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // Map english_proficiency string → numeric IELTS score
  const englishToScore = (val) => {
    const map = {
      'IELTS 6.0': 6.0, 'IELTS 6.5': 6.5, 'IELTS 7.0+': 7.0,
      'TOEFL 80+': 6.0, 'TOEFL 100+': 7.0, 'PTE 58+': 6.5, 'No test yet': 0,
    };
    return map[val] ?? 0;
  };

  // Map budget label → months timeline from target intake
  const intakeToMonths = (intake) => {
    if (!intake) return 12;
    const now = new Date();
    const parts = intake.split(' ');
    const month = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'].indexOf(parts[0]);
    const year  = parseInt(parts[1]) || now.getFullYear();
    const target = new Date(year, month, 1);
    const diff = Math.round((target - now) / (1000 * 60 * 60 * 24 * 30));
    return Math.max(1, Math.min(36, diff));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.education_level) { setError('Please select your education level.'); return; }
    if (!form.field_of_interest.trim()) { setError('Please enter your field of interest.'); return; }
    if (!form.budget_value) { setError('Please select your budget.'); return; }

    setLoading(true);
    try {
      const payload = {
        qualification:   form.education_level,
        marks:           parseFloat(form.marks) || 65,
        english_score:   englishToScore(form.english_proficiency),
        course_interest: form.field_of_interest,
        budget:          form.budget_value,
        pr_preference:   form.pr_preference,
        timeline:        intakeToMonths(form.target_intake),
      };
      const res = await profileRecommend(payload);
      navigate('/results/ai', { state: { ...res.data, input_profile: payload } });
    } catch (err) {
      setError('Could not get recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.email.trim() && form.phone.trim();
    if (step === 1) return form.education_level && form.field_of_interest.trim();
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((s, i) => (
              <span key={s.id} className={`text-xs font-semibold ${i <= step ? 'text-primary-600' : 'text-gray-400'}`}>
                {s.title}
              </span>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{STEPS[step].title}</h2>

          {/* Step 0: Personal */}
          {step === 0 && (
            <div className="space-y-4">
              <input className="input-field" placeholder="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} />
              <input className="input-field" type="email" placeholder="Email Address *" value={form.email} onChange={e => set('email', e.target.value)} />
              <input className="input-field" placeholder="Phone / WhatsApp *" value={form.phone} onChange={e => set('phone', e.target.value)} />
              <input className="input-field" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          )}

          {/* Step 1: Education */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Highest Education Level *</label>
                <select className="input-field" value={form.education_level} onChange={e => set('education_level', e.target.value)}>
                  <option value="">Select...</option>
                  {['High School / 12th Grade', 'Diploma', "Bachelor's Degree", "Master's Degree", 'PhD'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field of Interest *</label>
                <input className="input-field" placeholder="e.g. Computer Science, MBA, Nursing, Engineering" value={form.field_of_interest} onChange={e => set('field_of_interest', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Marks / Percentage</label>
                <input className="input-field" type="number" min={0} max={100} placeholder="e.g. 75" value={form.marks} onChange={e => set('marks', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">English Proficiency</label>
                <select className="input-field" value={form.english_proficiency} onChange={e => set('english_proficiency', e.target.value)}>
                  <option value="">Select...</option>
                  {['IELTS 6.0','IELTS 6.5','IELTS 7.0+','TOEFL 80+','TOEFL 100+','PTE 58+','No test yet'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Experience (years)</label>
                <input className="input-field" type="number" min={0} max={30} value={form.work_experience_years} onChange={e => set('work_experience_years', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Countries
                  <span className="text-gray-400 font-normal ml-1">(optional — search & select any)</span>
                </label>
                <CountryPicker
                  selected={form.preferred_countries}
                  onChange={v => set('preferred_countries', v)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Budget *</label>
                <select
                  className="input-field"
                  value={form.budget_range}
                  onChange={e => {
                    const opt = BUDGET_OPTIONS.find(o => o.label === e.target.value);
                    set('budget_range', e.target.value);
                    set('budget_value', opt?.value || 0);
                  }}
                >
                  <option value="">Select budget range...</option>
                  {BUDGET_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Intake</label>
                <select className="input-field" value={form.target_intake} onChange={e => set('target_intake', e.target.value)}>
                  <option value="">Select...</option>
                  {INTAKE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
                <input
                  id="pr_pref"
                  type="checkbox"
                  checked={form.pr_preference}
                  onChange={e => set('pr_preference', e.target.checked)}
                  className="w-4 h-4 accent-primary-600"
                />
                <label htmlFor="pr_pref" className="text-sm font-medium text-gray-700 cursor-pointer">
                  I'm interested in Permanent Residency (PR) / immigration pathway after studies
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anything else you'd like us to know?</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Scholarships, specific universities, career goals..."
                  value={form.additional_info}
                  onChange={e => set('additional_info', e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-accent flex items-center gap-2 disabled:opacity-60"
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analysing Profile...</>
                  : '🤖 Get AI Recommendations'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
