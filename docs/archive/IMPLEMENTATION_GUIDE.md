# 🎓 IESA ERP - Session-Aware Platform

## Overview

IESA is a **Session-Aware Enterprise Resource Planning (ERP) System** for the Industrial Engineering Department. The platform implements a unique "Time Travel" architecture that prevents **Data Decay** - the primary failure point of student association software.

### The Problem: Data Decay

When new executives take over, traditional platforms lose historical data because everything is mixed together. Old payments, events, and records become irrelevant noise.

### The Solution: Session-First Architecture

**Every single transactional document has a `session_id`.**

- ✅ Users: Persistent across time (Name, Email, Matric Number)
- ✅ Roles: Ephemeral, tied to sessions (President 2024/2025 vs 2025/2026)
- ✅ Data: All payments, events, grades tagged with `session_id`

**Result:** Switch sessions in the UI → entire dashboard "travels back in time"

---

## Architecture

### Backend (FastAPI + MongoDB)

**Tech Stack:**
- FastAPI (Python 3.10+)
- MongoDB (Motor async driver)
- Firebase Admin SDK (Authentication)
- Pydantic (Data validation)

**Key Files:**
- `backend/app/db.py` - MongoDB connection
- `backend/app/models/` - Pydantic models (session-first design)
- `backend/app/routers/` - API endpoints
- `backend/app/core/security.py` - Auth & role-based access control

### Frontend (Next.js 16)

**Tech Stack:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Firebase JS SDK (Client auth)

**Key Files:**
- `src/context/SessionContext.tsx` - Session state management
- `src/context/AuthContext.tsx` - User auth + MongoDB profile
- `src/components/dashboard/SessionSelector.tsx` - Time travel UI
- `src/app/api/` - Proxy routes to FastAPI backend

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- Firebase project with Authentication enabled

### 1. MongoDB Setup

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod --dbpath=/path/to/data
```

**Option B: MongoDB Atlas (Recommended)**
1. Create free cluster at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Get connection string
3. Whitelist your IP address

### 2. Firebase Setup

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication → Google + Email/Password
3. Download service account key:
   - Project Settings → Service Accounts → Generate new private key
   - Save as `backend/serviceAccountKey.json`
4. Get web app config (for frontend)

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env with your MongoDB and Firebase credentials
# MONGODB_URL=mongodb://localhost:27017
# DATABASE_NAME=iesa_db
# Place serviceAccountKey.json in backend/ directory

# Run backend
cd app
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### 4. Frontend Setup

```bash
# From project root
npm install

# Create .env.local
cp .env.local.example .env.local

# Edit .env.local with Firebase config and backend URL
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
# NEXT_PUBLIC_FIREBASE_API_KEY=...

# Run frontend
npm run dev
```

Frontend runs at `http://localhost:3000`

---

## Initial Data Setup

### Create First Academic Session

1. Sign in as admin (first user is auto-admin)
2. Use API or create via MongoDB:

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024/2025",
    "startDate": "2024-09-01T00:00:00Z",
    "endDate": "2025-08-31T23:59:59Z",
    "currentSemester": 1,
    "isActive": true
  }'
```

Or via MongoDB Compass:
```json
{
  "name": "2024/2025",
  "startDate": ISODate("2024-09-01T00:00:00Z"),
  "endDate": ISODate("2025-08-31T23:59:59Z"),
  "currentSemester": 1,
  "isActive": true,
  "createdAt": ISODate(),
  "updatedAt": ISODate()
}
```

---

## How the Time Travel Feature Works

### 1. User Logs In
- Firebase authenticates → JWT token
- Backend creates/fetches MongoDB user profile
- User auto-enrolled in active session (if student)

### 2. Dashboard Loads
- SessionContext fetches active session
- Session stored in localStorage for persistence
- SessionSelector appears in header

### 3. Viewing Data
- All API calls include `session_id` query parameter
- Backend filters payments, events, announcements by session
- Only session-specific data is returned

### 4. Time Travel
- User clicks SessionSelector
- Switches to "2023/2024"
- **ENTIRE DASHBOARD** refetches data for old session
- Payments, events, announcements all update
- Historical view - students see what they paid that year

---

## API Endpoints

### Sessions
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/active` - Get active session
- `GET /api/sessions/{id}` - Get specific session
- `POST /api/sessions` - Create session (admin only)
- `PATCH /api/sessions/{id}` - Update session (admin only)
- `DELETE /api/sessions/{id}` - Delete session + all data (admin only)

### Users
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update profile
- `POST /api/users` - Create/update user (called after Firebase auth)
- `GET /api/users` - List users (admin/exco only)
- `PATCH /api/users/{id}/role` - Change user role (admin only)

