import React, { useState, useRef, useEffect } from 'react'

/**
 * Reusable Country Card Component with Hover-Video Interaction
 * Includes lazy loading, error fallbacks, accessibility support, and touch device optimization.
 */
export default function CountryHoverCard({ country, activeCardId, onHover, onClick }) {
  const [isHovered, setIsHovered]         = useState(false)
  const [videoLoaded, setVideoLoaded]     = useState(false)
  const [videoError, setVideoError]       = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const videoRef                          = useRef(null)

  const isCurrentActive = activeCardId === country.id

  // Detect touch-only devices or reduced motion preference
  useEffect(() => {
    const touchCheck = window.matchMedia('(hover: none)').matches
    const motionCheck = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setIsTouchDevice(touchCheck || motionCheck)
  }, [])

  // Handle active card video playback synchronization
  useEffect(() => {
    if (!videoRef.current || videoError || isTouchDevice) return

    if (isCurrentActive && isHovered) {
      // Lazy load video src when hovered
      if (!videoRef.current.src && country.videoUrl) {
        videoRef.current.src = country.videoUrl
      }
      
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => setVideoLoaded(true))
          .catch(() => {
            // Silently fall back to static poster image if autoplay is blocked or fails
            setVideoError(true)
          })
      }
    } else {
      videoRef.current.pause()
      try { videoRef.current.currentTime = 0 } catch {}
    }
  }, [isCurrentActive, isHovered, country.videoUrl, videoError, isTouchDevice])

  const handleMouseEnter = () => {
    if (isTouchDevice) return
    setIsHovered(true)
    if (onHover) onHover(country.id)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (onHover) onHover(null)
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative rounded-2xl border ${country.border || 'border-gray-200'} bg-white shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer flex flex-col justify-between h-[320px] select-none`}
      aria-label={`Study in ${country.name}`}
    >
      {/* Background Image / Video Container */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900">
        
        {/* Static Thumbnail Poster Image */}
        <img
          src={country.poster}
          alt={`Study in ${country.name}`}
          className={`w-full h-full object-cover transition-all duration-700 ease-out transform group-hover:scale-105 ${
            isHovered && videoLoaded && !videoError ? 'opacity-30 scale-105' : 'opacity-85'
          }`}
          loading="lazy"
        />

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-10" />

        {/* Hover Video Element (Lazy Loaded) */}
        {!isTouchDevice && !videoError && (
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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl filter drop-shadow-md">{country.flag}</span>
            <div>
              <h3 className="font-extrabold text-xl text-white tracking-tight leading-snug group-hover:text-amber-300 transition-colors">
                {country.name}
              </h3>
              <span className="inline-block mt-1 text-[11px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                {country.tag}
              </span>
            </div>
          </div>

          {/* Playing indicator badge when hovered */}
          {isHovered && videoLoaded && !videoError && (
            <div className="flex items-center gap-1.5 bg-blue-500/30 backdrop-blur-md border border-blue-400/40 px-2.5 py-1 rounded-full text-[10px] font-bold text-blue-200 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              PREVIEW
            </div>
          )}
        </div>

        {/* Bottom Content */}
        <div className="space-y-3 pt-4">
          <p className="text-xs sm:text-sm text-gray-200/90 leading-relaxed font-normal line-clamp-3 group-hover:text-white transition-colors">
            {country.desc}
          </p>

          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-all pt-1">
            <span>Explore Universities</span>
            <span className="transform group-hover:translate-x-1.5 transition-transform duration-300">→</span>
          </div>
        </div>

      </div>
    </div>
  )
}
