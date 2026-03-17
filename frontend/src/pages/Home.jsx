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
      { threshold: 0.12 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Data ─── */
const COUNTRIES = [
  { name: 'Canada', flag: '🇨🇦', tag: 'PR Pathways', color: 'from-red-50 to-red-100', border: 'border-red-200', desc: 'World-class universities with post-study work permits and clear PR routes.' },
  { name: 'Australia', flag: '🇦🇺', tag: '2–4 yr Work Visa', color: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', desc: 'Top QS-ranked universities, vibrant lifestyle, and strong job market.' },
  { name: 'United Kingdom', flag: '🇬🇧', tag: '1-Year Masters', color: 'from-blue-50 to-blue-100', border: 'border-blue-200', desc: 'Prestigious institutions, shorter programs, and global recognition.' },
  { name: 'USA', flag: '🇺🇸', tag: 'Research Hub', color: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', desc: 'Home to the world\'s top research universities and innovation ecosystems.' },
  { name: 'Germany', flag: '🇩🇪', tag: 'Free Tuition', color: 'from-gray-50 to-gray-100', border: 'border-gray-200', desc: 'Public universities with zero or minimal tuition fees for international students.' },
  { name: 'Ireland', flag: '🇮🇪', tag: 'Tech Hub', color: 'from-green-50 to-green-100', border: 'border-green-200', desc: 'Gateway to Europe with Google, Meta, and Apple HQs — ideal for tech careers.' },
];

const SERVICES = [
  { icon: '🎓', title: 'University Selection', desc: 'We shortlist the best universities matching your profile, budget, and career goals.' },
  { icon: '📝', title: 'Application Assistance', desc: 'End-to-end support with SOPs, LORs, essays, and application submissions.' },
  { icon: '🛂', title: 'Visa Guidance', desc: 'Expert visa counseling with document checklists and mock interviews.' },
  { icon: '💰', title: 'Scholarship Support', desc: 'We identify and help you apply for scholarships to reduce your financial burden.' },
  { icon: '✈️', title: 'Pre-Departure Briefing', desc: 'Accommodation, travel, banking, and cultural orientation before you fly.' },
  { icon: '🤖', title: 'AI-Powered Matching', desc: 'Our AI engine recommends the best countries and courses based on your profile.' },
];

const TESTIMONIALS = [
  { name: 'Priya Sharma', dest: 'MS CS — University of Toronto, Canada', text: 'AIEC made my dream of studying in Canada a reality. The AI assessment was spot-on and the counselors guided me through every step.', avatar: 'PS', color: 'bg-blue-500' },
  { name: 'Rahul Mehta', dest: 'MBA — Melbourne Business School, Australia', text: 'From shortlisting universities to visa approval, the team was incredibly supportive. Got a 40% scholarship too!', avatar: 'RM', color: 'bg-green-500' },
  { name: 'Ananya Patel', dest: 'MSc Finance — University of Manchester, UK', text: 'The AI tool recommended Manchester before I even knew about it. Best decision of my life. Highly recommend AIEC!', avatar: 'AP', color: 'bg-purple-500' },
  { name: 'Karan Singh', dest: 'MEng — TU Munich, Germany', text: 'Free tuition in Germany seemed too good to be true. AIEC helped me navigate the entire process seamlessly.', avatar: 'KS', color: 'bg-orange-500' },
];

const STATS = [
  { value: '500+', label: 'Students Placed' },
  { value: '98%', label: 'Visa Success Rate' },
  { value: '50+', label: 'Partner Universities' },
  { value: '6', label: 'Countries Covered' },
];

/* ─── Main Component ─── */
export default function Home() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

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

  const wa = import.meta.env.VITE_WHATSAPP || '919999999999';

  return (
    <div className="overflow-x-hidden">

      {/* ══════════════════════════════════════
          1. HERO
      ══════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#1d4ed8] overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              AI-Powered Study Abroad Guidance
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              Study Abroad<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-yellow-300">
                Made Simple
              </span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-lg leading-relaxed">
              AIEC uses AI to match you with the perfect university and country based on your profile, budget, and career goals. Free consultation, zero hidden fees.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply" className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-accent-500/40 hover:-translate-y-0.5 text-base">
                Get Free AI Assessment
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want to know more about studying abroad.')}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base backdrop-blur-sm"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-green-400"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Chat on WhatsApp
              </a>
            </div>
            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 mt-10">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-extrabold text-white">{s.value}</p>
                  <p className="text-xs text-blue-200">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating card */}
          <div className="hidden lg:block">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-white shadow-2xl">
              <p className="text-sm font-semibold text-blue-200 mb-4 uppercase tracking-wider">Quick Assessment Preview</p>
              <div className="space-y-3">
                {['🎓 What level are you studying?', '🌍 Which country interests you?', '💰 What is your budget range?', '📅 When do you plan to start?'].map((q, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-sm">
                    <span>{q}</span>
                  </div>
                ))}
              </div>
              <Link to="/apply" className="mt-6 w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold py-3 rounded-xl transition-all text-sm">
                Start Full Assessment →
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 text-xs animate-bounce">
          <span>Scroll</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </section>

      {/* ══════════════════════════════════════
          2. COUNTRIES
      ══════════════════════════════════════ */}
      <section id="countries" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Study Destinations</span>
            <h2 className="section-title">Where Will You Study?</h2>
            <p className="section-subtitle">We help students secure admissions in top universities across 6 countries.</p>
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

      {/* ══════════════════════════════════════
          3. SERVICES
      ══════════════════════════════════════ */}
      <section id="services" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">What We Do</span>
            <h2 className="section-title">Our Services</h2>
            <p className="section-subtitle">Comprehensive support from the first consultation to landing at your destination.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="group border border-gray-100 rounded-2xl p-6 hover:border-primary-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 bg-primary-50 group-hover:bg-primary-100 rounded-xl flex items-center justify-center text-2xl mb-4 transition-colors">
                    {s.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          4. AI ASSESSMENT CTA
      ══════════════════════════════════════ */}
      <section id="assessment" className="py-20 px-4 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-accent-400 mb-3 block">AI-Powered Tool</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Find Your Perfect<br />Study Destination</h2>
            <p className="text-lg text-blue-200 max-w-2xl mx-auto">Answer 4 quick steps and our AI will recommend the best countries and courses tailored to your profile.</p>
          </Reveal>

          {/* Steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { step: '01', icon: '👤', label: 'Your Profile' },
              { step: '02', icon: '🎓', label: 'Education' },
              { step: '03', icon: '🌍', label: 'Preferences' },
              { step: '04', icon: '🤖', label: 'AI Results' },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 text-center text-white">
                  <p className="text-xs font-bold text-accent-400 mb-2">STEP {s.step}</p>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <p className="text-sm font-semibold">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="text-center">
            <Link
              to="/apply"
              className="inline-flex items-center gap-3 bg-accent-500 hover:bg-accent-600 text-white font-bold px-10 py-5 rounded-2xl text-lg transition-all shadow-2xl hover:shadow-accent-500/40 hover:-translate-y-1"
            >
              <span>🤖</span>
              Start Free AI Assessment
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <p className="text-blue-300 text-sm mt-4">Takes less than 3 minutes · 100% free · No sign-up required</p>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          5. TESTIMONIALS
      ══════════════════════════════════════ */}
      <section id="testimonials" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Student Stories</span>
            <h2 className="section-title">What Our Students Say</h2>
            <p className="section-subtitle">Real stories from students who achieved their study abroad dreams with AIEC.</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="bg-white rounded-2xl p-7 shadow-sm hover:shadow-lg transition-shadow border border-gray-100">
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-6 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                      {t.avatar}
                    </div>
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

      {/* ══════════════════════════════════════
          6. CONTACT
      ══════════════════════════════════════ */}
      <section id="contact" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          {/* Left info */}
          <Reveal>
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3 block">Get In Touch</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Ready to Start<br />Your Journey?</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Fill out the form and our expert counselors will reach out within 24 hours. Or chat with us directly on WhatsApp for instant support.
            </p>
            <div className="space-y-4 mb-8">
              {[
                { icon: '📧', label: 'Email', value: 'aaradhyainternationaleducation@gmail.com' },
                { icon: '📞', label: 'Phone', value: '+977 9802020575' },
                { icon: '💬', label: 'WhatsApp', value: 'Available 9am – 8pm IST' },
                { icon: '📍', label: 'Location', value: 'India' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-lg">{item.icon}</div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                    <p className="text-gray-800 font-medium text-sm">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want to book a free consultation.')}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat on WhatsApp Now
            </a>
          </Reveal>

          {/* Right form */}
          <Reveal delay={150}>
            {contactSent ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Message Received!</h3>
                <p className="text-gray-600 mb-6">Our counselor will contact you within 24 hours.</p>
                <Link to="/apply" className="btn-primary inline-block">Take Full AI Assessment</Link>
              </div>
            ) : (
              <form onSubmit={handleContact} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 space-y-4">
                <h3 className="font-bold text-gray-900 text-lg mb-2">Send Us a Message</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input className="input-field" placeholder="Your Name *" value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required />
                  <input className="input-field" placeholder="Phone Number *" value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} required />
                </div>
                <input className="input-field" type="email" placeholder="Email Address" value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                <textarea className="input-field resize-none" rows={4}
                  placeholder="Tell us about your study abroad goals..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} />
                <button type="submit" disabled={contactLoading} className="btn-primary w-full text-base">
                  {contactLoading ? 'Sending...' : 'Send Message →'}
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
