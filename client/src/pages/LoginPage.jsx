import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Mail, ArrowRight, AlertCircle, 
  CheckCircle2, RefreshCw, ArrowLeft 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const { isAuthenticated, isAdmin, sendOtp, verifyOtp } = useAuth();
  const { showToast } = useToast();

  // Screen state: 'email' | 'otp'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);

  const inputRefs = useRef([]);

  // If already authenticated, redirect to appropriate destination
  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        const dest = redirectParam && redirectParam.startsWith('/admin') ? redirectParam : '/admin';
        navigate(dest, { replace: true });
      } else {
        const dest = redirectParam && !redirectParam.startsWith('/admin') ? redirectParam : '/account';
        navigate(dest, { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, redirectParam, navigate]);

  // Handle 30-second resend cooldown timer
  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // Handle 5-minute OTP expiration countdown timer
  useEffect(() => {
    let timer = null;
    if (step === 'otp' && otpExpiresIn > 0) {
      timer = setInterval(() => {
        setOtpExpiresIn(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, otpExpiresIn]);

  // Email format validation
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isSendDisabled = loading || !isValidEmail;

  // Handle Requesting OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail) {
      const msg = 'Please enter a valid email address.';
      setErrorMsg(msg);
      showToast(msg, 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await sendOtp(cleanEmail);

      if (res && res.success) {
        const masked = res.maskedEmail || cleanEmail;
        setMaskedEmail(masked);
        showToast(res.message || `Verification code sent to ${masked}`, 'success');
        setStep('otp');
        setCooldown(res.cooldownSeconds || 30);
        setOtpExpiresIn(300); // 5 minutes countdown
        setOtpDigits(['', '', '', '']);
        setTimeout(() => {
          if (inputRefs.current[0]) inputRefs.current[0].focus();
        }, 150);
      } else {
        const failMsg = res?.message || 'Failed to dispatch verification code. Please check your email.';
        setErrorMsg(failMsg);
        showToast(failMsg, 'error');
      }
    } catch (err) {
      console.error('[Login OTP Request Failed]:', err);
      let errorText = '';

      if (err.status === 403) {
        errorText = err.data?.message || 'This account has been disabled. Please contact customer support.';
      } else if (err.status === 429) {
        const waitSec = err.data?.remainingSeconds || 30;
        errorText = err.data?.message || `Rate limit active. Please wait ${waitSec} seconds before requesting a new code.`;
        setCooldown(waitSec);
      } else if (err.status === 502) {
        errorText = err.data?.message || 'Email delivery failed. Please verify your email address and try again.';
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        errorText = 'Unable to connect to the server. Please verify your internet connection.';
      } else {
        errorText = err.data?.message || err.message || 'Failed to send verification code. Please try again.';
      }

      setErrorMsg(errorText);
      showToast(errorText, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit box input (4 digits)
  const handleDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (!cleaned) {
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // Support pasting 4-digit OTP
    if (cleaned.length > 1) {
      const pastedChars = cleaned.slice(0, 4).split('');
      pastedChars.forEach((ch, i) => {
        if (i < 4) newDigits[i] = ch;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(3, pastedChars.length);
      if (inputRefs.current[nextIndex]) inputRefs.current[nextIndex].focus();
      return;
    }

    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    // Auto-advance to next box
    if (cleaned && index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle backspace navigation between digit boxes
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  // Handle Verifying OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const plainOtp = otpDigits.join('').trim();
    if (plainOtp.length !== 4) {
      setErrorMsg('Please enter all 4 digits of the verification code.');
      showToast('Complete 4-digit code required', 'error');
      return;
    }

    if (otpExpiresIn <= 0) {
      const msg = 'Code has expired (valid for 5 minutes). Please request a new verification code.';
      setErrorMsg(msg);
      showToast(msg, 'error');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      setLoading(true);
      const res = await verifyOtp(cleanEmail, plainOtp);

      if (res && res.success) {
        showToast(res.message || `Welcome, ${res.user?.name || 'Customer'}!`, 'success');
        
        // Dynamic role-based redirection
        if (res.role === 'admin') {
          const dest = redirectParam && (redirectParam.startsWith('/admin') || redirectParam.startsWith('/pos')) ? redirectParam : '/admin';
          navigate(dest, { replace: true });
        } else {
          // Customer: if redirectParam was set (e.g. from Order Now flow), return to it
          const dest = redirectParam && !redirectParam.startsWith('/admin') && !redirectParam.startsWith('/pos') ? redirectParam : '/account';
          navigate(dest, { replace: true });
        }
      } else {
        setErrorMsg(res?.message || 'Invalid or expired verification code.');
      }
    } catch (err) {
      console.error('[Email OTP Verify Failed]:', err);
      let msg = err.data?.message || err.message || 'Verification failed.';
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        msg = 'Unable to connect to the server. Please verify your connection.';
      }
      setErrorMsg(msg);
      showToast(msg, 'error');
      setOtpDigits(['', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-md bg-white dark:bg-dark-card p-8 sm:p-10 rounded-3xl border border-gold/30 shadow-xl space-y-6">

        {/* Brand Logo & Welcome Heading */}
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-gold/40 mx-auto shadow-sm hover:scale-105 transition-transform duration-300">
              <img src="/assets/logo.jpg" alt="AKE Rice" className="w-full h-full object-cover" />
            </div>
          </Link>

          <div className="space-y-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-forest-green dark:text-gold-light">
              {step === 'email' ? 'Welcome to AKE Rice' : 'Enter Verification Code'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {step === 'email' 
                ? 'Sign in to continue your experience' 
                : `We sent a single-use 4-digit code to ${maskedEmail || email}`}
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: EMAIL ADDRESS INPUT */}
        {/* ========================================================================= */}
        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>

              <div className={`relative flex rounded-xl border bg-white dark:bg-dark-bg overflow-hidden transition-all ${
                isValidEmail 
                  ? 'border-emerald ring-1 ring-emerald/30' 
                  : 'border-gray-300 dark:border-dark-border focus-within:border-gold focus-within:ring-1 focus-within:ring-gold'
              }`}>
                <div className="px-3.5 py-3 text-gray-400 flex items-center">
                  <Mail className="w-4 h-4 text-gold-dark dark:text-gold" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="w-full px-2 py-3 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                />
                {isValidEmail && (
                  <div className="pr-3 flex items-center text-emerald">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>

            {/* CONTINUE BUTTON */}
            <button
              type="submit"
              disabled={isSendDisabled}
              className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                isSendDisabled
                  ? 'bg-gray-200 dark:bg-dark-border text-gray-400 cursor-not-allowed'
                  : 'bg-forest-green hover:bg-deep-green text-gold-light border border-gold/40 shadow-sm hover:shadow cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-gold" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 text-gold" />
                </>
              )}
            </button>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center pt-2">
              We'll send a secure single-use verification code to your email.
            </p>
          </form>
        ) : (
          /* ========================================================================= */
          /* STEP 2: 4-DIGIT OTP VERIFICATION */
          /* ========================================================================= */
          <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in">
            {/* Notification & Change Email option */}
            <div className="p-3 rounded-xl bg-forest-green/5 dark:bg-dark-bg border border-gold/20 text-xs flex items-center justify-between text-gray-700 dark:text-gray-300">
              <span className="truncate">{maskedEmail || email}</span>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setErrorMsg('');
                }}
                className="text-xs font-bold text-forest-green dark:text-gold hover:underline flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" /> Change
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 text-center">
                Enter 4-Digit Code
              </label>

              {/* 4 Digit Input Boxes */}
              <div className="grid grid-cols-4 gap-3 max-w-xs mx-auto">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-full h-14 text-center text-2xl font-bold font-mono rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-forest-green dark:text-gold-light focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  />
                ))}
              </div>

              {/* Countdown & Resend Option */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <span className="text-gray-500">
                  {otpExpiresIn > 0 ? (
                    <>
                      Expires in: <strong className="text-forest-green dark:text-gold font-mono font-bold">
                        {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                      </strong>
                    </>
                  ) : (
                    <span className="text-red-500 font-bold">Code expired</span>
                  )}
                </span>

                {cooldown > 0 ? (
                  <span className="text-gray-400 text-[11px]">
                    Resend in <strong className="font-mono text-gold-dark">{cooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="font-bold text-forest-green dark:text-gold hover:underline flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend Code
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 4 || otpExpiresIn <= 0}
              className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                loading || otpDigits.join('').length !== 4 || otpExpiresIn <= 0
                  ? 'bg-gray-200 dark:bg-dark-border text-gray-400 cursor-not-allowed'
                  : 'bg-forest-green hover:bg-deep-green text-gold-light border border-gold/40 shadow-sm hover:shadow cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-gold" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify & Continue</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
