const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    changeAmount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      enum: ['order_placed', 'order_cancelled', 'manual_adjustment', 'restock'],
      required: true,
    },
    orderId: {
      type: String,
    },
    remainingStock: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
