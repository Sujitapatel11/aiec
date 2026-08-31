import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, GraduationCap, Globe, Target, Sparkles, Check, ArrowRight, ArrowLeft, ShieldCheck, Award, BookOpen, Award as Medal, DollarSign, Calendar, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { profileRecommend } from '../api';

/* ── Constants ─────────────────────────────────────────────────────── */
const STEPS = [
  { id: 'personal',    title: 'Basic Info',       icon: User, desc: 'Tell us about yourself' },
  { id: 'education',   title: 'Academic Details', icon: GraduationCap, desc: 'Your education background' },
  { id: 'preferences', title: 'Preferences',      icon: Globe, desc: 'Budget & destination' },
  { id: 'goals',       title: 'Goals',            icon: Target, desc: 'Timeline & ambitions' },
];

const BUDGET_OPTIONS = [
  { label: 'Under $10,000/yr',   value: 8000,  tag: 'Budget-friendly' },
  { label: '$10,000–$20,000/yr', value: 15000, tag: 'Moderate' },
  { label: '$20,000–$35,000/yr', value: 27000, tag: 'Standard' },
  { label: '$35,000–$50,000/yr', value: 42000, tag: 'Premium' },
  { label: 'Above $50,000/yr',   value: 60000, tag: 'Top-tier' },
];

const INTAKE_OPTIONS = [
  { label: 'Within 6 months', months: 6,  tag: 'Urgent' },
  { label: 'Within 1 year',   months: 12, tag: 'Planning' },
  { label: 'After 1 year',    months: 18, tag: 'Flexible' },
  { label: 'Just exploring',  months: 24, tag: 'Research' },
];

const EDUCATION_OPTIONS = [
  { label: 'High School / 12th Grade' },
  { label: 'Diploma' },
  { label: "Bachelor's Degree" },
  { label: "Master's Degree" },
  { label: 'PhD' },
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
  { text: 'Analyzing your academic profile…',     icon: GraduationCap },
  { text: 'Matching with top universities…',      icon: Globe },
  { text: 'Calculating visa success chances…',    icon: ShieldCheck },
  { text: 'Preparing your personalized report…',  icon: Sparkles },
];

