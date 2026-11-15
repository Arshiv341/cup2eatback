const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  trackOrder,
  generateInvoice,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', createOrder); // Allows guest checkout as well as logged-in checkout
router.get('/my-orders', protect, getMyOrders);
router.get('/track/:id', trackOrder);
router.get('/:id/invoice', generateInvoice);

module.exports = router;
