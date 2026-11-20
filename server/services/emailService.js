const nodemailer = require('nodemailer');
const Order = require('../models/Order');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kaviyansellappan15@gmail.com';

/**
 * Create reusable SMTP transporter for Gmail / Custom SMTP
 */
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: {
      user,
      pass
    }
  });
}

/**
 * Build professional branded HTML email for OTP Verification (Unified for Admin & Customer)
 */
function buildOtpEmailHTML({ name, otp, role }) {
  const isAdmin = role === 'admin';
  const subtitle = isAdmin ? 'Administrator Portal Authentication' : 'Account Sign In Verification';
  const heading = isAdmin ? 'AKE Rice Admin Login' : 'Welcome to AKE Rice';
  const greeting = isAdmin ? (name || 'Administrator') : (name || 'Valued Customer');
  const actionText = isAdmin
    ? 'Your single-use verification code to access the AKE Rice Administrator Dashboard is:'
    : 'Your single-use verification code to sign in to your AKE Rice account is:';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isAdmin ? 'AKE Rice Admin Verification Code' : 'AKE Rice Verification Code'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f6f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2d3748;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f6f0; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background: #ffffff; border-radius: 20px; overflow: hidden; border: 2px solid #c5a85c; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
          <!-- Header Banner -->
          <tr>
            <td style="background: #1b4332; padding: 32px 24px; text-align: center;">
              <h1 style="color: #f9d976; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px;">🌾 AKE RICE</h1>
              <p style="color: #ffffff; margin: 6px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">${subtitle}</p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="color: #1b4332; margin: 0 0 12px; font-size: 20px; font-weight: 700;">${heading}</h2>
              <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                Hello <strong>${greeting}</strong>,<br>
                ${actionText}
              </p>
              
              <!-- OTP Box -->
              <div style="background: #f4fbf7; border: 2px dashed #c5a85c; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 38px; font-weight: 800; letter-spacing: 14px; color: #1b4332; font-family: 'Courier New', Courier, monospace; display: inline-block; padding-left: 14px;">${otp}</span>
              </div>
              
              <!-- Security Details -->
              <div style="background: #fcfcfc; border-left: 4px solid #c5a85c; padding: 14px 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0 0 6px; font-size: 12px; color: #2d3748; font-weight: 600;">
                  ⏱️ <strong>This code is valid for 5 minutes.</strong>
                </p>
                <p style="margin: 0 0 6px; font-size: 12px; color: #718096;">
                  🔒 <strong>Do not share this code with anyone.</strong> AKE Rice staff will never ask for your verification code.
                </p>
                <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                  🛡️ If you did not request this code, please ignore this email.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f7fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #718096;">
                AKE Rice – Authentic Koppampatty Seeraga Samba Rice | Automated Business System
              </p>
              <p style="margin: 4px 0 0; font-size: 10px; color: #a0aec0;">
                Secure Notification • Do not reply to this email
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send 4-Digit Login OTP via Gmail SMTP (Supports Admin and Customer)
 */
async function sendAdminOtpEmail({ email, name, otp, role }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const isMockExplicit = (process.env.OTP_MOCK === 'true' || isTest) && !isProduction;
  const isAdmin = role === 'admin';

  if (isMockExplicit) {
    console.log(`\n======================================================`);
    console.log(`📧 [EMAIL OTP - DEV SIMULATION MODE]`);
    console.log(`Recipient: ${email} (${role || 'user'})`);
    console.log(`Template: AKE Rice ${isAdmin ? 'Admin' : 'Customer'} Verification Code`);
    console.log(`======================================================\n`);
    return {
      success: true,
      mock: true
    };
  }

  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!user || !pass) {
    throw new Error('SMTP_USER or SMTP_PASS environment variables are not configured in backend.');
  }

  const transporter = getSmtpTransporter();
  const htmlContent = buildOtpEmailHTML({ name, otp, role });
  const subject = isAdmin ? 'AKE Rice Admin Login Verification Code' : 'Your AKE Rice Verification Code';

  const info = await transporter.sendMail({
    from: `"${isAdmin ? 'AKE Rice Admin' : 'AKE Rice'}" <${user}>`,
    to: email,
    subject: subject,
    text: `AKE Rice Login\n\nYour verification code is:\n${otp}\n\nThis code is valid for 5 minutes.\nDo not share this code with anyone.\nIf you did not request this code, please ignore this email.`,
    html: htmlContent
  });

  console.log(`[EmailService] OTP email dispatched successfully to ${email} (MessageId: ${info.messageId})`);
  return {
    success: true,
    messageId: info.messageId
  };
}

/**
 * Calculate Start & End of current week (Monday to Sunday)
 */
function getCurrentWeekPeriod() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);

  const startOfWeek = new Date(now.setDate(diffToMonday));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startStr = startOfWeek.toISOString().split('T')[0];
  const endStr = endOfWeek.toISOString().split('T')[0];

  const firstJan = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((startOfWeek - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);

  return { startOfWeek, endOfWeek, startStr, endStr, weekNum, year: now.getFullYear() };
}

/**
 * Compile weekly order metrics
 */
async function compileWeeklyOrderMetrics() {
  const period = getCurrentWeekPeriod();

  // Find orders created in the period
  let orders = await Order.find({
    createdAt: { $gte: period.startOfWeek, $lte: period.endOfWeek }
  }).sort({ createdAt: -1 });

  // If none this week, include all recent orders up to 50
  if (orders.length === 0) {
    orders = await Order.find({}).sort({ createdAt: -1 }).limit(50);
  }

  const totalOrders = orders.length;
  const codOrders = orders.filter(o => (o.payment || '').includes('Cash')).length;
  const onlineOrders = orders.filter(o => !(o.payment || '').includes('Cash')).length;
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Order Placed').length;
  const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;
  const totalRevenue = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + (o.total || 0), 0);

  return {
    period,
    totalOrders,
    codOrders,
    onlineOrders,
    deliveredOrders,
    pendingOrders,
    cancelledOrders,
    totalRevenue,
    orders
  };
}

