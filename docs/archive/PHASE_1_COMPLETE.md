# 🎯 Phase 1: Foundation & Architecture - COMPLETE

## Overview

Phase 1 establishes the robust foundation for the IESA ERP system with:
- ✅ Enhanced database models with admission year and current level tracking
- ✅ Permission-based RBAC (not role-based)
- ✅ Session-aware middleware (`get_current_session`)
- ✅ Versioned API structure (`/api/v1/*`)
- ✅ Advanced route protection with permissions
- ✅ Profile management for static data

---

## Week 1: Project Setup & Database Architecture ✅

### 1. Tech Stack Initialization

**Backend Structure:**
```
/api/v1/auth       → User authentication (Firebase)
/api/v1/academics  → Future: Grades, CGPA, courses
/api/v1/admin      → Session, enrollment, role management
/api/v1/users      → User profiles
/api/v1/sessions   → Session CRUD
/api/v1/payments   → Payment tracking
/api/v1/events     → Event management
/api/v1/announcements → Communications
```

**Database:** MongoDB Atlas (configured in `.env`)

### 2. Enhanced Schema Implementation

#### Users Model (Persistent)
```python
class UserBase(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    matricNumber: Optional[str]
    department: str = "Industrial Engineering"
    phone: Optional[str]
    role: Literal["student", "admin", "exco"]
    bio: Optional[str]
    profilePictureUrl: Optional[str]
    
    # ✨ Phase 1 Enhancements
    admissionYear: Optional[int]  # 2000-2030
    currentLevel: Optional[Literal["100L", "200L", "300L", "400L", "500L"]]
    skills: Optional[list[str]]  # Up to 20 skills
```

**Key Points:**
- Users are **persistent** across all sessions (no `session_id`)
- `admissionYear` tracks when student entered the program
- `currentLevel` is admin-controlled to prevent students from self-promoting
- `skills` array for portfolio building

#### Sessions Model (Academic Years)
```python
class SessionBase(BaseModel):
    name: str  # "2024/2025"
    startDate: datetime
    endDate: datetime
    isActive: bool
    currentSemester: Literal[1, 2]
```

**Key Points:**
- Only ONE session can be `isActive: true` at a time
- `session_code` pattern: `YYYY/YYYY`
- Deleting a session cascades to all ephemeral data

#### Roles Model (Session-Scoped)
```python
class RoleBase(BaseModel):
    userId: str
    sessionId: str  # REQUIRED
    position: PositionType
    level: Optional[str]
    
    # ✨ Phase 1: Permission-Based RBAC
    permissions: list[str]  # ["announcement:create", "payment:approve", ...]
```

**Key Points:**
- Roles are **ephemeral** (tied to sessions)
- Permissions are **fine-grained** (`announcement:create`, not `is_president`)
- Default permissions assigned by position (see `DEFAULT_PERMISSIONS`)

### 3. Middleware: `get_current_session()`

**Location:** [backend/app/core/permissions.py](backend/app/core/permissions.py)

**Usage:**
```python
from app.core.permissions import get_current_session

@router.get("/events")
async def list_events(session: dict = Depends(get_current_session)):
    session_id = str(session["_id"])
    # Fetch events for this session
```

**How It Works:**
1. Checks `X-Session-ID` header for explicit session selection
2. Falls back to active session if header missing
3. Raises 404 if no active session exists
4. Returns full session document (not just ID)

**Frontend Integration:**
```typescript
const response = await fetch("/api/v1/events", {
  headers: {
    "Authorization": `Bearer ${token}`,
    "X-Session-ID": currentSession.id  // Optional: defaults to active
  }
});
```

---

## Week 2: RBAC & Authentication ✅

### 1. Permission-Based Authorization

**Philosophy Shift:**
```python
# ❌ OLD WAY (Role-Based)
if user.role == "president":
    create_announcement()

# ✅ NEW WAY (Permission-Based)
if "announcement:create" in user_permissions:
    create_announcement()
```

**Why?**
- Flexible: VP can have `announcement:create` too
- Session-aware: Permissions expire with session
- Granular: Separate `create`, `edit`, `delete` permissions
- Extensible: Add new permissions without code changes

