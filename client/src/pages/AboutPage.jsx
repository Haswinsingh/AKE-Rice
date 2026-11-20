import React, { useState } from 'react';
import {
  ShieldCheck, Award, Heart, CheckCircle2,
  Sparkles, Layers, Maximize2, MapPin, Phone, Mail, Clock
} from 'lucide-react';
import LightboxModal from '../components/LightboxModal';

export default function AboutPage() {
  const [lightboxImg, setLightboxImg] = useState(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  const openLightbox = (src, title) => {
    setLightboxImg(src);
    setLightboxTitle(title);
  };

  const galleryImages = [
    { src: '/assets/about_story.jpg', title: 'Generational Harvesting in Koppampatty' },
    { src: '/assets/about_cultivation.jpg', title: 'Lush Organic Seeraga Samba Nursery' },
    { src: '/assets/about_traditional.jpg', title: 'Traditional Grain Winnowing & Sun-Drying' },
    { src: '/assets/about_processing.jpg', title: 'Aroma-Retention Processing Plant' },
    { src: '/assets/manual_packing.jpg', title: 'Careful Quality Inspection & Manual Packing' },
    { src: '/assets/about_biryani.jpg', title: 'Fluffy & Aromatic Koppampatty Biryani Feast' },
    { src: '/assets/time_nursery.jpg', title: 'Sapling Nurturing with Natural Rainwater' },
    { src: '/assets/time_ducks.jpg', title: 'Natural Biological Pest Control in Paddy Fields' },
    { src: '/assets/time_harvest.jpg', title: 'Golden Field Harvest at Full Maturity' },
    { src: '/assets/time_processing.jpg', title: 'Traditional Hulling & Destoning' },
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">

      {/* HEADER BANNER */}
      <section className="bg-gradient-to-b from-forest-green to-deep-green text-white py-16 sm:py-24 text-center border-b border-gold/20">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-gold-light bg-gold/20 px-3.5 py-1.5 rounded-full border border-gold/30">
            Our Heritage & Roots
          </span>
          <h1 className="brand-font text-3xl sm:text-5xl font-bold tracking-tight">
            The Story of AKE Rice & Koppampatty
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Preserving centuries of authentic agricultural wisdom, pure rain-fed soils, and the traditional aroma of Koppampatty Seeraga Samba.
          </p>
        </div>
      </section>

      {/* DETAILED STORY SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
              Origin & Heritage
            </span>
            <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light">
              Where True Seeraga Samba Belongs
            </h2>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
              Koppampatty, nestled in the fertile river-fed agrarian heartland of Tamil Nadu, has long been celebrated for cultivating the finest Seeraga Samba. Unlike common hybrid rice varieties, genuine Koppampatty Seeraga Samba requires a specific climate, mineral-rich red soil, and patient 130–140 days of natural maturity.
            </p>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
              Named after the cumin seed (Seeragam) for its distinctively small, oval-shaped grains, this rice carries an intense, natural floral fragrance that fills your entire home during cooking. It is easily digestible, gentle on the stomach, and rich in natural dietary fiber.
            </p>

            <div className="pt-2 grid grid-cols-2 gap-4 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <div className="flex items-center gap-2 bg-cream dark:bg-dark-card p-3 rounded-xl border border-gold/20">
                <ShieldCheck className="w-4 h-4 text-emerald" />
                <span>Zero Artificial Fragrance</span>
              </div>
              <div className="flex items-center gap-2 bg-cream dark:bg-dark-card p-3 rounded-xl border border-gold/20">
                <CheckCircle2 className="w-4 h-4 text-emerald" />
                <span>Aged 6+ Months for Non-Sticky Cook</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-3xl overflow-hidden border-2 border-gold/40 shadow-2xl group cursor-pointer" onClick={() => openLightbox('/assets/about_story.jpg', 'Koppampatty Farmers')}>
              <img
                src="/assets/about_story.jpg"
                alt="Koppampatty Farmers"
                className="w-full h-80 sm:h-96 object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                <span className="text-white text-sm font-semibold flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-gold" /> Click to view full image
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* HARVESTING & PROCESSING TIMELINE */}
      <section className="bg-forest-green/5 dark:bg-dark-card/50 py-16 border-y border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
              Process & Quality
            </span>
            <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light">
              From Seedling to Your Dining Table
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Every pouch of AKE Rice undergoes an uncompromised 5-step traditional journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gold/30 shadow-md space-y-3">
              <span className="w-8 h-8 rounded-full bg-gold/20 text-forest-green dark:text-gold font-bold flex items-center justify-center text-sm">1</span>
              <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Traditional Sowing</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Heirloom seeds are nurtured in organic nurseries using natural compost and rainwater irrigation.
              </p>
            </div>

            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gold/30 shadow-md space-y-3">
              <span className="w-8 h-8 rounded-full bg-gold/20 text-forest-green dark:text-gold font-bold flex items-center justify-center text-sm">2</span>
              <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Slow Maturity</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Grown for 130+ days without hasty chemical acceleration, building intense essential rice oils.
              </p>
            </div>

            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gold/30 shadow-md space-y-3">
              <span className="w-8 h-8 rounded-full bg-gold/20 text-forest-green dark:text-gold font-bold flex items-center justify-center text-sm">3</span>
              <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Gentle Sun-Drying</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Naturally dried on clean open-air courtyards under gentle morning sunlight to seal the inner starch.
              </p>
            </div>

            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gold/30 shadow-md space-y-3">
              <span className="w-8 h-8 rounded-full bg-gold/20 text-forest-green dark:text-gold font-bold flex items-center justify-center text-sm">4</span>
              <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Destoning & Aging</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Double-destoned and aged in cool granaries so grains remain intact and fluffy when cooked.
              </p>
            </div>

            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gold/30 shadow-md space-y-3">
              <span className="w-8 h-8 rounded-full bg-gold/20 text-forest-green dark:text-gold font-bold flex items-center justify-center text-sm">5</span>
              <h4 className="font-bold text-forest-green dark:text-gold-light text-base">Aroma-Lock Pack</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Sealed in multi-layer zipper pouches that lock in freshness for up to 12 months.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* INTERACTIVE PHOTO GALLERY & LIGHTBOX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
            Visual Journey
          </span>
          <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light">
            Photo Gallery & Farm Life
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Click on any photo to inspect in high-resolution full-screen lightbox.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {galleryImages.map((img, idx) => (
            <div
              key={idx}
              onClick={() => openLightbox(img.src, img.title)}
              className="relative rounded-2xl overflow-hidden border border-gold/30 shadow-md group cursor-pointer aspect-square bg-gray-100 dark:bg-dark-card"
            >
              <img
                src={img.src}
                alt={img.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-3 text-center text-white">
                <Maximize2 className="w-5 h-5 text-gold mb-1" />
                <span className="text-[11px] font-bold line-clamp-2">{img.title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DIRECT CONTACT & LOCATION SECTION */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="bg-white dark:bg-dark-card rounded-3xl border border-gold/30 shadow-xl p-8 sm:p-12 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
              Get In Touch
            </span>
            <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light">
              Contact AKE Rice
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Have questions about bulk orders, wholesale supply, or traditional cooking tips? Connect directly with our team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            <div className="p-5 rounded-2xl bg-cream/50 dark:bg-dark-bg border border-gold/20 space-y-2">
              <MapPin className="w-6 h-6 text-gold" />
              <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">Farm & Mill Location</strong>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Koppampatty, Tiruchirappalli District, Tamil Nadu, India
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-cream/50 dark:bg-dark-bg border border-gold/20 space-y-2">
              <Phone className="w-6 h-6 text-gold" />
              <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">WhatsApp & Orders</strong>
              <a href="https://wa.me/919176049099" target="_blank" rel="noreferrer" className="block text-xs text-emerald hover:underline font-mono font-semibold">
                +91 91760 49099
              </a>
              <span className="text-[11px] text-gray-400 block">+91 84891 07668 (Helpline)</span>
            </div>

            <div className="p-5 rounded-2xl bg-cream/50 dark:bg-dark-bg border border-gold/20 space-y-2">
              <Mail className="w-6 h-6 text-gold" />
              <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">Email Inquiries</strong>
              <a href="mailto:kaviyansellappan15@gmail.com" className="block text-xs text-forest-green dark:text-gold hover:underline font-medium truncate">
                kaviyansellappan15@gmail.com
              </a>
              <span className="text-[11px] text-gray-400 block">Fast response within 24 hours</span>
            </div>

            <div className="p-5 rounded-2xl bg-cream/50 dark:bg-dark-bg border border-gold/20 space-y-2">
              <Clock className="w-6 h-6 text-gold" />
              <strong className="block text-sm font-bold text-forest-green dark:text-gold-light">Operating Hours</strong>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Monday – Saturday<br />8:00 AM – 8:00 PM IST
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={!!lightboxImg}
        src={lightboxImg}
        title={lightboxTitle}
        onClose={() => setLightboxImg(null)}
      />

    </div>
  );
}
