/**
 * AIEC Study Abroad — Structured Country Data
 *
 * TODO: verify all figures against official embassy/university sources — last drafted 2026-09-13
 *
 * DATA VERIFICATION FLAG:
 * The tuition ranges, work-hour limits, post-study visa durations, cost estimates, and
 * university lists below were drafted from a content source and have NOT been independently
 * verified against official government or institutional sources. Policy numbers (especially
 * work rights and post-study visa lengths) change frequently.
 * This data must be reviewed and confirmed against official sources before/after going live.
 * Architecture is intentionally data-driven — updating any country's facts is a single
 * object edit in this file, requiring no code changes elsewhere.
 *
 * Priority order for Nepali students (per AIEC internal ranking):
 * 1. Japan  2. Australia  3. UK  4. Canada  5. USA  6. South Korea  7. France  8. New Zealand
 */

export const COUNTRIES = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. JAPAN
  // TODO: verify tuition ranges, language school costs, work-hour limits against
  // JASSO (Japan Student Services Organization) and MEXT official sources.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'japan',
    name: 'Japan',
    flag: '🇯🇵',
    priority: 1,
    whyPopular:
      'Currently the highest-enrollment destination for Nepali students. Affordable cost relative to English-speaking nations, a wide network of language schools and vocational colleges, and strong part-time work rights during study.',
    approxAnnualCostNPR: 'NPR 12–22 Lakh/year',
    topUniversities: [
      'University of Tokyo',
      'Kyoto University',
      'Osaka University',
      'Waseda University',
      'Ritsumeikan Asia Pacific University (APU)',
      'Language Schools & Vocational Colleges (highest enrolment volume)',
    ],
    popularCourses: [
      'Japanese Language',
      'Business & Management',
      'IT & Engineering',
      'Hospitality',
      'Nursing',
    ],
    costBreakdown: {
      tuition: {
        local: '¥500,000–¥1,200,000/year',
        npr: 'NPR 4.5–11 Lakh/year',
        note: 'University / vocational college fees. Language school fees vary.',
      },
      living: {
        local: '¥900,000–¥1,400,000/year',
        npr: 'NPR 8–13 Lakh/year',
        note: 'Accommodation, food, transport.',
      },
      total: {
        local: '¥1,400,000–¥2,600,000/year',
        npr: 'NPR 12–22 Lakh/year',
      },
    },
    workRights: {
      duringStudy:
        'Up to 28 hours/week during term; full-time during designated vacation periods (subject to visa conditions — verify with JNTO/immigration).',
      postStudy:
        'Designated Activities visa available for job-seeking after graduation; duration varies by qualification level.',
    },
    // Visa success factors pulled only from existing backend recommendation logic — no invented claims.
    visaSuccessFactors: null,
    // Visual config (mirrors countryVideos.js for cards)
    gradientBg: 'from-rose-950 via-red-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUSTRALIA
  // TODO: verify tuition ranges against CRICOS, work-hour rules against
  // Department of Home Affairs (student visa conditions), and post-study visa
  // (Temporary Graduate visa subclass 485) durations.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    priority: 2,
    whyPopular:
      'Strong Nepali student community, broadly recognised degrees, practical work rights during and after study, and multiple pathways toward permanent residency.',
    approxAnnualCostNPR: 'NPR 45–75 Lakh/year',
    topUniversities: [
      'University of Technology Sydney (UTS)',
      'RMIT University',
      'Deakin University',
      'Macquarie University',
      'University of Wollongong',
      'CQUniversity',
      'University of Tasmania',
    ],
    popularCourses: [
      'Information Technology',
      'Nursing',
      'Business & Accounting',
      'Engineering',
      'Hospitality & Cookery',
    ],
    costBreakdown: {
      tuition: {
        local: 'AUD 25,000–42,000/year',
        npr: 'NPR 22–37 Lakh/year',
        note: 'Varies significantly by institution and course level.',
      },
      living: {
        local: 'AUD 25,000–30,000/year',
        npr: 'NPR 22–27 Lakh/year',
        note: 'Accommodation, food, transport, personal expenses.',
      },
      total: {
        local: 'AUD 50,000–72,000+/year',
        npr: 'NPR 45–65 Lakh+/year',
      },
    },
    workRights: {
      duringStudy:
        'Up to 48 hours per fortnight during study periods (current policy — verify with Department of Home Affairs as rules have changed previously).',
      postStudy:
        'Temporary Graduate Visa (subclass 485): 2–4 years depending on qualification and region of study. Graduate Work stream or Post-Study Work stream.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-amber-950 via-yellow-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. UNITED KINGDOM
  // TODO: verify tuition ranges against UCAS/HESA data, Graduate Route visa
  // duration, and NHS surcharge amounts against UKVI official guidance.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'uk',
    name: 'United Kingdom',
    flag: '🇬🇧',
    priority: 3,
    whyPopular:
      '1-year Master\'s programs significantly cut total study cost. Globally recognised degrees and a 2-year post-study Graduate Route visa available to most graduates.',
    approxAnnualCostNPR: 'NPR 35–60 Lakh/year',
    topUniversities: [
      'University of Hertfordshire',
      'Coventry University',
      'University of Greenwich',
      'Ulster University',
      'Birmingham City University',
      'Anglia Ruskin University',
    ],
    popularCourses: [
      'Business & Management',
      'Data Science & IT',
      'Public Health',
      'Engineering',
      'Accounting & Finance',
    ],
    costBreakdown: {
      tuition: {
        local: '£12,000–£22,000/year',
        npr: 'NPR 20–37 Lakh/year',
        note: 'Postgraduate taught programmes at listed universities. London institutions typically higher.',
      },
      living: {
        local: '£12,000–£15,000/year',
        npr: 'NPR 20–25 Lakh/year',
        note: 'Outside London. London living costs are notably higher.',
      },
      total: {
        local: '£24,000–£37,000/year',
        npr: 'NPR 40–60 Lakh/year',
      },
    },
    workRights: {
      duringStudy:
        'Up to 20 hours/week during term time; full-time during official vacation periods (Student visa conditions).',
      postStudy:
        'Graduate Route visa: 2 years for Bachelor\'s/Master\'s graduates; 3 years for PhD graduates. No employer sponsorship required.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-blue-950 via-indigo-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CANADA
  // TODO: verify tuition ranges against EduCanada/Statistics Canada data,
  // PGWP eligibility and duration rules against IRCC official guidance,
  // and GIC requirement amounts.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'canada',
    name: 'Canada',
    flag: '🇨🇦',
    priority: 4,
    whyPopular:
      'Among the most accessible PR pathways for international graduates via Express Entry (CEC) and Provincial Nominee Programs. College-level programs are practical and job-focused.',
    approxAnnualCostNPR: 'NPR 40–70 Lakh/year',
    topUniversities: [
      'Seneca College',
      'Centennial College',
      'George Brown College',
      'Conestoga College',
      'University of Windsor',
      'Yorkville University',
    ],
    popularCourses: [
      'Business Administration',
      'IT & Computer Science',
      'Nursing & Healthcare',
      'Hospitality Management',
      'Engineering Technology',
    ],
    costBreakdown: {
      tuition: {
        local: 'CAD 15,000–28,000/year',
        npr: 'NPR 15–28 Lakh/year',
        note: 'College diploma/degree programmes. University fees are typically higher.',
      },
      living: {
        local: 'CAD 20,000–25,000/year (incl. GIC)',
        npr: 'NPR 20–25 Lakh/year',
        note: 'Includes Guaranteed Investment Certificate (GIC) requirement for first year. Verify current GIC amount with IRCC.',
      },
      total: {
        local: 'CAD 35,000–53,000+/year',
        npr: 'NPR 40–55 Lakh+/year (first year)',
      },
    },
    workRights: {
      duringStudy:
        'Up to 20 hours/week during academic sessions; full-time during scheduled breaks (Student Direct Stream conditions — verify with IRCC for current rules).',
      postStudy:
        'Post-Graduation Work Permit (PGWP): up to 3 years for qualifying programmes. Duration depends on programme length.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-red-950 via-rose-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. USA
  // TODO: Full content not yet drafted. Populate universities, courses, and
  // cost breakdown once content review is complete.
  // Verify F-1 OPT/STEM OPT rules against USCIS/DHS official sources.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'usa',
    name: 'United States',
    flag: '🇺🇸',
    priority: 5,
    whyPopular:
      'Home to the world\'s highest-ranked research universities, extensive scholarship opportunities, and a globally recognised alumni network spanning every industry.',
    approxAnnualCostNPR: 'NPR 35–90 Lakh+/year',
    topUniversities: [
      'Content under review — full university list to be added after content verification.',
    ],
    popularCourses: [
      'Computer Science & Engineering',
      'Business & MBA',
      'Data Science & AI',
      'Life Sciences & Research',
      'Finance & Economics',
    ],
    costBreakdown: {
      tuition: {
        local: 'USD 20,000–55,000+/year',
        npr: 'NPR 27–75 Lakh+/year',
        note: 'Ranges widely — community colleges at the low end, Ivy League/private research universities at the high end. Full cost breakdown to be verified.',
      },
      living: {
        local: 'USD 12,000–20,000/year',
        npr: 'NPR 16–27 Lakh/year',
        note: 'Varies significantly by city/state. NYC and California are substantially higher.',
      },
      total: {
        local: 'USD 32,000–75,000+/year',
        npr: 'NPR 35–90 Lakh+/year',
      },
    },
    workRights: {
      duringStudy:
        'On-campus work: up to 20 hours/week. Off-campus work is restricted on F-1 visa (CPT/OPT exceptions apply).',
      postStudy:
        'Optional Practical Training (OPT): 12 months post-graduation; STEM graduates eligible for a 24-month extension (STEM OPT). Verify with USCIS/DSO.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-slate-950 via-purple-950 to-indigo-950',
    poster:
      'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. SOUTH KOREA
  // TODO: Full content not yet drafted. Populate universities, courses, and
  // cost breakdown once content review is complete.
  // Verify work-hour limits and post-study visa options against Korea Immigration
  // Service (KIS) official sources.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'south-korea',
    name: 'South Korea',
    flag: '🇰🇷',
    priority: 6,
    whyPopular:
      'Rapidly growing destination for Nepali students. Affordable tuition relative to Western countries, government scholarship programs (GKS/KGSP), and a strong technology and culture industry.',
    approxAnnualCostNPR: 'NPR 15–28 Lakh/year',
    topUniversities: [
      'Content under review — full university list to be added after content verification.',
    ],
    popularCourses: [
      'Korean Language',
      'IT & Computer Science',
      'Engineering',
      'Business & Management',
      'K-Culture & Media Studies',
    ],
    costBreakdown: {
      tuition: {
        local: 'KRW 3,000,000–8,000,000/year',
        npr: 'NPR 3–8 Lakh/year',
        note: 'Public universities at the lower end. Private universities higher. Full breakdown to be verified.',
      },
      living: {
        local: 'KRW 10,000,000–15,000,000/year',
        npr: 'NPR 10–18 Lakh/year',
        note: 'Seoul significantly higher than regional cities.',
      },
      total: {
        local: 'KRW 13,000,000–23,000,000/year',
        npr: 'NPR 15–28 Lakh/year',
      },
    },
    workRights: {
      duringStudy:
        'Part-time work permitted on D-2 student visa (conditions apply — verify current hours cap with Korea Immigration Service).',
      postStudy:
        'Various post-study visa options available including D-10 job-seeking visa. Full post-study work rights to be verified and added.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-sky-950 via-blue-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. FRANCE
  // TODO: verify tuition amounts against Campus France official figures,
  // APS visa duration and eligibility, and work-hour calculations (20 hrs/wk
  // = 964 hrs/year) against official OFII/Campus France sources.
  // Private / Grandes Écoles fees are substantially higher — flagged below.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'france',
    name: 'France',
    flag: '🇫🇷',
    priority: 7,
    whyPopular:
      'Among the lowest public university tuition in Europe for international students. Access to the broader Schengen EU study area, growing English-taught Master\'s programmes, and a 1-year post-study APS visa for graduates.',
    approxAnnualCostNPR: 'NPR 16–24 Lakh/year',
    topUniversities: [
      'Sorbonne University',
      'Université Paris-Saclay',
      'Université Grenoble Alpes',
      'Sciences Po',
      'INSA Lyon',
      'University of Lyon',
    ],
    popularCourses: [
      'Engineering & IT',
      'Business & Management',
      'Data Science & AI',
      'Hospitality & Tourism',
      'Fashion & Luxury Brand Management',
      'Public Health',
    ],
    costBreakdown: {
      tuition: {
        local: '€2,800–€4,000/year',
        npr: 'NPR 4–6 Lakh/year',
        note:
          'Public university fees set by the French government. Private institutions and Grandes Écoles are substantially higher (€10,000–€25,000+/year).',
      },
      living: {
        local: '€8,000–€12,000/year',
        npr: 'NPR 12–18 Lakh/year',
        note: 'Paris is at the higher end. Regional cities more affordable.',
      },
      total: {
        local: '€11,000–€16,000/year',
        npr: 'NPR 16–24 Lakh/year',
        note: 'For public universities. Private/Grandes Écoles total is significantly higher.',
      },
    },
    workRights: {
      duringStudy:
        '20 hours/week (964 hours/year) on student visa. Consistent with EU student work rights framework.',
      postStudy:
        'Autorisation Provisoire de Séjour (APS) — 1-year post-graduation job-seeking/work permit for qualifying graduates. Verify current eligibility criteria with Campus France/OFII.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-sky-950 via-blue-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. NEW ZEALAND
  // TODO: verify tuition ranges against Education New Zealand (ENZ) official data,
  // work-hour entitlements against Immigration New Zealand (Nov 2025 policy noted
  // in draft — VERIFY), and Post-Study Work Visa durations.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'new-zealand',
    name: 'New Zealand',
    flag: '🇳🇿',
    priority: 8,
    whyPopular:
      'High safety rankings, smaller class sizes, practical learning environments, strong work rights during study, and a relatively clear post-study work and PR pathway.',
    approxAnnualCostNPR: 'NPR 34–48 Lakh/year',
    topUniversities: [
      'University of Auckland',
      'University of Otago',
      'Victoria University of Wellington',
      'University of Canterbury',
      'Massey University',
      'Auckland University of Technology (AUT)',
      'University of Waikato',
    ],
    popularCourses: [
      'Information Technology',
      'Business & Management',
      'Nursing & Health Sciences',
      'Engineering',
      'Hospitality & Tourism',
      'Agriculture & Environmental Science',
    ],
    costBreakdown: {
      tuition: {
        local: 'NZD 22,000–38,000/year',
        npr: 'NPR 18–32 Lakh/year',
        note: 'Degree-level programmes at listed universities.',
      },
      living: {
        local: 'NZD ~20,000/year',
        npr: 'NPR 16–17 Lakh/year',
        note: 'Auckland is higher than other cities.',
      },
      total: {
        local: 'NZD 42,000–58,000/year',
        npr: 'NPR 34–48 Lakh/year',
      },
    },
    workRights: {
      duringStudy:
        '25 hours/week during study (per draft source — policy noted as increased from 20 hrs in November 2025; VERIFY against Immigration New Zealand current guidance before presenting to students).',
      postStudy:
        'Post-Study Work Visa: up to 3 years for Bachelor\'s and Master\'s degree holders. Duration and eligibility conditions to be verified with Immigration New Zealand.',
    },
    visaSuccessFactors: null,
    gradientBg: 'from-teal-950 via-cyan-950 to-slate-950',
    poster:
      'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=1200&q=80',
  },
];

/**
 * Helper: get a country entry by its id slug.
 * Returns undefined if not found.
 */
export function getCountryById(id) {
  return COUNTRIES.find((c) => c.id === id);
}

/**
 * Helper: get the matching COUNTRY_VIDEOS entry id for a country.
 * countryVideos.js uses the same id strings for: uk, usa, canada, australia,
 * germany, france, ireland, new-zealand.
 * New entries added here (japan, south-korea) don't have video entries yet.
 */
export const COUNTRY_VIDEO_ID_MAP = {
  japan: 'japan',
  australia: 'australia',
  uk: 'uk',
  canada: 'canada',
  usa: 'usa',
  'south-korea': 'south-korea',
  france: 'france',
  'new-zealand': 'new-zealand',
};
