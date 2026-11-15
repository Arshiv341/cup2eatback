const Order = require('../models/Order');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const Setting = require('../models/Setting');
const emailService = require('../services/emailService');
const { generateInvoicePDF } = require('../services/invoiceService');
const { checkDeliveryEligibility, calculateDeliveryFee } = require('../utils/deliveryCalculator');

// Helper to generate unique order reference
const generateOrderId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `C2E-${dateStr}-${randomSuffix}`;
};

// Create new customer order
const createOrder = async (req, res) => {
  try {
    const { customer, shippingAddress, items, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items cannot be empty' });
    }

    if (!customer?.name || !customer?.email || !customer?.phone) {
      return res.status(400).json({ success: false, message: 'Customer details are required' });
    }

    if (!shippingAddress?.houseNo || !shippingAddress?.city || !shippingAddress?.pincode) {
      return res.status(400).json({ success: false, message: 'Complete delivery address is required' });
    }

    // Load store settings for shipping threshold
    const storeSettings = await Setting.findOne();
    const freeShippingThreshold = storeSettings?.freeShippingThreshold || 499;
    const baseDeliveryFee = storeSettings?.deliveryCharge || 50;

    // Backend price recalculation & stock validation
    let verifiedSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.productName} not found` });
      }

      // Find matching variant
      const variant = product.variants.find(
        (v) => v.sku === item.sku || (v.flavour === item.flavour && v.boxSize === item.boxSize)
      );

      if (!variant) {
        return res.status(400).json({ success: false, message: `Variant for ${item.productName} not found` });
      }

      if (variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} (${variant.flavour}). Only ${variant.stock} units available.`,
        });
      }

      verifiedSubtotal += variant.price * item.quantity;
      verifiedItems.push({
        productId: product._id,
        productName: product.name,
        flavour: variant.flavour,
        boxSize: variant.boxSize,
        sku: variant.sku,
        price: variant.price,
        quantity: item.quantity,
      });
    }

    // Enforce Single Piece Delivery Restriction
    const deliveryCheck = checkDeliveryEligibility(verifiedItems);
    if (!deliveryCheck.eligible) {
      return res.status(400).json({
        success: false,
        message: 'Single Piece orders are not eligible for delivery. Please remove single piece items or select the Full Sealed Box (200 Pieces) for door delivery.',
      });
    }

    // Free delivery strictly for subtotal > freeShippingThreshold (e.g. > 499)
    const shippingFee = calculateDeliveryFee(verifiedSubtotal, baseDeliveryFee, freeShippingThreshold);
    const totalAmount = verifiedSubtotal + shippingFee;
    const orderId = generateOrderId();

    // Create immutable order record
    const order = await Order.create({
      orderId,
      customer: {
        userId: req.user?._id || customer.userId || null,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      items: verifiedItems,
      shippingAddress,
      subtotal: verifiedSubtotal,
      shippingFee,
      totalAmount,
      paymentMethod: paymentMethod || 'online',
      paymentStatus: paymentMethod === 'cod' ? 'Pending' : 'Pending',
      orderStatus: 'Placed',
      orderStatusHistory: [{ status: 'Placed', timestamp: new Date() }],
    });

    // Deduct stock atomically and write inventory logs
    for (const it of verifiedItems) {
      const product = await Product.findOneAndUpdate(
        { _id: it.productId, 'variants.sku': it.sku, 'variants.stock': { $gte: it.quantity } },
        { $inc: { 'variants.$.stock': -it.quantity } },
        { new: true }
      );

      const updatedVariant = product?.variants.find((v) => v.sku === it.sku);
      await InventoryLog.create({
        productId: it.productId,
        sku: it.sku,
        changeAmount: -it.quantity,
        reason: 'order_placed',
        orderId: order.orderId,
        remainingStock: updatedVariant ? updatedVariant.stock : 0,
      });
    }

    // If COD, dispatch confirmation email immediately
    if (paymentMethod === 'cod') {
      await emailService.sendOrderConfirmationEmail(order);
    }

    return res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get orders for current logged in user
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ 'customer.userId': req.user._id }, { 'customer.email': req.user.email }],
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Track order by Order ID (public tracking endpoint with data masking)
const trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      $or: [{ orderId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order reference not found' });
    }

    // Mask sensitive contact details for public tracking
    const orderObj = order.toObject();
    if (orderObj.customer) {
      if (orderObj.customer.phone && orderObj.customer.phone.length > 4) {
        orderObj.customer.phone = '******' + orderObj.customer.phone.slice(-4);
      }
      if (orderObj.customer.email && orderObj.customer.email.includes('@')) {
        const [userPart, domain] = orderObj.customer.email.split('@');
        orderObj.customer.email = userPart.slice(0, 2) + '***@' + domain;
      }
    }

    return res.status(200).json({ success: true, order: orderObj });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Stream PDF invoice
const generateInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { orderId: req.params.id },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found for invoice generation' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Cup2Eat-Invoice-${order.orderId}.pdf`);

    generateInvoicePDF(order, res);
  } catch (err) {
    console.error('Invoice stream error:', err);
    return res.status(500).json({ success: false, message: 'Could not generate invoice' });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  trackOrder,
  generateInvoice,
};
