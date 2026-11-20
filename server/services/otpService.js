const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '4', 10);
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '30', 10);
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

/**
 * Generate a cryptographically secure 4-digit OTP
 */
function generateCode() {
  return crypto.randomInt(1000, 10000).toString();
}

/**
 * Hash an OTP code with bcrypt for secure database storage
 */
async function hashOtp(code) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(code.toString(), salt);
}

/**
 * Compare plain OTP code with stored bcrypt hash
 */
async function verifyHashedOtp(plainCode, hashedCode) {
  if (!plainCode || !hashedCode) return false;
  return bcrypt.compare(plainCode.toString(), hashedCode);
}

/**
 * Check if resend cooldown is active (30 seconds)
 */
function isCooldownActive(lastSentAt) {
  if (!lastSentAt) return false;
  const elapsedSeconds = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
  return elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS;
}

/**
 * Calculate remaining cooldown seconds
 */
function getRemainingCooldown(lastSentAt) {
  if (!lastSentAt) return 0;
  const elapsedSeconds = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds));
}

/**
 * Send 4-Digit OTP to registered Admin or Customer email address via Gmail SMTP
 * Generates secure code, hashes it, sends email, and returns hashedCode (NEVER plain code)
 */
async function sendAdminOtp({ email, name, role }) {
  if (!email) {
    throw new Error('Email address is required to dispatch OTP.');
  }

  // 1. Generate cryptographically secure 4-digit code
  const code = generateCode();

  // 2. Hash code using bcrypt for storage
  const hashedCode = await hashOtp(code);

  // 3. Dispatch OTP via Gmail SMTP using Nodemailer
  const sendResult = await emailService.sendAdminOtpEmail({
    email,
    name: name || (role === 'admin' ? 'Administrator' : 'Valued Customer'),
    otp: code,
    role
  });

  if (!sendResult.success) {
    return {
      success: false,
      error: sendResult.error || 'Failed to dispatch email via SMTP gateway.'
    };
  }

  // Strictly return hashedCode - NEVER expose plain code in production
  return {
    success: true,
    hashedCode,
    mock: sendResult.mock || false,
    ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
    messageId: sendResult.messageId
  };
}

/**
 * Verify 4-Digit OTP entered by Admin against stored bcrypt hash
 */
async function verifyAdminOtp(plainOtp, hashedCode) {
  if (!plainOtp || !hashedCode) {
    return { success: false, message: 'Missing OTP code or stored hash.' };
  }

  const isValid = await verifyHashedOtp(plainOtp, hashedCode);
  if (isValid) {
    return { success: true, message: 'OTP verified successfully.' };
  }

  return { success: false, message: 'Invalid OTP code.' };
}

module.exports = {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  MAX_ATTEMPTS,
  generateCode,
  hashOtp,
  verifyHashedOtp,
  isCooldownActive,
  getRemainingCooldown,
  sendAdminOtp,
  verifyAdminOtp
};
