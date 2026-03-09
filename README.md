# IESA Platform

**Industrial Engineering Students' Association — University of Ibadan**

IESA is a full-stack departmental web platform for the Industrial Engineering department at the University of Ibadan (UI), Nigeria. It serves as the central hub for student engagement, academic administration, payments, events, and department communications — combining a vibrant Next.js 16 frontend with a robust FastAPI backend.

---

## Features

### Student Portal
- **Dashboard** — Personalized overview of announcements, upcoming events, timetable, and payment status
- **Announcements** — Level-targeted and department-wide notifications
- **Events** — Browse and register for department events, with Paystack payment integration for paid events
- **Timetable** — Session-aware class schedule viewer
- **Payments** — Dues tracking with Paystack online payment and bank transfer submission
- **Resource Library** — Study materials and resources submitted by students and approved by admins
- **Press / Blog** — Student article submission, editorial review workflow, and public blog
- **Study Groups** — Real-time group chat (WebSocket), session scheduling, and resource sharing
- **IESA AI** — Groq-powered AI assistant (Llama 3.3 70B) with personalized student context
- **Growth Hub** — 8 self-development tools: habits tracker, CGPA calculator, Pomodoro timer, flashcards, journal, planner, course list, and goals
- **IEPOD** — Departmental orientation programme with registration, structured phases, and quizzes
- **TIMP** — Technical & Industry Mentorship Programme with applications, matching, and pair management
- **Receipts & Tickets** — Download payment receipts (PDF + QR code) and event tickets

### Admin Panel
- **User Management** — Create, edit, and manage student and staff accounts
- **Role & Permission Management** — Granular RBAC with 25+ scoped permissions
- **Session Management** — Create and activate academic sessions
- **Enrollment Management** — Student level tracking per session
- **Announcement Management** — Draft, publish, and target announcements by level
- **Event Management** — Create events, manage registrations, and track paid attendees
- **Payment Management** — Define dues, review Paystack transactions, manage bank accounts, and approve bank transfers
- **Timetable Management** — Build and publish the semester timetable
- **Resource Approval** — Review and approve student-submitted study materials
- **Audit Logs** — Full action history for accountability
- **IEPOD & TIMP Admin** — Manage orientation phases, quizzes, mentorship applications, and pairs
- **Admin Statistics** — Dashboard with key metrics and growth charts

### Platform-Wide
- **Firebase Authentication** — Email/password + Google sign-in, Firebase Admin SDK for backend token verification
- **Permission-Based Access** — Every protected route and API endpoint gated by named scopes
- **Real-Time Updates** — WebSocket for study group chat, SSE for cache revalidation
- **Rate Limiting** — SlowAPI with Redis backend (falls back to in-memory)
- **Email Notifications** — Transactional emails via Resend
- **Cloudinary** — Profile images and resource file uploads
- **Docker** — Full containerized dev and production setups

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 16 (App Router, React 19, TypeScript) |
| **Styling** | Tailwind CSS v4 (CSS-first config, custom design system) |
| **State / Data** | SWR v2, React Context API |
| **Rich Text** | Tiptap v3 (article editor) |
| **Charts** | Recharts |
| **Calendar** | React Big Calendar |
| **Real-Time** | WebSocket (study groups), SSE (cache revalidation) |
| **Backend Framework** | FastAPI (async) |
| **Database** | MongoDB via Motor (async driver) |
| **Schema Validation** | Pydantic v2 |
| **Authentication** | Firebase Auth (email/password, Google sign-in) |
| **AI** | Groq SDK — Llama 3.3 70B Versatile |
| **Payments** | Paystack |
| **File Storage** | Cloudinary |
| **Email** | Resend |
| **PDF Generation** | ReportLab + qrcode |
| **Rate Limiting** | SlowAPI + Redis (in-memory fallback) |
| **Testing** | Vitest (frontend), pytest (backend) |
| **Containerization** | Docker + Docker Compose |

---

## Quick Start

### Option 1 — Docker (recommended)

```bash
# Development (hot reload on both frontend and backend)
docker compose -f docker-compose.dev.yml up

# Production
docker compose up
```

