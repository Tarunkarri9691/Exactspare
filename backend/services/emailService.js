import nodemailer from 'nodemailer';
import config from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporterInstance = null;
let isConfigured = false;
let configWarningLogged = false;

/**
 * Initializes and returns the Nodemailer SMTP transporter.
 * Returns null if SMTP configuration is absent or incomplete.
 */
const getTransporter = () => {
  if (transporterInstance) {
    return transporterInstance;
  }

  const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = config.email || {};

  // Check if SMTP is configured
  if (smtpHost && smtpUser && smtpPass) {
    try {
      transporterInstance = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpSecure || false,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });
      isConfigured = true;
      logger.info(`[Email Service] SMTP transporter initialized with host: ${smtpHost}:${smtpPort}`);
      return transporterInstance;
    } catch (err) {
      logger.error(`[Email Service] Failed to create SMTP transporter: ${err.message}`);
      return null;
    }
  }

  if (!configWarningLogged) {
    logger.info(
      '[Email Service] SMTP configuration not detected. Operating in safe MOCK/LOGGER mode. ' +
      'To enable real email dispatch, set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env'
    );
    configWarningLogged = true;
  }

  return null;
};

/**
 * Send an email using SMTP or simulated logger fallback.
 * Guaranteed never to crash the caller or throw unhandled exceptions.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject line
 * @param {string} options.text - Plain text version
 * @param {string} options.html - Rich HTML version
 * @returns {Promise<{ delivered: boolean, simulated: boolean, messageId?: string, error?: string }>}
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (!to) {
      logger.warn('[Email Service] sendEmail aborted: Recipient email is empty');
      return { delivered: false, simulated: false, error: 'Recipient address required' };
    }

    const transporter = getTransporter();
    const from = config.email?.fromAddress || 'EXACTSPARE <no-reply@exactspare.com>';

    if (transporter && isConfigured) {
      // Send real email via SMTP
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html
      });

      logger.info(`[Email Service] Email dispatched successfully to: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
      return { delivered: true, simulated: false, messageId: info.messageId };
    } else {
      // Mock / Development simulation mode
      const mockMessageId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      logger.info(
        `[Email Service (MOCK)] To: ${to} | Subject: "${subject}" | SimMessageId: ${mockMessageId}\n` +
        `Preview: ${text?.substring(0, 160) || 'HTML Email Body'}...`
      );
      return { delivered: false, simulated: true, messageId: mockMessageId };
    }
  } catch (error) {
    logger.error(`[Email Service] Delivery failed for ${to} | Subject: "${subject}": ${error.message}`);
    return { delivered: false, simulated: false, error: error.message };
  }
};

/**
 * Wrap an HTML body in the EXACTSPARE branded responsive layout.
 */
