const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

// Auto-seed helper
const Product = require('./models/Product');
const User = require('./models/User');
const Setting = require('./models/Setting');

const app = express();

// Connect to MongoDB Atlas
connectDB().then(async (conn) => {
  if (conn) {
    // Check if initial admin or products need seeding
    try {
      const prodCount = await Product.countDocuments();
      if (prodCount === 0) {
        console.log('[Auto-Init] Database empty. Running initial seeder...');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@cup2eat.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
          await User.create({
            name: 'Cup2Eat Admin',
            email: adminEmail,
            phone: '9818192575',
            password: process.env.ADMIN_PASSWORD || 'Admin@Cup2Eat2026',
            role: 'admin',
            isVerified: true,
          });
          console.log(`[Auto-Init] Admin created: ${adminEmail}`);
        }

        const existingSetting = await Setting.findOne();
        if (!existingSetting) {
          await Setting.create({
            businessEmail: 'support@cup2eat.com',
            contactNumber: '+91 98181 92575',
            whatsappNumber: '919818192575',
            businessAddress: 'Registered Facility & Kitchen Labs, Bengaluru, Karnataka, India',
            deliveryCharge: 50,
            freeShippingThreshold: 499,
            lowStockThreshold: 15,
          });
        }

        const sampleProducts = [
          {
            name: 'Cup2Eat Crispy Edible Waffle Cups',
            category: 'Chocolate Coated',
            description: 'Crispy, baked edible waffle cups coated with a delicious food-grade chocolate barrier. Holds steaming hot chai or coffee for over 40 minutes without leaking.',
            images: [
              'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
            ],
            isFeatured: true,
            variants: [
              { flavour: 'Chocolate Coated', boxSize: '10 Cups Box', price: 249, originalPrice: 299, sku: 'C2E-CHOC-10', stock: 85 },
              { flavour: 'Chocolate Coated', boxSize: '25 Cups Party Pack', price: 549, originalPrice: 650, sku: 'C2E-CHOC-25', stock: 40 },
            ],
          },
          {
            name: 'Cup2Eat Artisan Baked Biscuit Tea Cups',
            category: 'Flavoured Wafer',
            description: 'Infused with aromatic elaichi (cardamom) and baked from multigrain wheat flour. Perfect companion for morning and evening Indian masala chai.',
            images: [
              'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?q=80&w=800&auto=format&fit=crop',
            ],
            isFeatured: true,
            variants: [
              { flavour: 'Cardamom Crunch', boxSize: '10 Cups Box', price: 229, originalPrice: 279, sku: 'C2E-CARD-10', stock: 60 },
              { flavour: 'Cardamom Crunch', boxSize: '25 Cups Party Pack', price: 499, originalPrice: 599, sku: 'C2E-CARD-25', stock: 35 },
            ],
          },
          {
            name: 'Cup2Eat Vanilla Infused Edible Dessert Cups',
            category: 'Vanilla Infused',
            description: 'Subtle sweet vanilla aroma with a golden baked crunch. Ideal for espresso shots, cappuccino, ice cream scoops, fruit custards, and mousse.',
            images: [
              'https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=800&auto=format&fit=crop',
            ],
            isFeatured: true,
            variants: [
              { flavour: 'Vanilla Infused', boxSize: '10 Cups Box', price: 239, originalPrice: 289, sku: 'C2E-VAN-10', stock: 55 },
            ],
          },
          {
            name: 'Cup2Eat Assorted Discovery 24-Pack',
            category: 'Assorted Pack',
            description: 'Can’t decide which flavour to choose? Experience all favourites! Includes 8 Chocolate Coated, 8 Cardamom Crunch, and 8 Vanilla Infused cups.',
            images: [
              'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
            ],
            isFeatured: true,
            variants: [
              { flavour: 'Assorted 3-Flavour Mix', boxSize: '24 Cups Discovery Box', price: 599, originalPrice: 720, sku: 'C2E-ASST-24', stock: 45 },
            ],
          },
        ];

        await Product.insertMany(sampleProducts);
        console.log('[Auto-Init] Initialized default catalog.');
      }
    } catch (e) {
      console.error('[Auto-Init Error]', e.message);
    }
  }
});

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for flexible external images and Razorpay checkout iframe
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting on API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', apiLimiter);

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    brand: 'Cup2Eat',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static build in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Internal Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Cup2Eat Server] Running on http://localhost:${PORT}`);
});

module.exports = app;
