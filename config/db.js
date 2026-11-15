const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cuptoeat';
    
    // Connect with options for high reliability
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB Atlas] Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Atlas Connection Error] ${error.message}`);
    console.warn(`Tip: Ensure your MONGODB_URI in server/.env is valid and your IP is whitelisted in MongoDB Atlas.`);
    // Return null so the server can still run gracefully in demo/development mode
    return null;
  }
};

module.exports = connectDB;
