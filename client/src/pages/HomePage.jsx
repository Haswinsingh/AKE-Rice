import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Utensils, Star, ShieldCheck, Award, 
  Sparkles, ChevronRight, CheckCircle2, ArrowRight, Heart, Phone
} from 'lucide-react';
import { feedbackService } from '../services/feedbackService';
import { productService } from '../services/productService';
import { useAuth } from '../context/AuthContext';
import LightboxModal from '../components/LightboxModal';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);

  const getOrderLink = (productId = '1kg', qty = 1) => {
    const target = `/order?product=${encodeURIComponent(productId)}&qty=${qty}`;
    if (!isAuthenticated) {
      return `/login?redirect=${encodeURIComponent(target)}`;
    }
    return target;
  };

  // Dynamic stock calculations from live inventory
  const prod1kg = products.find(p => p.id === '1kg' || p.name === '1 KG Rice');
  const avail1kg = prod1kg?.availableStockKg !== undefined ? prod1kg.availableStockKg : 5000;
  const isOut1kg = prod1kg?.stockStatus === 'OUT OF STOCK' || avail1kg <= 0 || prod1kg?.status === 'Inactive';
  const isLow1kg = !isOut1kg && (avail1kg <= (prod1kg?.lowStockThresholdKg || 200) || prod1kg?.stockStatus === 'LOW STOCK');

  const prod25kg = products.find(p => p.id === '25kg' || p.name === '25 KG Rice');
  const avail25kg = prod25kg?.availableStockKg !== undefined ? prod25kg.availableStockKg : 5000;
  const isOut25kg = prod25kg?.stockStatus === 'OUT OF STOCK' || avail25kg <= 0 || prod25kg?.status === 'Inactive';
  const isLow25kg = !isOut25kg && (avail25kg <= (prod25kg?.lowStockThresholdKg || 200) || prod25kg?.stockStatus === 'LOW STOCK');

  const additionalProducts = products.filter(p => p.id !== '1kg' && p.id !== '25kg' && p.status === 'Active');

  useEffect(() => {
    feedbackService.getPublicFeedback()
      .then(res => {
        if (res.success && res.reviews) {
          setReviews(res.reviews.slice(0, 3));
        }
      })
      .catch(() => {});

    productService.getProducts()
      .then(res => {
        if (res.success && res.products) {
          setProducts(res.products);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-forest-green via-deep-green to-[#0f241a] text-white pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* Subtle patterned gold background overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#c5a85c_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Headlines & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/20 border border-gold/40 text-gold-light text-xs sm:text-sm font-bold uppercase tracking-widest shadow-sm">
                <Sparkles className="w-4 h-4 text-gold" />
                <span>Authentic Koppampatty Heritage Grain</span>
              </div>

              <h1 className="brand-font text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.15]">
                The Fragrance of Tradition, <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-light via-gold to-yellow-400">
                  The Grain of Royalty
                </span>
              </h1>

              <p className="text-base sm:text-lg text-gray-300 max-w-2xl leading-relaxed mx-auto lg:mx-0">
                Directly from the fertile soils of Koppampatty, Tamil Nadu. Hand-harvested, aged to perfection, and renowned for its tiny aromatic grains that absorb rich spices and define the ultimate Seeraga Samba Biryani.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  to={getOrderLink('1kg')}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-gold to-gold-light text-forest-green font-extrabold text-base shadow-xl hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <ShoppingBag className="w-5 h-5 text-forest-green" />
                  <span>Order Koppampatty Rice</span>
                </Link>

                <Link
                  to="/recipes"
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-gold/30 text-white font-bold text-base backdrop-blur-sm transition-all"
                >
                  <Utensils className="w-5 h-5 text-gold-light" />
                  <span>Biryani Recipe Guide</span>
                </Link>

                <a
                  href="https://wa.me/919176049099?text=Hello%20AKE%20Rice,%20I%20would%20like%20to%20order%20Seeraga%20Samba%20Rice"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald/20 hover:bg-emerald/30 border border-emerald/40 text-emerald-300 font-bold text-sm transition-all"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp Us</span>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-gold/20 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gold flex-shrink-0" />
                  <span>100% Traditional</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gold flex-shrink-0" />
                  <span>FSSAI Certified</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-gold flex-shrink-0" />
                  <span>Direct Farm Sourced</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-gold flex-shrink-0 fill-gold" />
                  <span>Intense Fragrance</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Showcase */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="relative w-full max-w-md">
                {/* Glow Backdrop */}
                <div className="absolute -inset-2 bg-gradient-to-r from-gold/30 to-emerald/30 rounded-3xl blur-2xl opacity-60" />

                {/* Main Product Card Visual */}
                <div className="relative overflow-hidden rounded-3xl border-2 border-gold/50 shadow-2xl bg-white/5 backdrop-blur-md p-4 group">
                  <img
                    src="/assets/packet_1kg.jpg"
                    alt="AKE Koppampatty Seeraga Samba Rice 1KG Pouch"
                    className="w-full h-80 sm:h-96 object-cover rounded-2xl shadow-inner group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => setLightboxImg('/assets/packet_1kg.jpg')}
                  />
                  
                  {/* Floating Price Pill */}
                  <div className="absolute bottom-7 left-7 right-7 bg-forest-green/90 backdrop-blur-md border border-gold/40 p-4 rounded-2xl flex items-center justify-between shadow-xl">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gold-light block">
                        Fresh 1 KG Aroma Pouch
                      </span>
                      <strong className="text-2xl font-black text-white">₹195</strong>
                    </div>
                    <button
                      onClick={() => navigate(getOrderLink('1kg'))}
                      className="px-4 py-2 rounded-xl bg-gold text-forest-green font-bold text-xs uppercase tracking-wider hover:bg-gold-light transition-colors"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>

                {/* Additional badge pill */}
                <div className="absolute -top-4 -right-4 bg-deep-green border border-gold px-3.5 py-1.5 rounded-full shadow-lg text-xs font-bold text-gold-light flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-gold fill-gold" />
                  <span>Koppampatty Origin</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PRODUCTS SPOTLIGHT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-extrabold uppercase tracking-widest text-gold-dark dark:text-gold">
            Harvest Options
          </span>
          <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light">
            Available Rice Varieties
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
            Choose between convenient 1 KG zipper home pouches or bulk 25 KG wholesale sacks for grand festivities and family functions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Product 1: 1 KG Rice */}
          <div className="bg-white rounded-3xl border-2 border-gold/30 shadow-xl overflow-hidden flex flex-col hover:border-gold transition-all duration-300 dark:bg-dark-card dark:border-dark-border">
            <div className="relative h-64 sm:h-72 overflow-hidden bg-cream/50">
              <img
                src="/assets/packet_1kg.jpg"
                alt="1 KG Rice"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 cursor-pointer"
                onClick={() => setLightboxImg('/assets/packet_1kg.jpg')}
              />
              <div className="absolute top-4 left-4 bg-forest-green text-gold-light px-3.5 py-1 rounded-full text-xs font-bold border border-gold/40 shadow">
                1 KG Fresh Pouch
              </div>
            </div>
            
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                    1 KG Seeraga Samba Pouch
                  </h3>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 dark:text-gray-400 line-through">₹220</span>
                    <strong className="block text-2xl font-extrabold text-forest-green dark:text-gold">₹195</strong>
                  </div>
                </div>

                {/* Live Stock Availability Badge */}
                <div className="pt-1">
                  {isOut1kg ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      OUT OF STOCK
                    </span>
                  ) : isLow1kg ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      LIMITED STOCK ({avail1kg} KG LEFT)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald/10 text-emerald border border-emerald/20">
                      <span className="w-2 h-2 rounded-full bg-emerald" />
                      IN STOCK ({avail1kg} KG AVAILABLE)
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Packed in an aroma-locking zipper pouch to seal the traditional Koppampatty fragrance. Cook 8 generous servings of authentic fragrant biryani.
                </p>

                <ul className="space-y-2 pt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Aroma-Lock Resealable Zipper Pouch</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Serves 8 adults (approx 125g per serving)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Cash on Delivery & Instant UPI Payment</span>
                  </li>
                </ul>
              </div>

              {isOut1kg ? (
                <button
                  disabled
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gray-200 dark:bg-dark-border text-gray-500 font-bold text-sm cursor-not-allowed"
                >
                  <span>Temporarily Out of Stock</span>
                </button>
              ) : (
                <Link
                  to={getOrderLink('1kg')}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-forest-green hover:bg-deep-green text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
                >
                  <ShoppingBag className="w-4 h-4 text-gold-light" />
                  <span>Order 1 KG Pouch</span>
                </Link>
              )}
            </div>
          </div>

          {/* Product 2: 25 KG Bulk Bag */}
          <div className="bg-white rounded-3xl border-2 border-gold/30 shadow-xl overflow-hidden flex flex-col hover:border-gold transition-all duration-300 dark:bg-dark-card dark:border-dark-border">
            <div className="relative h-64 sm:h-72 overflow-hidden bg-cream/50">
              <img
                src="/assets/packet_25kg.jpg"
                alt="25 KG Bag"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 cursor-pointer"
                onClick={() => setLightboxImg('/assets/packet_25kg.jpg')}
              />
              <div className="absolute top-4 left-4 bg-emerald text-white px-3.5 py-1 rounded-full text-xs font-bold shadow">
                Wholesale Bulk Savings (Save ₹250)
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                    25 KG Wholesale Bulk Sack
                  </h3>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 dark:text-gray-400 line-through">₹5,000</span>
                    <strong className="block text-2xl font-extrabold text-forest-green dark:text-gold">₹4,625</strong>
                    <span className="text-[10px] text-emerald font-bold">Only ₹185 / KG</span>
                  </div>
                </div>

                {/* Live Stock Availability Badge */}
                <div className="pt-1">
                  {isOut25kg ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      OUT OF STOCK
                    </span>
                  ) : isLow25kg ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      LIMITED STOCK ({avail25kg} KG LEFT)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald/10 text-emerald border border-emerald/20">
                      <span className="w-2 h-2 rounded-full bg-emerald" />
                      IN STOCK ({avail25kg} KG AVAILABLE)
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Bulk woven bag straight from our traditional processing mill in Koppampatty. Perfect for catering, wedding feasts, restaurants, and joint families.
                </p>

                <ul className="space-y-2 pt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Heavy-duty moisture resistant woven sack</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Special wholesale discount rate of ₹185/KG</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Fast door delivery across Tamil Nadu</span>
                  </li>
                </ul>
              </div>

              {isOut25kg ? (
                <button
                  disabled
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gray-200 dark:bg-dark-border text-gray-500 font-bold text-sm cursor-not-allowed"
                >
                  <span>Temporarily Out of Stock</span>
                </button>
              ) : (
                <Link
                  to={getOrderLink('25kg')}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-forest-green to-deep-green hover:from-deep-green hover:to-emerald text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
                >
                  <ShoppingBag className="w-4 h-4 text-gold-light" />
                  <span>Order 25 KG Bulk Bag</span>
                </Link>
              )}
            </div>
          </div>

          {/* Dynamic Additional Products from Admin Catalog */}
          {additionalProducts.map(prod => {
            const avail = prod.availableStockKg !== undefined ? prod.availableStockKg : 5000;
            const isOut = prod.stockStatus === 'OUT OF STOCK' || avail <= 0;
            const isLow = !isOut && (avail <= (prod.lowStockThresholdKg || 200) || prod.stockStatus === 'LOW STOCK');
            const imgSrc = prod.image?.startsWith('http') || prod.image?.startsWith('/') ? prod.image : `/${prod.image || 'assets/packet_1kg.jpg'}`;

            return (
              <div key={prod.id} className="bg-white rounded-3xl border-2 border-gold/30 shadow-xl overflow-hidden flex flex-col hover:border-gold transition-all duration-300 dark:bg-dark-card dark:border-dark-border">
                <div className="relative h-64 sm:h-72 overflow-hidden bg-cream/50">
                  <img
                    src={imgSrc}
                    alt={prod.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => setLightboxImg(imgSrc)}
                  />
                  <div className="absolute top-4 left-4 bg-forest-green text-gold-light px-3.5 py-1 rounded-full text-xs font-bold border border-gold/40 shadow">
                    {prod.packageSize}
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
                        {prod.name}
                      </h3>
                      <div className="text-right">
                        <strong className="block text-2xl font-extrabold text-forest-green dark:text-gold">₹{prod.price?.toLocaleString('en-IN')}</strong>
                        <span className="text-[10px] text-emerald font-bold">₹{prod.ratePerKg} / KG</span>
                      </div>
                    </div>

                    {/* Stock badge */}
                    <div className="pt-1">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                          OUT OF STOCK
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                          LIMITED STOCK ({avail} KG LEFT)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald/10 text-emerald border border-emerald/20">
                          <span className="w-2 h-2 rounded-full bg-emerald" />
                          IN STOCK ({avail} KG AVAILABLE)
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {prod.description}
                    </p>
                  </div>

                  {isOut ? (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gray-200 dark:bg-dark-border text-gray-500 font-bold text-sm cursor-not-allowed"
                    >
                      <span>Temporarily Out of Stock</span>
                    </button>
                  ) : (
                    <Link
                      to={getOrderLink(prod.id)}
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-forest-green hover:bg-deep-green text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
                    >
                      <ShoppingBag className="w-4 h-4 text-gold-light" />
                      <span>Order {prod.name}</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </section>

      {/* KOPPAMPATTY HERITAGE SECTION */}
      <section className="bg-forest-green/5 dark:bg-dark-card/50 py-16 border-y border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Gallery Grid */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img
                  src="/assets/about_story.jpg"
                  alt="Harvesting"
                  className="w-full h-48 sm:h-56 object-cover rounded-2xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxImg('/assets/about_story.jpg')}
                />
                <img
                  src="/assets/about_cultivation.jpg"
                  alt="Farming Fields"
                  className="w-full h-36 sm:h-44 object-cover rounded-2xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxImg('/assets/about_cultivation.jpg')}
                />
              </div>
              <div className="space-y-4 pt-6">
                <img
                  src="/assets/about_traditional.jpg"
                  alt="Traditional Winnowing"
                  className="w-full h-36 sm:h-44 object-cover rounded-2xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxImg('/assets/about_traditional.jpg')}
                />
                <img
                  src="/assets/manual_packing.jpg"
                  alt="Manual Packaging"
                  className="w-full h-48 sm:h-56 object-cover rounded-2xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxImg('/assets/manual_packing.jpg')}
                />
              </div>
            </div>

            {/* Story Description */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
                Purity & Heritage
              </span>
              <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light leading-tight">
                Grown with Pure Rainwater & Generational Care in Koppampatty
              </h2>
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                Koppampatty Seeraga Samba Rice is not an ordinary grain. Grown in the nutrient-dense soils of Tamil Nadu, each grain is carefully nurtured by generational farmers who follow traditional, sustainable cultivation.
              </p>
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                When cooked, its miniature round grains stay separate without sticking or breaking, absorbing aromatic ghee, fresh spices, and succulent meats to create the unforgettable biryani aroma that has graced Tamil weddings for centuries.
              </p>

              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 font-bold text-forest-green dark:text-gold hover:text-emerald text-sm transition-colors"
                >
                  <span>Explore the complete AKE Rice story & photo gallery</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DYNAMIC STATISTICS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md text-center space-y-2 dark:bg-dark-card">
            <span className="brand-font text-3xl sm:text-4xl font-extrabold text-forest-green dark:text-gold">100%</span>
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Authentic & Pure</span>
            <p className="text-xs text-gray-600 dark:text-gray-300">Unadulterated Koppampatty single-origin grain</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md text-center space-y-2 dark:bg-dark-card">
            <span className="brand-font text-3xl sm:text-4xl font-extrabold text-forest-green dark:text-gold">5.0 ★</span>
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer Rating</span>
            <p className="text-xs text-gray-600 dark:text-gray-300">Loved for irresistible aroma and fluffy texture</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md text-center space-y-2 dark:bg-dark-card">
            <span className="brand-font text-3xl sm:text-4xl font-extrabold text-forest-green dark:text-gold">1000+</span>
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Festive Feasts</span>
            <p className="text-xs text-gray-600 dark:text-gray-300">Supplied to home cooks and top wedding caterers</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-md text-center space-y-2 dark:bg-dark-card">
            <span className="brand-font text-3xl sm:text-4xl font-extrabold text-forest-green dark:text-gold">12 Mos</span>
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fresh Shelf Life</span>
            <p className="text-xs text-gray-600 dark:text-gray-300">Moisture-sealed packaging preserving aroma</p>
          </div>
        </div>
      </section>

      {/* CUSTOMER REVIEWS PREVIEW */}
      {reviews.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">Customer Love</span>
              <h2 className="brand-font text-2xl sm:text-3xl font-bold text-forest-green dark:text-gold-light">
                What Our Customers Say
              </h2>
            </div>
            <Link
              to="/feedback"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-forest-green hover:text-emerald dark:text-gold"
            >
              <span>View All Customer Reviews</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map(r => (
              <div
                key={r.id || r._id}
                className="bg-white p-6 rounded-3xl border border-gold/30 shadow-md space-y-4 flex flex-col justify-between dark:bg-dark-card"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gold">
                      {[...Array(r.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {r.date ? r.date.split(' ')[0] : 'Verified'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                    "{r.review}"
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 dark:border-dark-border flex items-center justify-between text-xs">
                  <span className="font-bold text-forest-green dark:text-gold-light capitalize">
                    {r.name}
                  </span>
                  <span className="text-[10px] text-emerald font-semibold bg-emerald/10 px-2 py-0.5 rounded-full">
                    Verified Buyer
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* WHATSAPP CALL TO ACTION BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-deep-green to-forest-green p-8 sm:p-12 text-white border-2 border-gold/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-left max-w-xl">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-gold-light bg-gold/20 px-3 py-1 rounded-full">
              Instant Ordering
            </span>
            <h3 className="brand-font text-2xl sm:text-3xl font-bold">
              Prefer to Order Directly on WhatsApp?
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Connect directly with our team on WhatsApp. Share your requirements, address, and receive fast order confirmation.
            </p>
          </div>

          <a
            href="https://wa.me/919176049099?text=Hello%20AKE%20Rice,%20I%20would%20like%20to%20order%20Koppampatty%20Seeraga%20Samba%20Rice"
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 flex items-center gap-3 px-8 py-4 rounded-2xl bg-emerald hover:bg-emerald/90 text-white font-extrabold text-base shadow-xl transition-all hover:scale-105"
          >
            <Phone className="w-5 h-5 text-white" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </section>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={!!lightboxImg}
        src={lightboxImg}
        title="AKE Rice Photo Preview"
        onClose={() => setLightboxImg(null)}
      />

    </div>
  );
}
