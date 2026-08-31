import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { ShieldCheck, ArrowRight, Sparkles, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_DESTINATION_RATES = [
  { name: 'Canada', rate: 84, bar: '#10b981' },
  { name: 'Australia', rate: 76, bar: '#f59e0b' },
  { name: 'United Kingdom', rate: 89, bar: '#0c3b5e' },
  { name: 'Germany', rate: 91, bar: '#d9232d' },
];

export default function VisaGauge2D({
  targetPercentage = 88,
  isInteractive = true,
  destinationRates,
  subtitle = "Instant AI Profile Match Engine",
  showCTA = true,
}) {
  const springValue = useSpring(0, { duration: 2500, bounce: 0 });
  const displayValue = useTransform(springValue, (latest) => Math.round(latest));

  const [counterText, setCounterText] = useState(0);

  useEffect(() => {
    springValue.set(targetPercentage);

    const unsubscribe = displayValue.on('change', (val) => {
      setCounterText(val);
    });
    return () => unsubscribe();
  }, [targetPercentage, springValue, displayValue]);

  // Use provided destination rates from backend analysis if available
  const ratesToDisplay = (destinationRates && destinationRates.length > 0)
    ? destinationRates.map((d, idx) => ({
        name: d.name || d.country,
        rate: d.rate || d.score || 80,
        bar: ['#10b981', '#f59e0b', '#0c3b5e', '#d9232d'][idx % 4],
      }))
    : DEFAULT_DESTINATION_RATES;

  // Circular gauge SVG calculations
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (counterText / 100) * circumference;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden font-sans">
      {/* Background Subtle Accent Glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-navy-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm sm:text-base">
              Visa Success Probability Gauge
            </h4>
            <p className="text-xs text-slate-500 font-sans">
              {subtitle}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 bg-emerald-100/80 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full font-display">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          Live Calculation
        </span>
      </div>

      {/* Center 2D Circular Gauge */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
        <div className="relative w-[160px] h-[160px] flex items-center justify-center flex-shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Animated Progress Circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#emeraldGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>

          {/* Gauge Center Text */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
              {counterText}%
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mt-0.5 flex items-center gap-1 font-display">
              <TrendingUp className="w-3 h-3" /> High Match
            </span>
          </div>
        </div>

        {/* Breakdown progress bars for top destinations */}
        <div className="w-full sm:w-auto flex-1 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 font-display">
            Destination Match Breakdown
          </p>
          {ratesToDisplay.map((dest) => (
            <div key={dest.name} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>{dest.name}</span>
                <span className="font-bold text-slate-900 font-display">{dest.rate}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: dest.bar }}
                  initial={{ width: 0 }}
                  animate={{ width: `${dest.rate}%` }}
                  transition={{ duration: 1.2, delay: 0.2 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Footer */}
      {showCTA && (
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Calculated from your verified profile inputs</span>
          </div>
          {isInteractive && (
            <Link
              to="/apply"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-crimson-600 hover:bg-crimson-700 active:scale-[0.98] text-white font-display font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-crimson-600/20 text-sm"
            >
              Recalculate Score
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
