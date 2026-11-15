const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Setting = require('../models/Setting');
const InventoryLog = require('../models/InventoryLog');
const emailService = require('../services/emailService');

// Admin Metrics
const getMetrics = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments();

    // Calculate revenue from paid or delivered orders
    const paidOrders = await Order.find({
      $or: [{ paymentStatus: 'Paid' }, { orderStatus: 'Delivered' }],
    });
    const totalRevenue = paidOrders.reduce((sum, ord) => sum + ord.totalAmount, 0);
    const paidOrdersCount = paidOrders.length;
    const pendingOrdersCount = await Order.countDocuments({
      orderStatus: { $in: ['Placed', 'Confirmed', 'Processing'] },
    });

    // Group by status
    const allOrders = await Order.find();
    const ordersByStatus = {
      Placed: 0,
      Confirmed: 0,
      Processing: 0,
      Packed: 0,
      Shipped: 0,
      'Out for Delivery': 0,
      Delivered: 0,
      Cancelled: 0,
    };

    allOrders.forEach((o) => {
      if (ordersByStatus[o.orderStatus] !== undefined) {
        ordersByStatus[o.orderStatus]++;
      }
    });

    // Recent orders
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(8);

    // Low stock items
    const storeSettings = await Setting.findOne();
    const lowStockThreshold = storeSettings?.lowStockThreshold || 15;

    const products = await Product.find({ isActive: true });
    const lowStockItems = [];
    products.forEach((p) => {
      p.variants?.forEach((v) => {
        if (v.stock <= lowStockThreshold) {
          lowStockItems.push({
            productId: p._id,
            productName: p.name,
            flavour: v.flavour,
            boxSize: v.boxSize,
            stock: v.stock,
          });
        }
      });
    });

    return res.status(200).json({
      success: true,
      metrics: {
        totalOrders,
        paidOrdersCount,
        pendingOrdersCount,
        totalCustomers,
        totalProducts,
        totalRevenue,
        lowStockCount: lowStockItems.length,
        ordersByStatus,
        recentOrders,
        lowStockItems,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// All Orders
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update order status with stock restoration on cancellation & automated customer notification
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const previousStatus = order.orderStatus;
    order.orderStatus = status;
    order.orderStatusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Fulfillment status changed to ${status}`,
    });

    // If order was cancelled and previous status wasn't cancelled, restore variant stock
    if (status === 'Cancelled' && previousStatus !== 'Cancelled') {
      for (const item of order.items) {
        await Product.findOneAndUpdate(
          { _id: item.productId, 'variants.sku': item.sku },
          { $inc: { 'variants.$.stock': item.quantity } }
        );

        await InventoryLog.create({
          productId: item.productId,
          sku: item.sku,
          changeAmount: item.quantity,
          reason: 'order_cancelled',
          orderId: order.orderId,
          remainingStock: 0,
        });
      }
    }

    await order.save();

    // Send customer email update via Resend
    await emailService.sendOrderStatusEmail(order, status);

    return res.status(200).json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Customer accounts with order statistics
const getCustomers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    // Aggregate orders per customer
    const customersWithStats = await Promise.all(
      users.map(async (u) => {
        const userOrders = await Order.find({
          $or: [{ 'customer.userId': u._id }, { 'customer.email': u.email }],
        });

        const totalSpent = userOrders
          .filter((o) => o.paymentStatus === 'Paid' || o.orderStatus === 'Delivered')
          .reduce((sum, o) => sum + o.totalAmount, 0);

        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          createdAt: u.createdAt,
          orderCount: userOrders.length,
          totalSpent,
        };
      })
    );

    return res.status(200).json({ success: true, customers: customersWithStats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Store Settings
const getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({});
    }
    return res.status(200).json({ success: true, settings: setting });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create(req.body);
    } else {
      Object.assign(setting, req.body);
      await setting.save();
    }
    return res.status(200).json({ success: true, settings: setting });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Adjust Variant Inventory
const adjustInventory = async (req, res) => {
  try {
    const { productId, sku, adjustment } = req.body;

    const product = await Product.findOne({ _id: productId, 'variants.sku': sku });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Variant SKU not found' });
    }

    const updated = await Product.findOneAndUpdate(
      { _id: productId, 'variants.sku': sku },
      { $inc: { 'variants.$.stock': adjustment } },
      { new: true }
    );

    const variant = updated.variants.find((v) => v.sku === sku);

    await InventoryLog.create({
      productId,
      sku,
      changeAmount: adjustment,
      reason: 'manual_adjustment',
      remainingStock: variant ? variant.stock : 0,
    });

    return res.status(200).json({ success: true, variant });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getMetrics,
  getOrders,
  updateOrderStatus,
  getCustomers,
  getSettings,
  updateSettings,
  adjustInventory,
};
