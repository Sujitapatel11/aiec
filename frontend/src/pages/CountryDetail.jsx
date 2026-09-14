import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  DollarSign,
  Briefcase,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Users,
  Globe2,
  Clock,
  ArrowRight,
  Star,
} from 'lucide-react';
import { getCountryById } from '../data/countries';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, label, title }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 bg-navy-50 border border-navy-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-5 h-5 text-navy-600" />
      </div>
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-crimson-600 block mb-0.5 font-display">
          {label}
        </span>
        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
          {title}
        </h2>
      </div>
    </div>
  );
}

function ContentCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

function DataVerificationBadge() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-amber-800 font-sans leading-relaxed">
        <span className="font-bold font-display">Data notice:</span> Figures shown (tuition, work hours, visa durations) are based on drafted reference material and have not been independently verified against official government or institutional sources. Policies change — confirm current rules with the relevant embassy, immigration authority, or official university before making decisions.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CountryDetail Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CountryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const country = getCountryById(id);
  const wa = import.meta.env.VITE_WHATSAPP || '919802020575';

  // ── 404 state ──
  if (!country) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center gap-6">
        <Globe2 className="w-16 h-16 text-slate-300" />
        <div>
          <h1 className="font-display font-extrabold text-2xl text-slate-900 mb-2">Country not found</h1>
          <p className="text-slate-500 font-sans text-sm">We don't have a detail page for "{id}" yet.</p>
        </div>
        <button onClick={() => navigate('/')} className="btn-primary">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
      </div>
    );
  }

  const waMessage = encodeURIComponent(
    `Hi! I'm interested in studying in ${country.name}. Can you help me?`
  );

  const isContentPending =
    country.topUniversities.length === 1 &&
    country.topUniversities[0].includes('under review');

  return (
    <div className="min-h-screen bg-slate-50/50">

      {/* ══ HERO BANNER ══ */}
      <section className="relative bg-navy-950 text-white overflow-hidden">
        {/* Background poster */}
        <div className="absolute inset-0 z-0">
          <img
            src={country.poster}
            alt={`Study in ${country.name}`}
            className="w-full h-full object-cover opacity-40 brightness-75"
            loading="eager"
          />
          <div className={`absolute inset-0 bg-gradient-to-br ${country.gradientBg} opacity-80`} />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/50 to-transparent" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 sm:pt-10 sm:pb-20">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-semibold font-display transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Destinations
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            {/* Priority badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full mb-4 font-display">
              <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
              #{country.priority} Popular Destination for Nepali Students
            </div>

            {/* Country name + flag */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-6xl sm:text-7xl drop-shadow-lg">{country.flag}</span>
              <div>
                <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight drop-shadow-md">
                  {country.name}
                </h1>
                <p className="text-slate-200 text-base sm:text-lg font-sans mt-1">
                  Study Abroad Guide for Nepali Students
                </p>
              </div>
            </div>

            {/* Cost pill */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm font-bold px-4 py-2 rounded-full font-display backdrop-blur-sm mt-2">
              <DollarSign className="w-4 h-4" />
              Approx. {country.approxAnnualCostNPR}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ MAIN CONTENT ══ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">

        {/* Data verification notice */}
        <DataVerificationBadge />

        {/* ── Content-pending notice for USA / South Korea ── */}
        {isContentPending && (
          <div className="flex items-start gap-3 bg-navy-50 border border-navy-200 rounded-xl p-4 text-sm">
            <Clock className="w-5 h-5 text-navy-600 flex-shrink-0 mt-0.5" />
            <p className="text-navy-800 font-sans leading-relaxed">
              <span className="font-bold font-display">Full content coming soon.</span> Detailed university list and complete cost breakdown for {country.name} are under content review. The overview and work rights summary below are provided as an initial guide.
            </p>
          </div>
        )}

        {/* ── Two-column grid on desktop ── */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left / main column */}
          <div className="lg:col-span-2 space-y-8">

            {/* 1. Why Popular */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <ContentCard>
                <SectionHeading icon={Users} label="Why Choose" title={`Why Nepali Students Choose ${country.name}`} />
                <p className="text-slate-700 font-sans text-base leading-relaxed">
                  {country.whyPopular}
                </p>
              </ContentCard>
            </motion.div>

            {/* 2. Top Universities */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <ContentCard>
                <SectionHeading icon={GraduationCap} label="Institutions" title="Top Universities & Colleges" />
                <ul className="space-y-3">
                  {country.topUniversities.map((uni, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 font-sans text-sm sm:text-base leading-snug">{uni}</span>
                    </li>
                  ))}
                </ul>
              </ContentCard>
            </motion.div>

            {/* 3. Popular Courses */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <ContentCard>
                <SectionHeading icon={BookOpen} label="Academics" title="Popular Courses" />
                <div className="flex flex-wrap gap-2.5">
                  {country.popularCourses.map((course, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-navy-50 border border-navy-100 text-navy-700 text-sm font-semibold px-4 py-2 rounded-full font-display"
                    >
                      <Star className="w-3 h-3 text-crimson-500" />
                      {course}
                    </span>
                  ))}
                </div>
              </ContentCard>
            </motion.div>

            {/* 4. Cost Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <ContentCard>
                <SectionHeading icon={DollarSign} label="Finances" title="Cost Breakdown" />

                {/* Cost table */}
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full min-w-[340px] text-sm border-separate border-spacing-y-2">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-slate-400 pb-1 pl-3 font-display">
                          Category
                        </th>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-slate-400 pb-1 font-display">
                          Local Currency
                        </th>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-slate-400 pb-1 font-display">
                          NPR (approx.)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Tuition row */}
                      <tr className="bg-slate-50 rounded-xl">
                        <td className="py-3 pl-3 pr-2 rounded-l-xl font-semibold text-slate-700 font-display whitespace-nowrap">
                          Tuition
                        </td>
                        <td className="py-3 pr-2 text-slate-600 font-sans">
                          {country.costBreakdown.tuition.local}
                        </td>
                        <td className="py-3 pr-3 rounded-r-xl text-navy-700 font-bold font-display">
                          {country.costBreakdown.tuition.npr}
                        </td>
                      </tr>
                      {/* Living row */}
                      <tr className="bg-slate-50 rounded-xl">
                        <td className="py-3 pl-3 pr-2 rounded-l-xl font-semibold text-slate-700 font-display whitespace-nowrap">
                          Living Costs
                        </td>
                        <td className="py-3 pr-2 text-slate-600 font-sans">
                          {country.costBreakdown.living.local}
                        </td>
                        <td className="py-3 pr-3 rounded-r-xl text-navy-700 font-bold font-display">
                          {country.costBreakdown.living.npr}
                        </td>
                      </tr>
                      {/* Total row */}
                      <tr className="bg-navy-600 rounded-xl text-white">
                        <td className="py-3 pl-3 pr-2 rounded-l-xl font-extrabold font-display whitespace-nowrap">
                          Total / Year
                        </td>
                        <td className="py-3 pr-2 font-semibold font-sans">
                          {country.costBreakdown.total.local}
                        </td>
                        <td className="py-3 pr-3 rounded-r-xl font-extrabold font-display text-amber-300">
                          {country.costBreakdown.total.npr}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div className="mt-4 space-y-1.5">
                  {[
                    country.costBreakdown.tuition.note,
                    country.costBreakdown.living.note,
                    country.costBreakdown.total.note,
                  ]
                    .filter(Boolean)
                    .map((note, i) => (
                      <p key={i} className="text-xs text-slate-400 font-sans leading-relaxed flex gap-2">
                        <span className="text-slate-300 flex-shrink-0">•</span>
                        {note}
                      </p>
                    ))}
                </div>
              </ContentCard>
            </motion.div>

            {/* 5. Work Rights */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <ContentCard>
                <SectionHeading icon={Briefcase} label="Employment" title="Work Rights" />
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* During study */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 font-display">
                        During Study
                      </span>
                    </div>
                    <p className="text-slate-700 font-sans text-sm leading-relaxed">
                      {country.workRights.duringStudy}
                    </p>
                  </div>
                  {/* Post study */}
                  <div className="bg-navy-50 border border-navy-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-4 h-4 text-navy-600" />
                      <span className="text-xs font-bold uppercase tracking-widest text-navy-700 font-display">
                        Post-Study
                      </span>
                    </div>
                    <p className="text-slate-700 font-sans text-sm leading-relaxed">
                      {country.workRights.postStudy}
                    </p>
                  </div>
                </div>
              </ContentCard>
            </motion.div>

          </div>{/* /left column */}

          {/* ── Right sidebar ── */}
          <div className="space-y-6">

            {/* Talk to Expert CTA — sticky on desktop */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:sticky lg:top-28"
            >
              <div className="bg-gradient-to-br from-navy-600 to-navy-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-navy-600/20">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-white fill-white/20" />
                </div>
                <h3 className="font-display font-extrabold text-xl mb-2">
                  Talk to an Expert
                </h3>
                <p className="text-slate-200 font-sans text-sm leading-relaxed mb-6">
                  Get personalised guidance for studying in {country.name} — from university selection to visa filing. Our counselors respond within 24 hours.
                </p>

                <a
                  href={`https://wa.me/${wa}?text=${waMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-display font-bold px-5 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-xl text-sm"
                >
                  {/* WhatsApp icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Talk to Expert on WhatsApp
                </a>

                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <Link
                    to="/apply"
                    className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-display font-semibold px-5 py-3 rounded-xl transition-all duration-200 text-sm"
                  >
                    Run AI Assessment
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Quick facts card */}
              <div className="mt-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
                <h4 className="font-display font-bold text-slate-900 text-base mb-4">Quick Facts</h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm">
                    <Globe2 className="w-4 h-4 text-navy-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 text-xs font-medium block font-sans">Destination</span>
                      <span className="text-slate-800 font-semibold font-display">{country.name}</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 text-xs font-medium block font-sans">Nepali Student Rank</span>
                      <span className="text-slate-800 font-semibold font-display">#{country.priority} Most Popular</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 text-xs font-medium block font-sans">Est. Annual Cost</span>
                      <span className="text-slate-800 font-semibold font-display">{country.approxAnnualCostNPR}</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <GraduationCap className="w-4 h-4 text-navy-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 text-xs font-medium block font-sans">Top Courses</span>
                      <span className="text-slate-800 font-semibold font-display">
                        {country.popularCourses.slice(0, 2).join(', ')}
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </motion.div>

          </div>{/* /right sidebar */}
        </div>{/* /grid */}

        {/* ══ BOTTOM CTA BANNER ══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-navy-700 via-navy-600 to-crimson-700 rounded-2xl p-8 sm:p-10 text-white text-center shadow-xl"
        >
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl mb-3">
            Ready to Study in {country.name}?
          </h2>
          <p className="text-slate-200 font-sans text-base mb-8 max-w-lg mx-auto">
            Book a free consultation with our senior educational counselors — no fees, no commitment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={`https://wa.me/${wa}?text=${waMessage}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-display font-bold px-6 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/30 text-sm sm:text-base"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Talk to Expert — Free Consultation
            </a>
            <Link
              to="/apply"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-display font-semibold px-6 py-3.5 rounded-xl transition-all duration-200 text-sm sm:text-base"
            >
              Start AI Assessment
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Explore other destinations */}
        <div className="text-center pt-2 pb-4">
          <Link
            to="/#countries"
            className="inline-flex items-center gap-2 text-navy-600 hover:text-navy-800 font-display font-semibold text-sm transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Explore all destinations
          </Link>
        </div>

      </div>{/* /main content */}
    </div>
  );
}
