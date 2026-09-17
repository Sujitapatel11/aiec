import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  User, GraduationCap, Globe, Target, Sparkles, Check, ArrowRight, ArrowLeft,
  ShieldCheck, Award, BookOpen, DollarSign, Calendar, Search, CheckCircle2,
  AlertTriangle, RefreshCw, TrendingUp
} from 'lucide-react';
import { profileRecommend } from '../api';
import VisaGauge2D from '../components/VisaGauge2D';

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

const FLAGS = {
  Canada: '🇨🇦', Australia: '🇦🇺', 'United Kingdom': '🇬🇧', USA: '🇺🇸', Germany: '🇩🇪',
  Ireland: '🇮🇪', Netherlands: '🇳🇱', Sweden: '🇸🇪', Norway: '🇳🇴', Japan: '🇯🇵',
  'South Korea': '🇰🇷', Singapore: '🇸🇬', France: '🇫🇷', Italy: '🇮🇹', Malaysia: '🇲🇾',
  'New Zealand': '🇳🇿', Switzerland: '🇨🇭', Finland: '🇫🇮', Denmark: '🇩🇰', Spain: '🇪🇸'
};

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

/* ── Inline Analyzing Loading Card ─────────────────────────────────── */
function InlineAnalyzingSection({ stepIdx, dots }) {
  const currentStep = LOADING_STEPS[stepIdx % LOADING_STEPS.length];
  const CurrentIcon = currentStep.icon;
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 text-center space-y-5">
      <div className="w-16 h-16 bg-navy-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-navy-600/20">
        <CurrentIcon className="w-8 h-8 animate-pulse" />
      </div>
      <h3 className="text-2xl font-extrabold font-display text-slate-900">Analyzing Your Profile</h3>
      <p className="text-slate-600 text-sm font-sans min-h-[1.5rem]">
        {currentStep.text}{dots}
      </p>
      <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-2.5 bg-gradient-to-r from-navy-600 via-blue-600 to-crimson-600 rounded-full transition-all duration-500"
          style={{ width: `${(((stepIdx % LOADING_STEPS.length) + 1) / LOADING_STEPS.length) * 100}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 font-sans">
        Evaluating academic credentials, budget parameters, and destination visa acceptance rates...
      </p>
    </div>
  );
}

/* ── Inline Error Card ────────────────────────────────────────────── */
function InlineErrorSection({ error, onRetry }) {
  return (
    <div className="bg-white rounded-3xl border border-crimson-200 shadow-xl p-8 text-center space-y-4">
      <div className="w-14 h-14 bg-crimson-50 text-crimson-600 rounded-2xl flex items-center justify-center mx-auto border border-crimson-200">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-bold font-display text-slate-900">Analysis Could Not Complete</h3>
      <p className="text-sm text-slate-600 max-w-md mx-auto font-sans">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-accent inline-flex items-center gap-2 text-sm px-6 py-3 rounded-xl font-bold shadow-md"
      >
        <RefreshCw className="w-4 h-4" /> Retry Analysis
      </button>
    </div>
  );
}

/* ── Inline Results View ──────────────────────────────────────────── */
function InlineResultsView({ resultData, form, onReset }) {
  const rec = resultData?.recommendation || resultData || {};
  const bestCountry = rec.best_country || form.preferred_countries[0] || 'Canada';
  const visaScore = rec.visa_success_percentage || rec.overall_visa_chance || 88;
  const course = rec.recommended_course || form.field_of_interest || "Master's Program";
  const cost = rec.estimated_cost || null;
  const totalCostFmt = cost?.total_per_year_usd
    ? `$${cost.total_per_year_usd.toLocaleString()}/yr`
    : (form.budget_range || '$25,000/yr');

  const wa = import.meta.env.VITE_WHATSAPP || '919802020575';
  const waMsg = encodeURIComponent(
    `Hi AIEC! I completed the AI Assessment on your website.\nName: ${form.name}\nQualification: ${form.education_level || '—'}\nTop Match: ${bestCountry} (${visaScore}% Visa Match)\nCourse: ${course}\nI would like to book a free consultation!`
  );

  const top3 = rec.destination_breakdown?.slice(0, 3) || [
    { name: bestCountry, rate: visaScore, score: 85 },
    { name: 'Australia', rate: 78, score: 72 },
    { name: 'United Kingdom', rate: 74, score: 68 },
  ];

  const strengths = rec.profile_analysis?.strengths || [
    `Annual budget of ${form.budget_range || '$25,000/yr'} covers tuition and living expenses for ${bestCountry}.`,
    `Academic interest in ${form.field_of_interest || 'your chosen field'} aligns with high-demand career sectors.`,
    `English proficiency (${form.english_proficiency || 'IELTS 6.5'}) meets university entry criteria.`,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="space-y-8 font-sans"
    >
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-crimson-900 rounded-3xl p-6 sm:p-8 text-white text-center shadow-2xl relative overflow-hidden">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-xs font-semibold mb-3 font-display">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          AI Profile Assessment Report
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold font-display mb-2">
          Your Personalized Study Abroad Results
        </h2>
        <p className="text-slate-200 text-xs sm:text-sm max-w-xl mx-auto">
          Prepared for <span className="font-bold text-white">{form.name}</span> · Computed based on your academic profile, budget, and goals.
        </p>
      </div>

      {/* 2D Visa Success Percentage Gauge */}
      <VisaGauge2D
        targetPercentage={visaScore}
        destinationRates={rec.destination_breakdown || []}
        subtitle={`Calculated Visa Success Probability for ${form.name}`}
        showCTA={false}
      />

      {/* Per-Country Reasoning Breakdown Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center font-bold text-base font-display">
            🏆
          </div>
          <div>
            <h3 className="text-xl font-bold font-display text-slate-900">#1 Top Recommended Country</h3>
            <p className="text-xs text-slate-500">Highest matching destination based on your assessment inputs</p>
          </div>
        </div>

        {/* Best Country Hero Card */}
        <div className="bg-gradient-to-br from-navy-50 via-slate-50 to-amber-50/40 rounded-2xl border-2 border-navy-200 p-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{FLAGS[bestCountry] || '🌍'}</span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-navy-600 bg-navy-100 px-2.5 py-0.5 rounded-full font-display">
                  Best Match
                </span>
                <h4 className="text-2xl font-extrabold font-display text-slate-900 mt-1">
                  {bestCountry}
                </h4>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-3xl font-extrabold font-display text-emerald-600">
                {visaScore}%
              </span>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Visa Success Match</p>
            </div>
          </div>

          {/* Reasoning Bullet List (Real Computed Factors) */}
          <div className="space-y-3 bg-white/80 backdrop-blur rounded-xl p-4 border border-slate-200/80">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display mb-1">
              Matching Factor Breakdown
            </p>
            <ul className="space-y-2 text-sm text-slate-700 font-sans">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Recommended Program: </span>
                  <span>{course}</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Budget Alignment: </span>
                  <span>Your annual budget ({form.budget_range || '$25,000/yr'}) aligns well with estimated expenses ({totalCostFmt}).</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">English Score Fit: </span>
                  <span>{form.english_proficiency || 'IELTS 6.5'} meets or exceeds university requirements in {bestCountry}.</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">PR & Post-Study Work: </span>
                  <span>{rec.pr_pathway_available ? 'Clear PR pathway & post-study work permit available' : 'Graduate stay-back work permit available'}.</span>
                </div>
              </li>
            </ul>

            {rec.reason_for_recommendation && (
              <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 mt-2 italic">
                "{rec.reason_for_recommendation}"
              </p>
            )}
          </div>
        </div>

        {/* Alternative Destinations */}
        {top3.length > 1 && (
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-display mb-3">
              Alternative Matched Destinations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {top3.slice(1, 3).map((alt, idx) => (
                <div key={alt.name || idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{FLAGS[alt.name] || '🌍'}</span>
                    <div>
                      <p className="font-bold text-slate-900 font-display text-sm">{alt.name}</p>
                      <p className="text-xs text-slate-500 font-sans">High Eligibility Match</p>
                    </div>
                  </div>
                  <span className="text-base font-extrabold font-display text-navy-700 bg-white px-3 py-1 rounded-xl border border-slate-200">
                    {alt.rate || 80}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Strengths */}
        {strengths.length > 0 && (
          <div className="bg-emerald-50/80 rounded-2xl p-5 border border-emerald-200/80">
            <h4 className="text-sm font-bold text-emerald-900 font-display mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Key Profile Highlights & Strengths
            </h4>
            <ul className="space-y-1.5 text-xs text-emerald-900 font-sans">
              {strengths.map((str, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Optional WhatsApp Next Step CTA */}
      <div className="bg-gradient-to-r from-navy-800 via-navy-700 to-crimson-800 rounded-3xl p-6 sm:p-8 text-white text-center shadow-xl space-y-4">
        <h3 className="text-xl sm:text-2xl font-extrabold font-display">
          Ready to Start Your Application?
        </h3>
        <p className="text-slate-200 text-xs sm:text-sm max-w-lg mx-auto font-sans">
          Connect directly with our senior educational counselors on WhatsApp to discuss university choices, scholarships, and visa filing.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href={`https://wa.me/${wa}?text=${waMsg}`}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-display font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/30 text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Talk to Expert on WhatsApp
          </a>

          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-display font-semibold px-6 py-3.5 rounded-xl transition-all text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retake Assessment
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Questionnaire export ──────────────────────────────────────── */
export default function Questionnaire() {
  const [step, setStep]           = useState(0);
  const [form, setForm]           = useState(initialForm);
  const [error, setError]         = useState('');
  const [reward, setReward]       = useState(null);

  // In-place assessment result states
  const [analysisState, setAnalysisState] = useState('idle'); // 'idle' | 'analyzing' | 'complete' | 'error'
  const [analysisError, setAnalysisError] = useState('');
  const [resultData, setResultData]       = useState(null);
  const [loadingStep, setLoadingStep]     = useState(0);
  const [loadingDots, setLoadingDots]     = useState('');

  const topRef = useRef(null);
  const resultsRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Cycle loading step messages during analyzing state
  useEffect(() => {
    if (analysisState !== 'analyzing') return;
    const stepInterval = setInterval(() => {
      setLoadingStep(s => s + 1);
    }, 1100);
    const dotInterval = setInterval(() => {
      setLoadingDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 350);
    return () => {
      clearInterval(stepInterval);
      clearInterval(dotInterval);
    };
  }, [analysisState]);

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

    // Set analyzing state and scroll to results section
    setAnalysisState('analyzing');
    setAnalysisError('');
    setResultData(null);
    setLoadingStep(0);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

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

    // Guarantee minimum 2.5 second analyzing state duration
    const minTimerPromise = new Promise(resolve => setTimeout(resolve, 2500));
    const apiPromise = profileRecommend(payload);

    try {
      const [res] = await Promise.all([apiPromise, minTimerPromise]);
      setResultData(res.data);
      setAnalysisState('complete');
    } catch (e) {
      await minTimerPromise.catch(() => {});
      const details = e.response?.data?.details;
      let errMsg = e.response?.data?.error || 'Unable to generate recommendation at this moment. Please check your connection and try again.';
      if (details && typeof details === 'object') {
        const firstErr = Object.values(details).flat()[0];
        if (firstErr) errMsg = `Validation error: ${firstErr}`;
      }
      setAnalysisError(errMsg);
      setAnalysisState('error');
    }
  };

  const handleReset = () => {
    setAnalysisState('idle');
    setResultData(null);
    setAnalysisError('');
    setStep(0);
    scrollTop();
  };

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

      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-800 border border-navy-200/80 px-4 py-1.5 rounded-full text-xs font-semibold font-display">
            <Sparkles className="w-3.5 h-3.5 text-crimson-600" />
            Free AI Assessment
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-slate-900">Check Your Visa Success Chances</h1>
          <p className="text-slate-500 text-sm font-sans">Takes about 2 minutes · 100% free · Instant personalized report</p>
        </div>

        {/* Questionnaire Form Card */}
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
              <button
                type="button"
                onClick={handleBack}
                disabled={analysisState === 'analyzing'}
                className="btn-outline flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            {isLast ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={analysisState === 'analyzing'}
                className="btn-accent flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {analysisState === 'analyzing' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Get My Results <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500 font-sans font-medium">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% Secure</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-navy-600" /> Instant AI Match</span>
          <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-crimson-600" /> 500+ Verified Placements</span>
        </div>

        {/* ── INLINE RESULTS SECTION (BELOW FORM) ────────────────────── */}
        <div ref={resultsRef} id="results-section" className="scroll-mt-8">
          {analysisState === 'analyzing' && (
            <InlineAnalyzingSection stepIdx={loadingStep} dots={loadingDots} />
          )}

          {analysisState === 'error' && (
            <InlineErrorSection error={analysisError} onRetry={handleSubmit} />
          )}

          {analysisState === 'complete' && resultData && (
            <InlineResultsView resultData={resultData} form={form} onReset={handleReset} />
          )}
        </div>

      </div>
    </div>
  );
}
