#  Car2Go Backend

Backend REST API for Car2Go – a full-stack car rental platform connecting customers, vehicle owners, and administrators through a centralized rental management system.

---

## Overview

Car2Go Backend is built using Node.js, Express.js, and MongoDB. It handles authentication, vehicle management, booking operations, payments, document verification, email notifications, PDF invoice generation, and administrative operations.

---
## Live Links
- API Base: https://api.car2go.free.je
- Frontend: https://app.car2go.free.je
## Features

### Authentication & Security

- User Registration & Login
- JWT Authentication
- Role-Based Authorization
- Password Hashing with bcrypt
- Protected Routes

### Vehicle Management

- Add New Vehicles
- Update Vehicle Details
- Delete Vehicle Listings
- Vehicle Approval Workflow
- Manage Availability

### Booking System

- Create Booking Requests
- Booking Status Tracking
- Booking History Management
- Booking Verification System

### Document Management

- Driving License Upload
- Aadhaar Upload
- Vehicle Document Upload
- Secure Document Storage

### Image Management

- Multer File Uploads
- Cloudinary Integration
- Vehicle Image Management

### Payments

- Razorpay Integration
- Payment Verification
- Booking Hold Mechanism
- Transaction Management

### Email Services

- Resend API Integration
- Booking Confirmation Emails
- Status Update Emails
- Notification System

### PDF Generation

- PDFKit Integration
- Dynamic Invoice Generation
- Downloadable Booking Receipts

### Admin Features

- User Management
- Owner Management
- Vehicle Approval System
- Booking Monitoring
- Payment Monitoring

---

## Tech Stack

| Technology | Purpose |
|------------|----------|
| Node.js | Runtime Environment |
| Express.js | Backend Framework |
| MongoDB | Database |
| Mongoose | ODM |
| JWT | Authentication |
| bcrypt | Password Security |
| Multer | File Upload Handling |
| Cloudinary | Cloud Storage |
| Razorpay | Payment Gateway |
| Resend | Email Service |
| PDFKit | Invoice Generation |

---

## Project Structure

```text
server/
│
├── controllers/
├── models/
├── routes/
├── middleware/
├── config/
├── services/
├── utils/
├── uploads/
└── server.js
```

---

## Installation

### Clone Repository

```bash
git clone https://github.com/harshsolanki018/car2go-backend.git
cd car2go-backend
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file:

```env
PORT=5000

MONGODB_URI=

JWT_SECRET=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RESEND_API_KEY=
```

---

## Run Development Server

```bash
npm run dev
```

Server runs at:

```text
http://localhost:5000
```

---

## Core API Modules

### Authentication

- Register User
- Login User
- Manage Sessions

### Cars

- Create Car Listing
- Update Car Listing
- Delete Car Listing
- Retrieve Cars

### Bookings

- Create Booking
- Verify Booking
- Track Booking Status
- Manage Bookings

### Payments

- Create Razorpay Orders
- Verify Payments
- Generate Receipts

### Documents

- Upload Documents
- Verify User Documents

### Admin

- Manage Users
- Manage Owners
- Approve Vehicles
- Monitor Bookings

---

## Deployment

### Frontend

- Netlify

### Backend

- Render

### Database

- MongoDB Atlas

---

## Future Enhancements

- GPS Vehicle Tracking
- Real-Time Notifications
- Driver Booking Support
- Analytics Dashboard
- Mobile Application
- AI-Based Pricing Suggestions

---

## Author

**Harsh Solanki**

GitHub: https://github.com/harshsolanki018

---

## License

This project is developed for educational and portfolio purposes.
