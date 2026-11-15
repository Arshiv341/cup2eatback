const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const emailService = require('../services/emailService');

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Create Razorpay Order
const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order record not found' });
    }

    const amountInPaise = Math.round(order.totalAmount * 100);

    // If Razorpay SDK is configured with API keys
    if (razorpayInstance) {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.orderId,
        payment_capture: 1,
      };

      const rzpOrder = await razorpayInstance.orders.create(options);
      order.razorpayOrderId = rzpOrder.id;
      await order.save();

      return res.status(200).json({
        success: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amount: amountInPaise,
        currency: 'INR',
      });
    }

    // Development / Test Simulation Mode when credentials are not yet configured in .env
    const simulatedRzpId = `order_test_${Date.now()}`;
    order.razorpayOrderId = simulatedRzpId;
    await order.save();

    return res.status(200).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
      razorpayOrderId: simulatedRzpId,
      amount: amountInPaise,
      currency: 'INR',
      isTestSimulated: true,
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Verify Razorpay Payment Signature
const verifyRazorpaySignature = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, internalOrderId } = req.body;

    const order = await Order.findById(internalOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify cryptographic signature if secret is present
    if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        order.paymentStatus = 'Failed';
        await order.save();
        return res.status(400).json({ success: false, message: 'Payment signature verification failed' });
      }
    }

    // Payment successfully verified
    order.paymentStatus = 'Paid';
    order.orderStatus = 'Confirmed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.orderStatusHistory.push({
      status: 'Confirmed',
      timestamp: new Date(),
      note: `Online payment verified via Razorpay (${razorpay_payment_id})`,
    });

    await order.save();

    // Dispatch automated confirmation email
    await emailService.sendOrderConfirmationEmail(order);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and order confirmed successfully',
      order,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpaySignature,
};
