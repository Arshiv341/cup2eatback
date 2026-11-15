/**
 * Centralized Delivery and Product Pricing Rules for Cup2Eat (Server)
 * 
 * Rules:
 * 1. Single Piece is strictly NOT available for delivery.
 * 2. Orders with subtotal strictly greater than 499 (> 499) qualify for FREE delivery.
 * 3. Orders of 499 or less pay the configured delivery fee (default: 50).
 */

const FREE_DELIVERY_THRESHOLD = 499;
const DEFAULT_DELIVERY_FEE = 50;

/**
 * Checks if a variant or cart item represents a Single Piece unit
 */
function isSinglePieceVariant(item) {
  if (!item) return false;
  const boxSize = (item.boxSize || '').toLowerCase();
  const name = (item.productName || item.name || '').toLowerCase();
  return (
    item.isDeliveryEligible === false ||
    boxSize.includes('single') ||
    name.includes('single piece') ||
    (item.price === 20 && !boxSize.includes('200'))
  );
}

/**
 * Validates delivery eligibility for an array of order items
 * Single Piece cannot be delivered under any circumstances.
 */
function checkDeliveryEligibility(items) {
  if (!items || items.length === 0) {
    return { eligible: true, message: '' };
  }

  const singlePieceItems = items.filter(isSinglePieceVariant);
  if (singlePieceItems.length > 0) {
    return {
      eligible: false,
      singlePieceCount: singlePieceItems.length,
      message: 'Single Piece orders are not eligible for delivery. Please remove single piece items or select the Full Sealed Box (200 Pieces) for door delivery.',
    };
  }

  return { eligible: true, message: '' };
}

/**
 * Calculates delivery fee based on verified subtotal
 * Strictly subtotal > 499 is FREE. 499 or less pays the fee.
 */
function calculateDeliveryFee(subtotal, configuredFee = DEFAULT_DELIVERY_FEE, threshold = FREE_DELIVERY_THRESHOLD) {
  if (subtotal <= 0) return 0;
  return subtotal > threshold ? 0 : configuredFee;
}

module.exports = {
  FREE_DELIVERY_THRESHOLD,
  DEFAULT_DELIVERY_FEE,
  isSinglePieceVariant,
  checkDeliveryEligibility,
  calculateDeliveryFee,
};
