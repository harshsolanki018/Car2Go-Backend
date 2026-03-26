const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('../config/env');

const razorpay = new Razorpay({
  key_id: env.razorpayKeyId,
  key_secret: env.razorpayKeySecret,
});

async function createOrder({ amount, currency = 'INR', receipt, notes }) {
  return razorpay.orders.create({
    amount,
    currency,
    receipt,
    notes,
  });
}

function verifySignature({ orderId, paymentId, signature }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(body)
    .digest('hex');
  return expected === signature;
}

module.exports = {
  createOrder,
  verifySignature,
};
