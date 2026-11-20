import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Utensils, Users, Printer, Share2, CheckSquare, 
  Square, Sparkles, ShoppingBag, Globe, ChefHat, CheckCircle2
} from 'lucide-react';
import { calculateRecipe } from '../utils/recipesData';

export default function RecipesPage() {
  const [lang, setLang] = useState('en'); // 'en' or 'ta'
  const [biryaniType, setBiryaniType] = useState('chicken');
  const [customName, setCustomName] = useState('');
  const [peopleCount, setPeopleCount] = useState(4);
  const [customPeople, setCustomPeople] = useState('');
  const [checkedSteps, setCheckedSteps] = useState({});

  const activePeople = customPeople && parseInt(customPeople, 10) > 0 
    ? parseInt(customPeople, 10) 
    : peopleCount;

  const recipe = calculateRecipe(biryaniType, activePeople, lang, customName);

  const toggleStep = (index) => {
    setCheckedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const completedCount = Object.values(checkedSteps).filter(Boolean).length;
  const progressPct = Math.round((completedCount / recipe.steps.length) * 100);

  // WhatsApp share recipe text
  const shareOnWhatsApp = () => {
    let text = `🌾 *${recipe.title} Recipe* (Serving ${recipe.people} Guests)\n`;
    text += `Prepared authentically with Koppampatty Seeraga Samba Rice!\n\n`;
    text += `*Key Ingredients:*\n`;
    text += `• Koppampatty Seeraga Samba Rice: ${recipe.riceGrams} g\n`;
    text += `• Water: ${recipe.waterMl} ml (Exact 1:1.5 Ratio)\n`;
    text += `• ${recipe.mainIngredient}: ${recipe.mainQty}${recipe.mainQtySuffix}\n`;
    text += `• Sliced Onions: ${recipe.onionGrams} g\n`;
    text += `• Chopped Tomatoes: ${recipe.tomatoGrams} g\n\n`;
    text += `Order authentic Koppampatty Rice from AKE Rice: https://akerice.in or WhatsApp +91 9176049099`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const biryaniOptions = [
    { id: 'chicken', labelEn: 'Chicken Biryani', labelTa: 'சிக்கன் பிரியாணி' },
    { id: 'mutton', labelEn: 'Mutton Biryani', labelTa: 'மட்டன் பிரியாணி' },
    { id: 'veg', labelEn: 'Plain Vegetable Biryani', labelTa: 'காய்கறி பிரியாணி' },
    { id: 'soya', labelEn: 'Soya Biryani', labelTa: 'சோயா பிரியாணி' },
    { id: 'egg', labelEn: 'Egg Biryani', labelTa: 'முட்டை பிரியாணி' },
    { id: 'mushroom', labelEn: 'Mushroom Biryani', labelTa: 'காளான் பிரியாணி' },
    { id: 'paneer', labelEn: 'Paneer Biryani', labelTa: 'பனீர் பிரியாணி' },
    { id: 'prawn', labelEn: 'Prawn Biryani', labelTa: 'இறால் பிரியாணி' },
    { id: 'fish', labelEn: 'Fish Biryani', labelTa: 'மீன் பிரியாணி' },
    { id: 'custom', labelEn: 'Custom Recipe', labelTa: 'தனிப்பயன் செய்முறை' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      
      {/* HEADER & LANGUAGE SWITCHER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-gold/30">
        <div className="text-center md:text-left space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gold/20 text-forest-green dark:text-gold text-xs font-bold uppercase tracking-widest">
            <ChefHat className="w-4 h-4 text-gold" />
            <span>{lang === 'ta' ? 'பாரம்பரிய சமையல் வழிகாட்டி' : 'Culinary Master Guide'}</span>
          </div>
          <h1 className="brand-font text-3xl sm:text-5xl font-bold text-forest-green dark:text-gold-light">
            {lang === 'ta' ? 'சீரக சம்பா பிரியாணி வழிகாட்டி' : 'Seeraga Samba Biryani Guide'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            {lang === 'ta' 
              ? 'கொப்பம்பட்டி சீரக சம்பா அரிசியுடன் தயாரிக்கப்படும் சுவையான பிரியாணி செய்முறைகள்.' 
              : 'Authentic measurements, spice formulas, and dynamic guest scaling with Koppampatty Seeraga Samba.'}
          </p>
        </div>

        {/* Language Switcher Buttons */}
        <div className="flex items-center gap-2 bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-gold/40 shadow-sm no-print">
          <button
            onClick={() => setLang('en')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              lang === 'en'
                ? 'bg-forest-green text-gold-light shadow'
                : 'text-gray-600 dark:text-gray-300 hover:text-forest-green'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang('ta')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              lang === 'ta'
                ? 'bg-forest-green text-gold-light shadow'
                : 'text-gray-600 dark:text-gray-300 hover:text-forest-green'
            }`}
          >
            தமிழ் (Tamil)
          </button>
        </div>
      </div>

      {/* CONTROLS: BIRYANI SELECTOR & SERVING SCALER */}
      <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/30 shadow-lg space-y-6 no-print">
        <h2 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light flex items-center gap-2">
          <Utensils className="w-5 h-5 text-gold" />
          <span>{lang === 'ta' ? 'உங்கள் செய்முறையைத் தேர்ந்தெடுக்கவும்' : 'Customize Recipe & Servings'}</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Biryani Variety Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              {lang === 'ta' ? 'பிரியாணி வகை:' : 'Select Biryani Variety:'}
            </label>
            <select
              value={biryaniType}
              onChange={(e) => setBiryaniType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm font-semibold text-forest-green dark:text-gold-light focus:outline-none focus:border-gold"
            >
              {biryaniOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {lang === 'ta' ? opt.labelTa : opt.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Name if Custom selected */}
          {biryaniType === 'custom' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                {lang === 'ta' ? 'செய்முறை பெயர்:' : 'Custom Recipe Title:'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ta' ? 'எ.கா. காடை பிரியாணி' : 'e.g. Quail Biryani'}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>
          )}

          {/* Guest Count Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              {lang === 'ta' ? 'நபர்களின் எண்ணிக்கை (Serving Size):' : 'Number of Guests / Servings:'}
            </label>
            <select
              value={customPeople ? 'custom' : peopleCount}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setCustomPeople('50');
                } else {
                  setCustomPeople('');
                  setPeopleCount(parseInt(e.target.value, 10));
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm font-semibold text-forest-green dark:text-gold-light focus:outline-none focus:border-gold"
            >
              <option value={2}>2 {lang === 'ta' ? 'நபர்கள்' : 'People'}</option>
              <option value={4}>4 {lang === 'ta' ? 'நபர்கள் (குடும்பம்)' : 'People (Family)'}</option>
              <option value={6}>6 {lang === 'ta' ? 'நபர்கள்' : 'People'}</option>
              <option value={8}>8 {lang === 'ta' ? 'நபர்கள் (1 KG அரிசி)' : 'People (1 KG Rice)'}</option>
              <option value={10}>10 {lang === 'ta' ? 'நபர்கள்' : 'People'}</option>
              <option value={15}>15 {lang === 'ta' ? 'நபர்கள்' : 'People'}</option>
              <option value={20}>20 {lang === 'ta' ? 'நபர்கள் (2.5 KG அரிசி)' : 'People (2.5 KG Rice)'}</option>
              <option value={50}>50 {lang === 'ta' ? 'நபர்கள் (விசேஷம்)' : 'People (Function)'}</option>
              <option value={100}>100 {lang === 'ta' ? 'நபர்கள் (திருமணம்)' : 'People (Wedding)'}</option>
              <option value="custom">{lang === 'ta' ? 'தனிப்பயன் எண்ணிக்கை (Custom)' : 'Custom Guests...'}</option>
            </select>
          </div>

          {/* Custom Input */}
          {customPeople !== '' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                {lang === 'ta' ? 'தனிப்பயன் நபர்கள் எண்ணிக்கை:' : 'Enter Exact Guests Count:'}
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={customPeople}
                onChange={(e) => setCustomPeople(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
              />
            </div>
          )}

        </div>
      </div>

      {/* RECIPE CARD RESULT */}
      <div className="bg-white dark:bg-dark-card rounded-3xl border-2 border-gold/40 shadow-xl overflow-hidden space-y-8 p-6 sm:p-10">
        
        {/* RECIPE TITLE & HERO HEADER */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pb-8 border-b border-gray-100 dark:border-dark-border">
          <div className="space-y-3 text-center lg:text-left flex-1">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald bg-emerald/10 px-3 py-1 rounded-full">
              {lang === 'ta' ? 'கொப்பம்பட்டி சீரக சம்பா சிறப்பு' : 'Cooked with Koppampatty Seeraga Samba'}
            </span>
            <h2 className="brand-font text-3xl sm:text-4xl font-bold text-forest-green dark:text-gold-light">
              {recipe.title}
            </h2>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1.5 bg-gold/15 text-forest-green dark:text-gold px-3 py-1 rounded-lg">
                <Users className="w-4 h-4 text-gold" />
                {lang === 'ta' ? `${recipe.people} நபர்களுக்கான அளவு` : `Scaled for ${recipe.people} Servings`}
              </span>
              <span className="bg-forest-green/10 dark:bg-dark-border px-3 py-1 rounded-lg">
                {lang === 'ta' ? `அரிசி: ${recipe.riceGrams} கிராம்` : `Rice: ${recipe.riceGrams} g`}
              </span>
              <span className="bg-forest-green/10 dark:bg-dark-border px-3 py-1 rounded-lg">
                {lang === 'ta' ? `தண்ணீர் விகிதம்: 1 : 1.5` : `Water Ratio: 1 : 1.5 (${recipe.waterMl} ml)`}
              </span>
            </div>
          </div>

          <div className="w-48 h-36 rounded-2xl overflow-hidden border-2 border-gold/30 shadow-md flex-shrink-0">
            <img src={recipe.img} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* INGREDIENTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Main Ingredients */}
          <div className="space-y-4 bg-cream/50 dark:bg-dark-bg p-6 rounded-2xl border border-gold/20">
            <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              <span>{lang === 'ta' ? 'முக்கிய பொருட்கள் (Main Ingredients)' : 'Main Ingredients'}</span>
            </h3>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span className="font-semibold text-forest-green dark:text-gold-light">
                  {lang === 'ta' ? 'கொப்பம்பட்டி சீரக சம்பா அரிசி' : 'Koppampatty Seeraga Samba Rice'}
                </span>
                <strong className="text-forest-green dark:text-gold">{recipe.riceGrams} g</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{recipe.mainIngredient}</span>
                <strong>{recipe.mainQty}{recipe.mainQtySuffix}</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{lang === 'ta' ? 'தண்ணீர் (சரியான அளவு)' : 'Water (Exact 1:1.5 ratio)'}</span>
                <strong className="text-blue-600 dark:text-blue-400">{recipe.waterMl} ml</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{lang === 'ta' ? 'வெங்காயம் (நீளமாக நறுக்கியது)' : 'Sliced Onions'}</span>
                <strong>{recipe.onionGrams} g</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{lang === 'ta' ? 'தக்காளி' : 'Tomatoes'}</span>
                <strong>{recipe.tomatoGrams} g</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{lang === 'ta' ? 'இஞ்சி பூண்டு விழுது' : 'Ginger-Garlic Paste'}</span>
                <strong>{recipe.gingerGarlicGrams} g</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{lang === 'ta' ? 'சமையல் எண்ணெய் & நெய்' : 'Cooking Oil & Pure Ghee'}</span>
                <strong>{recipe.oilMl} ml Oil + {recipe.gheeMl} ml Ghee</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-200/60 dark:border-dark-border">
                <span>{lang === 'ta' ? 'புதினா & கொத்தமல்லி' : 'Fresh Mint & Coriander'}</span>
                <strong>{recipe.mintGrams} g Mint / {recipe.corianderGrams} g Coriander</strong>
              </div>

              <div className="flex justify-between py-1.5">
                <span>{lang === 'ta' ? 'தயிர் & எலுமிச்சை சாறு' : 'Curd & Lemon Juice'}</span>
                <strong>{recipe.curdMl} ml Curd / {recipe.lemonJuiceMl} ml Lemon</strong>
              </div>
            </div>
          </div>

          {/* Whole Spices */}
          <div className="space-y-4 bg-cream/50 dark:bg-dark-bg p-6 rounded-2xl border border-gold/20">
            <h3 className="brand-font text-lg font-bold text-forest-green dark:text-gold-light flex items-center gap-2">
              <Utensils className="w-4 h-4 text-gold" />
              <span>{lang === 'ta' ? 'முழு வாசனை மசாலாக்கள் (Whole Spices)' : 'Whole Spices'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              {recipe.spices.map((s, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-white dark:bg-dark-card border border-gold/15 flex items-center justify-between">
                  <span className="truncate pr-2 font-medium">{s.name}</span>
                  <span className="font-bold text-forest-green dark:text-gold flex-shrink-0">{s.qty}</span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-gray-500 pt-2 italic">
              {lang === 'ta'
                ? '* மசாலா பொருட்கள் சீரக சம்பா அரிசியின் நறுமணத்தை தூண்டிவிடும் பாரம்பரிய விகிதத்தில் கணக்கிடப்பட்டுள்ளது.'
                : '* Spices are mathematically balanced so the natural floral fragrance of Seeraga Samba shines through.'}
            </div>
          </div>

        </div>

        {/* COOKING STEPS WITH CHECKLIST */}
        <div className="space-y-6 pt-4 border-t border-gray-100 dark:border-dark-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                {lang === 'ta' ? 'செய்முறை படிகள் (Cooking Steps)' : 'Step-by-Step Cooking Instructions'}
              </h3>
              <span className="text-xs text-gray-500">
                {lang === 'ta' ? 'சமைக்கும் போது ஒவ்வொரு படியையும் குறித்துக் கொள்ளவும்' : 'Check off each step as you cook to ensure dum biryani perfection'}
              </span>
            </div>

            {/* Checklist Progress Bar */}
            <div className="w-full sm:w-64 space-y-1 text-right">
              <span className="text-xs font-bold text-forest-green dark:text-gold">
                {progressPct}% {lang === 'ta' ? 'முடிந்தது' : 'Complete'} ({completedCount}/{recipe.steps.length})
              </span>
              <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-dark-border overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-emerald transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {recipe.steps.map((step, idx) => {
              const isChecked = !!checkedSteps[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isChecked
                      ? 'bg-emerald/10 border-emerald/40 text-gray-400 line-through'
                      : 'bg-white dark:bg-dark-bg border-gold/20 hover:border-gold/50 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <button type="button" className="mt-0.5 flex-shrink-0 text-emerald">
                    {isChecked ? <CheckSquare className="w-5 h-5 text-emerald" /> : <Square className="w-5 h-5 text-gray-400" />}
                  </button>
                  <div className="flex-1 text-sm leading-relaxed">
                    <strong className="mr-2 text-forest-green dark:text-gold-light not-italic">
                      {lang === 'ta' ? `படி ${idx + 1}:` : `Step ${idx + 1}:`}
                    </strong>
                    <span>{step}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ACTIONS: PRINT, WHATSAPP, ORDER */}
        <div className="pt-6 border-t border-gray-100 dark:border-dark-border flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gold/40 text-xs font-bold uppercase tracking-wider text-forest-green dark:text-gold hover:bg-gold/15 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Recipe</span>
            </button>

            <button
              onClick={shareOnWhatsApp}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald hover:bg-emerald/90 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>
          </div>

          <Link
            to="/order"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-gold-light" />
            <span>Order Koppampatty Rice For This Recipe</span>
          </Link>
        </div>

      </div>

    </div>
  );
}