### 2. Permission Registry

**Location:** [backend/app/core/permissions.py](backend/app/core/permissions.py)

**Available Permissions:**
```python
PERMISSIONS = {
    # Announcements
    "announcement:create": "Create announcements",
    "announcement:edit": "Edit announcements",
    "announcement:delete": "Delete announcements",
    "announcement:view": "View announcements",
    
    # Events
    "event:create": "Create events",
    "event:edit": "Edit events",
    "event:delete": "Delete events",
    "event:manage": "Manage event registrations",
    
    # Payments
    "payment:create": "Create payment requests",
    "payment:edit": "Edit payment requests",
    "payment:delete": "Delete payment requests",
    "payment:approve": "Approve/verify payments",
    "payment:view_all": "View all students' payments",
    
    # Grades
    "grade:create": "Create grade records",
    "grade:edit": "Edit grade records",
    "grade:view_all": "View all students' grades",
    
    # Users
    "user:view_all": "View all users",
    "user:edit": "Edit user profiles",
    "user:delete": "Delete users",
    
    # Roles
    "role:assign": "Assign roles to users",
    "role:revoke": "Revoke roles from users",
    "role:view": "View role assignments",
    
    # Sessions
    "session:create": "Create new sessions",
    "session:edit": "Edit sessions",
    "session:activate": "Activate/deactivate sessions",
    "session:delete": "Delete sessions",
    
    # Enrollments
    "enrollment:create": "Enroll students in sessions",
    "enrollment:edit": "Edit enrollments",
    "enrollment:delete": "Delete enrollments",
}
```

### 3. Default Permissions by Position

**President:**
```python
DEFAULT_PERMISSIONS["president"] = [
    "announcement:create", "announcement:edit", "announcement:delete",
    "event:create", "event:edit", "event:delete", "event:manage",
    "payment:create", "payment:edit", "payment:delete", "payment:approve",
    "user:view_all", "role:view",
]
```

**Financial Secretary:**
```python
DEFAULT_PERMISSIONS["financial_secretary"] = [
    "payment:create", "payment:edit", "payment:approve", "payment:view_all",
    "announcement:view",
]
```

**Class Rep:**
```python
DEFAULT_PERMISSIONS["class_rep"] = [
    "announcement:view",
    "event:view",
    "payment:view_all",
]
```

### 4. Using Permissions in Routes

**Method 1: Dependencies**
```python
from app.core.permissions import require_permission

@router.post("/announcements", dependencies=[Depends(require_permission("announcement:create"))])
async def create_announcement(...):
    # Only users with announcement:create can access
```

**Method 2: Multiple Permissions**
```python
from app.core.permissions import require_any_permission, require_all_permissions

# ANY permission (OR logic)
@router.get("/dashboard", dependencies=[Depends(require_any_permission(["payment:view_all", "event:manage"]))])
async def dashboard(...):
    pass

# ALL permissions (AND logic)
@router.post("/critical", dependencies=[Depends(require_all_permissions(["payment:approve", "user:edit"]))])
async def critical_action(...):
    pass
```

**Method 3: Manual Check**
```python
from app.core.permissions import get_user_permissions

async def custom_logic(user: User, session: dict):
    permissions = await get_user_permissions(user.id, str(session["_id"]))
    
    if "announcement:create" in permissions:
        # Allow action
    else:
        raise HTTPException(status_code=403, detail="No permission")
```

### 5. Admin Override

**Admins get ALL permissions automatically:**
```python
async def get_user_permissions(user_id: str, session_id: str) -> List[str]:
    user = await users.find_one({"_id": user_id})
    
    if user and user.get("role") == "admin":
        return list(PERMISSIONS.keys())  # All permissions
    
    # ... continue checking roles
```

### 6. Profile Management Endpoints

**Update Static Data (Self-Service):**
```http
PATCH /api/v1/users/me
Content-Type: application/json

{
  "phone": "+2348012345678",
  "bio": "Passionate about industrial optimization",
  "skills": ["Python", "AutoCAD", "Lean Manufacturing"]
}
```

**Update Academic Info (Admin Only):**
```http
PATCH /api/v1/users/{user_id}/academic-info
Content-Type: application/json

{
  "admissionYear": 2022,
  "currentLevel": "300L"
}
```