/**
 * Generate formatted HTML email template
 */
function buildEmailReportHTML(metrics) {
  let orderRowsHTML = '';
  if (!metrics.orders || metrics.orders.length === 0) {
    orderRowsHTML = '<tr><td colspan="8" style="text-align:center; padding:12px; color:#777;">No orders recorded for current week.</td></tr>';
  } else {
    metrics.orders.forEach(o => {
      const payStatus = o.paymentStatus || ((o.payment || '').includes('Cash') ? 'Cash on Delivery' : 'Pending Verification');
      orderRowsHTML += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding:8px; font-weight:bold; color:#2c3e50;">${o.id}</td>
          <td style="padding:8px;">${o.name}</td>
          <td style="padding:8px;">${o.mobile}</td>
          <td style="padding:8px;">${o.product} (${o.qty})</td>
          <td style="padding:8px; font-weight:bold; color:#1b4332;">₹${(o.total || 0).toLocaleString('en-IN')}</td>
          <td style="padding:8px;">${o.payment || 'COD'}</td>
          <td style="padding:8px;">${payStatus}</td>
          <td style="padding:8px;">${o.status || 'Pending'}</td>
        </tr>
      `;
    });
  }

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #333333; padding: 22px; border-radius: 8px; border: 1px solid #c5a85c; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 900px; margin: 0 auto;">
      <div style="border-bottom: 2px solid #c5a85c; padding-bottom: 12px; margin-bottom: 18px; text-align: center;">
        <h2 style="color: #1b4332; margin: 0 0 4px 0;">🌾 AKE RICE - WEEKLY BUSINESS & ORDER REPORT</h2>
        <p style="color: #666666; margin: 0; font-size: 0.9rem;">Week Period: <strong>${metrics.period.startStr} - ${metrics.period.endStr}</strong> | Recipient: <strong>${ADMIN_EMAIL}</strong></p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; text-align: center;">
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px;">
          <span style="font-size: 11px; color: #6c757d; text-transform: uppercase; font-weight: bold; display: block;">Total Orders</span>
          <strong style="font-size: 1.4rem; color: #c5a85c;">${metrics.totalOrders}</strong>
        </div>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px;">
          <span style="font-size: 11px; color: #6c757d; text-transform: uppercase; font-weight: bold; display: block;">COD Orders</span>
          <strong style="font-size: 1.4rem; color: #1b4332;">${metrics.codOrders}</strong>
        </div>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px;">
          <span style="font-size: 11px; color: #6c757d; text-transform: uppercase; font-weight: bold; display: block;">Online Orders</span>
          <strong style="font-size: 1.4rem; color: #2980b9;">${metrics.onlineOrders}</strong>
        </div>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px;">
          <span style="font-size: 11px; color: #6c757d; text-transform: uppercase; font-weight: bold; display: block;">Delivered</span>
          <strong style="font-size: 1.4rem; color: #27ae60;">${metrics.deliveredOrders}</strong>
        </div>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px;">
          <span style="font-size: 11px; color: #6c757d; text-transform: uppercase; font-weight: bold; display: block;">Pending</span>
          <strong style="font-size: 1.4rem; color: #e67e22;">${metrics.pendingOrders}</strong>
        </div>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px;">
          <span style="font-size: 11px; color: #6c757d; text-transform: uppercase; font-weight: bold; display: block;">Total Revenue</span>
          <strong style="font-size: 1.4rem; color: #1b4332;">₹${metrics.totalRevenue.toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <h4 style="margin: 15px 0 8px 0; color: #1b4332;">Order Records for This Week:</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
          <thead>
            <tr style="background: #1b4332; color: #ffffff;">
              <th style="padding: 8px;">Order ID</th>
              <th style="padding: 8px;">Customer</th>
              <th style="padding: 8px;">Mobile</th>
              <th style="padding: 8px;">Items</th>
              <th style="padding: 8px;">Total</th>
              <th style="padding: 8px;">Payment</th>
              <th style="padding: 8px;">Pay Status</th>
              <th style="padding: 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${orderRowsHTML}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 25px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; font-size: 0.8rem; color: #777;">
        AKE Rice – Authentic Koppampatty Seeraga Samba Rice | Automated Business System
      </div>
    </div>
  `;
}

/**
 * Dispatch report via nodemailer or mock logging
 */
async function sendWeeklyEmailReport(metrics) {
  const htmlContent = buildEmailReportHTML(metrics);

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const info = await transporter.sendMail({
        from: `"AKE Rice Admin" <${process.env.EMAIL_USER}>`,
        to: ADMIN_EMAIL,
        subject: `🌾 AKE Rice - Weekly Order Report [${metrics.period.startStr} to ${metrics.period.endStr}]`,
        html: htmlContent
      });

      console.log(`[EmailService] Report sent successfully to ${ADMIN_EMAIL}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId, htmlContent };
    } catch (err) {
      console.error(`[EmailService] Error dispatching email:`, err);
      return { success: false, error: err.message, htmlContent };
    }
  } else {
    console.log(`[EmailService] (Development Mode) Report compiled for ${ADMIN_EMAIL}. Real SMTP credentials not configured in .env.`);
    return { success: true, mock: true, htmlContent };
  }
}

module.exports = {
  ADMIN_EMAIL,
  sendAdminOtpEmail,
  buildOtpEmailHTML,
  getCurrentWeekPeriod,
  compileWeeklyOrderMetrics,
  buildEmailReportHTML,
  sendWeeklyEmailReport
};
