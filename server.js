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
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      // Seed initial administrator account safely
      if (adminEmail && adminPassword) {
        const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase().trim() });
        if (!existingAdmin) {
          await User.create({
            name: 'Cup2Eat Admin',
            email: adminEmail.toLowerCase().trim(),
            phone: '9818192575',
            password: adminPassword,
            role: 'admin',
            isVerified: true,
          });
          console.log(`[Auto-Init] Configured admin account initialized: ${adminEmail}`);
        }
      } else if (!isProduction) {
        // Development-only fallback admin
        const devAdminEmail = 'admin@cup2eat.com';
        const existingAdmin = await User.findOne({ email: devAdminEmail });
        if (!existingAdmin) {
          await User.create({
            name: 'Cup2Eat Admin',
            email: devAdminEmail,
            phone: '9818192575',
            password: 'Admin@Cup2Eat2026',
            role: 'admin',
            isVerified: true,
          });
          console.log(`[Auto-Init] Development admin initialized: ${devAdminEmail}`);
        }
      }

      // Initialize default store settings if none exist
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
        console.log('[Auto-Init] Initialized default store configuration.');
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
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/$/, ''))
  : null;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, mobile apps, health checks)
      if (!origin) return callback(null, true);

      // If no CLIENT_URL configured or wildcard, allow all origins
      if (!allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
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

// Root API info endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cup2Eat Backend API is running.',
    health: '/api/health',
    version: '1.0.0',
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    brand: 'Cup2Eat',
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler for undefined API and server routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found on this server.`,
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Internal Server Error]', err.message || err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    success: false,
    message: isProd && (!err.status || err.status === 500)
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal server error occurred.',
  });
});

// Process safety: handle uncaught exceptions and unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`[Cup2Eat Server] Running on http://localhost:${PORT}`);
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('[Server] Graceful shutdown signal received. Closing HTTP server...');
  server.close(async () => {
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('[Server] MongoDB connections closed cleanly.');
    } catch (e) {
      console.error('[Server] Error closing MongoDB during shutdown:', e.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;