const renderEmailTemplate = ({ title, preheader, bodyHtml, actionUrl, actionText }) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; color: #1e293b; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: #0A192F; padding: 24px; text-align: center; }
    .logo { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-decoration: none; }
    .logo span { color: #FF6B00; }
    .content { padding: 32px 24px; }
    .title { font-size: 20px; font-weight: 700; color: #0A192F; margin-top: 0; margin-bottom: 16px; }
    .body-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #FF6B00; color: #ffffff !important; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(255,107,0,0.3); }
    .notice { font-size: 13px; color: #64748b; background-color: #f8fafc; border-left: 4px solid #FF6B00; padding: 12px 16px; margin: 20px 0; }
    .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || title}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 24px 12px;">
    <tr>
      <td align="center">
        <div class="wrapper">
          <div class="header">
            <a href="${config.frontendUrl}" class="logo">EXACT<span>SPARE</span></a>
          </div>
          <div class="content">
            <h1 class="title">${title}</h1>
            <div class="body-text">${bodyHtml}</div>
            ${
              actionUrl && actionText
                ? `<div class="btn-container">
                    <a href="${actionUrl}" class="btn" target="_blank">${actionText}</a>
                  </div>`
                : ''
            }
          </div>
          <div class="footer">
            <p style="margin: 0 0 6px 0;">&copy; ${new Date().getFullYear()} EXACTSPARE — Vehicle Spare Parts Finder & Marketplace</p>
            <p style="margin: 0;">Automated notification. Please do not reply directly to this email.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * 1. Send Welcome Email upon user registration
 */
export const sendWelcomeEmail = async (user) => {
  const title = `Welcome to EXACTSPARE, ${user.name}!`;
  const bodyHtml = `
    <p>Thank you for creating an account with <strong>EXACTSPARE</strong>, your trusted destination for genuine vehicle spare parts and verified suppliers.</p>
    <p>Your account has been registered with the role: <strong>${user.role === 'OWNER' ? 'Shop Owner' : 'Customer'}</strong>.</p>
    <ul>
      <li>Fast AI-assisted and image-based vehicle spare parts search</li>
      <li>Instant price comparisons across verified automotive shops</li>
      <li>Real-time order tracking and delivery status</li>
      <li>Dedicated customer support and ticket assistance</li>
    </ul>
    <p>We're thrilled to have you with us!</p>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Welcome to EXACTSPARE — Your Account is Ready',
    text: `Welcome to EXACTSPARE, ${user.name}! Thank you for creating an account. Start exploring genuine spare parts at ${config.frontendUrl}`,
    html: renderEmailTemplate({
      title,
      preheader: 'Welcome to EXACTSPARE! Your vehicle spare parts journey begins here.',
      bodyHtml,
      actionUrl: `${config.frontendUrl}/login`,
      actionText: 'Log In to EXACTSPARE'
    })
  });
};

/**
 * 2. Send Password Reset Email with secure link
 */
export const sendPasswordResetEmail = async (user, rawToken) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${rawToken}`;
  const title = 'Reset Your EXACTSPARE Password';
  const bodyHtml = `
    <p>Hello ${user.name || 'valued customer'},</p>
    <p>We received a request to reset the password for your EXACTSPARE account (<strong>${user.email}</strong>).</p>
    <p>Click the secure button below to choose a new password. This link is single-use and will expire in <strong>15 minutes</strong> for your security.</p>
    <div class="notice">
      <strong>Didn't request a password reset?</strong> If you did not make this request, please safely ignore this email. Your existing password remains secure.
    </div>
    <p style="font-size: 13px; color: #64748b; word-break: break-all;">
      If the button does not work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #FF6B00;">${resetUrl}</a>
    </p>
  `;

  return sendEmail({
    to: user.email,
    subject: 'EXACTSPARE — Password Reset Request',
    text: `Hello ${user.name || 'User'},\n\nA password reset was requested for your EXACTSPARE account. Use this single-use link (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: renderEmailTemplate({
      title,
      preheader: 'Reset your password for EXACTSPARE. Link valid for 15 minutes.',
      bodyHtml,
      actionUrl: resetUrl,
      actionText: 'Reset Password'
    })
  });
};

/**
 * 3. Send Email Verification Link
 */
export const sendEmailVerificationLink = async (user, rawToken) => {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${rawToken}`;
  const title = 'Verify Your Email Address';
  const bodyHtml = `
    <p>Hello ${user.name},</p>
    <p>Please verify your email address to confirm your EXACTSPARE account and receive order updates seamlessly.</p>
    <p>This verification link will expire in <strong>24 hours</strong>.</p>
    <p style="font-size: 13px; color: #64748b; word-break: break-all;">
      Or visit: <a href="${verifyUrl}" style="color: #FF6B00;">${verifyUrl}</a>
    </p>
  `;

  return sendEmail({
    to: user.email,
    subject: 'EXACTSPARE — Verify Your Email Address',
    text: `Hello ${user.name},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: renderEmailTemplate({
      title,
      preheader: 'Verify your email address for EXACTSPARE.',
      bodyHtml,
      actionUrl: verifyUrl,
      actionText: 'Verify Email Address'
    })
  });
};

/**
 * 4. Send Order Confirmation Email
 */
export const sendOrderConfirmationEmail = async (order, customerEmail, customerName) => {
  const trackingUrl = `${config.frontendUrl}/orders/${order._id || order.id}/tracking`;
  const title = `Order Confirmation #${order._id || order.id}`;
  const itemsHtml = Array.isArray(order.items)
    ? order.items
        .map(
          (item) =>
            `<li style="margin-bottom: 6px;"><strong>${item.name || item.partName || 'Part'}</strong> &times; ${item.quantity} — &#8377;${(item.price * item.quantity).toFixed(2)}</li>`
        )
        .join('')
    : '<li>Spare parts order</li>';

  const bodyHtml = `
    <p>Hi ${customerName || 'Customer'},</p>
    <p>Thank you for your order! We have received your order and the automotive shop is reviewing it.</p>
    <p><strong>Order Summary:</strong></p>
    <ul>${itemsHtml}</ul>
    <p><strong>Total Amount:</strong> &#8377;${(order.totalAmount || 0).toFixed(2)}</p>
    <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Cash on Delivery'}</p>
    <p>You can track the progress of your order in real-time on EXACTSPARE.</p>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Confirmed: #${order._id || order.id} — EXACTSPARE`,
    text: `Hi ${customerName || 'Customer'},\n\nYour order #${order._id || order.id} has been received! Total: Rs. ${(order.totalAmount || 0).toFixed(2)}. Track it here: ${trackingUrl}`,
    html: renderEmailTemplate({
      title,
      preheader: `Your order #${order._id || order.id} is confirmed!`,
      bodyHtml,
      actionUrl: trackingUrl,
      actionText: 'Track Order Status'
    })
  });
};

/**
 * 5. Send Order Status Update Email
 */
export const sendOrderStatusEmail = async (order, customerEmail, customerName, newStatus) => {
  const trackingUrl = `${config.frontendUrl}/orders/${order._id || order.id}/tracking`;
  const title = `Order #${order._id || order.id} Status Update`;
  const bodyHtml = `
    <p>Hi ${customerName || 'Customer'},</p>
    <p>The status of your order <strong>#${order._id || order.id}</strong> has been updated to:</p>
    <div style="background-color: #e0f2fe; border: 1px solid #7dd3fc; padding: 12px 18px; border-radius: 6px; font-size: 16px; font-weight: 700; color: #0369a1; text-align: center; margin: 16px 0;">
      ${newStatus}
    </div>
    <p>Check the live order tracking timeline on EXACTSPARE for full details.</p>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order #${order._id || order.id} is now ${newStatus} — EXACTSPARE`,
    text: `Hi ${customerName || 'Customer'},\n\nYour order #${order._id || order.id} status is now: ${newStatus}. View timeline: ${trackingUrl}`,
    html: renderEmailTemplate({
      title,
      preheader: `Update on your order #${order._id || order.id}: ${newStatus}`,
      bodyHtml,
      actionUrl: trackingUrl,
      actionText: 'View Order Timeline'
    })
  });
};

/**
 * 6. Send Shop Application Status Update Email
 */
export const sendShopApplicationStatusEmail = async (applicantEmail, applicantName, shopName, status, reason) => {
  const isApproved = status === 'APPROVED';
  const title = isApproved ? 'Shop Application Approved!' : 'Shop Application Status Update';
  const bodyHtml = isApproved
    ? `
      <p>Hello ${applicantName},</p>
      <p>Congratulations! Your application to register <strong>${shopName}</strong> on EXACTSPARE has been <strong>APPROVED</strong> by our platform administrator.</p>
      <p>You can now log in to access your Shop Owner Dashboard, list your vehicle spare parts inventory, and fulfill customer orders.</p>
    `
    : `
      <p>Hello ${applicantName},</p>
      <p>Your application to register <strong>${shopName}</strong> on EXACTSPARE has been updated to: <strong>${status}</strong>.</p>
      ${reason ? `<div class="notice"><strong>Admin Remarks:</strong> ${reason}</div>` : ''}
      <p>If you have any questions or would like to submit additional documentation, please contact our support team.</p>
    `;

  return sendEmail({
    to: applicantEmail,
    subject: `EXACTSPARE — Shop Application ${status}: ${shopName}`,
    text: `Hello ${applicantName},\n\nYour shop application for ${shopName} status: ${status}.${reason ? ` Reason: ${reason}` : ''}\nVisit: ${config.frontendUrl}`,
    html: renderEmailTemplate({
      title,
      preheader: `Your shop application for ${shopName} has been ${status.toLowerCase()}.`,
      bodyHtml,
      actionUrl: `${config.frontendUrl}/login`,
      actionText: isApproved ? 'Go to Shop Dashboard' : 'Visit EXACTSPARE'
    })
  });
};

/**
 * 7. Send Subscription Expiry Reminder Email
 */
export const sendSubscriptionExpiryReminderEmail = async (
  ownerEmail,
  ownerName,
  planName,
  expiryDate,
  stage,
  daysRemaining
) => {
  const isExpired = stage === 'EXPIRED';
  const formattedExpiry = expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A';
  
  let subject = '';
  let stageMessage = '';
  let title = '';

  switch (stage) {
    case '7_DAYS':
      subject = 'Your EXACTSPARE subscription expires in 7 days — Renew now';
      stageMessage = 'Your EXACTSPARE subscription expires in 7 days. Renew now to avoid interruption.';
      title = 'Subscription Expiring in 7 Days';
      break;
    case '3_DAYS':
      subject = 'Your EXACTSPARE subscription expires in 3 days — Please renew';
      stageMessage = 'Your subscription expires in 3 days. Please renew your plan.';
      title = 'Subscription Expiring in 3 Days';
      break;
    case '1_DAY':
      subject = 'URGENT: Your EXACTSPARE subscription expires tomorrow';
      stageMessage = 'Your subscription expires tomorrow. Renew now.';
      title = 'Subscription Expiring Tomorrow';
      break;
    case 'EXPIRED':
    default:
      subject = 'Your EXACTSPARE subscription has expired — Renew to restore access';
      stageMessage = 'Your EXACTSPARE subscription has expired. Renew your subscription to restore subscription-based access.';
      title = 'Subscription Expired';
      break;
  }

  const renewalUrl = `${config.frontendUrl}/owner/subscription`;

  const bodyHtml = `
    <p>Hello ${ownerName || 'Store Owner'},</p>
    <div style="background-color: ${isExpired ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${isExpired ? '#fca5a5' : '#fde68a'}; padding: 14px 18px; border-radius: 8px; font-size: 15px; font-weight: 700; color: ${isExpired ? '#991b1b' : '#92400e'}; margin: 16px 0;">
      ${stageMessage}
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Subscription Plan:</td>
        <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${planName || 'Merchant Partner Plan'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Expiry Date:</td>
        <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${formattedExpiry}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Status:</td>
        <td style="padding: 8px 0; font-weight: 700; color: ${isExpired ? '#dc2626' : '#d97706'};">${isExpired ? 'EXPIRED' : `${daysRemaining} day(s) remaining`}</td>
      </tr>
    </table>
    <p>Renew your subscription directly in the Shop Owner Portal to ensure continuous store visibility, active spare parts indexing, and incoming customer enquiries.</p>
  `;

  return sendEmail({
    to: ownerEmail,
    subject,
    text: `Hello ${ownerName || 'Store Owner'},\n\n${stageMessage}\nPlan: ${planName}\nExpiry Date: ${formattedExpiry}\nRenew your subscription here: ${renewalUrl}`,
    html: renderEmailTemplate({
      title,
      preheader: stageMessage,
      bodyHtml,
      actionUrl: renewalUrl,
      actionText: 'Renew Subscription'
    })
  });
};

export default {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailVerificationLink,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendShopApplicationStatusEmail,
  sendSubscriptionExpiryReminderEmail
};
