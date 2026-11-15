const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'cuptoeat_dev_super_secret_jwt_key_2026'
    );
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // STRICT CHECK: Unverified accounts cannot access protected routes
    if (!req.user.isVerified) {
      return res.status(403).json({
        success: false,
        isUnverified: true,
        message: 'Account is unverified. Access to protected features is denied.',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin' && req.user.isVerified) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges required.',
    });
  }
};

module.exports = { protect, adminOnly };
