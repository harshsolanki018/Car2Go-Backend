const { sendMail, isMailConfigured } = require('./mailer.service');
const { buildInvoicePdf } = require('./invoice.service');

function buildUserSuccessEmail({ booking, car, totalAmount }) {
  return {
    subject: `Car2Go Booking Confirmed - ${booking.bookingId || booking.id}`,
    html: `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
        
        <div style="background:#2c3e50;color:#fff;padding:20px;text-align:center;font-size:22px;">
          Your Booking has been Confirmed
        </div>

        <div style="padding:20px;color:#333;">
          <p>Hi <b>${booking.fullName || 'Customer'}</b>,</p>
          <p>Congratulations! Your booking has been successfully confirmed </p>

          <div style="background:#f9f9f9;padding:15px;border-radius:8px;">
            <h3>Booking Details</h3>
            <p><b>Booking ID:</b> ${booking.bookingId || booking.id}</p>
            <p><b>Car:</b> ${car?.name || 'N/A'} (${car?.carNumber || 'N/A'})</p>
            <p><b>Pickup Date:</b> ${booking.pickupDate}</p>
            <p><b>Return Date:</b> ${booking.returnDate}</p>
            <p><b>Total Price:</b> ₹${Number(totalAmount || 0).toFixed(2)}</p>
          </div>

          <div style="background:#fff3cd;padding:12px;border-radius:6px;margin-top:12px;">
            <p style="margin:0;">
              <b>Pickup Code:</b> ${booking.pickupCode || 'N/A'}
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#666;">
              Share this code with the car owner at pickup to start your trip.
            </p>
          </div>

         <div style="background:#eef6ff;padding:12px;border-radius:6px;margin-top:15px;">
          <p style="margin:0;">
           <b>Invoice Attached:</b> You can find your booking invoice attached to this email.
          </p>
        </div>

          <p style="margin-top:15px;">
            Thank you for choosing <b>Car2Go</b>
          </p>
         </div>

        <div style="text-align:center;padding:15px;font-size:12px;color:#888;">
         Car2Go Support: car2gosupport@gmail.com
        </div>

      </div>
    </div>
    `,
  };
}

function buildUserFailureEmail({ name, reason }) {
  return {
    subject: 'Car2Go Booking Failed',
    html: `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;">
        
        <div style="background:#e74c3c;color:#fff;padding:20px;text-align:center;font-size:20px;">
         Oops your Booking is Failed
        </div>

        <div style="padding:20px;color:#333;">
          <p>Hi <b>${name || 'Customer'}</b>,</p>

          <p>We couldn’t complete your booking.</p>

          <div style="background:#fff5f5;padding:15px;border-radius:8px;">
            <p><b>Reason:</b> ${reason || 'Unknown error'}</p>
          </div>

          <p style="margin-top:15px;">Please try again or contact support.</p>
        </div>

        <div style="text-align:center;font-size:12px;padding:15px;color:#999;">
          Car2Go Support: car2gosupport@gmail.com
        </div>

      </div>
    </div>
    `,
  };
}

