const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    businessEmail: { type: String, default: 'support@cup2eat.com' },
    contactNumber: { type: String, default: '+91 98181 92575' },
    whatsappNumber: { type: String, default: '919818192575' },
    businessAddress: {
      type: String,
      default: 'Registered Facility & Kitchen Labs, Bengaluru, Karnataka, India',
    },
    deliveryCharge: { type: Number, default: 50 },
    freeShippingThreshold: { type: Number, default: 499 },
    lowStockThreshold: { type: Number, default: 15 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
