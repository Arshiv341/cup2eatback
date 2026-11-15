const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Product = require('../models/Product');
const Setting = require('../models/Setting');

dotenv.config();

const realBrandProducts = [
  {
    name: 'Cup2Eat 100 ML Hot Beverage Edible Cup',
    category: '100 ML | HOT',
    description: 'Designed specifically for hot Indian chai, tea, espresso, and filter coffee. Leak-proof for 40+ minutes at high temperatures. Available in Chocolate, Vanilla, and Elaichi flavours.',
    images: [
      '/assets/products/chocolate-cup.svg',
      '/assets/products/vanilla-cup.svg',
      '/assets/products/elaichi-cup.svg',
    ],
    isFeatured: true,
    variants: [
      {
        flavour: 'Chocolate',
        boxSize: '10 Cups Pack',
        price: 249,
        originalPrice: 299,
        sku: 'C2E-100-CHOC-10',
        stock: 120,
      },
      {
        flavour: 'Vanilla',
        boxSize: '10 Cups Pack',
        price: 239,
        originalPrice: 289,
        sku: 'C2E-100-VAN-10',
        stock: 95,
      },
      {
        flavour: 'Elaichi',
        boxSize: '10 Cups Pack',
        price: 229,
        originalPrice: 279,
        sku: 'C2E-100-ELAI-10',
        stock: 110,
      },
      {
        flavour: 'Assorted (3-Flavour Mix)',
        boxSize: 'Bulk 396 Cups (Ref Spec - Pending Conf.)',
        price: 3960,
        originalPrice: 4200,
        sku: 'C2E-100-BULK-396',
        stock: 25,
      },
    ],
  },
  {
    name: 'Cup2Eat 150 ML Cold Beverage & Shake Edible Cup',
    category: '150 ML | COLD',
    description: 'Heavy-gauge edible wafer cup engineered for cold coffee, thick shakes, smoothies, and dessert servings. Completely leak-proof and maintains crispness with cold drinks.',
    images: [
      '/assets/products/cold-cup.svg',
    ],
    isFeatured: true,
    variants: [
      {
        flavour: 'Golden Biscuit',
        boxSize: '10 Cups Pack',
        price: 299,
        originalPrice: 349,
        sku: 'C2E-150-BIS-10',
        stock: 80,
      },
      {
        flavour: 'Golden Biscuit',
        boxSize: 'Bulk 432 Cups (Ref Spec - Pending Conf.)',
        price: 6500,
        originalPrice: 7200,
        sku: 'C2E-150-BULK-432',
        stock: 20,
      },
    ],
  },
  {
    name: 'Cup2Eat Chocolate Coated Gourmet Waffle Cup',
    category: 'Chocolate Coated',
    description: 'Crispy baked wafer with an internal rich chocolate barrier coating. The perfect companion for desserts, cappuccino, and sweet treat lovers.',
    images: [
      '/assets/products/chocolate-cup.svg',
    ],
    isFeatured: true,
    variants: [
      {
        flavour: 'Rich Chocolate Coated',
        boxSize: '10 Cups Pack',
        price: 279,
        originalPrice: 329,
        sku: 'C2E-CHOC-COAT-10',
        stock: 90,
      },
      {
        flavour: 'Rich Chocolate Coated',
        boxSize: 'Bulk 125 Cups (Ref Spec - Pending Conf.)',
        price: 3300,
        originalPrice: 3600,
        sku: 'C2E-CHOC-BULK-125',
        stock: 18,
      },
    ],
  },
];

const seed = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    console.log(`[Seed] Connecting to MongoDB: ${mongoURI}`);
    await mongoose.connect(mongoURI);

    // Update catalog with authentic edible cup representations and specifications
    await Product.deleteMany({});
    await Product.insertMany(realBrandProducts);
    console.log(`[Seed] Updated database with ${realBrandProducts.length} authentic Cup2Eat products.`);

    console.log('[Seed] Database initialization complete!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]', err);
    process.exit(1);
  }
};

seed();
