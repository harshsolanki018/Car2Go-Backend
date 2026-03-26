const { sendMail, isMailConfigured } = require('./mailer.service');

async function sendOtpEmail({ email, name, otp }) {
  if (!isMailConfigured()) {
    throw new Error('[Mail] SMTP configuration is missing.');
  }

  const subject = 'Car2Go OTP Verification';

  const html = `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">

      <!-- Header -->
      <div style="background:#2c3e50;color:#fff;padding:20px;text-align:center;font-size:22px;">
       Verify Your Account
      </div>

      <!-- Content -->
      <div style="padding:20px;color:#333;">
        <p>Hi <b>${name || 'there'}</b>,</p>

        <p>
          Thank you for choosing <b>Car2Go</b>.
        </p>

        <p>
          Please use the One-Time Password (OTP) below to complete your verification:
        </p>

        <!-- OTP Box -->
        <div style="text-align:center;margin:20px 0;">
          <span style="
            display:inline-block;
            background:#f1f3f5;
            padding:15px 25px;
            font-size:24px;
            letter-spacing:4px;
            border-radius:8px;
            font-weight:bold;
          ">
            ${otp}
          </span>
        </div>

        <p>
          This OTP is valid for a limited time. Please do not share it with anyone for security reasons.
        </p>

        <p>
          If you did not request this verification, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align:center;font-size:12px;padding:15px;color:#999;">
        Need help? Contact us at car2gosupport@gmail.com
      </div>

    </div>
  </div>
  `;

  await sendMail({ to: email, subject, html });
}

async function sendPasswordResetOtpEmail({ email, name, otp }) {
  if (!isMailConfigured()) {
    throw new Error('[Mail] SMTP configuration is missing.');
  }

  const subject = 'Car2Go Password Reset OTP';

  const html = `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">

      <!-- Header -->
      <div style="background:#2c3e50;color:#fff;padding:20px;text-align:center;font-size:22px;">
        Reset Your Password
      </div>

      <!-- Content -->
      <div style="padding:20px;color:#333;">
        <p>Hi <b>${name || 'there'}</b>,</p>

        <p>
          We received a request to reset your <b>Car2Go</b> account password.
        </p>

        <p>
          Please use the One-Time Password (OTP) below to proceed:
        </p>

        <!-- OTP Box -->
        <div style="text-align:center;margin:20px 0;">
          <span style="
            display:inline-block;
            background:#f1f3f5;
            padding:15px 25px;
            font-size:24px;
            letter-spacing:4px;
            border-radius:8px;
            font-weight:bold;
          ">
            ${otp}
          </span>
        </div>

        <p>
          This OTP is valid for a limited time. For your security, do not share it with anyone.
        </p>

        <p>
          If you did not request a password reset, please ignore this email or contact our support team immediately.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align:center;font-size:12px;padding:15px;color:#999;">
        Need help? Contact us at car2gosupport@gmail.com
      </div>

    </div>
  </div>
  `;

  await sendMail({ to: email, subject, html });
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetOtpEmail,
};
