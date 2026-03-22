import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileRecommend } from '../api';

/* ── Constants ─────────────────────────────────────────────────────── */
const STEPS = [
  { id: 'personal',    title: 'Basic Info',       icon: '👤', desc: 'Tell us about yourself' },
  { id: 'education',   title: 'Academic Details', icon: '🎓', desc: 'Your education background' },
  { id: 'preferences', title: 'Preferences',      icon: '🌍', desc: 'Budget & destination' },
  { id: 'goals',       title: 'Goals',            icon: '🎯', desc: 'Timeline & ambitions' },
];

const BUDGET_OPTIONS = [
  { label: 'Under $10,000/yr',   value: 8000,  icon: '💚', tag: 'Budget-friendly' },
  { label: '$10,000–$20,000/yr', value: 15000, icon: '💛', tag: 'Moderate' },
  { label: '$20,000–$35,000/yr', value: 27000, icon: '🧡', tag: 'Standard' },
  { label: '$35,000–$50,000/yr', value: 42000, icon: '❤️', tag: 'Premium' },
  { label: 'Above $50,000/yr',   value: 60000, icon: '💜', tag: 'Top-tier' },
];

const INTAKE_OPTIONS = [
  { label: 'Within 6 months', months: 6,  icon: '🔥', tag: 'Urgent' },
  { label: 'Within 1 year',   months: 12, icon: '📅', tag: 'Planning' },
  { label: 'After 1 year',    months: 18, icon: '🗓️', tag: 'Flexible' },
  { label: 'Just exploring',  months: 24, icon: '🔍', tag: 'Research' },
];

const EDUCATION_OPTIONS = [
  { label: 'High School / 12th Grade', icon: '📚' },
  { label: 'Diploma',                  icon: '📜' },
  { label: "Bachelor's Degree",        icon: '🎓' },
  { label: "Master's Degree",          icon: '🏅' },
  { label: 'PhD',                      icon: '🔬' },
];

const ENGLISH_OPTIONS = [
  { label: 'IELTS 6.0',   score: 6.0 },
  { label: 'IELTS 6.5',   score: 6.5 },
  { label: 'IELTS 7.0+',  score: 7.0 },
  { label: 'TOEFL 80+',   score: 6.0 },
  { label: 'TOEFL 100+',  score: 7.0 },
  { label: 'PTE 58+',     score: 6.5 },
  { label: 'No test yet', score: 0   },
];

const TOP_COUNTRIES = [
  'Canada','Australia','United Kingdom','USA','Germany',
  'Ireland','Netherlands','Sweden','Norway','Japan',
  'South Korea','Singapore','France','Italy','Malaysia',
];

const LOADING_STEPS = [
  { text: 'Analyzing your academic profile…',     icon: '📊' },
  { text: 'Matching with top universities…',      icon: '🏛️' },
  { text: 'Calculating visa success chances…',    icon: '🛂' },
  { text: 'Preparing your personalized report…',  icon: '📋' },
];

const MICRO_REWARDS = {
  1: { msg: "Great start! Let's check your academic profile 🎓", color: 'bg-blue-50 border-blue-200 text-blue-700' },
  2: { msg: "Excellent! You're eligible for top countries 🎯",   color: 'bg-green-50 border-green-200 text-green-700' },
  3: { msg: "Almost there! Just your goals left 🚀",             color: 'bg-purple-50 border-purple-200 text-purple-700' },
};

const initialForm = {
  name: '', email: '', phone: '', city: '',
  education_level: '', field_of_interest: '', marks: '',
  english_proficiency: '', english_score: 0,
  work_experience_years: 0,
  preferred_countries: [],
  budget_range: '', budget_value: 0,
  target_intake: '', pr_preference: false,
  additional_info: '',
};

