const PDFDocument = require('pdfkit');
const brandConfig = require('../config/brandConfig');

const generateInvoicePDF = (order, stream) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.pipe(stream);

  // Brand Header
  doc
    .fillColor('#422A1C')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('Cup2Eat', 50, 45);

  doc
    .fillColor('#D97706')
    .fontSize(10)
    .font('Helvetica')
    .text('100% Edible & Eco-Friendly Tableware', 50, 72);

  doc
    .fillColor('#64748B')
    .fontSize(9)
    .text(brandConfig.BUSINESS_ADDRESS, 50, 85)
    .text(`Email: ${brandConfig.SUPPORT_EMAIL} | Phone: ${brandConfig.SUPPORT_PHONE}`, 50, 98);

  // Invoice Meta on Right
  doc
    .fillColor('#422A1C')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('TAX INVOICE', 400, 45, { align: 'right' });

  const invoiceNo = order.invoiceNumber || `INV-${order.orderId}`;
  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  doc
    .fillColor('#334155')
    .fontSize(9)
    .font('Helvetica')
    .text(`Invoice No: ${invoiceNo}`, 400, 68, { align: 'right' })
    .text(`Order ID: #${order.orderId}`, 400, 82, { align: 'right' })
    .text(`Date: ${invoiceDate}`, 400, 96, { align: 'right' });

  doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 125).lineTo(550, 125).stroke();

  // Billed To / Shipping Details
  doc
    .fillColor('#422A1C')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Billed & Shipped To:', 50, 140);

  doc
    .fillColor('#334155')
    .fontSize(9)
    .font('Helvetica')
    .text(order.customer.name, 50, 156)
    .text(`Phone: ${order.customer.phone}`, 50, 169)
    .text(`Email: ${order.customer.email}`, 50, 182)
    .text(
      `${order.shippingAddress.houseNo}, ${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`,
      50,
      195,
      { width: 300 }
    );

  // Payment Status Box
  doc
    .rect(400, 140, 150, 65)
    .fillAndStroke('#FAF8F5', '#EAE3D9');

  doc
    .fillColor('#422A1C')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Payment Information', 410, 148);

  doc
    .fillColor('#64748B')
    .fontSize(8)
    .font('Helvetica')
    .text(`Method: ${order.paymentMethod.toUpperCase()}`, 410, 164)
    .text(`Status: ${order.paymentStatus}`, 410, 177)
    .text(`Fulfillment: ${order.orderStatus}`, 410, 190);

  // Table Header
  const tableTop = 240;
  doc
    .rect(50, tableTop, 500, 24)
    .fill('#422A1C');

  doc
    .fillColor('#FFFFFF')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Item Description', 60, tableTop + 7)
    .text('Flavour & Pack', 230, tableTop + 7)
    .text('Rate', 380, tableTop + 7, { width: 50, align: 'right' })
    .text('Qty', 440, tableTop + 7, { width: 30, align: 'center' })
    .text('Amount', 480, tableTop + 7, { width: 60, align: 'right' });

  // Table Rows
  let y = tableTop + 30;
  order.items.forEach((item, index) => {
    const bg = index % 2 === 0 ? '#FFFFFF' : '#FAF8F5';
    doc.rect(50, y - 5, 500, 22).fill(bg);

    doc
      .fillColor('#1E293B')
      .fontSize(9)
      .font('Helvetica')
      .text(item.productName, 60, y, { width: 160 })
      .text(`${item.flavour} (${item.boxSize})`, 230, y, { width: 140 })
      .text(`INR ${item.price.toFixed(2)}`, 380, y, { width: 50, align: 'right' })
      .text(item.quantity.toString(), 440, y, { width: 30, align: 'center' })
      .text(`INR ${(item.price * item.quantity).toFixed(2)}`, 480, y, { width: 60, align: 'right' });

    y += 24;
  });

  doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, y + 5).lineTo(550, y + 5).stroke();

  // Summary Totals on Right
  const totalsTop = y + 15;
  doc
    .fillColor('#64748B')
    .fontSize(9)
    .font('Helvetica')
    .text('Items Subtotal:', 350, totalsTop, { width: 110, align: 'right' })
    .text(`INR ${order.subtotal.toFixed(2)}`, 470, totalsTop, { width: 70, align: 'right' });

  doc
    .text('Delivery Charges:', 350, totalsTop + 16, { width: 110, align: 'right' })
    .text(order.shippingFee === 0 ? 'FREE' : `INR ${order.shippingFee.toFixed(2)}`, 470, totalsTop + 16, { width: 70, align: 'right' });

  doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(350, totalsTop + 32).lineTo(550, totalsTop + 32).stroke();

  doc
    .fillColor('#422A1C')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Final Payable Total:', 330, totalsTop + 38, { width: 130, align: 'right' })
    .text(`INR ${order.totalAmount.toFixed(2)}`, 470, totalsTop + 38, { width: 70, align: 'right' });

  // Footer Note
  doc
    .fillColor('#94A3B8')
    .fontSize(8)
    .font('Helvetica')
    .text(
      'This is an electronically generated tax invoice for Cup2Eat food-grade edible biscuit & wafer tableware. Thank you for eliminating single-use plastic waste!',
      50,
      720,
      { align: 'center', width: 500 }
    );

  doc.end();
};

module.exports = { generateInvoicePDF };