**Update Role (Admin Only):**
```http
PATCH /api/v1/users/{user_id}/role
Content-Type: application/json

{
  "new_role": "exco"
}
```

---

## Week 3: Dashboard Skeleton ✅

### 1. Permission-Aware State Management

**New Context:** [src/context/PermissionsContext.tsx](src/context/PermissionsContext.tsx)

**Usage:**
```typescript
import { usePermissions } from "@/context/PermissionsContext";

function MyComponent() {
  const { hasPermission, hasAnyPermission, loading } = usePermissions();
  
  if (loading) return <Spinner />;
  
  return (
    <div>
      {hasPermission("announcement:create") && (
        <CreateAnnouncementButton />
      )}
      
      {hasAnyPermission(["event:create", "event:edit"]) && (
        <ManageEventsButton />
      )}
    </div>
  );
}
```

### 2. Higher-Order Component (HOC) for Route Protection

**Location:** [src/lib/withAuth.tsx](src/lib/withAuth.tsx)

**Usage:**

**Require Authentication Only:**
```typescript
export default withAuth(MyComponent);
```

**Require Permission:**
```typescript
export default withAuth(MyComponent, {
  requiredPermission: "announcement:create"
});
```

**Require ANY Permission:**
```typescript
export default withAuth(MyComponent, {
  anyPermission: ["event:create", "event:edit"]
});
```

**Require ALL Permissions:**
```typescript
export default withAuth(MyComponent, {
  requiredPermissions: ["payment:approve", "payment:edit"]
});
```

**Require Role (Legacy):**
```typescript
export default withAuth(MyComponent, {
  allowedRoles: ["admin", "exco"]
});
```

### 3. Permission Gate Component

**Conditional Rendering:**
```tsx
import { PermissionGate } from "@/lib/withAuth";

<PermissionGate permission="announcement:create">
  <CreateButton />
</PermissionGate>

<PermissionGate anyPermission={["event:create", "event:edit"]}>
  <ManageEventsSection />
</PermissionGate>

<PermissionGate 
  permission="payment:approve" 
  fallback={<AccessDenied />}
>
  <PaymentApprovalPanel />
</PermissionGate>
```

### 4. Permission Check Hook

**Inline Permission Checks:**
```typescript
import { usePermissionCheck } from "@/lib/withAuth";

function EventCard({ event }) {
  const canEdit = usePermissionCheck("event:edit");
  
  return (
    <div>
      <h3>{event.title}</h3>
      {canEdit && <EditButton />}
    </div>
  );
}
```

### 5. Updated Providers

**Order Matters:**
```tsx
// src/app/providers.tsx
<ThemeProvider>
  <SessionProvider>
    <PermissionsProvider>  {/* Must be inside SessionProvider */}
      {children}
    </PermissionsProvider>
  </SessionProvider>
</ThemeProvider>
```

**Why?**
- PermissionsProvider needs SessionContext to fetch permissions for current session
- Permissions are session-scoped (president in 2024/2025 ≠ president in 2025/2026)

---

## API Versioning

### Versioned Routes (Primary)
```
/api/v1/users
/api/v1/sessions
/api/v1/payments
/api/v1/events
/api/v1/announcements
/api/v1/grades
/api/v1/enrollments
/api/v1/roles
```

### Legacy Routes (Backward Compatibility)
```
/api/users      → Same as /api/v1/users
/api/sessions   → Same as /api/v1/sessions
...
```

**Why Both?**
- `/api/v1/*` is the primary structure going forward
- `/api/*` maintains compatibility with existing code
- Both route to the same handlers (no duplication)

**Future:**
- Phase 2 might introduce `/api/v2/*` with breaking changes
- Old clients continue using `/api/v1/*`

---

## Migration Guide

### For Backend Developers

**Old Route Protection:**
```python
@router.post("/announcements", dependencies=[Depends(require_role(["admin", "exco"]))])
async def create_announcement(...):
    pass
```

**New Route Protection:**
```python
@router.post("/announcements", dependencies=[Depends(require_permission("announcement:create"))])
async def create_announcement(...):
    pass
```

