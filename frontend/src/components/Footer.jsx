import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, MessageSquare, ArrowRight } from 'lucide-react';

export default function Footer() {
  const wa = import.meta.env.VITE_WHATSAPP || '919802020575';

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-navy-900 text-white pt-16 pb-8 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        {/* Brand */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl p-2 inline-block">
              <img src="/logo.png" alt="AIEC Logo" className="h-12 w-auto object-contain" />
            </div>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed max-w-md font-sans">
            Aradhya International Education Consultancy — Birgunj, Nepal. Helping students achieve their study abroad dreams with AI-powered profile matching and expert end-to-end guidance.
          </p>
          <div className="pt-2">
            <a
              href={`https://wa.me/${wa}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              Chat with Counselor on WhatsApp
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-display font-bold text-white mb-4 text-xs uppercase tracking-wider text-crimson-400">
            Quick Navigation
          </h4>
          <ul className="space-y-2.5 text-sm text-slate-300 font-sans">
            {[
              { label: 'Study Destinations', id: 'countries' },
              { label: 'Consultancy Services', id: 'services' },
              { label: 'Visa Chance Tool', id: 'assessment' },
              { label: 'Student Testimonials', id: 'testimonials' },
              { label: 'Contact Office', id: 'contact' },
            ].map((l) => (
              <li key={l.id}>
                <button onClick={() => scrollTo(l.id)} className="hover:text-white hover:translate-x-1 transition-all text-left">
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h4 className="font-display font-bold text-white mb-4 text-xs uppercase tracking-wider text-crimson-400">
            Birgunj Head Office
          </h4>
          <ul className="space-y-3 text-sm text-slate-300 font-sans">
            <li className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-crimson-400 flex-shrink-0 mt-0.5" />
              <span className="break-all">aaradhyainternationaleducation@gmail.com</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-crimson-400 flex-shrink-0" />
              <span>+977 9802020575 / 9766350770</span>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-crimson-400 flex-shrink-0 mt-0.5" />
              <span>Ranighat-24, Birgunj, Nepal</span>
            </li>
          </ul>
          <div className="mt-6 flex items-center gap-3">
            <Link to="/apply" className="inline-flex items-center gap-1.5 bg-crimson-600 hover:bg-crimson-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-crimson-600/20">
              Free Assessment <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="https://www.instagram.com/aaradhya_international5"
              target="_blank"
              rel="noreferrer"
              className="w-9 h-9 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-navy-800 pt-6 text-center text-xs text-slate-400 font-sans">
        © {new Date().getFullYear()} AIEC – Aradhya International Education Consultancy Pvt. Ltd. All rights reserved.
      </div>
    </footer>
  );
}