function buildOwnerSuccessEmail({ ownerName, booking, car, userName, userPhone, userEmail }) {
  return {
    subject: `Your Car Has Been Booked - ${car?.name || ''}`,
    html: `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;">
        
        <div style="background:#34495e;color:#fff;padding:20px;text-align:center;font-size:20px;">
          New Booking Received
        </div>

        <div style="padding:20px;color:#333;">
          <p>Hi <b>${ownerName || 'Owner'}</b>,</p>
          <p>Your car has been successfully booked </p>

          <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin-top:10px;">
            <h3>Car Details</h3>
            <p><b>Car:</b> ${car?.name || 'N/A'} (${car?.carNumber || 'N/A'})</p>
          </div>

          <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin-top:10px;">
            <h3>Customer Details</h3>
            <p><b>Name:</b> ${userName || 'N/A'}</p>
            <p><b>Phone:</b> ${userPhone || 'N/A'}</p>
            <p><b>Email:</b> ${userEmail || 'N/A'}</p>
          </div>

          <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin-top:10px;">
            <h3>Booking Dates</h3>
            <p><b>Pickup:</b> ${booking.pickupDate}</p>
            <p><b>Return:</b> ${booking.returnDate}</p>
          </div>

          <div style="background:#eef6ff;padding:12px;border-radius:6px;margin-top:12px;">
            <p style="margin:0;">
              <b>Pickup Verification:</b> Ask the renter for their pickup code to mark the booking active.
            </p>
          </div>

        </div>
        <div style="text-align:center;font-size:12px;padding:15px;color:#999;">
          Car2Go Support : car2gosupport@gmail.com
        </div>
      </div>
    </div>
    `,
  };
}
async function generateInvoiceBuffer(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = buildInvoicePdf(data);
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function sendBookingSuccessEmails({ booking, car, user, owner }) {
  if (!isMailConfigured()) {
    return;
  }

  const totalAmount = booking.totalAmount ?? booking.totalPrice ?? 0;
  const userEmail = booking.userEmail || booking.email || user?.email;
  const ownerEmail = booking.ownerEmail || owner?.email || car?.ownerEmail;

  const attachInvoice = String(process.env.MAIL_ATTACH_INVOICE || 'true').toLowerCase() === 'true';
  let attachments = [];

  if (attachInvoice && userEmail) {
    const invoiceBuffer = await generateInvoiceBuffer({ booking, car, user, owner });
    const fileId = booking.bookingId || booking.id || 'invoice';
    attachments = [
      {
        filename: `Car2Go_Invoice_${fileId}.pdf`,
        content: invoiceBuffer,
      },
    ];
  }

  if (userEmail) {
    const { subject, html } = buildUserSuccessEmail({ booking, car, totalAmount });
    await sendMail({ to: userEmail, subject, html, attachments });
  }

  if (ownerEmail) {
    const { subject, html } = buildOwnerSuccessEmail({
      ownerName: owner?.name || car?.ownerName,
      booking,
      car,
      userName: booking.fullName || user?.name,
      userPhone: booking.phone || user?.phone,
      userEmail: booking.userEmail || user?.email,
    });
    await sendMail({ to: ownerEmail, subject, html });
  }
}

async function sendBookingFailureEmail({ email, name, reason }) {
  if (!isMailConfigured() || !email) {
    return;
  }
  const { subject, html } = buildUserFailureEmail({ name, reason });
  await sendMail({ to: email, subject, html });
}

function buildOwnerPayoutEmail({ ownerName, amountPaid, bookingCount, paidAt, payoutId }) {
  return {
    subject: `Car2Go Payout Processed - ${payoutId || 'Payout'}`,
    html: `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;">
        <div style="background:#2c3e50;color:#fff;padding:18px;text-align:center;font-size:20px;">
          Payout Completed
        </div>
        <div style="padding:20px;color:#333;">
          <p>Hi <b>${ownerName || 'Owner'}</b>,</p>
          <p>Your payout has been processed successfully.</p>
          <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin-top:10px;">
            <p><b>Payout ID:</b> ${payoutId || 'N/A'}</p>
            <p><b>Amount Paid:</b> Rs. ${Number(amountPaid || 0).toFixed(0)}</p>
            <p><b>Bookings Covered:</b> ${Number(bookingCount || 0)}</p>
            <p><b>Paid On:</b> ${paidAt || ''}</p>
          </div>
          <p style="margin-top:15px;">Thank you for partnering with Car2Go.</p>
        </div>
        <div style="text-align:center;font-size:12px;padding:15px;color:#999;">
          Car2Go Support: car2gosupport@gmail.com
        </div>
      </div>
    </div>
    `,
  };
}

async function sendOwnerPayoutEmail({
  ownerEmail,
  ownerName,
  amountPaid,
  bookingCount,
  paidAt,
  payoutId,
}) {
  if (!isMailConfigured() || !ownerEmail) {
    return;
  }
  const { subject, html } = buildOwnerPayoutEmail({
    ownerName,
    amountPaid,
    bookingCount,
    paidAt,
    payoutId,
  });
  await sendMail({ to: ownerEmail, subject, html });
}

module.exports = {
  sendBookingSuccessEmails,
  sendBookingFailureEmail,
  sendOwnerPayoutEmail,
};
