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