/* ── StepIndicator ──────────────────────────────────────────────────── */
function StepIndicator({ current }) {
  const pct = Math.round(((current) / STEPS.length) * 100);
  return (
    <div className="w-full mb-8">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-primary-600">{pct}% completed</span>
        <span className="text-xs text-gray-400">Step {current + 1} of {STEPS.length}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-5 overflow-hidden">
        <div
          className="h-2.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-700 progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-100 -z-0" />
        {STEPS.map((s, i) => {
          const done    = i < current;
          const active  = i === current;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1.5 z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
                ${done   ? 'bg-primary-600 border-primary-600 text-white scale-90'  : ''}
                ${active ? 'bg-white border-primary-600 text-primary-600 shadow-md scale-110' : ''}
                ${!done && !active ? 'bg-white border-gray-200 text-gray-400' : ''}
              `}>
                {done ? '✓' : s.icon}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-primary-600' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                {s.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── OptionCard ─────────────────────────────────────────────────────── */
function OptionCard({ icon, label, tag, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`option-card w-full text-left flex items-center gap-3 ${selected ? 'selected' : ''}`}
    >
      {icon && <span className="text-2xl flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm leading-tight ${selected ? 'text-primary-700' : 'text-gray-800'}`}>{label}</p>
        {tag && <p className="text-xs text-gray-400 mt-0.5">{tag}</p>}
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
        ${selected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
        {selected && (
          <svg className="w-3 h-3 text-white animate-check" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" strokeDasharray="50" strokeDashoffset="0" />
          </svg>
        )}
      </div>
    </button>
  );
}

/* ── CountryPicker ──────────────────────────────────────────────────── */
function CountryPicker({ selected, onChange }) {
  const [search, setSearch] = useState('');
  const filtered = TOP_COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  const toggle = (c) => {
    if (selected.includes(c)) onChange(selected.filter(x => x !== c));
    else if (selected.length < 5) onChange([...selected, c]);
  };
  const FLAGS = { Canada:'🇨🇦', Australia:'🇦🇺', 'United Kingdom':'🇬🇧', USA:'🇺🇸', Germany:'🇩🇪',
    Ireland:'🇮🇪', Netherlands:'🇳🇱', Sweden:'🇸🇪', Norway:'🇳🇴', Japan:'🇯🇵',
    'South Korea':'🇰🇷', Singapore:'🇸🇬', France:'🇫🇷', Italy:'🇮🇹', Malaysia:'🇲🇾' };
  return (
    <div>
      <input
        className="input-field text-sm mb-3"
        placeholder="🔍 Search countries…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filtered.map(c => {
          const sel = selected.includes(c);
          return (
            <button
              key={c} type="button" onClick={() => toggle(c)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-200
                ${sel ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50 text-gray-700'}`}
            >
              <span className="text-lg">{FLAGS[c] || '🌍'}</span>
              <span className="truncate">{c}</span>
              {sel && <span className="ml-auto text-primary-500 text-xs">✓</span>}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-primary-600 font-medium mt-2">{selected.length} selected (max 5)</p>
      )}
    </div>
  );
}

/* ── LoadingScreen ──────────────────────────────────────────────────── */
function LoadingScreen() {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % LOADING_STEPS.length), 1200);
    const d = setInterval(() => setDots(p => p.length >= 3 ? '' : p + '.'), 400);
    return () => { clearInterval(t); clearInterval(d); };
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
      <div className="text-center text-white max-w-sm w-full">
        <div className="text-6xl mb-6 animate-bounce-in">{LOADING_STEPS[step].icon}</div>
        <h2 className="text-2xl font-extrabold mb-2">Analyzing Your Profile</h2>
        <p className="text-blue-200 text-base mb-8 min-h-[1.5rem]">{LOADING_STEPS[step].text}{dots}</p>
        {/* Animated progress */}
        <div className="w-full bg-white/20 rounded-full h-2 mb-6 overflow-hidden">
          <div className="h-2 bg-white rounded-full animate-pulse" style={{ width: `${((step + 1) / LOADING_STEPS.length) * 100}%`, transition: 'width 1.2s ease' }} />
        </div>
        <div className="flex justify-center gap-2">
          {LOADING_STEPS.map((s, i) => (
            <div key={i} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all duration-500
              ${i <= step ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'}`}>
              <span>{s.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── MicroReward toast ──────────────────────────────────────────────── */
function MicroReward({ step, onDone }) {
  const r = MICRO_REWARDS[step];
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!r) return null;
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 border rounded-2xl px-5 py-3 shadow-lg animate-bounce-in flex items-center gap-3 ${r.color}`}>
      <span className="text-lg">🎉</span>
      <span className="text-sm font-semibold">{r.msg}</span>
    </div>
  );
}

/* ── Step panels ────────────────────────────────────────────────────── */
function StepPersonal({ form, set }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">👤</div>
        <h2 className="text-2xl font-extrabold text-gray-900">Tell us about yourself</h2>
        <p className="text-gray-500 text-sm mt-1">Basic info to personalise your recommendations</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input className="input-field" placeholder="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} />
        <input className="input-field" placeholder="City / Country" value={form.city} onChange={e => set('city', e.target.value)} />
        <input className="input-field" type="email" placeholder="Email Address *" value={form.email} onChange={e => set('email', e.target.value)} />
        <input className="input-field" placeholder="Phone / WhatsApp *" value={form.phone} onChange={e => set('phone', e.target.value)} />
      </div>
    </div>
  );
}

function StepEducation({ form, set }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🎓</div>
        <h2 className="text-2xl font-extrabold text-gray-900">Academic Background</h2>
        <p className="text-gray-500 text-sm mt-1">Your education level and scores</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Highest Education Level</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EDUCATION_OPTIONS.map(o => (
            <OptionCard key={o.label} icon={o.icon} label={o.label}
              selected={form.education_level === o.label}
              onClick={() => set('education_level', o.label)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">GPA / Percentage / CGPA</label>
          <input className="input-field" placeholder="e.g. 75% or 3.5 GPA" value={form.marks} onChange={e => set('marks', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Field of Interest</label>
          <input className="input-field" placeholder="e.g. Computer Science, MBA" value={form.field_of_interest} onChange={e => set('field_of_interest', e.target.value)} />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">English Proficiency</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ENGLISH_OPTIONS.map(o => (
            <OptionCard key={o.label} label={o.label}
              selected={form.english_proficiency === o.label}
              onClick={() => { set('english_proficiency', o.label); set('english_score', o.score); }} />
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-1">Work Experience (years)</label>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={10} value={form.work_experience_years}
            onChange={e => set('work_experience_years', Number(e.target.value))}
            className="flex-1 accent-primary-600" />
          <span className="text-primary-700 font-bold w-16 text-center bg-primary-50 rounded-lg py-1">
            {form.work_experience_years} yr{form.work_experience_years !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepPreferences({ form, set }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🌍</div>
        <h2 className="text-2xl font-extrabold text-gray-900">Your Preferences</h2>
        <p className="text-gray-500 text-sm mt-1">Budget and destination choices</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Annual Budget (tuition + living)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUDGET_OPTIONS.map(o => (
            <OptionCard key={o.label} icon={o.icon} label={o.label} tag={o.tag}
              selected={form.budget_range === o.label}
              onClick={() => { set('budget_range', o.label); set('budget_value', o.value); }} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Preferred Countries <span className="text-gray-400 font-normal">(pick up to 5)</span></p>
        <CountryPicker selected={form.preferred_countries} onChange={v => set('preferred_countries', v)} />
      </div>
    </div>
  );
}

function StepGoals({ form, set }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🎯</div>
        <h2 className="text-2xl font-extrabold text-gray-900">Your Goals</h2>
        <p className="text-gray-500 text-sm mt-1">Timeline and long-term plans</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">When do you plan to start?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INTAKE_OPTIONS.map(o => (
            <OptionCard key={o.label} icon={o.icon} label={o.label} tag={o.tag}
              selected={form.target_intake === o.label}
              onClick={() => set('target_intake', o.label)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 border border-gray-200 cursor-pointer"
        onClick={() => set('pr_preference', !form.pr_preference)}>
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all
          ${form.pr_preference ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
          {form.pr_preference && <span className="text-white text-xs font-bold">✓</span>}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">I'm interested in Permanent Residency (PR)</p>
          <p className="text-xs text-gray-400">We'll prioritise countries with strong PR pathways</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-1">Anything else? <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea className="input-field resize-none" rows={3}
          placeholder="e.g. I want to work part-time, I have a gap year, specific course in mind…"
          value={form.additional_info} onChange={e => set('additional_info', e.target.value)} />
      </div>
    </div>
  );
}

/* ── Main Questionnaire export ──────────────────────────────────────── */
export default function Questionnaire() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [reward, setReward]   = useState(null);
  const topRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  /* Validate current step before advancing */
  const validate = () => {
    if (step === 0) {
      if (!form.name.trim())  return 'Please enter your name.';
      if (!form.email.trim()) return 'Please enter your email.';
      if (!form.phone.trim()) return 'Please enter your phone number.';
    }
    if (step === 1) {
      if (!form.education_level) return 'Please select your education level.';
    }
    if (step === 2) {
      if (!form.budget_range) return 'Please select a budget range.';
    }
    if (step === 3) {
      if (!form.target_intake) return 'Please select when you plan to start.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    if (step < STEPS.length - 1) {
      setReward(step + 1);   // show micro-reward for completed step
      setStep(s => s + 1);
      scrollTop();
    }
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
    scrollTop();
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);

    const payload = {
      name:                  form.name,
      email:                 form.email,
      phone:                 form.phone,
      city:                  form.city,
      qualification:         form.education_level,
      marks:                 parseFloat(form.marks) || null,
      course_interest:       form.field_of_interest,
      english_proficiency:   form.english_proficiency,
      english_score:         form.english_score,
      work_experience_years: form.work_experience_years,
      preferred_countries:   form.preferred_countries,
      budget:                form.budget_value,
      target_intake:         form.target_intake,
      pr_preference:         form.pr_preference,
      additional_info:       form.additional_info,
    };

    try {
      const res = await profileRecommend(payload);
      navigate('/results', {
        state: {
          recommendation: res.data.recommendation || res.data,
          input_profile:  payload,
          questionnaire_id: res.data.questionnaire_id || '',
        },
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const stepComponents = [
    <StepPersonal    key="p" form={form} set={set} />,
    <StepEducation   key="e" form={form} set={set} />,
    <StepPreferences key="pr" form={form} set={set} />,
    <StepGoals       key="g" form={form} set={set} />,
  ];

  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-10 px-4">
      <div ref={topRef} />

      {/* Micro-reward toast */}
      {reward && <MicroReward step={reward} onDone={() => setReward(null)} />}

      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-xs font-semibold mb-3">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            Free AI Assessment
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">Check Your Visa Success Chances</h1>
          <p className="text-gray-500 text-sm mt-2">Takes about 2 minutes · 100% free · Instant results</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <StepIndicator current={step} />

          {/* Step content */}
          {stepComponents[step]}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 gap-4">
            {step > 0 ? (
              <button type="button" onClick={handleBack}
                className="btn-outline flex items-center gap-2 text-sm">
                ← Back
              </button>
            ) : <div />}

            {isLast ? (
              <button type="button" onClick={handleSubmit}
                className="btn-accent flex items-center gap-2 text-sm glow-green">
                🚀 Get My Results
              </button>
            ) : (
              <button type="button" onClick={handleNext}
                className="btn-primary flex items-center gap-2 text-sm">
                Continue → 
              </button>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-xs text-gray-400">
          <span className="flex items-center gap-1">🔒 100% Secure</span>
          <span className="flex items-center gap-1">⚡ Instant Results</span>
          <span className="flex items-center gap-1">🎓 500+ Students Guided</span>
          <span className="flex items-center gap-1">🌍 20+ Countries</span>
        </div>
      </div>
    </div>
  );
}
