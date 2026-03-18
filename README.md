# Indocreonix Backend

Node.js + Express backend for Indocreonix admin and website integrations.

## Features

- JWT auth with signup/login and role-based access
- MongoDB models for users, leads, settings, and media
- Cloudinary media upload support
- Admin APIs for dashboard, users, leads, settings, media
- Security middleware: Helmet, CORS, rate limit

## Setup

1. Copy `.env.example` to `.env`
2. Fill MongoDB, JWT, and Cloudinary keys
3. Install dependencies:

```bash
npm install
```

4. Run server:

```bash
npm run dev
```

Server runs at `http://localhost:5000` by default.

## SMTP (Hostinger) on Render

If email works locally but times out on Render, check these environment variables on Render:

- `SMTP_HOST=smtp.hostinger.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=<your-primary-hostinger-mailbox>`
- `SMTP_PASS=<mailbox-password>`

Optional tuning:

- `SMTP_CONNECTION_TIMEOUT=20000`
- `SMTP_GREETING_TIMEOUT=15000`
- `SMTP_SOCKET_TIMEOUT=30000`

The backend now logs SMTP startup verification and includes SMTP error codes in logs to help diagnose network-level blocking.

### Render Free-tier note

Render Free web services block outbound SMTP ports (`25`, `465`, `587`).
If you are on Free tier, direct Hostinger SMTP will time out.

Use one of these options:

- Upgrade Render instance type (SMTP allowed), or
- Use `EMAIL_PROVIDER=resend` with HTTPS API (works on Free tier)

Required env vars for Resend mode:

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=<your_resend_api_key>`
- `RESEND_FROM=<fallback_sender@yourdomain.com>`
- `RESEND_INFO_FROM=info@yourdomain.com`
- `RESEND_CONTACT_FROM=contact@yourdomain.com`
- `RESEND_CAREERS_FROM=careers@yourdomain.com`

Mail sender mapping:

- Contact form emails send from `RESEND_CONTACT_FROM`
- Career application emails send from `RESEND_CAREERS_FROM`
- Any default/fallback email sends from `RESEND_INFO_FROM`

## API Overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/stats`
- `GET /api/users`
- `PATCH /api/users/:id`
- `POST /api/leads`
- `GET /api/leads`
- `PATCH /api/leads/:id`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/media`
- `POST /api/media`
- `DELETE /api/media/:id`
