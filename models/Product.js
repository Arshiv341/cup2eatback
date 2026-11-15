const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  flavour: {
    type: String,
    required: true,
    trim: true,
  },
  boxSize: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  originalPrice: {
    type: Number,
    min: 0,
  },
  sku: {
    type: String,
    required: true,
    trim: true,
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  isDeliveryEligible: {
    type: Boolean,
    default: true,
  },
  unitCount: {
    type: Number,
    default: 1,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      default: 'Flavoured Wafer',
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    variants: [variantSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Product', productSchema);
