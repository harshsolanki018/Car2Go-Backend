const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function formatCurrency(amount) {
  const value = Number(amount || 0);
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDate(value) {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function safe(value, fallback = 'N/A') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildInvoiceNumber(booking) {
  const datePart = formatDate(booking.createdAt || new Date())
    .replace(/\s/g, '')
    .replace(/,/g, '-')
    .replace(/-/g, '');
  const idPart = booking.bookingId || booking.id || '0000';
  return `INV-${datePart}-${idPart}`;
}

function buildInvoicePdf({ booking, car, user, owner }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // ================= BACKGROUND =================
  doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');
  doc.fillColor('#1e1e1e');

  const left = 50;
  const right = pageWidth - 50;

  let y = 40;

  // ================= HEADER =================
  doc.moveTo(left, y).lineTo(right, y).stroke('#888');

  y += 20;

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, left, y, { width: 120 });
  }

  doc.fontSize(10)
    .text('TAX INVOICE', right - 120, y)
    .text('Address : Surat, Gujarat', right - 200, y + 15)
    .text('Email   : car2gosupport@gmail.com', right - 200, y + 30)
    .text('Phone   : +91 7490008061', right - 200, y + 45);

  y += 80;

  doc.moveTo(left, y).lineTo(right, y).stroke('#888');

  y += 25;

  // ================= HELPERS =================
  function labelValue(label, value, x, y) {
    doc.text(label, x, y, { continued: true });
    doc.text(` ${value}`);
  }

  // ================= BILL TO + INVOICE =================
  const leftX = left;
  const rightX = pageWidth / 2 + 10;

  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('BILL TO', leftX, y);
  doc.text('INVOICE', rightX, y);

  y += 20;

  doc.font('Helvetica').fontSize(10);

  const invoiceId = buildInvoiceNumber(booking);
  const issuedOn = formatDate(booking.createdAt || new Date());
  const bookingId = booking.bookingId || `BK-${booking.id || 'N/A'}`;

  const baseAmount =
    booking.totalPrice != null
      ? Number(booking.totalPrice)
      : Number((car?.pricePerDay || 0) * (booking.totalDays || 0));
  const platformFee =
    booking.platformFee != null ? Number(booking.platformFee) : baseAmount * 0.05;
  const gstAmount =
    booking.gstAmount != null ? Number(booking.gstAmount) : platformFee * 0.18;
  const totalAmount =
    booking.totalAmount != null
      ? Number(booking.totalAmount)
      : baseAmount + platformFee + gstAmount;

  // LEFT
  labelValue('Name  :' , safe(booking.fullName || user?.name), leftX, y);
  labelValue('Email :', safe(booking.userEmail || user?.email), leftX, y + 18);
  labelValue('Phone :', safe(booking.phone || user?.phone), leftX, y + 36);

  // RIGHT
  labelValue('Invoice ID:', invoiceId, rightX, y);
  labelValue('Date      :', issuedOn, rightX, y + 18);
  labelValue('Booking ID:', bookingId, rightX, y + 36);

  y += 80;

  // ================= OWNER =================
  doc.font('Helvetica-Bold').text('OWNER DETAILS', leftX, y);
  y += 18;

  doc.font('Helvetica');
  labelValue('Name  :', safe(owner?.name || car?.ownerName), leftX, y);
  labelValue('Email :', safe(owner?.email || car?.ownerEmail), leftX, y + 18);
  labelValue('Phone :', safe(owner?.phone || car?.ownerContact), leftX, y + 36);

  y += 80;

  // ================= VEHICLE =================
  doc.font('Helvetica-Bold').text('VEHICLE INFORMATION', leftX, y);
  y += 18;

  doc.font('Helvetica');
  labelValue('Car    :', safe(car?.name), leftX, y);
  labelValue('Number :', safe(car?.carNumber), leftX, y + 18);
  labelValue(
    'Rental :',
    `${formatDate(booking.pickupDate)} - ${formatDate(booking.returnDate)}`,
    leftX,
    y + 36
  );

  y += 90;

  // ================= TABLE =================
  doc.font('Helvetica-Bold').text('CHARGES DETAILS', leftX, y);
  y += 20;

  const tableX = left;
  const tableWidth = right - left;
  const rowHeight = 25;

  const colWidths = [200, 80, 80, 120];

  function drawRow(y, cols) {
    let x = tableX;

    cols.forEach((col, i) => {
      doc.rect(x, y, colWidths[i], rowHeight).stroke('#aaa');
      doc.text(col, x + 5, y + 7);
      x += colWidths[i];
    });
  }

  // HEADER
  drawRow(y, ['Description', 'Rate', 'Days', 'Subtotal']);
  y += rowHeight;

  // ROWS
  drawRow(y, [
    'Car Rental Charges',
    formatCurrency(car?.pricePerDay || 0),
    String(booking.totalDays || 0),
    formatCurrency(baseAmount),
  ]);
  y += rowHeight;

  drawRow(y, ['Platform Fee (5%)', '-', '-', formatCurrency(platformFee)]);
  y += rowHeight;

  drawRow(y, ['GST (18%)', '-', '-', formatCurrency(gstAmount)]);
  y += rowHeight;

  // TOTAL
  doc.font('Helvetica-Bold');
  drawRow(y, ['Total Amount paid', '', '', formatCurrency(totalAmount)]);

  y += 60;

  // ================= PAYMENT =================
  doc.font('Helvetica-Bold').text('PAYMENT INFORMATION', leftX, y);
  y += 20;

  doc.font('Helvetica');

  labelValue('Payment ID :', safe(booking.paymentId), leftX, y);
  labelValue('Order ID   :', safe(booking.paymentOrderId), leftX, y + 18);
  labelValue('Method     :', 'Online (Razorpay)', leftX, y + 36);
  labelValue('Date       :', issuedOn, leftX, y + 54);

  y += 80;

  // ================= FOOTER =================
  doc.moveTo(left, y).lineTo(right, y).stroke('#888');

  y += 10;

  doc.text('Thank you for choosing Car2Go!', left, y, {
    align: 'center',
    width: tableWidth,
  });

  doc.text('For support: car2gosupport@gmail.com', left, y + 15, {
    align: 'center',
    width: tableWidth,
  });

  return doc;
}

module.exports = { buildInvoicePdf };