const MICRO_REWARDS = {
  1: { msg: "Great start! Let's check your academic profile 🎓", color: 'bg-navy-50 border-navy-200 text-navy-800' },
  2: { msg: "Excellent! You're eligible for top countries 🎯",   color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  3: { msg: "Almost there! Just your goals left 🚀",             color: 'bg-crimson-50 border-crimson-200 text-crimson-800' },
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
    <div className="w-full mb-8 font-display">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold text-navy-700">{pct}% completed</span>
        <span className="text-xs text-slate-400 font-medium">Step {current + 1} of {STEPS.length}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6 overflow-hidden">
        <div
          className="h-2.5 rounded-full bg-gradient-to-r from-navy-600 to-crimson-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
        {STEPS.map((s, i) => {
          const done    = i < current;
          const active  = i === current;
          const StepIcon = s.icon;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1.5 z-10">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
                ${done   ? 'bg-navy-600 border-navy-600 text-white scale-95 shadow-sm'  : ''}
                ${active ? 'bg-white border-navy-600 text-navy-600 shadow-md scale-110' : ''}
                ${!done && !active ? 'bg-white border-slate-200 text-slate-400' : ''}
              `}>
                {done ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-navy-700' : done ? 'text-slate-500' : 'text-slate-300'}`}>
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
function OptionCard({ label, tag, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`option-card w-full text-left flex items-center justify-between gap-3 ${selected ? 'selected' : ''}`}
    >
      <div className="flex-1 min-w-0 font-sans">
        <p className={`font-semibold text-sm leading-tight ${selected ? 'text-navy-800 font-display font-bold' : 'text-slate-800'}`}>{label}</p>
        {tag && <p className="text-xs text-slate-400 mt-0.5">{tag}</p>}
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
        ${selected ? 'bg-navy-600 border-navy-600' : 'border-slate-300'}`}>
        {selected && <Check className="w-3 h-3 text-white" />}
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
        placeholder="Search study destinations…"
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
                ${sel ? 'border-navy-600 bg-navy-50 text-navy-800 font-bold' : 'border-slate-200 hover:border-navy-300 hover:bg-slate-50 text-slate-700'}`}
            >
              <span className="text-lg">{FLAGS[c] || '🌍'}</span>
              <span className="truncate">{c}</span>
              {sel && <Check className="ml-auto text-navy-600 w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-navy-600 font-semibold mt-2 font-display">{selected.length} selected (max 5)</p>
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
  const CurrentIcon = LOADING_STEPS[step].icon;
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="text-center text-slate-900 max-w-sm w-full font-display space-y-4">
        <div className="w-16 h-16 bg-navy-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-navy-600/20">
          <CurrentIcon className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-2xl font-extrabold">Analyzing Your Profile</h2>
        <p className="text-slate-600 text-sm font-sans min-h-[1.5rem]">{LOADING_STEPS[step].text}{dots}</p>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="h-2 bg-crimson-600 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / LOADING_STEPS.length) * 100}%` }} />
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
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 border rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3 font-display ${r.color}`}>
      <Sparkles className="w-5 h-5 text-amber-500" />
      <span className="text-sm font-bold">{r.msg}</span>
    </div>
  );
}

/* ── Step panels ────────────────────────────────────────────────────── */
function StepPersonal({ form, set }) {
  return (
    <div className="space-y-4 font-sans">
      <div className="text-center mb-6">
        <User className="w-12 h-12 text-navy-600 mx-auto mb-2" />
        <h2 className="text-2xl font-extrabold font-display text-slate-900">Tell us about yourself</h2>
        <p className="text-slate-500 text-sm mt-1">Basic info to personalise your recommendations</p>
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
    <div className="space-y-5 font-sans">
      <div className="text-center mb-6">
        <GraduationCap className="w-12 h-12 text-navy-600 mx-auto mb-2" />
        <h2 className="text-2xl font-extrabold font-display text-slate-900">Academic Background</h2>
        <p className="text-slate-500 text-sm mt-1">Your education level and scores</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2 font-display">Highest Education Level</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EDUCATION_OPTIONS.map(o => (
            <OptionCard key={o.label} label={o.label}
              selected={form.education_level === o.label}
              onClick={() => set('education_level', o.label)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1 font-display">GPA / Percentage / CGPA</label>
          <input className="input-field" placeholder="e.g. 75% or 3.5 GPA" value={form.marks} onChange={e => set('marks', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1 font-display">Field of Interest</label>
          <input className="input-field" placeholder="e.g. Computer Science, MBA" value={form.field_of_interest} onChange={e => set('field_of_interest', e.target.value)} />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2 font-display">English Proficiency</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ENGLISH_OPTIONS.map(o => (
            <OptionCard key={o.label} label={o.label}
              selected={form.english_proficiency === o.label}
              onClick={() => { set('english_proficiency', o.label); set('english_score', o.score); }} />
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 block mb-1 font-display">Work Experience (years)</label>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={10} value={form.work_experience_years}
            onChange={e => set('work_experience_years', Number(e.target.value))}
            className="flex-1 accent-navy-600" />
          <span className="text-navy-800 font-bold w-16 text-center bg-navy-50 rounded-lg py-1 font-display">
            {form.work_experience_years} yr{form.work_experience_years !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepPreferences({ form, set }) {
  return (
    <div className="space-y-5 font-sans">
      <div className="text-center mb-6">
        <Globe className="w-12 h-12 text-navy-600 mx-auto mb-2" />
        <h2 className="text-2xl font-extrabold font-display text-slate-900">Your Preferences</h2>
        <p className="text-slate-500 text-sm mt-1">Budget and destination choices</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2 font-display">Annual Budget (tuition + living)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUDGET_OPTIONS.map(o => (
            <OptionCard key={o.label} label={o.label} tag={o.tag}
              selected={form.budget_range === o.label}
              onClick={() => { set('budget_range', o.label); set('budget_value', o.value); }} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2 font-display">Preferred Countries <span className="text-slate-400 font-normal">(pick up to 5)</span></p>
        <CountryPicker selected={form.preferred_countries} onChange={v => set('preferred_countries', v)} />
      </div>
    </div>
  );
}

function StepGoals({ form, set }) {
  return (
    <div className="space-y-5 font-sans">
      <div className="text-center mb-6">
        <Target className="w-12 h-12 text-navy-600 mx-auto mb-2" />
        <h2 className="text-2xl font-extrabold font-display text-slate-900">Your Goals</h2>
        <p className="text-slate-500 text-sm mt-1">Timeline and long-term plans</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2 font-display">When do you plan to start?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INTAKE_OPTIONS.map(o => (
            <OptionCard key={o.label} label={o.label} tag={o.tag}
              selected={form.target_intake === o.label}
              onClick={() => set('target_intake', o.label)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200 cursor-pointer"
        onClick={() => set('pr_preference', !form.pr_preference)}>
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all
          ${form.pr_preference ? 'bg-navy-600 border-navy-600' : 'border-slate-300'}`}>
          {form.pr_preference && <Check className="text-white w-4 h-4 font-bold" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 font-display">I'm interested in Permanent Residency (PR)</p>
          <p className="text-xs text-slate-400">We'll prioritise countries with clear post-study PR pathways</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 block mb-1 font-display">Anything else? <span className="text-slate-400 font-normal">(optional)</span></label>
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
      const name = form.name.trim();
      const email = form.email.trim();
      const phone = form.phone.trim();
      const city = form.city.trim();

      if (!name) return 'Please enter your full name.';
      if (name.length < 3) return 'Name must be at least 3 characters long.';
      if (!/^[a-zA-Z\s'.]{3,50}$/.test(name)) return 'Name should only contain letters and spaces.';

      if (!email) return 'Please enter your email address.';
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) return 'Please enter a valid email address.';

      if (!phone) return 'Please enter your phone / WhatsApp number.';
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number (7 to 15 digits).';

      if (city && city.length < 2) return 'City name must be at least 2 characters.';
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
      setReward(step + 1);
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
      budget:                form.budget_value || 25000,
      target_intake:         form.target_intake,
      timeline:              12,
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
      const details = e.response?.data?.details;
      let errMsg = e.response?.data?.error || 'Something went wrong. Please try again.';
      if (details && typeof details === 'object') {
        const firstErr = Object.values(details).flat()[0];
        if (firstErr) errMsg = `Validation error: ${firstErr}`;
      }
      setError(errMsg);
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
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 py-12 px-4">
      <div ref={topRef} />

      {reward && <MicroReward step={reward} onDone={() => setReward(null)} />}

      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-800 border border-navy-200/80 px-4 py-1.5 rounded-full text-xs font-semibold font-display">
            <Sparkles className="w-3.5 h-3.5 text-crimson-600" />
            Free AI Assessment
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-slate-900">Check Your Visa Success Chances</h1>
          <p className="text-slate-500 text-sm font-sans">Takes about 2 minutes · 100% free · Instant personalized report</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
          <StepIndicator current={step} />

          {stepComponents[step]}

          {error && (
            <div className="mt-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm rounded-xl px-4 py-3 flex items-center gap-2 font-sans font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-crimson-600" /> {error}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 gap-4">
            {step > 0 ? (
              <button type="button" onClick={handleBack}
                className="btn-outline flex items-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            {isLast ? (
              <button type="button" onClick={handleSubmit}
                className="btn-accent flex items-center gap-2 text-sm">
                Get My Results <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleNext}
                className="btn-primary flex items-center gap-2 text-sm">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-8 text-xs text-slate-500 font-sans font-medium">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% Secure</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-navy-600" /> Instant AI Match</span>
          <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-crimson-600" /> 500+ Verified Placements</span>
        </div>
      </div>
    </div>
  );
}

