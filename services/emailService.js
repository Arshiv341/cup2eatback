const { Resend } = require('resend');
const brandConfig = require('../config/brandConfig');

const getResendClient = () => {
  if (process.env.RESEND_API_KEY) {
    return new Resend(process.env.RESEND_API_KEY);
  }
  return null;
};

const getFromEmail = () => {
  return process.env.RESEND_FROM_EMAIL || 'Cup2Eat <onboarding@resend.dev>';
};

/**
 * Send Email OTP for registration or password reset
 */
const sendOtpEmail = async (toEmail, otp, type = 'register') => {
  const isRegister = type === 'register';
  const subject = isRegister
    ? `Cup2Eat — Your Account Verification Code`
    : `Cup2Eat — Password Reset Code`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 20px; color: #1E2922; }
          .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #EAE3D9; overflow: hidden; }
          .header { background: #1B382B; padding: 30px; text-align: center; color: #ffffff; }
          .logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 35px 30px; text-align: center; }
          .title { font-size: 20px; font-weight: 700; color: #1B382B; margin-bottom: 15px; }
          .otp-box { background: #F6F3ED; border: 2px dashed #C8A051; border-radius: 16px; padding: 18px 24px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1B382B; display: inline-block; margin: 20px 0; font-family: monospace; }
          .notice { font-size: 13px; color: #556058; line-height: 1.6; }
          .footer { background: #FBF9F5; padding: 20px; text-align: center; font-size: 11px; color: #8C8075; border-top: 1px solid #EAE3D9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">CUP <span style="color: #D4AF37;">2</span> EAT</div>
            <div style="font-size: 12px; color: #E8EFEA; margin-top: 4px;">100% Edible & Eco-Friendly Tableware</div>
          </div>
          <div class="content">
            <div class="title">${isRegister ? 'Confirm Your Email Address' : 'Password Recovery Request'}</div>
            <p class="notice">
              Use the single-use verification code below to complete your ${isRegister ? 'account registration' : 'password reset'}. This code is valid for 15 minutes.
            </p>
            <div class="otp-box">${otp}</div>
            <p class="notice">
              If you did not request this verification code, you can safely disregard this email.
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} ${brandConfig.BRAND_NAME}. Support: ${brandConfig.SUPPORT_EMAIL}
          </div>
        </div>
      </body>
    </html>
  `;

  const resend = getResendClient();
  if (!resend) {
    console.warn(`[Resend Warning] RESEND_API_KEY is not configured in .env. Email not dispatched.`);
    return { success: false, error: 'Resend API key is not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [toEmail],
      subject,
      html,
    });
    if (error) {
      console.error('[Resend Delivery Error]', error.message || error);
      return { success: false, error: error.message || error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Resend Exception]', err.message || err);
    return { success: false, error: err.message };
  }
};

/**
 * Send Order Confirmation Email
 */
const sendOrderConfirmationEmail = async (order) => {
  const subject = `Cup2Eat Order Confirmed — #${order.orderId}`;

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #F0EBE1; font-size: 13px;">
          <strong>${item.productName}</strong><br>
          <span style="color: #786C62; font-size: 11px;">${item.flavour} • ${item.boxSize}</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #F0EBE1; text-align: center; font-size: 13px;">${item.quantity}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #F0EBE1; text-align: right; font-size: 13px; font-weight: bold;">₹${item.price * item.quantity}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 20px; color: #1E2922; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #EAE3D9; overflow: hidden; }
          .header { background: #1B382B; padding: 30px; text-align: center; color: #ffffff; }
          .content { padding: 30px; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .footer { background: #FBF9F5; padding: 20px; text-align: center; font-size: 11px; color: #8C8075; border-top: 1px solid #EAE3D9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 26px;">CUP <span style="color: #D4AF37;">2</span> EAT</h1>
            <p style="margin: 5px 0 0; font-size: 13px; color: #E8EFEA;">Order Confirmation #${order.orderId}</p>
          </div>
          <div class="content">
            <h2 style="font-size: 18px; color: #1B382B;">Hello ${order.customer.name},</h2>
            <p style="font-size: 13px; color: #556058; line-height: 1.6;">
              Thank you for ordering Cup2Eat edible wafer cups! Your order has been placed and is being prepared with high-grade food safe packaging.
            </p>
            <table class="table">
              <thead>
                <tr style="border-bottom: 2px solid #EAE3D9; text-align: left; font-size: 12px; color: #8C8075;">
                  <th style="padding-bottom: 8px;">Product & Flavour</th>
                  <th style="padding-bottom: 8px; text-align: center;">Qty</th>
                  <th style="padding-bottom: 8px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div style="text-align: right; font-size: 14px; font-weight: bold; margin-top: 10px; color: #1B382B;">
              Grand Total: ₹${order.totalAmount} (${order.paymentMethod.toUpperCase()})
            </div>
            <div style="margin-top: 25px; padding: 15px; background: #F6F3ED; border-radius: 12px; font-size: 12px;">
              <strong>Delivery Address:</strong><br>
              ${order.shippingAddress.houseNo}, ${order.shippingAddress.street}<br>
              ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}
            </div>
          </div>
          <div class="footer">
            Need assistance? Reach us at ${brandConfig.SUPPORT_EMAIL} or on WhatsApp at ${brandConfig.WHATSAPP_NUMBER}
          </div>
        </div>
      </body>
    </html>
  `;

  const resend = getResendClient();
  if (!resend) return { success: false, error: 'Resend API key not configured' };

  try {
    return await resend.emails.send({
      from: getFromEmail(),
      to: [order.customer.email],
      subject,
      html,
    });
  } catch (err) {
    console.error('[Resend Error]', err);
    return { success: false, error: err.message };
  }
};

/**
 * Send Order Status Update Email (Shipped, Delivered, etc.)
 */
const sendOrderStatusEmail = async (order, newStatus) => {
  const subject = `Cup2Eat Update: Order #${order.orderId} is now ${newStatus}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background: #FAF8F5; padding: 20px;">
        <div style="max-width: 550px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 16px; border: 1px solid #EAE3D9;">
          <h2 style="color: #1B382B; margin-top: 0;">Cup2Eat Order Update</h2>
          <p>Hello ${order.customer.name},</p>
          <p>Your Order <strong>#${order.orderId}</strong> has been updated to:</p>
          <div style="background: #F6F3ED; border-left: 4px solid #C8A051; padding: 15px; border-radius: 8px; font-weight: bold; color: #1B382B; margin: 15px 0;">
            Current Status: ${newStatus}
          </div>
          <p style="font-size: 13px; color: #556058;">
            Track your order anytime by visiting your customer dashboard or contacting us on WhatsApp.
          </p>
        </div>
      </body>
    </html>
  `;

  const resend = getResendClient();
  if (!resend) return { success: false, error: 'Resend API key not configured' };

  try {
    return await resend.emails.send({
      from: getFromEmail(),
      to: [order.customer.email],
      subject,
      html,
    });
  } catch (err) {
    console.error('[Resend Error]', err);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendOtpEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
};
