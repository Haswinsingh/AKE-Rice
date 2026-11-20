import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Award, ShieldCheck, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-forest-green text-gray-200 border-t-2 border-gold pt-16 pb-10 transition-colors duration-200 dark:bg-[#08150e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-gold/20">
          
          {/* Brand & Heritage Story */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold flex-shrink-0">
                <img src="/assets/logo.jpg" alt="AKE Rice" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="brand-font block text-xl font-bold tracking-wider text-gold-light leading-none">
                  AKE RICE
                </span>
                <span className="text-[10px] font-semibold tracking-widest uppercase text-gold">
                  Ashok Kavin Rice
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Authentic Koppampatty Seeraga Samba Rice cultivated with traditional organic care. Renowned for exquisite aroma, tiny tender grain, and authentic Tamil festive biryani perfection.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-gold-light bg-gold/10 px-3 py-2 rounded-lg border border-gold/30">
              <ShieldCheck className="w-4 h-4 text-gold flex-shrink-0" />
              <span>FSSAI License: 22423545000216</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="brand-font text-base font-bold tracking-wider text-gold-light uppercase">
              Quick Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-gray-300 hover:text-gold transition-colors">Home Storefront</Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-300 hover:text-gold transition-colors">Our Heritage & Farms</Link>
              </li>
              <li>
                <Link to="/order" className="text-gray-300 hover:text-gold transition-colors">Order 1KG & 25KG Bags</Link>
              </li>
              <li>
                <Link to="/recipes" className="text-gray-300 hover:text-gold transition-colors">Bilingual Biryani Recipe Guide</Link>
              </li>
              <li>
                <Link to="/feedback" className="text-gray-300 hover:text-gold transition-colors">Customer Reviews & Ratings</Link>
              </li>
              <li>
                <Link to="/account" className="text-gray-300 hover:text-gold transition-colors">Customer Account</Link>
              </li>
            </ul>
          </div>

          {/* Product Highlights */}
          <div className="space-y-4">
            <h4 className="brand-font text-base font-bold tracking-wider text-gold-light uppercase">
              Our Products
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="bg-white/5 p-3 rounded-xl border border-gold/15">
                <strong className="block text-white font-semibold">1 KG Zipper Pouch</strong>
                <span className="text-xs text-gold-light font-bold">₹200 / Pouch</span>
                <p className="text-xs text-gray-400 mt-0.5">Aroma-locked zipper packaging for home feasts.</p>
              </li>
              <li className="bg-white/5 p-3 rounded-xl border border-gold/15">
                <strong className="block text-white font-semibold">25 KG Bulk Bag</strong>
                <span className="text-xs text-gold-light font-bold">₹4,750 (Wholesale ₹190/KG)</span>
                <p className="text-xs text-gray-400 mt-0.5">Heavy-duty woven bag for family & restaurants.</p>
              </li>
            </ul>
          </div>

          {/* Direct Contact & WhatsApp */}
          <div className="space-y-4">
            <h4 className="brand-font text-base font-bold tracking-wider text-gold-light uppercase">
              Direct Contact
            </h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                <span>Koppampatty, Tamil Nadu, India</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gold flex-shrink-0" />
                <a href="https://wa.me/919176049099" target="_blank" rel="noreferrer" className="hover:text-gold transition-colors font-medium">
                  +91 9176049099 (WhatsApp)
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gold flex-shrink-0" />
                <a href="mailto:kaviyansellappan15@gmail.com" className="hover:text-gold transition-colors">
                  kaviyansellappan15@gmail.com
                </a>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://wa.me/919176049099?text=Hello%20AKE%20Rice,%20I%20would%20like%20to%20order%20Koppampatty%20Seeraga%20Samba%20Rice"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald/30 hover:bg-emerald/50 border border-emerald/50 text-white font-bold text-xs uppercase tracking-wider transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald" />
                Message On WhatsApp
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© {new Date().getFullYear()} AKE Rice – Ashok Kavin Rice. All Rights Reserved.</p>
          <p className="flex items-center gap-1.5 text-gray-400">
            Heritage Koppampatty Seeraga Samba Cultivation <Heart className="w-3.5 h-3.5 text-gold" />
          </p>
        </div>
      </div>
    </footer>
  );
}
