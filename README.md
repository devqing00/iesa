# 🎓 IESA Platform

**Modern departmental web platform with permission-based access control**

IESA is a comprehensive student management system built for academic departments. Features include user authentication, session management, announcements, events, payments tracking, and more.

---

## ✨ Key Features

- 🔐 **Permission-Based RBAC** - Granular access control (25+ permissions)
- 📅 **Session Management** - Multi-year academic session tracking
- 👥 **User Management** - Students, EXCO members, and admins
- 📢 **Announcements** - Level-specific notifications
- 🎉 **Events** - Session-aware event management
- 💰 **Payments** - Financial tracking per session
- 📊 **Enrollments** - Student level management
- 🎨 **Modern UI** - Glassmorphism design with dark mode

---

## 🚀 Quick Start

### **Frontend (Next.js)**

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### **Backend (FastAPI)**

```bash
cd backend
pip install -r requirements.txt
cd app
uvicorn main:app --reload
# API running at http://localhost:8000
```

### **Environment Setup**

Create `.env.local` with Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

---

## 🏗️ Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Firebase Auth
- React Context API

**Backend:**
- FastAPI
- MongoDB (Motor)
- Firebase Admin SDK
- Pydantic v2

---

## 📚 Documentation

- [**Permission System Guide**](docs/PERMISSIONS_GUIDE.md) - Complete permission reference
- [**Migration Complete**](docs/MIGRATION_COMPLETE.md) - Recent consolidation changes
- [**Archived Docs**](docs/archive/) - Historical implementation guides

---

## 🔑 Permission System

Instead of role-based checks, IESA uses **granular permissions**:

```python
# Backend
@router.post("/", dependencies=[Depends(require_permission("enrollment:create"))])

# Frontend
export default withAuth(EnrollmentsPage, { 
  anyPermission: ["enrollment:create", "enrollment:view"] 
});
```

See [PERMISSIONS_GUIDE.md](docs/PERMISSIONS_GUIDE.md) for full list.

---

## 📁 Project Structure

```
iesa/
├── src/
│   ├── app/              # Next.js pages
│   ├── components/       # Reusable UI components
│   ├── context/          # Auth, Session, Permissions contexts
│   └── lib/              # withAuth HOC, Firebase config
├── backend/
│   ├── app/
│   │   ├── routers/      # API endpoints
│   │   ├── models/       # Pydantic models
│   │   └── core/         # Security & permissions
│   └── requirements.txt
└── docs/                 # Documentation
```

---

## 🧪 Testing

**Backend:**
```bash
cd backend
pytest
```

**Frontend:**
```bash
npm run lint
npm run build
```

---

## 🤝 Contributing

1. Follow the permission-based patterns
2. Use TypeScript for type safety
3. Test with different user roles
4. Document new permissions

---

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for academic excellence**

