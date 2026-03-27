const nodemailer = require('nodemailer');
const { Resend } = require('resend');

let transporter = null;
let resendClient = null;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function isMailConfigured() {
  return isResendConfigured() || isSmtpConfigured();
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!isSmtpConfigured()) {
    throw new Error('[Mail] SMTP configuration is missing.');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.OTP_OVERRIDE_EMAIL,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

function getResendClient() {
  if (resendClient) {
    return resendClient;
  }

  if (!isResendConfigured()) {
    throw new Error('[Mail] RESEND_API_KEY is missing.');
  }

  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function normalizeFrom() {
  return  process.env.OTP_OVERRIDE_EMAIL;
}
// process.env.MAIL_FROM ||
function mapResendAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return undefined;
  }
  return attachments.map((attachment) => {
    const content = attachment?.content;
    const encoded =
      Buffer.isBuffer(content) ? content.toString('base64') : content;
    return {
      filename: attachment?.filename || 'attachment',
      content: encoded,
      contentType: attachment?.contentType,
    };
  });
}

async function sendWithResend({ to, subject, html, attachments = [] }) {
  const client = getResendClient();
  return client.emails.send({
    from: normalizeFrom(),
    to,
    subject,
    html,
    attachments: mapResendAttachments(attachments),
  });
}

async function sendWithSmtp({ to, subject, html, attachments = [] }) {
  const mailer = getTransporter();
  return mailer.sendMail({
    from: normalizeFrom(),
    to,
    subject,
    html,
    attachments,
  });
}

async function sendMail({ to, subject, html, attachments = [] }) {
  if (isResendConfigured()) {
    return sendWithResend({ to, subject, html, attachments });
  }
  return sendWithSmtp({ to, subject, html, attachments });
}

module.exports = {
  sendMail,
  isMailConfigured,
};
