import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Sparkles, Award } from 'lucide-react';

/**
 * Reusable Country Card Component with Hover-Video Interaction
 * Features:
 * - Unique per-country background media & video lazy loading via IntersectionObserver
 * - Robust error handling (posterError & videoError state fallbacks)
 * - Guaranteed high-contrast CSS gradients to ensure 100% legible text in all loading states
 * - Non-numeric highlight badge (TODO: replace with real per-country stat once client provides data)
 */
export default function CountryHoverCard({ country, activeCardId, onHover, onClick }) {
  const [isHovered, setIsHovered]         = useState(false);
  const [videoLoaded, setVideoLoaded]     = useState(false);
  const [videoError, setVideoError]       = useState(false);
  const [posterError, setPosterError]     = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const videoRef = useRef(null);
  const cardRef  = useRef(null);

  const isCurrentActive = activeCardId === country.id;

  // IntersectionObserver for view-port based lazy loading
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Detect touch-only devices or reduced motion preference
  useEffect(() => {
    const touchCheck = window.matchMedia('(hover: none)').matches;
    const motionCheck = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setIsTouchDevice(touchCheck || motionCheck);
  }, []);

  // Handle active card video playback synchronization
  useEffect(() => {
    if (!videoRef.current || videoError || isTouchDevice || !isNearViewport) return;

    if (isCurrentActive && isHovered) {
      if (!videoRef.current.src && country.videoUrl) {
        videoRef.current.src = country.videoUrl;
      }
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setVideoLoaded(true))
          .catch(() => {
            setVideoError(true);
          });
      }
    } else {
      videoRef.current.pause();
      try { videoRef.current.currentTime = 0; } catch {}
    }
  }, [isCurrentActive, isHovered, country.videoUrl, videoError, isTouchDevice, isNearViewport]);

  const handleMouseEnter = () => {
    if (isTouchDevice) return;
    setIsHovered(true);
    if (onHover) onHover(country.id);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onHover) onHover(null);
  };

  const badgeText = country.highlightTag || country.tag || 'Top Destination';

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative rounded-2xl border ${country.border || 'border-slate-200'} bg-navy-950 shadow-md hover:shadow-2xl hover:shadow-navy-600/20 transition-all duration-500 overflow-hidden cursor-pointer flex flex-col justify-between h-[350px] select-none`}
      aria-label={`Study in ${country.name}`}
    >
      {/* Background Container with Gradient Fallback */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* CSS Gradient Pattern Fallback (Guarantees zero blank/washed-out state) */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            country.gradientBg || 'from-navy-950 via-slate-900 to-navy-900'
          } transition-opacity duration-500`}
        />

        {/* Static Thumbnail Poster Image (Only rendered if image URL hasn't errored) */}
        {isNearViewport && !posterError && country.poster && (
          <img
            src={country.poster}
            alt={`Study in ${country.name}`}
            onError={() => setPosterError(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out transform group-hover:scale-105 ${
              isHovered && videoLoaded && !videoError ? 'opacity-30 scale-105' : 'opacity-70'
            }`}
            loading="lazy"
          />
        )}

        {/* Dark Gradient Overlay for Guaranteed Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/75 to-navy-950/30 z-10 pointer-events-none" />

        {/* Hover Video Element (Lazy Loaded) */}
        {!isTouchDevice && !videoError && isNearViewport && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            onCanPlay={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 z-5 ${
              isHovered && videoLoaded ? 'opacity-90' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Card Content Overlay */}
      <div className="relative z-20 p-6 flex flex-col justify-between h-full text-white">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="text-4xl filter drop-shadow-md flex-shrink-0">{country.flag}</span>
            <div>
              <h3 className="font-display font-extrabold text-xl text-white tracking-tight leading-snug group-hover:text-crimson-400 transition-colors drop-shadow-sm">
                {country.name}
              </h3>
              
              {/* Highlight Badge (Honest non-numeric tag) */}
              <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 px-3 py-1 rounded-full backdrop-blur-md shadow-sm font-display">
                <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span>{badgeText}</span>
              </span>
            </div>
          </div>

          {/* Video Preview Active Badge */}
          {isHovered && videoLoaded && !videoError && (
            <div className="flex items-center gap-1.5 bg-navy-900/60 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-crimson-500 animate-ping" />
              PREVIEW
            </div>
          )}
        </div>

        {/* Bottom Content */}
        <div className="space-y-3 pt-4 font-sans">
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal line-clamp-3 group-hover:text-white transition-colors drop-shadow-sm">
            {country.desc}
          </p>

          <div className="flex items-center gap-2 text-xs font-bold text-crimson-400 group-hover:text-crimson-300 transition-all pt-1 font-display">
            <span>Explore Options</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-300" />
          </div>
        </div>

      </div>
    </div>
  );
}
