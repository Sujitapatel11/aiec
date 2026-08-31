import React, { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  Globe2,
  Bot,
  FileText,
  Plane,
  Home as HomeIcon,
  MessageSquare,
  Phone,
  MapPin,
  Mail,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Users,
  Award,
  TrendingUp,
  Compass,
  Star,
  Check,
  Send
} from 'lucide-react';
import { submitContact } from '../api';
import CountryHoverCard from '../components/CountryHoverCard';
import VisaGauge2D from '../components/VisaGauge2D';
import { COUNTRY_VIDEOS } from '../data/countryVideos';

// Static Icon Mappings for Clean Look
const SERVICES = [
  { icon: Bot, title: 'AI-Based Country Recommendation', desc: 'Our AI engine analyses your marks, budget, IELTS score, and goals to recommend the best-fit countries and universities.' },
  { icon: ShieldCheck, title: 'Visa Success Prediction', desc: 'Get a realistic visa success probability based on your profile before you even apply — no surprises.' },
  { icon: GraduationCap, title: 'University Application Support', desc: 'End-to-end help with shortlisting, SOPs, LORs, essays, and submission to maximise your acceptance chances.' },
  { icon: FileText, title: 'Documentation & Visa Processing', desc: 'We prepare and verify every document — financial proof, transcripts, visa forms — so nothing gets rejected.' },
  { icon: Plane, title: 'Pre-Departure Briefing', desc: 'Accommodation, travel, banking, SIM cards, and cultural orientation so you land confident and prepared.' },
  { icon: HomeIcon, title: 'Post-Arrival Support', desc: 'We stay with you after landing — helping with university enrollment, local setup, and settling in.' },
];

const TESTIMONIALS = [
  { name: 'Priya Sharma', dest: 'MS CS — University of Toronto, Canada', text: 'AIEC made my dream of studying in Canada a reality. The AI assessment was spot-on and the counselors guided me through every step.', avatar: 'PS', color: 'bg-navy-600' },
  { name: 'Rahul Mehta', dest: 'MBA — Melbourne Business School, Australia', text: 'From shortlisting universities to visa approval, the team was incredibly supportive. Got a 40% scholarship too!', avatar: 'RM', color: 'bg-emerald-600' },
  { name: 'Ananya Patel', dest: 'MSc Finance — University of Manchester, UK', text: 'The AI tool recommended Manchester before I even knew about it. Best decision of my life. Highly recommend AIEC!', avatar: 'AP', color: 'bg-crimson-600' },
  { name: 'Karan Singh', dest: 'MEng — TU Munich, Germany', text: 'Free tuition in Germany seemed too good to be true. AIEC helped me navigate the entire process seamlessly.', avatar: 'KS', color: 'bg-amber-600' },
];

const STATS = [
  { value: '500+', label: 'Students Guided', icon: GraduationCap },
  { value: 'Verified', label: 'Guidance Track Record', icon: ShieldCheck },
  { value: '50+', label: 'Partner Universities', icon: Building2 },
  { value: '15+', label: 'Countries Covered', icon: Globe2 },
];

const PROCESS = [
  { step: '01', icon: MessageSquare, title: 'Free Consultation', desc: 'Tell us your goals, marks, and budget. We listen first.' },
  { step: '02', icon: Bot, title: 'AI Profile Analysis', desc: 'Our AI matches you with the best countries and universities.' },
  { step: '03', icon: FileText, title: 'Application & Docs', desc: 'We handle SOPs, LORs, forms, and document verification.' },
  { step: '04', icon: ShieldCheck, title: 'Visa Processing', desc: 'Expert visa guidance with mock interviews and checklists.' },
  { step: '05', icon: Plane, title: 'Pre-Departure', desc: 'Accommodation, travel, banking — fully prepared to fly.' },
  { step: '06', icon: HomeIcon, title: 'Post-Arrival Care', desc: 'We support you even after you land at your destination.' },
];