### Payments (Session-Aware)
- `GET /api/payments?session_id={id}` - List payments for session
- `GET /api/payments/{id}` - Get payment details
- `POST /api/payments` - Create payment (admin/exco only)
- `POST /api/payments/{id}/pay` - Record payment transaction
- `PATCH /api/payments/{id}` - Update payment (admin/exco only)
- `DELETE /api/payments/{id}` - Delete payment (admin only)

### Events, Announcements, Grades
(Similar patterns - all require `session_id`)

---

## Data Models

### User (Persistent)
```typescript
{
  _id: ObjectId,
  firebaseUid: string,
  email: string,
  firstName: string,
  lastName: string,
  matricNumber: string,  // e.g., "24/24IE001"
  department: string,
  role: "student" | "admin" | "exco",
  phone?: string,
  bio?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Session
```typescript
{
  _id: ObjectId,
  name: "2024/2025",
  startDate: Date,
  endDate: Date,
  currentSemester: 1 | 2,
  isActive: boolean,  // Only ONE can be true
  createdAt: Date,
  updatedAt: Date
}
```

### Payment (Session-Scoped)
```typescript
{
  _id: ObjectId,
  title: string,
  amount: number,
  sessionId: string,  // REQUIRED - links to Session
  mandatory: boolean,
  deadline: Date,
  paidBy: [string],  // Array of User IDs
  createdAt: Date,
  updatedAt: Date
}
```

### Role (Ephemeral)
```typescript
{
  _id: ObjectId,
  userId: string,
  sessionId: string,  // REQUIRED - role is session-specific
  position: "president" | "vice_president" | "class_rep" | etc.,
  level?: "100L" | "200L" | etc.,  // For class reps
  assignedAt: Date,
  assignedBy: string,  // Admin who assigned
  isActive: boolean
}
```

---

## Role-Based Access Control

### Student
- View payments, events, announcements for enrolled sessions
- Record own payments
- Register for events
- Update own profile
- **Read-only** access to past sessions

### Exco (Executive Committee)
- All student permissions
- Create/update payments, events, announcements
- View student lists
- Assign roles (with admin approval)
- Access to current + immediate past session

### Admin
- Full access to ALL sessions (time travel)
- Create/delete sessions
- Change user roles
- Delete any data
- Manage enrollments

---

## Development Workflow

### Adding a New Feature

1. **Backend:**
   - Create Pydantic model in `backend/app/models/`
   - Add router in `backend/app/routers/`
   - Register router in `backend/app/main.py`
   - If transactional, enforce `session_id` in model

2. **Frontend:**
   - Create API proxy in `src/app/api/`
   - Add component in `src/components/`
   - Use `useSession()` to get `currentSession.id`
   - Pass `session_id` to API calls

### Testing Session-Aware Features

1. Create multiple sessions (2023/2024, 2024/2025)
2. Add data to each (payments, events)
3. Switch sessions using SessionSelector
4. Verify data changes based on selected session

---

## Deployment

### Backend (FastAPI)

**Option 1: Railway/Render**
```bash
# Use gunicorn for production
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

**Option 2: Docker**
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Frontend (Next.js)

**Vercel (Recommended)**
```bash
vercel --prod
```

**Environment Variables:**
- `NEXT_PUBLIC_BACKEND_URL` - Production FastAPI URL
- Firebase config (all `NEXT_PUBLIC_FIREBASE_*`)

---

## Troubleshooting

### Backend won't start
- Check MongoDB connection string
- Verify Firebase service account key exists
- Check Python version (3.10+)

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_BACKEND_URL` in `.env.local`
- Check CORS settings in `backend/app/main.py`
- Ensure backend is running

### Session selector is empty
- Create at least one session via API
- Check MongoDB `sessions` collection
- Verify user is authenticated

### User profile not loading
- Check Firebase auth is working
- Verify `/api/users/me` endpoint
- Check browser console for errors

---

## Future Enhancements

- [ ] Events router with RSVP tracking
- [ ] Announcements router with read receipts
- [ ] Grades router for CGPA tracking across sessions
- [ ] Library management system
- [ ] Attendance tracking for events
- [ ] Analytics dashboard (session comparisons)
- [ ] Bulk import students from CSV
- [ ] Email notifications
- [ ] Mobile app (React Native)

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues or questions:
- GitHub Issues: [devqing00/iesa](https://github.com/devqing00/iesa)
- Email: support@iesa.dev

---

**Built with ❤️ for the Industrial Engineering Department**
