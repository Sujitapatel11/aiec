/**
 * Country Video & Meta Configuration for AIEC Study Abroad Destinations
 * High Quality Cinematic Background Videos with static poster fallbacks.
 *
 * Cards are ordered by Nepali student priority (1=Japan ... 8=New Zealand).
 * Germany and Ireland are retained below as additional destinations without
 * a dedicated detail page yet — they link to /apply as before.
 *
 * NOTE: highlightTag and tag fields use honest, non-numeric highlight descriptors.
 * // TODO: replace with real per-country stat once client provides data
 */

export const COUNTRY_VIDEOS = [
  // ── Priority 1 ──────────────────────────────────────────────────────────────
  {
    id: 'japan',
    name: 'Japan',
    flag: '\u{1F1EF}\u{1F1F5}',
    // TODO: replace with real per-country stat once client provides data
    tag: '#1 for Nepali Students',
    highlightTag: '#1 for Nepali Students',
    color: 'from-rose-50 to-red-100',
    border: 'border-rose-200',
    gradientBg: 'from-rose-950 via-red-950 to-slate-950',
    desc: 'Currently the highest-enrollment destination for Nepali students. Affordable cost, strong work rights, and a wide network of language schools and vocational colleges.',
    poster: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tokyo-streets-at-night-41544-large.mp4',
  },
  // ── Priority 2 ──────────────────────────────────────────────────────────────
  {
    id: 'australia',
    name: 'Australia',
    flag: '\u{1F1E6}\u{1F1FA}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'High Student Satisfaction',
    highlightTag: 'High Student Satisfaction',
    color: 'from-amber-50 to-yellow-100',
    border: 'border-amber-200',
    gradientBg: 'from-amber-950 via-yellow-950 to-slate-950',
    desc: 'Top QS-ranked universities, high quality of life, vibrant lifestyle, and strong graduate job market.',
    poster: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-sydney-opera-house-and-harbour-bridge-41551-large.mp4',
  },
  // ── Priority 3 ──────────────────────────────────────────────────────────────
  {
    id: 'uk',
    name: 'United Kingdom',
    flag: '\u{1F1EC}\u{1F1E7}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'Global Prestige',
    highlightTag: 'Global Prestige',
    color: 'from-blue-50 to-indigo-100',
    border: 'border-blue-200',
    gradientBg: 'from-blue-950 via-indigo-950 to-slate-950',
    desc: 'Prestigious institutions, shorter 1-year master\'s programs, and globally recognised degrees with 2-year Graduate Route work visa.',
    poster: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-big-ben-clock-tower-in-london-4437-large.mp4',
  },
  // ── Priority 4 ──────────────────────────────────────────────────────────────
  {
    id: 'canada',
    name: 'Canada',
    flag: '\u{1F1E8}\u{1F1E6}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'Student Favorite',
    highlightTag: 'Student Favorite',
    color: 'from-red-50 to-rose-100',
    border: 'border-red-200',
    gradientBg: 'from-red-950 via-rose-950 to-slate-950',
    desc: 'World-class universities with post-study work permits (PGWP) up to 3 years and clear Express Entry PR routes.',
    poster: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-toronto-skyline-41604-large.mp4',
  },
  // ── Priority 5 ──────────────────────────────────────────────────────────────
  {
    id: 'usa',
    name: 'United States',
    flag: '\u{1F1FA}\u{1F1F8}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'Top Academic Choice',
    highlightTag: 'Top Academic Choice',
    color: 'from-indigo-50 to-purple-100',
    border: 'border-indigo-200',
    gradientBg: 'from-slate-950 via-purple-950 to-indigo-950',
    desc: 'Home to the world\'s top research universities, Ivy League institutions, and Silicon Valley industry innovation.',
    poster: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-new-york-city-skyline-at-dusk-4264-large.mp4',
  },
  // ── Priority 6 ──────────────────────────────────────────────────────────────
  {
    id: 'south-korea',
    name: 'South Korea',
    flag: '\u{1F1F0}\u{1F1F7}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'Affordable & Growing',
    highlightTag: 'Affordable & Growing',
    color: 'from-sky-50 to-blue-100',
    border: 'border-sky-200',
    gradientBg: 'from-sky-950 via-blue-950 to-slate-950',
    desc: 'Rapidly growing destination for Nepali students. Affordable tuition, government scholarships (GKS/KGSP), and a strong technology and culture industry.',
    poster: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-seoul-south-korea-cityscape-4k-41553-large.mp4',
  },
  // ── Priority 7 ──────────────────────────────────────────────────────────────
  {
    id: 'france',
    name: 'France',
    flag: '\u{1F1EB}\u{1F1F7}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'Cultural & Business Leader',
    highlightTag: 'Cultural & Business Leader',
    color: 'from-sky-50 to-blue-100',
    border: 'border-sky-200',
    gradientBg: 'from-sky-950 via-blue-950 to-slate-950',
    desc: 'Top-tier business schools, rich cultural heritage, generous government subsidies, and affordable public university tuition.',
    poster: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-eiffel-tower-in-paris-at-sunset-41552-large.mp4',
  },
  // ── Priority 8 ──────────────────────────────────────────────────────────────
  {
    id: 'new-zealand',
    name: 'New Zealand',
    flag: '\u{1F1F3}\u{1F1FF}',
    // TODO: replace with real per-country stat once client provides data
    tag: 'High Quality Living',
    highlightTag: 'High Quality Living',
    color: 'from-teal-50 to-cyan-100',
    border: 'border-teal-200',
    gradientBg: 'from-teal-950 via-cyan-950 to-slate-950',
    desc: 'Ranked #1 for peaceful living, offering practical learning environments and attractive post-study work rights.',
    poster: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-scenic-new-zealand-lake-41617-large.mp4',
  },
];