export default function Home() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [activeCardId, setActiveCardId] = useState(null);
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
    <div className="overflow-x-hidden bg-slate-50/50">

      {/* ══ 1. HERO SECTION (Full-Bleed Cinematic Background Video + Readability Overlay) ══ */}
      <section className="relative min-h-[85vh] lg:min-h-[90vh] flex items-center overflow-hidden bg-navy-950 text-white border-b border-slate-200/20">
        
        {/* ── Background Media Layer (Self-Hosted Video & Poster Fallback) ── */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Static Poster Image Fallback (Instant load on mobile & slow networks) */}
          <img
            src="/hero-poster.jpg"
            alt="Students Studying Abroad"
            className="absolute inset-0 w-full h-full object-cover opacity-80 filter brightness-75 contrast-105 desaturate-[0.15]"
            loading="lazy"
          />

          {/* Compressed Autoplay Video Background (Local self-hosted asset) */}
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-poster.jpg"
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-85 filter brightness-75 contrast-105 desaturate-[0.15]"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>

          {/* Dual Directional & Vignette Readability Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/80 to-navy-950/45 z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-navy-950/30 z-10 pointer-events-none" />
        </div>

        {/* ── Foreground Content Column (Left-Aligned Overlaid Layout) ── */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 w-full">
          <motion.div
            className="max-w-3xl space-y-6 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header Pill */}
            <div className="inline-flex items-center gap-2.5 bg-white/10 border border-white/20 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg font-display">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              AI-Powered Guidance · Birgunj Head Office, Nepal
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold font-display text-white tracking-tight leading-[1.1] drop-shadow-md">
              Check Your Study Visa<br />
              <span className="bg-gradient-to-r from-crimson-400 via-rose-300 to-amber-300 bg-clip-text text-transparent">
                Success Chances
              </span><br />
              in 30 Seconds
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-xl text-slate-200 max-w-2xl leading-relaxed font-sans font-normal drop-shadow-sm">
              Get personalized country and university recommendations based on your GPA, budget, and career goals — free, instant, and AI-analyzed.
            </p>

            {/* CTA Button Group */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link
                to="/apply"
                className="btn-accent text-base sm:text-lg font-bold shadow-xl shadow-crimson-600/30 px-8 py-4 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                Start Free Assessment
                <ArrowRight className="w-5 h-5" />
              </Link>

              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I checked my visa chance and need guidance.')}`}
                target="_blank"
                rel="noreferrer"
                className="btn-green text-base sm:text-lg font-semibold shadow-xl px-8 py-4 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                <MessageSquare className="w-5 h-5 fill-current" />
                Talk to Expert on WhatsApp
              </a>
            </div>

            {/* Horizontal Glassmorphism Stat Counters Bar (Overlaid on Background) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-8 border-t border-white/20 font-display">
              {STATS.map((s) => (
                <div key={s.label} className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 space-y-1 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-2 text-white font-extrabold text-2xl sm:text-3xl">
                    <s.icon className="w-5 h-5 text-crimson-400 flex-shrink-0" />
                    <span>{s.value}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium font-sans">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ 2. INTRO / ABOUT SECTION (Asymmetric Layout) ══ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          
          <motion.div
            className="lg:col-span-6 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-crimson-600 block font-display">
              Who We Are
            </span>
            <h2 className="section-title text-slate-900 leading-tight">
              Your Trusted Partner<br />for Global Education
            </h2>
            <p className="text-slate-600 leading-relaxed font-sans text-base">
              Aradhya International Education Consultancy Pvt. Ltd. (AIEC) is a leading study abroad consultancy based in Birgunj, Nepal. We empower students to pursue world-class education with complete guidance from initial profile evaluation to university application and visa processing.
            </p>
            <p className="text-slate-600 leading-relaxed font-sans text-base">
              Our AI engine matches your GPA, budget, and career goals with verified university acceptance criteria, eliminating uncertainty before you spend money on application fees.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { icon: Bot, text: 'Personalized AI Recommendations' },
                { icon: ShieldCheck, text: 'Visa Success Prediction' },
                { icon: FileText, text: 'Document Verification' },
                { icon: Award, text: 'End-to-End Support' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <item.icon className="w-5 h-5 text-navy-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 font-display">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <Link to="/apply" className="btn-primary">
                Start Free Assessment <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-6 grid grid-cols-2 gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-1 ${
                  i % 2 === 0
                    ? 'bg-navy-600 text-white shadow-xl shadow-navy-600/15'
                    : 'bg-white border border-slate-200/80 shadow-md text-slate-900'
                }`}
              >
                <s.icon className={`w-8 h-8 mb-4 ${i % 2 === 0 ? 'text-crimson-400' : 'text-navy-600'}`} />
                <div>
                  <p className={`text-3xl font-extrabold font-display mb-1 ${i % 2 === 0 ? 'text-white' : 'text-slate-900'}`}>
                    {s.value}
                  </p>
                  <p className={`text-xs font-semibold ${i % 2 === 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* ══ 3. PROCESS TIMELINE (Break 3-Card Grid Pattern) ══ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-100/60 border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-navy-600 block mb-2 font-display">
              Our Process
            </span>
            <h2 className="section-title">From Dream to Destination</h2>
            <p className="section-subtitle">A clear 6-step roadmap engineered for maximum visa approval clarity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROCESS.map((p, i) => (
              <motion.div
                key={p.step}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-navy-300 transition-all duration-300 group flex flex-col justify-between"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold text-navy-600 bg-navy-50 px-3 py-1 rounded-full font-display">
                      STEP {p.step}
                    </span>
                    <p.icon className="w-6 h-6 text-crimson-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-slate-900 mb-2">{p.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">{p.desc}</p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Guaranteed Guidance</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. STUDY DESTINATIONS ══ */}
      <section id="countries" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-crimson-600 block mb-2 font-display">
              Popular Hubs
            </span>
            <h2 className="section-title">Where Will You Study?</h2>
            <p className="section-subtitle">Direct university partner networks in 15+ top international destinations.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {COUNTRY_VIDEOS.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <CountryHoverCard
                  country={c}
                  activeCardId={activeCardId}
                  onHover={setActiveCardId}
                  onClick={() => window.location.href = '/apply'}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. SERVICES SECTION ══ */}
      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-100/60 border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-navy-600 block mb-2 font-display">
              What We Offer
            </span>
            <h2 className="section-title">End-to-End Counseling Services</h2>
            <p className="section-subtitle">Everything you need to transform your application into a verified offer letter.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s, i) => (
              <motion.div
                key={s.title}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-navy-300 transition-all duration-300 group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="w-12 h-12 bg-navy-50 group-hover:bg-navy-600 rounded-xl flex items-center justify-center text-navy-600 group-hover:text-white mb-4 transition-colors">
                  <s.icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-slate-900 mb-2 text-base sm:text-lg">{s.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. VISA CHANCE CHECKER (Simple 2D Animated Gauge Feature) ══ */}
      <section id="assessment" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white via-slate-50 to-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <span className="inline-flex items-center gap-2 bg-crimson-50 text-crimson-700 text-xs font-bold px-3 py-1 rounded-full border border-crimson-200 font-display">
              <Sparkles className="w-3.5 h-3.5" />
              AI Visa Calculator
            </span>
            <h2 className="section-title">Check Your Estimated Visa Chance</h2>
            <p className="section-subtitle">
              Answer 4 quick steps and our model calculates your visa probability across Canada, Australia, UK, and Germany.
            </p>
          </div>

          {/* Clean 2D Animated Gauge Component Integration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <VisaGauge2D targetPercentage={88} isInteractive={true} />
          </motion.div>
        </div>
      </section>

      {/* ══ 7. TRUST & TESTIMONIALS ══ */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-navy-600 block mb-2 font-display">
              Proven Results
            </span>
            <h2 className="section-title">Why Students Trust AIEC</h2>
            <p className="section-subtitle">Real feedback from Nepali students studying across the globe.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                className="bg-slate-50/80 rounded-2xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div>
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed font-sans text-sm sm:text-base italic mb-6">
                    "{t.text}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-display font-bold text-sm`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-display font-bold text-slate-900 text-sm">{t.name}</p>
                    <p className="text-xs font-medium text-navy-600 font-sans">{t.dest}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. CONTACT SECTION ══ */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-100/60 border-t border-slate-200/60">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-crimson-600 block font-display">
              Get In Touch
            </span>
            <h2 className="section-title text-slate-900 leading-tight">
              Ready to Start<br />Your Global Journey?
            </h2>
            <p className="text-slate-600 leading-relaxed font-sans text-base">
              Visit our Birgunj office or send us a message. Our senior educational counselors respond within 24 hours.
            </p>

            <div className="space-y-4 pt-2">
              {[
                { icon: Building2, label: 'Office', value: 'Aradhya International Education Consultancy Pvt. Ltd.' },
                { icon: MapPin, label: 'Location', value: 'Ranighat-24, Birgunj, Nepal' },
                { icon: Mail, label: 'Email', value: 'aaradhyainternationaleducation@gmail.com' },
                { icon: Phone, label: 'Phone', value: '+977 9802020575 / 9766350770' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-navy-600 flex-shrink-0 shadow-sm">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium font-sans">{item.label}</p>
                    <p className="text-slate-800 font-semibold text-sm font-sans">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <a
                href="tel:+9779802020575"
                className="btn-primary"
              >
                <Phone className="w-4 h-4" /> Call Birgunj Office
              </a>
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want to book a free consultation.')}`}
                target="_blank"
                rel="noreferrer"
                className="btn-green"
              >
                <MessageSquare className="w-4 h-4 fill-current" /> WhatsApp Us
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {contactSent ? (
              <div className="bg-white border border-emerald-200 rounded-3xl p-10 text-center shadow-xl">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Message Received!</h3>
                <p className="text-slate-600 font-sans text-sm mb-6">Our senior counselor will contact you within 24 hours.</p>
                <Link to="/apply" className="btn-primary">Take Full AI Assessment</Link>
              </div>
            ) : (
              <form onSubmit={handleContact} className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl space-y-4">
                <h3 className="font-display font-bold text-slate-900 text-lg mb-2">Send Us a Direct Message</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    className="input-field"
                    placeholder="Your Name *"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                  <input
                    className="input-field"
                    placeholder="Phone / WhatsApp *"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    required
                  />
                </div>
                <input
                  className="input-field"
                  type="email"
                  placeholder="Email Address"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Tell us about your study abroad goals..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                />
                <button
                  type="submit"
                  disabled={contactLoading}
                  className="btn-accent w-full text-base flex items-center justify-center gap-2"
                >
                  {contactLoading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <>Send Message <Send className="w-4 h-4" /></>
                  )}
                </button>
                <p className="text-xs text-slate-400 text-center font-sans">We respond within 24 hours · 100% Confidential</p>
              </form>
            )}
          </motion.div>

        </div>
      </section>

    </div>
  );
}
