import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Send,
  Play
} from 'lucide-react';
import { submitContact, getPublicVideoTestimonials } from '../api';
import CountryHoverCard from '../components/CountryHoverCard';
import VisaGauge2D from '../components/VisaGauge2D';
import { COUNTRY_VIDEOS } from '../data/countryVideos';
import TESTIMONIALS_DATA from '../data/testimonials';

// Static Icon Mappings for Clean Look
const SERVICES = [
  { icon: Bot, title: 'AI-Based Country Recommendation', desc: 'Our AI engine analyses your marks, budget, IELTS score, and goals to recommend the best-fit countries and universities.' },
  { icon: ShieldCheck, title: 'Visa Success Prediction', desc: 'Get a realistic visa success probability based on your profile before you even apply — no surprises.' },
  { icon: GraduationCap, title: 'University Application Support', desc: 'End-to-end help with shortlisting, SOPs, LORs, essays, and submission to maximise your acceptance chances.' },
  { icon: FileText, title: 'Documentation & Visa Processing', desc: 'We prepare and verify every document — financial proof, transcripts, visa forms — so nothing gets rejected.' },
  { icon: Plane, title: 'Pre-Departure Briefing', desc: 'Accommodation, travel, banking, SIM cards, and cultural orientation so you land confident and prepared.' },
  { icon: HomeIcon, title: 'Post-Arrival Support', desc: 'We stay with you after landing — helping with university enrollment, local setup, and settling in.' },
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
  const [videoTestimonials, setVideoTestimonials] = useState([]);

  useEffect(() => {
    getPublicVideoTestimonials()
      .then(res => setVideoTestimonials(res.data || []))
      .catch(() => setVideoTestimonials([]));
  }, []);
  
  // Hero Video Quality & Mobile Stability State
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const videoRef = useRef(null);

  const wa = import.meta.env.VITE_WHATSAPP || '919802020575';
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Detect slow network connection (Network Information API)
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const conn = navigator.connection;
      if (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
        setIsSlowConnection(true);
        return;
      }
    }

    // 2. Safety timeout fallback: if video hasn't loaded within 6 seconds, maintain static poster
    const timer = setTimeout(() => {
      if (videoRef.current && (videoRef.current.readyState < 2 || videoRef.current.paused)) {
        console.log('Hero video load timed out (>6s) or slow network — maintaining poster fallback');
      }
    }, 6000);

    // 3. Programmatic play attempt for mobile Safari / browser policies
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsVideoReady(true);
        }).catch(err => {
          console.warn('Hero video autoplay deferred by browser policy:', err);
        });
      }
    }

    return () => clearTimeout(timer);
  }, []);

  const handleVideoReady = () => {
    if (!isSlowConnection) {
      setIsVideoReady(true);
    }
  };

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
      <section className="relative py-24 lg:py-32 overflow-hidden bg-navy-950 text-white border-b border-slate-200/20">
        
        {/* ── Background Media Layer (Self-Hosted Dual Video & Poster Fallback) ── */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-navy-950">
          {/* Static Poster Image (Shown instantly on load, slow networks, or initial buffer) */}
          <img
            src="/hero-poster.jpg"
            alt="Students Studying Abroad"
            className={`absolute inset-0 w-full h-full object-cover brightness-95 contrast-100 z-0 transition-opacity duration-700 ${
              isVideoReady ? 'opacity-0 pointer-events-none' : 'opacity-90'
            }`}
            loading="eager"
          />

          {/* Compressed Autoplay Video Background with Progressive Enhancement */}
          {!isSlowConnection && (
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/hero-poster.jpg"
              onCanPlay={handleVideoReady}
              onCanPlayThrough={handleVideoReady}
              onPlaying={handleVideoReady}
              className={`absolute inset-0 w-full h-full object-cover z-0 brightness-95 contrast-100 transition-opacity duration-700 ${
                isVideoReady ? 'opacity-90' : 'opacity-0'
              }`}
            >
              <source src="/hero-video-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
              <source src="/hero-video-desktop.mp4" type="video/mp4" media="(min-width: 768px)" />
              <source src="/hero-video-desktop.mp4" type="video/mp4" />
            </video>
          )}

          {/* Mobile & Desktop Readability Gradient Overlays - Lightened for Brighter Aesthetic */}
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/65 via-navy-950/40 to-navy-950/15 lg:bg-gradient-to-r lg:from-navy-950/70 lg:via-navy-950/35 lg:to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-950/60 to-transparent z-10 pointer-events-none" />
        </div>

        {/* ── Foreground Content Column (Left-Aligned Overlaid Layout) ── */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            className="max-w-3xl space-y-6 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header Pill Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md text-slate-100 text-xs font-semibold px-4 py-2 rounded-full shadow-md font-display">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Birgunj Head Office, Nepal · Official Consultancy</span>
            </div>

            {/* Main Heading - Professional & Trustworthy */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.15] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-display">
              Your Trusted Partner for<br />
              <span className="text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                Global Education
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-100 font-medium max-w-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] leading-relaxed font-sans">
              Personalized university matching and expert visa guidance for Nepali students — transparent, reliable, and backed by a proven track record.
            </p>

            {/* CTA Button Group - Clear Visual Hierarchy on Mobile & Desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <Link
                to="/apply"
                className="btn-accent text-base sm:text-lg font-bold shadow-xl shadow-crimson-600/30 px-7 py-3.5 sm:px-8 sm:py-4 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                Start Free Assessment
                <ArrowRight className="w-5 h-5" />
              </Link>

              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want expert study abroad guidance.')}`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-400/40 text-emerald-300 text-sm sm:text-base font-medium px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:border-emerald-400/70"
              >
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                Talk to Expert on WhatsApp
              </a>
            </div>

            {/* Horizontal Glassmorphism Stat Counters Bar (Overlaid on Background) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-8 border-t border-white/20 font-display">
              {STATS.map((s) => (
                <div key={s.label} className="bg-white/[0.10] border border-white/20 backdrop-blur-md rounded-xl px-4 py-3 sm:px-5 sm:py-4 hover:bg-white/[0.15] transition-all duration-300 space-y-1">
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
                  onClick={() => navigate(`/country/${c.id}`)}
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
              Student Experiences
            </span>
            <h2 className="section-title">Why Students Trust AIEC</h2>
            <p className="section-subtitle">Real feedback from students studying across the globe.</p>
          </div>

          {/* 1+ Published Video Testimonials Display */}
          {videoTestimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videoTestimonials.map((v, i) => (
                <motion.div
                  key={v.id}
                  className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex flex-col justify-between group hover:border-slate-700 transition-all"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <video
                      src={v.video_url}
                      poster={v.thumbnail_url}
                      controls
                      preload="none"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800/80">
                    <div>
                      <p className="font-display font-bold text-sm text-white">
                        {v.student_name || 'Anonymous Student'}
                      </p>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5 font-sans">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Verified Student Video
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-navy-800 text-amber-400 flex items-center justify-center text-xs font-bold font-display border border-navy-700 shadow-sm">
                      AIEC
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : TESTIMONIALS_DATA.isPlaceholder || !TESTIMONIALS_DATA.items || TESTIMONIALS_DATA.items.length === 0 ? (
            <div className="max-w-3xl mx-auto">
              <motion.div
                className="bg-slate-50/80 rounded-2xl p-8 sm:p-12 border border-slate-200/80 shadow-sm text-center relative overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                {/* Subtle Accent Background Glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-navy-600/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-crimson-600/5 rounded-full blur-2xl pointer-events-none" />

                <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-navy-600 border border-navy-100 shadow-2xs">
                  <MessageSquare className="w-7 h-7" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-100/70 text-navy-700 text-xs font-semibold uppercase tracking-wider mb-4">
                  <ShieldCheck className="w-3.5 h-3.5 text-navy-600" />
                  <span>Honest & Verified Guidance</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-display text-slate-900 mb-3">
                  {TESTIMONIALS_DATA.placeholderTitle || "Verified Student Reviews Coming Soon"}
                </h3>

                <p className="text-slate-600 text-sm sm:text-base font-sans max-w-xl mx-auto leading-relaxed mb-8">
                  {TESTIMONIALS_DATA.placeholderSubtitle || "We are currently updating this section with verified student experiences, university acceptances, and placement feedback."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200/70 max-w-2xl mx-auto">
                  <div className="p-4 rounded-xl bg-white border border-slate-200/60 shadow-2xs text-left">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs sm:text-sm font-display mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>100% Authentic</span>
                    </div>
                    <p className="text-xs text-slate-500 font-sans">No fake or fabricated student reviews.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200/60 shadow-2xs text-left">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs sm:text-sm font-display mb-1">
                      <ShieldCheck className="w-4 h-4 text-navy-600 shrink-0" />
                      <span>Verified Placements</span>
                    </div>
                    <p className="text-xs text-slate-500 font-sans font-medium">Reviews collected from verified enrollments.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200/60 shadow-2xs text-left">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs sm:text-sm font-display mb-1">
                      <Award className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Transparent Quality</span>
                    </div>
                    <p className="text-xs text-slate-500 font-sans font-medium">Real university admission outcomes.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {TESTIMONIALS_DATA.items.map((t, i) => (
                <motion.div
                  key={t.name || i}
                  className="bg-slate-50/80 rounded-2xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <div>
                    <div className="flex gap-1 mb-4">
                      {[...Array(t.rating || 5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-slate-700 leading-relaxed font-sans text-sm sm:text-base italic mb-6">
                      "{t.text}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60">
                    <div className={`w-10 h-10 ${t.color || 'bg-navy-600'} rounded-full flex items-center justify-center text-white font-display font-bold text-sm`}>
                      {t.avatar || t.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-display font-bold text-slate-900 text-sm">{t.name}</p>
                      <p className="text-xs font-medium text-navy-600 font-sans">{t.dest}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
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
