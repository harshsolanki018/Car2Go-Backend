# Car2Go Backend

Node + Express + MongoDB backend structured for your existing frontend logic.

## Tech
- Node.js
- Express
- MongoDB (Mongoose)
- JWT auth

## Setup
1. Copy `.env.example` to `.env`.
2. Update values if needed (`MONGODB_URI`, `JWT_SECRET`, etc.).
3. Install packages:
```bash
npm install
```
4. Start server:
```bash
npm run dev
```

Server base URL:
- `http://localhost:5000`

API base:
- `http://localhost:5000/api`

## Default Admin Seed
On first run, backend auto-creates one admin user:
- Email: from `DATA_SEED_ADMIN_EMAIL`
- Password: from `DATA_SEED_ADMIN_PASSWORD`

## Auto IDs Implemented
- `users.id` -> `USR-*`
- `cars.id` -> auto-increment number
- `bookings.id` -> auto-increment number
- `bookings.bookingId` -> `BK-YYYYMMDD-####`
- `contactMessages.id` -> auto-increment number
- `contactMessages.ticketId` -> `TKT-*`
- `homeFeaturedConfig.id` -> auto-increment number

## Main Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)

### Cars
- `GET /api/cars`
- `GET /api/cars/:id`
- `POST /api/cars` (Admin)
- `PUT /api/cars/:id` (Admin)
- `PATCH /api/cars/:id/toggle-maintenance` (Admin)
- `DELETE /api/cars/:id` (Admin)

### Bookings
- `GET /api/bookings/car/:carId/ranges` (Auth)
- `POST /api/bookings` (Auth)
- `GET /api/bookings/me` (Auth)
- `PATCH /api/bookings/:id/cancel` (Auth)
- `PATCH /api/bookings/:id/rating` (Auth)
- `GET /api/bookings/admin/all` (Admin)
- `PATCH /api/bookings/admin/:id/approve` (Admin)
- `PATCH /api/bookings/admin/:id/reject` (Admin)
- `PATCH /api/bookings/admin/:id/complete` (Admin)

### Users (Admin)
- `GET /api/users`
- `PATCH /api/users/:id/toggle-block`
- `DELETE /api/users/:id`

### Messages
- `POST /api/messages`
- `GET /api/messages/admin/all` (Admin)
- `PATCH /api/messages/admin/:ticketId/status` (Admin)
- `DELETE /api/messages/admin/:ticketId` (Admin)

### Home
- `GET /api/home/featured-cars`
- `GET /api/home/status-bar`
- `GET /api/home/admin/home-featured-cars` (Admin)
- `PUT /api/home/admin/home-featured-cars` (Admin)
- `DELETE /api/home/admin/home-featured-cars` (Admin)

### Stats (Admin)
- `GET /api/stats/admin/stats?range=today|7d|30d`
- `GET /api/stats/admin/dashboard`

## Frontend Sync Compatibility Endpoints
These endpoints are added so the current Angular frontend logic can run in API mode without UI/logic rewrites.

- `GET /api/sync/users`
- `PUT /api/sync/users`
- `GET /api/sync/cars`
- `PUT /api/sync/cars`
- `GET /api/sync/bookings`
- `PUT /api/sync/bookings`
- `GET /api/sync/contact-messages`
- `PUT /api/sync/contact-messages`
- `GET /api/sync/home-featured-config`
- `PUT /api/sync/home-featured-config`
- `DELETE /api/sync/home-featured-config`
