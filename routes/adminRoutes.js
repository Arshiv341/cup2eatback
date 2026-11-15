const express = require('express');
const router = express.Router();
const {
  getMetrics,
  getOrders,
  updateOrderStatus,
  getCustomers,
  getSettings,
  updateSettings,
  adjustInventory,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect, adminOnly);

router.get('/metrics', getMetrics);
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.get('/customers', getCustomers);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/inventory/adjust', adjustInventory);

module.exports = router;
