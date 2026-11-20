const https = require('https');
const http = require('http');

/**
 * Dynamic Environment Variable Resolvers for MSG91 and SMS Gateways
 */
const getSmsProvider = () => (process.env.SMS_PROVIDER || 'msg91').toLowerCase();
const getMsg91AuthKey = () => (process.env.MSG91_AUTH_KEY || process.env.SMS_AUTH_KEY || process.env.SMS_API_KEY || '').trim();
const getMsg91TemplateId = () => (process.env.MSG91_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '').trim();
const getMsg91SenderId = () => (process.env.MSG91_SENDER_ID || process.env.SMS_SENDER_ID || 'AKERCE').trim();
const getMsg91OtpUrl = () => (process.env.MSG91_OTP_URL || process.env.SMS_BASE_URL || 'https://control.msg91.com/api/v5/otp').trim();

/**
 * Standard Indian DLT-Compliant SMS Template for AKE Rice Admin Login
 */
function getOtpMessage(otp) {
  return `AKE Rice Admin Login\n\nYour verification code is: ${otp}\n\nThis code expires in 5 minutes.\nDo not share this code with anyone.`;
}

/**
 * Send HTTP/HTTPS request helper for SMS gateways
 */
function sendGatewayRequest(urlStr, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const reqOpts = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'POST',
        headers: options.headers || {}
      };

      const req = lib.request(reqOpts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', (err) => reject(err));
      if (payload) {
        req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Normalize mobile number to international format for MSG91
 * Always produces: 91 + 10 digits (e.g. 918489107668)
 */
function formatMsg91Mobile(input) {
  if (!input) return '';
  let cleaned = input.toString().replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  if (cleaned.length > 10) {
    return `91${cleaned.slice(-10)}`;
  }
  return `91${cleaned}`;
}

/**
 * Send 4-Digit OTP using Official MSG91 SendOTP API
 * Endpoint: POST https://control.msg91.com/api/v5/otp
 * Query parameters: template_id, mobile, otp_length=4, otp_expiry=5
 * Header: authkey: MSG91_AUTH_KEY
 */
async function sendMsg91Otp({ mobile, customOtp = null }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isMockExplicit = process.env.OTP_MOCK === 'true' && !isProduction;
  const msg91AuthKey = getMsg91AuthKey();
  const msg91TemplateId = getMsg91TemplateId();
  const msg91OtpUrl = getMsg91OtpUrl();
  const msg91SenderId = getMsg91SenderId();
  const otpLength = parseInt(process.env.OTP_LENGTH || '4', 10);
  const otpExpiry = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
  const formattedMobile = formatMsg91Mobile(mobile);
  const cleanMobile = mobile.toString().replace(/\D/g, '').slice(-10);

  // If mock mode is explicitly enabled in development (OTP_MOCK=true)
  if (isMockExplicit) {
    console.log(`\n======================================================`);
    console.log(`📱 [SMS GATEWAY - MSG91 SIMULATION / DEV MODE]`);
    console.log(`Recipient: +91 ${cleanMobile} (MSG91 format: ${formattedMobile})`);
    console.log(`Template ID: ${msg91TemplateId || '6afed56cb96f02aa4c00d273'}`);
    console.log(`OTP Length: ${otpLength} digits | Expiry: ${otpExpiry} minutes`);
    if (customOtp) {
      console.log(`[DEV ONLY - NOT EXPOSED TO CLIENT] Simulated OTP: ${customOtp}`);
    }
    console.log(`======================================================\n`);
    return {
      success: true,
      provider: 'mock',
      mock: true,
      message: 'OTP SMS simulated successfully in development mode.'
    };
  }

  if (!msg91AuthKey) {
    throw new Error('MSG91_AUTH_KEY is missing in backend environment variables.');
  }

  if (!msg91TemplateId) {
    throw new Error('MSG91_TEMPLATE_ID is missing in backend environment variables.');
  }

  const queryParams = new URLSearchParams({
    template_id: msg91TemplateId,
    mobile: formattedMobile,
    otp_length: String(otpLength),
    otp_expiry: String(otpExpiry)
  });

  if (customOtp) {
    queryParams.append('otp', String(customOtp));
  }

  if (msg91SenderId) {
    queryParams.append('sender', msg91SenderId);
  }

  const endpoint = `${msg91OtpUrl}?${queryParams.toString()}`;

  const res = await sendGatewayRequest(endpoint, {
    method: 'POST',
    headers: {
      'authkey': msg91AuthKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }, {});

  const resData = res.data || {};

  if (res.statusCode >= 200 && res.statusCode < 300 && resData.type !== 'error') {
    console.log(`[MSG91 Gateway] 4-digit SMS OTP dispatched successfully to +91 ${cleanMobile} (Request ID: ${resData.request_id || 'OK'}).`);
    return {
      success: true,
      provider: 'msg91',
      mock: false,
      requestId: resData.request_id || 'OK'
    };
  }

  const errMsg = resData.message || (typeof res.raw === 'string' ? res.raw : `HTTP ${res.statusCode}`);
  throw new Error(`MSG91 Error: ${errMsg}`);
}

/**
 * Verify 4-Digit OTP using Official MSG91 VerifyOTP API
 * Endpoint: GET https://control.msg91.com/api/v5/otp/verify?mobile=...&otp=...
 * Header: authkey: MSG91_AUTH_KEY
 */
async function verifyMsg91Otp({ mobile, otp }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isMockExplicit = process.env.OTP_MOCK === 'true' && !isProduction;
  const msg91AuthKey = getMsg91AuthKey();
  const msg91OtpUrl = getMsg91OtpUrl();
  const formattedMobile = formatMsg91Mobile(mobile);
  const cleanOtp = (otp || '').toString().trim();

  if (!cleanOtp || cleanOtp.length !== 4) {
    return {
      success: false,
      message: 'Please provide a valid 4-digit OTP code.'
    };
  }

  // If mock mode is explicitly enabled in development (OTP_MOCK=true)
  if (isMockExplicit) {
    if (cleanOtp === '4321') {
      return {
        success: true,
        mock: true,
        message: 'OTP verified successfully in mock mode.'
      };
    }
    return {
      success: false,
      message: 'Invalid OTP code in mock mode.'
    };
  }

  if (!msg91AuthKey) {
    throw new Error('MSG91_AUTH_KEY is missing in backend environment variables.');
  }

  const verifyBase = msg91OtpUrl.replace(/\/+$/, '') + '/verify';
  const queryParams = new URLSearchParams({
    mobile: formattedMobile,
    otp: cleanOtp
  });
  const endpoint = `${verifyBase}?${queryParams.toString()}`;

  const res = await sendGatewayRequest(endpoint, {
    method: 'GET',
    headers: {
      'authkey': msg91AuthKey,
      'Accept': 'application/json'
    }
  });

  const resData = res.data || {};

  // Check MSG91 response type (MSG91 returns type: "success" or type: "error")
  if (resData.type === 'success' || (typeof resData.message === 'string' && resData.message.toLowerCase().includes('success'))) {
    console.log(`[MSG91 Gateway] OTP successfully verified for +91 ${formattedMobile.slice(-10)}`);
    return {
      success: true,
      message: resData.message || 'OTP verified successfully.'
    };
  }

  console.warn(`[MSG91 Gateway] OTP verification failed for +91 ${formattedMobile.slice(-10)}: ${resData.message || 'OTP not match'}`);
  return {
    success: false,
    message: resData.message || 'Invalid or expired OTP. Please check the code received on your phone and try again.'
  };
}

/**
 * Dispatch SMS via configured provider abstraction
 * Primary official provider: MSG91
 */
async function sendAdminOtpSms({ mobile, otp }) {
  const provider = getSmsProvider();
  if (provider === 'msg91') {
    return sendMsg91Otp({ mobile, customOtp: otp });
  }

  // Fallback providers (fast2sms / twilio)
  const cleanMobile = mobile.toString().replace(/\D/g, '').slice(-10);
  const formattedMsg = getOtpMessage(otp);
  const msg91AuthKey = getMsg91AuthKey();
  const msg91SenderId = getMsg91SenderId();

  try {
    switch (provider) {
      case 'fast2sms': {
        const baseUrl = process.env.SMS_BASE_URL || 'https://www.fast2sms.com/dev/bulkV2';
        const apiKey = process.env.FAST2SMS_API_KEY || msg91AuthKey;
        const payload = {
          route: 'otp',
          variables_values: otp,
          numbers: cleanMobile,
          sender_id: msg91SenderId
        };

        const res = await sendGatewayRequest(baseUrl, {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json'
          }
        }, payload);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return { success: true, provider: 'fast2sms', mock: false };
        }
        throw new Error(`Fast2SMS Error: HTTP ${res.statusCode} - ${JSON.stringify(res.data || res.raw)}`);
      }

      case 'twilio': {
        const accountSid = process.env.TWILIO_ACCOUNT_SID || msg91AuthKey;
        const authToken = process.env.TWILIO_AUTH_TOKEN || '';
        const fromNumber = process.env.TWILIO_PHONE_NUMBER || msg91SenderId;
        const baseUrl = process.env.SMS_BASE_URL || `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const formParams = new URLSearchParams();
        formParams.append('To', `+91${cleanMobile}`);
        formParams.append('From', fromNumber);
        formParams.append('Body', formattedMsg);

        const res = await sendGatewayRequest(baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }, formParams.toString());

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return { success: true, provider: 'twilio', mock: false };
        }
        throw new Error(`Twilio Error: HTTP ${res.statusCode} - ${JSON.stringify(res.data || res.raw)}`);
      }

      default:
        return sendMsg91Otp({ mobile, customOtp: otp });
    }
  } catch (error) {
    console.error(`[SMS Service Error] Provider "${provider}" failed:`, error.message);
    return {
      success: false,
      provider,
      error: error.message
    };
  }
}

module.exports = {
  sendAdminOtpSms,
  sendMsg91Otp,
  verifyMsg91Otp,
  formatMsg91Mobile,
  getOtpMessage,
  getSmsProvider,
  getMsg91AuthKey,
  getMsg91TemplateId,
  getMsg91SenderId,
  getMsg91OtpUrl
};
