import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { submitContact } from '../api';

/* ─── Scroll-reveal hook ─── */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </div>
  );
}

/* ─── WA SVG ─── */
const WA = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ─── Data ─── */
const COUNTRIES = [
  { name: 'Canada',         flag: '🇨🇦', tag: 'PR Pathways',    color: 'from-red-50 to-red-100',     border: 'border-red-200',    desc: 'World-class universities with post-study work permits and clear Express Entry PR routes.' },
  { name: 'Australia',      flag: '🇦🇺', tag: '2–4 yr Work Visa', color: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', desc: 'Top QS-ranked universities, vibrant lifestyle, and strong graduate job market.' },
  { name: 'United Kingdom', flag: '🇬🇧', tag: '1-Year Masters',  color: 'from-blue-50 to-blue-100',   border: 'border-blue-200',   desc: 'Prestigious institutions, shorter programs, and globally recognised degrees.' },
  { name: 'USA',            flag: '🇺🇸', tag: 'Research Hub',   color: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', desc: 'Home to the world\'s top research universities and Silicon Valley innovation.' },
  { name: 'Germany',        flag: '🇩🇪', tag: 'Free Tuition',   color: 'from-gray-50 to-gray-100',   border: 'border-gray-200',   desc: 'Public universities with zero or minimal tuition fees for international students.' },
  { name: 'Ireland',        flag: '🇮🇪', tag: 'Tech Hub',       color: 'from-green-50 to-green-100', border: 'border-green-200',  desc: 'English-speaking EU country — home to Google, Meta, Apple, and LinkedIn HQs.' },
];

const SERVICES = [
  { icon: '🤖', title: 'AI-Based Country Recommendation', desc: 'Our AI engine analyses your marks, budget, IELTS score, and goals to recommend the best-fit countries and universities.' },
  { icon: '🛂', title: 'Visa Success Prediction',         desc: 'Get a realistic visa success probability based on your profile before you even apply — no surprises.' },
  { icon: '🎓', title: 'University Application Support',  desc: 'End-to-end help with shortlisting, SOPs, LORs, essays, and submission to maximise your acceptance chances.' },
  { icon: '📄', title: 'Documentation & Visa Processing', desc: 'We prepare and verify every document — financial proof, transcripts, visa forms — so nothing gets rejected.' },
  { icon: '✈️', title: 'Pre-Departure Briefing',          desc: 'Accommodation, travel, banking, SIM cards, and cultural orientation so you land confident and prepared.' },
  { icon: '🏠', title: 'Post-Arrival Support',            desc: 'We stay with you after landing — helping with university enrollment, local setup, and settling in.' },
];

const TESTIMONIALS = [
  { name: 'Priya Sharma',  dest: 'MS CS — University of Toronto, Canada',       text: 'AIEC made my dream of studying in Canada a reality. The AI assessment was spot-on and the counselors guided me through every step.', avatar: 'PS', color: 'bg-blue-500' },
  { name: 'Rahul Mehta',   dest: 'MBA — Melbourne Business School, Australia',   text: 'From shortlisting universities to visa approval, the team was incredibly supportive. Got a 40% scholarship too!', avatar: 'RM', color: 'bg-green-500' },
  { name: 'Ananya Patel',  dest: 'MSc Finance — University of Manchester, UK',  text: 'The AI tool recommended Manchester before I even knew about it. Best decision of my life. Highly recommend AIEC!', avatar: 'AP', color: 'bg-purple-500' },
  { name: 'Karan Singh',   dest: 'MEng — TU Munich, Germany',                   text: 'Free tuition in Germany seemed too good to be true. AIEC helped me navigate the entire process seamlessly.', avatar: 'KS', color: 'bg-orange-500' },
];

const STATS = [
  { value: '500+', label: 'Students Guided',      icon: '🎓' },
  { value: '98%',  label: 'Visa Success Rate',    icon: '✅' },
  { value: '50+',  label: 'Partner Universities', icon: '🏛️' },
  { value: '15+',  label: 'Countries Covered',    icon: '🌍' },
];

const PROCESS = [
  { step: '01', icon: '💬', title: 'Free Consultation',    desc: 'Tell us your goals, marks, and budget. We listen first.' },
  { step: '02', icon: '🤖', title: 'AI Profile Analysis',  desc: 'Our AI matches you with the best countries and universities.' },
  { step: '03', icon: '📝', title: 'Application & Docs',   desc: 'We handle SOPs, LORs, forms, and document verification.' },
  { step: '04', icon: '🛂', title: 'Visa Processing',      desc: 'Expert visa guidance with mock interviews and checklists.' },
  { step: '05', icon: '✈️', title: 'Pre-Departure',        desc: 'Accommodation, travel, banking — fully prepared to fly.' },
  { step: '06', icon: '🏠', title: 'Post-Arrival Care',    desc: 'We support you even after you land at your destination.' },
];

/* ─── Main Component ─── */
export default function Home() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const wa = import.meta.env.VITE_WHATSAPP || '919802020575';

  const handleContact = async (e) => {
    e.preventDefault();
    setContactLoading(true);
    try {
      await submitContact(contactForm);
      setContactSent(true);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="overflow-x-hidden">

      {/* ══ 1. HERO ══ */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-[#0a0f1e] via-[#0f2460] to-[#1d4ed8] overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-500/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              AI-Powered Study Abroad Guidance · Birgunj, Nepal
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-6">
              Check Your Visa<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-yellow-300">
                Success Chances
              </span><br />
              in 30 Seconds
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-lg leading-relaxed">
              Get personalised country and university recommendations based on your profile — free, instant, and AI-powered.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply"
                className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-accent-500/40 hover:-translate-y-0.5 text-base">
                🚀 Start Free Assessment
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I checked my visa chance and need guidance.')}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base shadow-lg">
                <WA /> Talk to Expert on WhatsApp
              </a>
            </div>
            <div className="flex flex-wrap gap-8 mt-12">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-extrabold text-white">{s.value}</p>
                  <p className="text-xs text-blue-300 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — visa teaser card */}
          <div className="hidden lg:block">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center text-xl">🎯</div>
                <div>
                  <p className="font-bold text-sm">Your Visa Estimate is Ready</p>
                  <p className="text-xs text-blue-300">Based on 500+ student profiles</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { label: 'Canada', pct: 84, color: 'bg-green-400' },
                  { label: 'Australia', pct: 76, color: 'bg-yellow-400' },
                  { label: 'UK', pct: 89, color: 'bg-blue-400' },
                  { label: 'Germany', pct: 91, color: 'bg-purple-400' },
                ].map((c) => (
                  <div key={c.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{c.label}</span>
                      <span className="font-bold">{c.pct}% success rate</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className={`${c.color} h-2 rounded-full`} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-300 text-center mb-4">Complete your profile to get your personalised estimate</p>
              <Link to="/apply" className="w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold py-3 rounded-xl transition-all text-sm">
                Get My Free Report →
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 text-xs animate-bounce">
          <span>Scroll</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </section>

      {/* ══ 2. INTRO / ABOUT ══ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Who We Are</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
              Your Trusted Partner<br />for Studying Abroad
            </h2>
            <p className="text-gray-600 leading-relaxed mb-5">
              Aradhya International Education Consultancy Pvt. Ltd. is a leading study abroad consultancy based in Birgunj, Nepal. We help students achieve their dream of studying in top universities worldwide — with complete guidance from the first consultation all the way to post-arrival support.
            </p>
            <p className="text-gray-600 leading-relaxed mb-8">
              Our AI-powered platform analyses your academic profile, budget, and career goals to recommend the best countries, universities, and courses — giving you a realistic picture before you even apply.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { icon: '🎯', text: 'Personalised AI Recommendations' },
                { icon: '🛂', text: 'Visa Success Prediction' },
                { icon: '📋', text: 'Complete Documentation Support' },
                { icon: '🤝', text: 'End-to-End Guidance' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 bg-primary-50 rounded-xl px-4 py-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{item.text}</span>
                </div>
              ))}
            </div>
            <Link to="/apply" className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-7 py-3.5 rounded-xl transition-all shadow-md hover:-translate-y-0.5">
              Start Free Assessment →
            </Link>
          </Reveal>

          <Reveal delay={150}>
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((s, i) => (
                <div key={s.label} className={`rounded-2xl p-6 text-center ${i % 2 === 0 ? 'bg-primary-600 text-white' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <p className={`text-3xl font-extrabold mb-1 ${i % 2 === 0 ? 'text-white' : 'text-primary-600'}`}>{s.value}</p>
                  <p className={`text-sm font-medium ${i % 2 === 0 ? 'text-blue-200' : 'text-gray-600'}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 3. HOW IT WORKS ══ */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Our Process</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">From Dream to Destination</h2>
            <p className="text-gray-500 max-w-xl mx-auto">We guide you through every step — no confusion, no surprises.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROCESS.map((p, i) => (
              <Reveal key={p.step} delay={i * 80}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-extrabold text-primary-400 bg-primary-50 px-2.5 py-1 rounded-full">STEP {p.step}</span>
                  </div>
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-2">{p.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. COUNTRIES ══ */}
      <section id="countries" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Study Destinations</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Where Will You Study?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">We help students secure admissions in top universities across 15+ countries.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {COUNTRIES.map((c, i) => (
              <Reveal key={c.name} delay={i * 80}>
                <div className={`bg-gradient-to-br ${c.color} border ${c.border} rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 cursor-pointer group`}>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl">{c.flag}</span>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{c.name}</h3>
                      <span className="text-xs font-semibold text-primary-600 bg-white/70 px-2 py-0.5 rounded-full">{c.tag}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{c.desc}</p>
                  <div className="mt-4 flex items-center gap-1 text-primary-600 text-sm font-semibold group-hover:gap-2 transition-all">
                    Learn more <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. SERVICES ══ */}
      <section id="services" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">What We Offer</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Our Services</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Comprehensive support from the first consultation to landing at your destination.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="group bg-white border border-gray-100 rounded-2xl p-6 hover:border-primary-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 bg-primary-50 group-hover:bg-primary-100 rounded-xl flex items-center justify-center text-2xl mb-4 transition-colors">{s.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. AI ASSESSMENT CTA ══ */}
      <section id="assessment" className="py-20 px-4 bg-gradient-to-br from-[#0a0f1e] via-[#0f2460] to-[#1d4ed8] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <span className="text-xs font-bold uppercase tracking-widest text-accent-400 mb-3 block">AI-Powered Tool</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              Your Estimated Visa<br />Chance is Ready
            </h2>
            <p className="text-lg text-blue-200 max-w-2xl mx-auto mb-10">
              Answer 4 quick steps and our AI will show your visa success probability, best-matched countries, and suggested universities — personalised to your profile.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[
                { step: '01', icon: '👤', label: 'Your Profile' },
                { step: '02', icon: '🎓', label: 'Education' },
                { step: '03', icon: '🌍', label: 'Preferences' },
                { step: '04', icon: '🤖', label: 'AI Results' },
              ].map((s) => (
                <div key={s.step} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 text-center text-white">
                  <p className="text-xs font-bold text-accent-400 mb-2">STEP {s.step}</p>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <p className="text-sm font-semibold">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/apply"
                className="inline-flex items-center justify-center gap-3 bg-accent-500 hover:bg-accent-600 text-white font-bold px-10 py-5 rounded-2xl text-lg transition-all shadow-2xl hover:shadow-accent-500/40 hover:-translate-y-1">
                🤖 Get My Free Report
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I checked my visa chance and need guidance.')}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-5 rounded-2xl text-base transition-all shadow-lg">
                <WA /> Talk to Expert Now
              </a>
            </div>
            <p className="text-blue-300 text-sm mt-5">Takes less than 3 minutes · 100% free · No sign-up required</p>
          </Reveal>
        </div>
      </section>

      {/* ══ 7. TRUST / SOCIAL PROOF ══ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Why Students Trust Us</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Proven Results, Real Students</h2>
            <p className="text-gray-500 max-w-xl mx-auto">500+ student profiles analysed. Students guided to Canada, Australia, UK, Germany, and more.</p>
          </Reveal>

          {/* Trust badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
            {[
              { icon: '🇨🇦', label: 'Canada',    sub: '150+ students placed' },
              { icon: '🇦🇺', label: 'Australia', sub: '120+ students placed' },
              { icon: '🇬🇧', label: 'UK',        sub: '100+ students placed' },
              { icon: '🇩🇪', label: 'Germany',   sub: '80+ students placed' },
            ].map((b) => (
              <Reveal key={b.label}>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center hover:border-primary-200 hover:shadow-md transition-all">
                  <div className="text-4xl mb-2">{b.icon}</div>
                  <p className="font-bold text-gray-900">{b.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{b.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-shadow">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-6 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm`}>{t.avatar}</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-primary-600">{t.dest}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. CONTACT ══ */}
      <section id="contact" className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <Reveal>
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Get In Touch</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Ready to Start<br />Your Journey?</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Fill out the form and our expert counselors will reach out within 24 hours. Or chat with us directly on WhatsApp for instant support.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { icon: '🏢', label: 'Company',  value: 'Aradhya International Education Consultancy Pvt. Ltd.' },
                { icon: '📍', label: 'Address',  value: 'Ranighat-24, Birgunj, Nepal' },
                { icon: '📧', label: 'Email',    value: 'aaradhyainternationaleducation@gmail.com' },
                { icon: '📞', label: 'Phone',    value: '+977 9802020575 / 9766350770' },
                { icon: '💬', label: 'WhatsApp', value: 'Available 9am – 8pm daily' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                    <p className="text-gray-800 font-medium text-sm">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <a href="tel:+9779802020575"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-3 rounded-xl transition-all">
                📞 Call Us
              </a>
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want to book a free consultation.')}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-xl transition-all">
                <WA /> WhatsApp Us
              </a>
              <a href="https://www.instagram.com/aaradhya_international5"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-semibold px-5 py-3 rounded-xl transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                Instagram
              </a>
            </div>
          </Reveal>

          <Reveal delay={150}>
            {contactSent ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Message Received!</h3>
                <p className="text-gray-600 mb-6">Our counselor will contact you within 24 hours.</p>
                <Link to="/apply" className="btn-primary inline-block">Take Full AI Assessment</Link>
              </div>
            ) : (
              <form onSubmit={handleContact} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 text-lg mb-2">Send Us a Message</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input className="input-field" placeholder="Your Name *" value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required />
                  <input className="input-field" placeholder="Phone / WhatsApp *" value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} required />
                </div>
                <input className="input-field" type="email" placeholder="Email Address" value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                <textarea className="input-field resize-none" rows={4}
                  placeholder="Tell us about your study abroad goals..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} />
                <button type="submit" disabled={contactLoading} className="btn-primary w-full text-base flex items-center justify-center gap-2">
                  {contactLoading
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
                    : 'Send Message →'}
                </button>
                <p className="text-xs text-gray-400 text-center">We respond within 24 hours · No spam, ever.</p>
              </form>
            )}
          </Reveal>
        </div>
      </section>

    </div>
  );
}
