import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, LayoutDashboard, Menu, X, ArrowUpRight } from 'lucide-react';

const NAV_LINKS = [
  { href: '#countries', label: 'Destinations' },
  { href: '#services', label: 'Services' },
  { href: '#assessment', label: 'Visa Check' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '#contact', label: 'Contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (e, href) => {
    if (isHome) {
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      setOpen(false);
    }
  };

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-md shadow-slate-200/50 border-b border-slate-200/80' : 'bg-white/80 backdrop-blur-sm border-b border-slate-100'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="AIEC Logo" className="h-11 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1.5 font-display">
            {isHome && NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => handleAnchor(e, l.href)}
                className="text-sm font-semibold text-slate-700 hover:text-navy-600 px-3.5 py-2 rounded-xl hover:bg-navy-50/60 transition-all"
              >
                {l.label}
              </a>
            ))}
            {!isHome && (
              <Link to="/" className="text-sm font-semibold text-slate-700 hover:text-navy-600 px-3 py-2">Home</Link>
            )}
            <Link to="/dashboard" className="text-sm font-semibold text-slate-700 hover:text-navy-600 px-3.5 py-2 rounded-xl hover:bg-navy-50/60 transition-all inline-flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4 text-navy-600" />
              Dashboard
            </Link>

            <a
              href={`https://wa.me/${import.meta.env.VITE_WHATSAPP || '919802020575'}?text=${encodeURIComponent('Hi! I want to check my visa success chances.')}`}
              target="_blank"
              rel="noreferrer"
              className="ml-3 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              WhatsApp Expert
            </a>
          </div>

          {/* Mobile hamburger button */}
          <button
            className="md:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-slate-100 py-4 space-y-1.5 bg-white/95 backdrop-blur-md rounded-b-2xl px-2 shadow-xl">
            {isHome && NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => handleAnchor(e, l.href)}
                className="block px-4 py-2.5 text-slate-800 hover:text-navy-600 hover:bg-navy-50 rounded-xl font-semibold text-sm">
                {l.label}
              </a>
            ))}
            <Link to="/dashboard" onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-slate-800 hover:text-navy-600 hover:bg-navy-50 rounded-xl font-semibold text-sm">
              Dashboard
            </Link>
            <a
              href={`https://wa.me/${import.meta.env.VITE_WHATSAPP || '919802020575'}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 mx-2 mt-3 bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-md"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              WhatsApp Us Now
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
