# Car2Go Backend

This is the Node/Express backend for my Car2Go college project.

## Live Links
- API Base: https://car2go-backend-zbum.onrender.com/api
- Frontend: https://car2goweb.netlify.app

## Tech Used
- Node.js
- Express
- MongoDB (Mongoose)
- JWT Auth
- Razorpay (payments)
- Cloudinary (file storage)
- Resend (emails)

## Run Locally
```bash
npm install
npm run dev
```

Server runs at `http://localhost:5000`.

## Environment Setup
Create a `.env` in `Backend/` and add your keys. Main ones:
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`
- `MAIL_FROM`

Optional:
- `MAIL_TO_OVERRIDE` (send all emails to one address for testing)

## Admin Seed
On first run, an admin can be auto‑seeded using:
- `DATA_SEED_ADMIN_EMAIL`
- `DATA_SEED_ADMIN_PASSWORD`
