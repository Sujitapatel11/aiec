import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const wa = import.meta.env.VITE_WHATSAPP || '919999999999';

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#0f172a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white rounded-xl p-1">
              <img src="/logo.png" alt="AIEC Logo" className="h-12 w-auto object-contain" />
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
            Helping students achieve their global education dreams with AI-powered guidance and expert counseling.
          </p>
          <a
            href={`https://wa.me/${wa}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 mt-5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp Us
          </a>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Explore</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            {[
              { label: 'Destinations', id: 'countries' },
              { label: 'Services', id: 'services' },
              { label: 'AI Assessment', id: 'assessment' },
              { label: 'Testimonials', id: 'testimonials' },
              { label: 'Contact', id: 'contact' },
            ].map((l) => (
              <li key={l.id}>
                <button onClick={() => scrollTo(l.id)} className="hover:text-white transition-colors text-left">
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Contact</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-center gap-2"><span>📧</span> aaradhyainternationaleducation@gmail.com</li>
            <li className="flex items-center gap-2"><span>📞</span> +977 9802020575</li>
            <li className="flex items-center gap-2"><span>📍</span> India</li>
          </ul>
          <div className="mt-5">
            <Link to="/apply" className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Free Assessment →
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} AIEC – Aradhya International Education Consultancy. All rights reserved.
      </div>
    </footer>
  );
}