**Using Session Middleware:**
```python
# Old
@router.get("/events")
async def list_events(session_id: str = Query(...)):
    # Manually fetch session
    pass

# New
@router.get("/events")
async def list_events(session: dict = Depends(get_current_session)):
    session_id = str(session["_id"])
    # Session auto-injected
```

### For Frontend Developers

**Old Permission Check:**
```tsx
{userProfile?.role === "admin" && <AdminPanel />}
```

**New Permission Check:**
```tsx
{hasPermission("user:edit") && <AdminPanel />}
```

**Protecting Pages:**
```tsx
// Old
export default function AdminPage() {
  const { userProfile } = useAuth();
  
  if (userProfile?.role !== "admin") {
    return <AccessDenied />;
  }
  
  return <Content />;
}

// New
function AdminPage() {
  return <Content />;
}

export default withAuth(AdminPage, {
  requiredPermission: "user:edit"
});
```

---

## Testing Phase 1

### Backend Tests

**1. Test Permission System:**
```bash
# Assign president role to test user
POST /api/v1/roles
{
  "userId": "...",
  "sessionId": "...",
  "position": "president"
}

# Verify permissions
GET /api/v1/users/me/permissions
# Should return president's default permissions
```

**2. Test Session Middleware:**
```bash
# Without header (uses active session)
GET /api/v1/events

# With header (explicit session)
GET /api/v1/events
X-Session-ID: 507f1f77bcf86cd799439011
```

**3. Test Profile Updates:**
```bash
# Update static data (allowed)
PATCH /api/v1/users/me
{
  "phone": "+2348012345678",
  "skills": ["Python", "CAD"]
}

# Try to update level (should fail - no permission)
PATCH /api/v1/users/me
{
  "currentLevel": "500L"
}
```

### Frontend Tests

**1. Test Permission Loading:**
```tsx
const { permissions, loading } = usePermissions();
console.log("Permissions:", permissions);
// Should see array like ["announcement:create", "event:manage", ...]
```

**2. Test Route Protection:**
```tsx
// Navigate to /dashboard/admin/sessions
// Should redirect if no session:create permission
```

**3. Test Permission Gates:**
```tsx
<PermissionGate permission="announcement:create">
  <button>Create</button>  {/* Should only show if permitted */}
</PermissionGate>
```

---

## Key Achievements

✅ **Database Models:** Enhanced with `admissionYear`, `currentLevel`, `skills`, `permissions[]`
✅ **RBAC:** Switched from role-based to permission-based authorization
✅ **Middleware:** `get_current_session()` auto-injects current session
✅ **API Structure:** Versioned `/api/v1/*` with legacy compatibility
✅ **Profile Management:** Separate endpoints for static vs admin-controlled fields
✅ **Frontend HOC:** `withAuth` for declarative route protection
✅ **Permission Context:** Real-time permission checking in components
✅ **Permission Gates:** Conditional rendering based on permissions

---

## Next Steps (Phase 2)

- Integrate permission system into existing routers (payments, events, announcements)
- Add permission management UI for admins
- Implement audit logging for permission-sensitive actions
- Add real-time permission updates (WebSockets)
- Create permission documentation generator
- Build permission matrix visualization

---

## Quick Reference

**Check User Permission:**
```python
# Backend
permissions = await get_user_permissions(user_id, session_id)
if "announcement:create" in permissions:
    # Allow
```

```tsx
// Frontend
const { hasPermission } = usePermissions();
if (hasPermission("announcement:create")) {
  // Show button
}
```

**Protect Route:**
```python
# Backend
@router.post("/announcements", dependencies=[Depends(require_permission("announcement:create"))])
```

```tsx
// Frontend
export default withAuth(MyPage, { requiredPermission: "announcement:create" });
```

**Get Current Session:**
```python
# Backend
@router.get("/events")
async def list_events(session: dict = Depends(get_current_session)):
    session_id = str(session["_id"])
```

```tsx
// Frontend
const { currentSession } = useSession();
fetch(`/api/v1/events?session_id=${currentSession.id}`);
```

---

**Phase 1 Status: ✅ COMPLETE**

The foundation is solid, permission-based, and session-aware. Ready for Phase 2!
