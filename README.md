# Booking Platform API

A REST API for managing services and customer bookings, built with NestJS, TypeScript, PostgreSQL, and JWT authentication.

## Project Overview

This API supports two user types:
- **Staff (authenticated users)** — register/login, and manage services (create, update, delete) and bookings (view, filter, update status, cancel)
- **Customers (unauthenticated)** — can browse services and create bookings without logging in

## Tech Stack
- NestJS + TypeScript
- PostgreSQL + TypeORM (migration-based schema, no auto-sync)
- JWT authentication via Passport
- class-validator / class-transformer for request validation
- Swagger for interactive API documentation
- Jest for unit testing

## Installation Steps

1. Clone the repository and install dependencies:
```bash
   git clone <repo-url>
   cd booking-platform
   npm install
```

2. Copy the example environment file and fill in your own values:
```bash
   cp .env.example .env
```

3. Ensure PostgreSQL is running and create the database:
```sql
   CREATE DATABASE booking_platform;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | App port | `3000` |
| `DB_HOST` | Postgres host | `localhost` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_USERNAME` | Postgres user | `postgres` |
| `DB_PASSWORD` | Postgres password | — |
| `DB_DATABASE` | Database name | `booking_platform` |
| `JWT_SECRET` | Secret used to sign JWTs | a long random string |
| `JWT_EXPIRES_IN` | Token lifetime | `1d` |

## Database Setup

Schema is managed entirely through TypeORM migrations — `synchronize` is disabled to avoid unreviewed, automatic schema changes.

## Running Migrations

```bash
npm run migration:run     # apply all pending migrations
npm run migration:revert  # roll back the last migration
npm run migration:generate -- src/database/migrations/<Name>  # generate a new one after entity changes
```

## Running the Application

```bash
npm run start:dev   # development, with hot reload
npm run build && npm run start:prod   # production
```

The API runs at `http://localhost:3000` by default.

## Running Tests

```bash
npm run test       # unit tests
npm run test:cov   # unit tests with coverage report
```

Unit tests cover service-layer business logic: authentication (hashing, credential checks), and booking rules (past-date rejection, duplicate-slot prevention, status-transition rules). Controllers are thin pass-throughs and are exercised via manual/Postman testing instead of unit tests, since they contain no independent logic to verify in isolation.

## API Documentation

Interactive Swagger docs: **http://localhost:3000/api/docs**

Use the "Authorize" button with a JWT (from `POST /auth/login`) to test protected endpoints directly from the docs UI.

### Endpoint Summary

| Method | Endpoint | Auth Required | Notes |
|---|---|---|---|
| POST | `/auth/register` | No | |
| POST | `/auth/login` | No | |
| GET | `/services` | No | Paginated (`page`, `limit`) |
| GET | `/services/:id` | No | |
| POST | `/services` | Yes | |
| PATCH | `/services/:id` | Yes | |
| DELETE | `/services/:id` | Yes | |
| POST | `/bookings` | No | Rejects past dates & duplicate slots |
| GET | `/bookings` | Yes | Paginated + filterable (see below) |
| GET | `/bookings/:id` | Yes | |
| PATCH | `/bookings/:id/status` | Yes | |
| PATCH | `/bookings/:id/cancel` | Yes | |

### `GET /bookings` query parameters

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number, default `1` |
| `limit` | number | Page size, default `10`, max `100` |
| `status` | enum | `PENDING` \| `CONFIRMED` \| `CANCELLED` \| `COMPLETED` |
| `customerName` | string | Partial, case-insensitive match |
| `customerEmail` | string | Partial, case-insensitive match |
| `serviceId` | uuid | Exact match |
| `dateFrom` | date | Inclusive range start |
| `dateTo` | date | Inclusive range end |

## Assumptions Made

1. **Service ownership**: any authenticated user can manage any service — not scoped to the user who created it, per the assignment's literal wording ("only authenticated users can manage services").
2. **Service visibility**: `GET /services` and `GET /services/:id` are public, since customers must browse services to book them, and booking itself is explicitly unauthenticated.
3. **Booking management visibility**: viewing/listing/updating bookings after creation requires authentication (staff-only), while creation is public — a "customer books, staff manages" model.
4. **Booking status rule**: once a booking is `CANCELLED`, no further status transitions are allowed (not just blocking `COMPLETED`) — cancellation is treated as a terminal state. Completed bookings similarly cannot be cancelled.
5. **Money handling**: `price` stored as Postgres `numeric(10,2)` (not float), converted transparently to/from a JS `number` via a TypeORM column transformer.
6. **Phone number format**: `customerPhone` accepts any valid international format, since this is a public-facing form with no fixed region.
7. **Duplicate booking definition**: a duplicate is the same `serviceId` + `bookingDate` + `bookingTime` combination on a non-cancelled booking. Different customers booking different times/services is always allowed; cancelling a booking frees its slot back up.

## Bonus Features Implemented

- ✅ Swagger documentation
- ✅ Global validation (whitelisting, type transforms)
- ✅ Global exception handling (consistent error response shape)
- ✅ Pagination (`services`, `bookings`)
- ✅ Search/filter on bookings (status, customer name/email, service, date range)
- ✅ Duplicate booking prevention
- ✅ Unit testing (auth, services, bookings business logic)
- ⬜ Docker — intentionally skipped due to local hardware constraints; see below

## Future Improvements

- **Docker & docker-compose**, for one-command local setup — skipped in this submission due to local machine constraints, but the app's config (env-based, no hardcoded paths) is already Docker-ready
- **Database-level duplicate-booking constraint**: the current duplicate check is application-level and has a small theoretical race-condition window under concurrent requests for the exact same slot; a partial unique index on `(serviceId, bookingDate, bookingTime)` filtered by non-cancelled status would close this fully
- Refresh tokens (currently a single, expiring access token only)
- Role-based access control, if staff roles ever need to differ (e.g. admin vs. regular staff)
- e2e/integration tests against a real or in-memory test database, complementing the current unit tests

## Project Structure

```
src/
 ├── auth/           # registration, login, JWT strategy, guards
 ├── users/          # User entity and data access
 ├── services/       # Service entity, CRUD, DTOs, tests
 ├── bookings/       # Booking entity, CRUD, business rules, DTOs, tests
 ├── database/       # TypeORM datasource config + migrations
 ├── common/         # global exception filter, transformers, shared pagination DTOs
 ├── config/         # environment variable validation
 ├── app.module.ts
 └── main.ts
```

## Live Demo

- **API base URL:** https://booking-platform-api-v3vl.onrender.com
- **Swagger docs:** https://booking-platform-api-v3vl.onrender.com/api/docs

> Note: hosted on Render's free tier — the service spins down after 15 minutes of inactivity, so the first request may take 30–50 seconds to wake up.