const mongoose = require('mongoose');
const { MESSAGE_STATUS, USER_ROLES } = require('../constants/enums');
const { getNextSequence } = require('./counter.model');
const { generateTicketId } = require('../utils/id-generator');

const contactMessageSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    ticketId: { type: String, unique: true, index: true },
    senderRole: {
      type: String,
      enum: [USER_ROLES.USER, USER_ROLES.OWNER],
      default: USER_ROLES.USER,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: 'Not Provided', trim: true },
    subject: { type: String, default: 'General Inquiry', trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(MESSAGE_STATUS),
      default: MESSAGE_STATUS.NEW,
    },
  },
  { timestamps: true }
);

contactMessageSchema.pre('validate', async function ensureIds(next) {
  if (!this.id) {
    this.id = await getNextSequence('contact_message_id');
  }
  if (!this.ticketId) {
    this.ticketId = generateTicketId();
  }
  next();
});

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;
