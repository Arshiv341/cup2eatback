const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'cuptoeat_dev_super_secret_jwt_key_2026',
    { expiresIn: '30d' }
  );
};

// Register customer & send OTP
const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    // Rate limiting: check if OTP was created in the last 45 seconds
    const recentOtp = await OTP.findOne({
      email: cleanEmail,
      type: 'register',
      expiresAt: { $gt: new Date() },
    });
    if (recentOtp && recentOtp.attempts === 0 && (Date.now() - (recentOtp.expiresAt.getTime() - 15 * 60 * 1000)) < 45000) {
      return res.status(429).json({
        success: false,
        message: 'A verification code was recently sent. Please check your inbox or wait 45 seconds before requesting another.',
      });
    }

    // Generate secure 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert user strictly in UNVERIFIED state
    if (!existingUser) {
      await User.create({
        name,
        email: cleanEmail,
        phone,
        password,
        isVerified: false,
      });
    } else {
      existingUser.name = name;
      existingUser.phone = phone;
      existingUser.password = password;
      existingUser.isVerified = false;
      await existingUser.save();
    }

    // Invalidate previous OTPs for this email
    await OTP.deleteMany({ email: cleanEmail, type: 'register' });
    await OTP.create({
      email: cleanEmail,
      otp: generatedOtp,
      type: 'register',
      attempts: 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
    });

    // Send email via Resend
    const sendResult = await emailService.sendOtpEmail(cleanEmail, generatedOtp, 'register');

    if (!sendResult.success) {
      console.warn(`[OTP Send Notice] Email service notice: ${sendResult.error}`);
    }

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please enter OTP to verify your account.`,
      email: cleanEmail,
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to process registration.' });
  }
};

// Verify OTP - Only this endpoint grants verified status and issues token
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const otpRecord = await OTP.findOne({ email: cleanEmail, type: 'register' });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Verification code not found or already used. Please request a new code.',
      });
    }

    // Expiry check
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteMany({ email: cleanEmail, type: 'register' });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    // Limit failed attempts to 5
    if (otpRecord.attempts >= 5) {
      await OTP.deleteMany({ email: cleanEmail, type: 'register' });
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. For security, this code is invalidated. Please request a new code.',
      });
    }

    if (otpRecord.otp !== cleanOtp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remainingAttempts = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. (${remainingAttempts} attempts remaining)`,
      });
    }

    // Mark user verified
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found' });
    }

    user.isVerified = true;
    await user.save();

    // Critical: delete OTP record so it can NEVER be reused
    await OTP.deleteMany({ email: cleanEmail, type: 'register' });

    // Issue JWT token ONLY now
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Welcome to Cup2Eat!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: true,
      },
    });
  } catch (err) {
    console.error('OTP verification error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// Resend OTP
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found with this email' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified. Please sign in.' });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.deleteMany({ email: cleanEmail, type: 'register' });
    await OTP.create({
      email: cleanEmail,
      otp: generatedOtp,
      type: 'register',
      attempts: 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await emailService.sendOtpEmail(cleanEmail, generatedOtp, 'register');
    return res.status(200).json({ success: true, message: 'A fresh verification code has been dispatched.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to resend code.' });
  }
};

// Login customer or admin - Strictly enforces email verification
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials provided' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials provided' });
    }

    // CRITICAL SECURITY CHECK: Check if email is verified
    if (!user.isVerified) {
      // Generate and send a fresh OTP immediately
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      await OTP.deleteMany({ email: cleanEmail, type: 'register' });
      await OTP.create({
        email: cleanEmail,
        otp: generatedOtp,
        type: 'register',
        attempts: 0,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      await emailService.sendOtpEmail(cleanEmail, generatedOtp, 'register');

      return res.status(403).json({
        success: false,
        isUnverified: true,
        email: cleanEmail,
        message: 'Your email is not verified yet. A verification code has been dispatched to your email. Please enter the code to complete verification.',
      });
    }

    // Only verified users receive a JWT token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: true,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
};

// Get current user profile
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
};

// Forgot Password - request OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account registered with this email' });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.deleteMany({ email: cleanEmail, type: 'reset' });
    await OTP.create({
      email: cleanEmail,
      otp: generatedOtp,
      type: 'reset',
      attempts: 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await emailService.sendOtpEmail(cleanEmail, generatedOtp, 'reset');
    return res.status(200).json({ success: true, message: 'Password recovery code dispatched to your email.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to request reset.' });
  }
};

// Reset Password - verify OTP & update password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const otpRecord = await OTP.findOne({ email: cleanEmail, type: 'reset' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired recovery code' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteMany({ email: cleanEmail, type: 'reset' });
      return res.status(400).json({ success: false, message: 'Recovery code has expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteMany({ email: cleanEmail, type: 'reset' });
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Code invalidated.' });
    }

    if (otpRecord.otp !== cleanOtp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect recovery code entered' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    user.isVerified = true;
    await user.save();

    await OTP.deleteMany({ email: cleanEmail, type: 'reset' });

    return res.status(200).json({ success: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  forgotPassword,
  resetPassword,
};
