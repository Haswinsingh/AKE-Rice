import React, { useState, useEffect } from 'react';
import { 
  Star, MessageSquare, CheckCircle2, ShieldCheck, 
  Upload, ThumbsUp, Sparkles, Filter 
} from 'lucide-react';
import { feedbackService } from '../services/feedbackService';
import { adminService } from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LightboxModal from '../components/LightboxModal';

export default function FeedbackPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ totalCount: 0, averageRating: 5.0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState('all');

  // Submit Form State
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Zoom lightbox
  const [lightboxImg, setLightboxImg] = useState(null);

  const fetchReviews = () => {
    setLoading(true);
    feedbackService.getPublicFeedback()
      .then(res => {
        if (res.success) {
          setReviews(res.reviews || []);
          setStats({
            totalCount: res.totalCount || 0,
            averageRating: res.averageRating || 5.0,
            distribution: res.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
          });
        }
      })
      .catch(err => {
        showToast('Failed to load reviews', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      const res = await adminService.uploadFile(file);
      if (res.success && res.fileUrl) {
        setPhotoUrl(res.fileUrl);
        showToast('Review photo attached!', 'success');
      }
    } catch (err) {
      showToast('Could not upload image.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !review.trim()) {
      showToast('Please enter your name and review message.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        mobile: mobile.trim() || undefined,
        rating,
        review: review.trim(),
        photo: photoUrl || undefined,
        product: 'Koppampatty Seeraga Samba Rice'
      };

      const res = await feedbackService.createFeedback(payload);
      if (res.success) {
        showToast('Thank you! Your feedback has been published.', 'success');
        setReview('');
        setPhotoUrl('');
        setPhotoPreview(null);
        fetchReviews();
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit feedback.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReviews = filterRating === 'all' 
    ? reviews 
    : reviews.filter(r => Math.round(r.rating) === parseInt(filterRating, 10));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
      
      {/* HEADER */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-gold-dark dark:text-gold">
          Genuine Customer Experience
        </span>
        <h1 className="brand-font text-3xl sm:text-5xl font-bold text-forest-green dark:text-gold-light">
          Customer Reviews & Testimonials
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
          Read genuine experiences from families, caterers, and biryani enthusiasts who cook with Koppampatty Seeraga Samba.
        </p>
      </div>

      {/* RATING BREAKDOWN & SUMMARY CARD */}
      <div className="bg-white dark:bg-dark-card p-6 sm:p-10 rounded-3xl border border-gold/30 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        
        {/* Left: Big Score */}
        <div className="md:col-span-5 text-center md:border-r border-gray-100 dark:border-dark-border md:pr-8 space-y-3">
          <span className="brand-font text-5xl sm:text-6xl font-black text-forest-green dark:text-gold">
            {stats.averageRating}
          </span>
          <div className="flex items-center justify-center gap-1.5 text-gold">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-gold text-gold" />
            ))}
          </div>
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">
            Based on {stats.totalCount} Verified Customer Reviews
          </span>
        </div>

        {/* Right: Star Distribution Bars */}
        <div className="md:col-span-7 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = stats.distribution[stars] || 0;
            const pct = stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0;
            return (
              <div
                key={stars}
                onClick={() => setFilterRating(filterRating === String(stars) ? 'all' : String(stars))}
                className={`flex items-center gap-3 text-xs cursor-pointer p-1 rounded-lg hover:bg-gold/10 transition-colors ${
                  filterRating === String(stars) ? 'bg-gold/15 font-bold' : ''
                }`}
              >
                <span className="w-12 flex items-center gap-1 font-semibold">
                  {stars} <Star className="w-3.5 h-3.5 fill-gold text-gold" />
                </span>
                <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-dark-border overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-gray-500 font-mono">{pct}%</span>
              </div>
            );
          })}
        </div>

      </div>

      {/* TWO COLUMNS: WRITE REVIEW & REVIEWS FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* WRITE A REVIEW FORM */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border-2 border-gold/40 shadow-xl space-y-6 sticky top-28">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-dark-border">
              <MessageSquare className="w-5 h-5 text-gold" />
              <h3 className="brand-font text-xl font-bold text-forest-green dark:text-gold-light">
                Write a Review
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Your Overall Rating:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          (hoverRating || rating) >= s
                            ? 'fill-gold text-gold'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-forest-green dark:text-gold ml-2">
                    {rating} out of 5 Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kaviyan Sellappan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 8489107668 (To link verified purchase badge)"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Your Review Message *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share details on aroma, grain fluffiness, and how your biryani tasted..."
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm focus:outline-none focus:border-gold"
                />
              </div>

              {/* Optional Photo Attachment */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Attach Dish / Pouch Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gold text-xs font-bold text-forest-green dark:text-gold bg-cream dark:bg-dark-bg hover:bg-gold/10 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Attach Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Review attachment"
                      className="w-10 h-10 object-cover rounded-lg border border-gold cursor-pointer"
                      onClick={() => setLightboxImg(photoPreview)}
                    />
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-forest-green hover:bg-deep-green text-gold-light font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting Review...' : 'Publish Customer Review'}
              </button>
            </form>
          </div>
        </div>

        {/* REVIEWS FEED */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="brand-font text-2xl font-bold text-forest-green dark:text-gold-light">
              Customer Experiences ({filteredReviews.length})
            </h3>
            {filterRating !== 'all' && (
              <button
                onClick={() => setFilterRating('all')}
                className="text-xs font-bold text-gold hover:underline"
              >
                Clear Filter ({filterRating} Stars)
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-dark-card p-6 rounded-3xl h-36 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="bg-white dark:bg-dark-card p-12 rounded-3xl border border-gold/30 text-center space-y-3">
              <MessageSquare className="w-12 h-12 text-gold mx-auto" />
              <h4 className="font-bold text-lg text-forest-green dark:text-gold-light">No reviews found</h4>
              <p className="text-xs text-gray-500">Be the first to share your experience with this rating!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((r) => (
                <div
                  key={r.id || r._id}
                  className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-gold/25 shadow-md space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-base font-bold text-forest-green dark:text-gold-light capitalize">
                          {r.name}
                        </strong>
                        {r.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald bg-emerald/15 px-2.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-gold">
                        {[...Array(r.rating || 5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {r.date ? r.date.split(' ')[0] : 'Verified Review'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                    "{r.review}"
                  </p>

                  {/* Photo attachment if available */}
                  {r.photo && (
                    <div className="pt-2">
                      <img
                        src={r.photo}
                        alt="Customer meal"
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl border border-gold/30 shadow-sm cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImg(r.photo)}
                      />
                    </div>
                  )}

                  {/* Admin response if any */}
                  {r.adminResponse && (
                    <div className="p-3.5 rounded-xl bg-forest-green/5 dark:bg-dark-bg border border-gold/20 text-xs space-y-1">
                      <strong className="text-forest-green dark:text-gold block">AKE Rice Response:</strong>
                      <p className="text-gray-600 dark:text-gray-300">{r.adminResponse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={!!lightboxImg}
        src={lightboxImg}
        title="Customer Review Photo"
        onClose={() => setLightboxImg(null)}
      />

    </div>
  );
}
