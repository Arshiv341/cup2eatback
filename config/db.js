const mongoose = require('mongoose');

// Register MongoDB lifecycle listeners
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB Atlas] Disconnected from cluster. Reconnection will be attempted.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB Atlas] Successfully reconnected to cluster.');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB Atlas Connection Error]', err.message);
});

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MONGODB_URI environment variable is required in production.');
      }
      console.warn('[MongoDB Warning] MONGODB_URI is not set. Falling back to local mongodb://127.0.0.1:27017/cuptoeat');
    }

    const uriToConnect = mongoURI || 'mongodb://127.0.0.1:27017/cuptoeat';
    const conn = await mongoose.connect(uriToConnect, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 20,
    });

    console.log(`[MongoDB Atlas] Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Atlas Connection Error] ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    return null;
  }
};

module.exports = connectDB;