Requires a `backend/.env` file — see [Environment Variables](#environment-variables).

### Option 2 — Local

**Frontend**

```bash
npm install
npm run dev          # http://localhost:3000
```

**Backend**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

---

## Environment Variables

### Frontend (`/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`/backend/.env`)

```env
# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=iesa_db

# Auth
SECRET_KEY=your_jwt_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# Paystack
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_CALLBACK_URL=http://localhost:3000/dashboard/payments

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Groq AI
GROQ_API_KEY=gsk_...

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Redis (optional — falls back to in-memory)
REDIS_URL=redis://localhost:6379

# Google Drive (optional — for resource uploads)
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...

# CORS
ALLOWED_ORIGINS=http://localhost:3000
ENVIRONMENT=development
```

---

## Project Structure

```
iesa/
├── src/
│   ├── app/
│   │   ├── (admin)/admin/          # Admin panel pages
│   │   ├── (auth)/                 # Login, register, reset password
│   │   ├── (student)/dashboard/    # Student portal pages
│   │   ├── about/                  # Public about page
│   │   ├── blog/                   # Public press/blog
│   │   ├── contact/                # Contact form
│   │   ├── events/                 # Public events listing
│   │   ├── history/                # Department history page
│   │   ├── iepod/                  # Public IEPOD info page
│   │   ├── team/                   # Team page
│   │   ├── globals.css             # Design tokens & utility classes
│   │   ├── layout.tsx              # Root layout, fonts, providers
│   │   └── providers.tsx           # Auth, Session, Permissions, Toast
│   ├── components/
│   │   ├── admin/                  # Admin-specific components
│   │   ├── dashboard/              # Student dashboard components
│   │   ├── home/                   # Public landing page sections
│   │   ├── layout/                 # Navbar, sidebar, footer
│   │   └── ui/                     # Shared UI: Modal, Toast, Table, Button...
│   ├── context/
│   │   ├── AuthContext.tsx         # JWT auth state, getAccessToken()
│   │   ├── PermissionsContext.tsx  # Permission checks
│   │   ├── SessionContext.tsx      # Active academic session
│   │   └── SidebarContext.tsx      # Sidebar collapse state
│   ├── hooks/
│   │   ├── useData.ts              # SWR hooks: useStudentDashboard, useAdminStats
│   │   ├── useGrowthData.ts        # Growth Hub localStorage + API persistence
│   │   └── useSSE.ts               # SSE listener for SWR cache revalidation
│   ├── lib/
│   │   ├── api.ts                  # Typed API client (api.get, api.post, ...)
│   │   ├── api/                    # Feature-specific API modules
│   │   └── withAuth.tsx            # HOC for permission-gated pages
│   └── types/                      # Shared TypeScript interfaces
├── backend/
│   └── app/
│       ├── core/
│       │   ├── auth.py             # Firebase init & token verification
│       │   ├── permissions.py      # require_permission() dependency (cached)
│       │   ├── security.py         # Firebase token → MongoDB user mapping
│       │   ├── audit.py            # Audit log helpers
│       │   ├── email.py            # Transactional email via Resend
│       │   ├── rate_limiting.py    # SlowAPI setup
│       │   └── transactions.py     # Atomic MongoDB transaction helpers
│       ├── models/                 # Pydantic v2 request/response models
│       ├── routers/                # One file per API domain (30 routers)
│       ├── db.py                   # Motor connection + collection helpers
│       └── main.py                 # App factory, middleware, router registration
├── docs/                           # Extended documentation
├── scripts/                        # Dev utility scripts
├── docker-compose.yml              # Production compose
├── docker-compose.dev.yml          # Development compose (hot reload)
└── vitest.config.ts                # Frontend test config
```

---

## Authentication & Permissions

### Auth Flow

1. User signs in via Firebase (email/password or Google) → frontend receives Firebase ID token
2. Frontend stores Firebase user via `onAuthStateChanged`; calls `getAccessToken()` which uses `FirebaseUser.getIdToken()` (auto-refreshes)
3. Every API request includes `Authorization: Bearer <firebase_id_token>` → backend verifies with Firebase Admin SDK

### Permission System

IESA uses named permission scopes rather than coarse roles. Permissions are assigned to roles, roles assigned to users. The backend caches resolved permissions per user with a 5-minute TTL.

```python
# Backend — protect an endpoint
@router.get("/", dependencies=[Depends(require_permission("resource:view"))])

# Frontend — protect a page
export default withAuth(ResourcesPage, {
  anyPermission: ["resource:view", "resource:manage"]
});
```

Permission format: `scope:action` — e.g. `announcement:create`, `payment:view_all`, `user:manage`.

---

## Payment Architecture

### Paystack (online)

1. Student clicks "Pay" → `POST /api/v1/paystack/initialize`
2. Backend initializes transaction, returns `authorization_url`
3. Browser redirects to Paystack checkout (full-page)
4. On success, Paystack redirects back with `?reference=XXX`
5. Frontend calls `POST /api/v1/paystack/verify/{reference}`
6. Backend confirms with Paystack API, marks student as paid

### Bank Transfer (manual)

1. Student submits sender details + receipt image → `POST /api/v1/bank-transfers/`
2. Admin reviews in the Bank Transfers tab → `PATCH /api/v1/bank-transfers/{id}/review`
3. On approval, backend adds student to the payment's `paidBy` array

---

## Level Calculation

Student level is **auto-calculated** — never manually entered.

```
level = clamp((currentSessionSecondYear - admittedSessionSecondYear) × 100 + 100, 100, 500)
```

Example: Active session `2025/2026`, admitted `2022/2023` → `(2026 − 2023) × 100 + 100 = 400L`

---

## Scripts

Utility scripts live in `scripts/` and `backend/scripts/`:

| Script | Purpose |
|---|---|
| `backend/scripts/make_super_admin.py` | Elevate a user to super admin |
| `backend/scripts/seed_dummy_data.py` | Populate DB with test data |
| `backend/scripts/reset_password.py` | Manually reset a user's password |
| `backend/scripts/list_users.py` | Print all registered users |
| `backend/scripts/verify_email.py` | Manually mark an email as verified |
| `backend/fix_cloud_users.py` | Backfill Cloudinary profile images |

---

## Testing

**Frontend (Vitest)**

```bash
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # Coverage report
```

**Backend (pytest)**

```bash
cd backend
pytest tests/
```

---

## Documentation

- [Design System v3](docs/DESIGN_SYSTEM_V3.md) — Full color, typography, and component reference
- [Payment Testing Guide](docs/PAYMENT_TESTING_GUIDE.md) — End-to-end Paystack test flow
- [IEPOD Programme](IEPOD.md) — Orientation programme structure
- [Archived Docs](docs/archive/) — Legacy implementation guides

