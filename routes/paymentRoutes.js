const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyRazorpaySignature,
} = require('../controllers/paymentController');

router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyRazorpaySignature);

module.exports = router;
