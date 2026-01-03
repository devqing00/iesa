# Phase 2: The Student Experience - Complete Implementation Plan

## 🎯 Current State Analysis

### ✅ What Already Exists

**Frontend Student Pages:**
- ✅ Dashboard Overview ([/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)) - Stats display (mock data)
- ✅ Events ([/dashboard/events/page.tsx](src/app/(dashboard)/dashboard/events/page.tsx)) - Event grid with filters (mock data)
- ✅ Library ([/dashboard/library/page.tsx](src/app/(dashboard)/dashboard/library/page.tsx)) - Resource cards (mock data)
- ✅ Payments ([/dashboard/payments/page.tsx](src/app/(dashboard)/dashboard/payments/page.tsx)) - Dues & transactions (mock data)
- ✅ Announcements ([/dashboard/announcements/page.tsx](src/app/(dashboard)/dashboard/announcements/page.tsx)) - Announcement list (mock data)
- ✅ Profile ([/dashboard/profile/page.tsx](src/app/(dashboard)/dashboard/profile/page.tsx))
- ✅ Growth Hub:
  - ✅ Growth Landing ([/dashboard/growth/page.tsx](src/app/(dashboard)/dashboard/growth/page.tsx))
  - ✅ **CGPA Calculator** ([/dashboard/growth/cgpa/page.tsx](src/app/(dashboard)/dashboard/growth/cgpa/page.tsx)) - **FULLY IMPLEMENTED**
    - ✅ Client-side calculator with localStorage
    - ✅ Multi-semester workspace
    - ✅ Simulator for "what-if" scenarios
    - ✅ CSV import/export
    - ✅ Snapshots for saving states
    - ✅ Previous CGPA integration
  - ⚠️ Schedule Bot ([/dashboard/growth/schedule-bot/page.tsx](src/app/(dashboard)/dashboard/growth/schedule-bot/page.tsx)) - UI exists, needs backend
  - ⚠️ Planner ([/dashboard/growth/planner/page.tsx](src/app/(dashboard)/dashboard/growth/planner/page.tsx)) - Placeholder only

**Backend APIs (Already Built):**
- ✅ `/api/events` - Full CRUD + registration system ([events.py](backend/app/routers/events.py))
- ✅ `/api/announcements` - Full CRUD + level targeting ([announcements.py](backend/app/routers/announcements.py))
- ✅ `/api/payments` - Payment dues + transaction tracking ([payments.py](backend/app/routers/payments.py))
- ✅ `/api/users` - User profiles + permissions ([users.py](backend/app/routers/users.py))
- ✅ `/api/students` - Registration + matric validation ([students.py](backend/app/routers/students.py))

### ❌ What's Missing for Phase 2

**Major Gaps:**
1. **Library/Resources System** - No backend, no file storage
2. **Timetable/Schedule System** - No ClassSessions collection, no API
3. **Paystack Integration** - No payment processing
4. **PDF Receipt Generation** - No document generation
5. **Digital ID Card** - No ID generation
6. **File Upload Infrastructure** - No Cloudinary/S3 integration
7. **IESA Bot** - No AI/chatbot backend
8. **Personal Planner** - Only placeholder UI

---

## 📋 Phase 2: Complete Feature Breakdown

### **Week 4: Academic Hub (Library & Growth)**

#### **4.1: Resource Library System** 🆕 PRIORITY HIGH

**Database Schema:**
```python
# New collection: resources
{
  "_id": ObjectId,
  "sessionId": ObjectId,  # Session-scoped
  "title": str,
  "description": str,
  "type": str,  # "slide", "pastQuestion", "video", "textbook", "note"
  "courseCode": str,  # "TVE 202", "MEE 301", "General"
  "level": int,  # 100, 200, 300, 400, 500
  "fileUrl": str,  # Cloudinary URL
  "filePublicId": str,  # Cloudinary public ID for deletion
  "fileType": str,  # "pdf", "pptx", "mp4", "docx"
  "fileSize": int,  # bytes
  "uploadedBy": ObjectId,  # User ID
  "uploaderName": str,
  "tags": [str],  # ["thermodynamics", "calculus", "CAD"]
  "downloadCount": int,
  "viewCount": int,
  "isApproved": bool,  # Academic Committee approval
  "approvedBy": ObjectId | None,
  "createdAt": datetime,
  "updatedAt": datetime
}
```

**Backend Tasks:**
- [ ] Install Cloudinary SDK: `pip install cloudinary`
- [ ] Create `/api/resources` router with endpoints:
  - `POST /api/resources/upload` - Upload file (requires `resource:upload` permission)
  - `GET /api/resources` - List resources (filters: level, courseCode, type, sessionId)
  - `GET /api/resources/{id}` - Get single resource
  - `PATCH /api/resources/{id}/approve` - Approve resource (requires `resource:approve`)
  - `DELETE /api/resources/{id}` - Delete resource + Cloudinary file
  - `POST /api/resources/{id}/download` - Track downloads
- [ ] Add Cloudinary config to `backend/.env`:
  ```
  CLOUDINARY_CLOUD_NAME=your_cloud_name
  CLOUDINARY_API_KEY=your_api_key
  CLOUDINARY_API_SECRET=your_api_secret
  ```
- [ ] Create folder structure in Cloudinary: `/iesa/{sessionName}/{level}/{courseCode}/{type}/`
- [ ] Implement file validation:
  - Max size: 50MB for PDFs/PPT, 500MB for videos
  - Allowed types: pdf, pptx, ppt, mp4, docx, png, jpg
- [ ] Add permissions to roles:
  - `resource:upload` - Academic Committee only
  - `resource:approve` - Academic Committee leadership
  - `resource:delete` - Admin + Academic Committee

**Frontend Tasks:**
- [ ] Update [library/page.tsx](src/app/(dashboard)/dashboard/library/page.tsx):
  - Replace mock data with API calls to `/api/resources`
  - Add filters: Level, Course Code, Material Type
  - Add search by title/tags
  - Show download/view counts
  - Add "Request Resource" button (creates announcement)
- [ ] Create upload form (Academic Committee only):
  - File picker with drag-and-drop
  - Course code dropdown (dynamic from courses list)
  - Level selector
  - Type selector (slide/PQ/video/textbook/note)
  - Tags input (chips)
  - Preview before upload
  - Upload progress bar
- [ ] Add resource detail modal:
  - Title, description, file info
  - Preview (if PDF/image)
  - Download button
  - Share link
  - Report button

**Infrastructure:**
- [ ] Set up Cloudinary account (free tier: 25GB storage, 25GB bandwidth/month)
- [ ] Configure folder auto-creation
- [ ] Set up auto-tagging for organization

---

#### **4.2: GP Calculator Enhancement** ✅ ALREADY DONE

**Status:** The CGPA calculator is fully implemented with:
- ✅ Multi-semester workspace
- ✅ "What-if" simulator
- ✅ CSV import/export
- ✅ localStorage for privacy (no database storage)
- ✅ Previous CGPA integration
- ✅ Snapshots for saving states

**No work needed.** Consider adding:
- [ ] Tutorial/onboarding tour (optional)
- [ ] Export to PDF report (optional)

---

### **Week 5: IESA Bot & Timetables**

#### **5.1: Dynamic Timetable System** 🆕 PRIORITY HIGH

**Database Schema:**
```python
# New collection: classSessions
{
  "_id": ObjectId,
  "sessionId": ObjectId,  # Academic session
  "courseCode": str,  # "TVE 202"
  "courseTitle": str,  # "Engineering Drawing II"
  "level": int,  # 200
  "day": str,  # "Monday", "Tuesday", etc.
  "startTime": str,  # "08:00"
  "endTime": str,  # "10:00"
  "venue": str,  # "LT1", "CAD Lab"
  "lecturer": str | None,
  "type": str,  # "lecture", "practical", "tutorial"
  "recurring": bool,  # True for weekly classes
  "createdBy": ObjectId,
  "createdAt": datetime,
  "updatedAt": datetime
}

# New collection: classCancellations
{
  "_id": ObjectId,
  "classSessionId": ObjectId,
  "date": date,  # Specific date cancelled (e.g., 2025-02-15)
  "reason": str,
  "cancelledBy": ObjectId,  # Class Rep
  "cancelledAt": datetime
}
```

**Backend Tasks:**
- [ ] Create `/api/timetable` router:
  - `POST /api/timetable/classes` - Add class (requires `timetable:create`)
  - `GET /api/timetable/classes` - List classes (filter: level, day, sessionId)
  - `PATCH /api/timetable/classes/{id}` - Update class
  - `DELETE /api/timetable/classes/{id}` - Delete class
  - `POST /api/timetable/classes/{id}/cancel` - Cancel specific occurrence (Class Rep only)
  - `GET /api/timetable/week` - Get weekly view (params: level, week_start_date)
  - `GET /api/timetable/today` - Get today's classes (params: level)
- [ ] Add permissions:
  - `timetable:create` - Class Rep, Admin
  - `timetable:edit` - Class Rep, Admin
  - `timetable:cancel` - Class Rep only
- [ ] Implement cancellation logic:
  - Check if class is recurring
  - Store cancellation with specific date
  - Filter out cancelled dates in GET endpoints

**Frontend Tasks:**
- [ ] Create [/dashboard/timetable/page.tsx](src/app/(dashboard)/dashboard/timetable/page.tsx):
  - Weekly grid view (desktop): Use `react-big-calendar` or custom grid
  - Vertical list view (mobile): Grouped by day
  - "Today" quick view
  - Filter by level (if user is Class Rep managing multiple levels)
  - Color-coded by course/type
  - Show venue, time, lecturer
  - Cancelled classes shown with strikethrough + reason
- [ ] Add "Cancel Class" button (Class Rep only):
  - Date picker for specific occurrence
  - Reason input
  - Confirmation dialog
  - Real-time update on cancel
- [ ] Create timetable management page (Class Rep/Admin):
  - Add class form (course, day, time, venue, recurring)
  - Bulk import from CSV
  - Edit/delete classes
- [ ] Add to sidebar navigation (between Events and Library)

**Libraries to Install:**
```bash
npm install react-big-calendar date-fns
# OR for custom grid:
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid
```

---

#### **5.2: IESA Bot (Schedule Query + General Help)** 🆕 MEDIUM PRIORITY

**Bot Features:**
1. **Schedule Queries:**
   - "What classes do I have tomorrow?"
   - "When is TVE 202 next week?"
   - "Show me my timetable for Monday"
2. **General Help:**
   - "How do I pay my dues?"
   - "When is the next event?"
   - "What are the library hours?"
3. **Quick Actions:**
   - "Export my timetable to calendar"
   - "Remind me about upcoming deadlines"

**Implementation Options:**

**Option A: Simple Rule-Based Bot (Recommended for MVP)**
- [ ] Create `/api/bot/query` endpoint
- [ ] Parse user intent using regex/keywords:
  - "tomorrow", "today", "next week" → Timetable query
  - "pay", "dues", "payment" → Payment info
  - "event", "events" → Fetch upcoming events
- [ ] Return structured responses from database
- [ ] No AI needed, just smart text parsing

**Option B: AI-Powered Bot (Advanced)**
- [ ] Integrate OpenAI API or local LLM
- [ ] Create RAG system with IESA documentation
- [ ] Use function calling for database queries
- [ ] Much more flexible, but requires API costs

**Backend Tasks (Option A):**
- [ ] Create `/api/bot/query` endpoint:
  ```python
  POST /api/bot/query
  {
    "message": "What classes do I have tomorrow?",
    "userId": "...",
    "level": 200
  }
  Response:
  {
    "response": "You have 3 classes tomorrow:\n- TVE 202 (08:00-10:00, LT1)\n- MEE 301 (10:00-12:00, Workshop)\n- GNS 201 (14:00-16:00, LT2)",
    "data": [...],  # Structured class data
    "suggestions": ["Export to calendar", "Set reminder"]
  }
  ```
- [ ] Implement intent detection:
  - Timetable: Check for days, course codes, time words
  - Payments: Check for "pay", "dues", "receipt"
  - Events: Check for "event", "program", "activity"
  - Help: Default fallback with FAQs
- [ ] Add conversation history (optional):
  - Store last 5 messages in session
  - Allow follow-up questions

**Frontend Tasks:**
- [ ] Enhance [schedule-bot/page.tsx](src/app/(dashboard)/dashboard/growth/schedule-bot/page.tsx):
  - Connect to `/api/bot/query` instead of mock
  - Add quick action buttons in responses
  - Add typing indicator while processing
  - Add example queries as chips
  - Add "Export to Calendar" action (generates .ics file)
  - Add chat history persistence (localStorage)

**Optional Enhancements:**
- [ ] Voice input (Web Speech API)
- [ ] Export timetable as image
- [ ] SMS notifications for class reminders (Twilio integration)

---

### **Week 6: Payments & ID Cards**

#### **6.1: Paystack Payment Integration** 🆕 PRIORITY HIGH

**Paystack Features:**
- Accept card payments
- Bank transfer
- USSD payments
- Mobile money
- Generate payment receipts

**Database Updates:**
```python
# Update payments collection:
{
  # ...existing fields...
  "paystackReference": str | None,  # Paystack transaction reference
  "paystackStatus": str | None,  # "pending", "success", "failed"
  "receiptUrl": str | None,  # Link to generated PDF receipt
  "receiptNumber": str | None,  # e.g., "IESA-2025-001234"
}

# New collection: transactions
{
  "_id": ObjectId,
  "paymentId": ObjectId,  # Link to payment due
  "userId": ObjectId,
  "sessionId": ObjectId,
  "amount": float,
  "paystackReference": str,
  "paystackStatus": str,
  "paymentMethod": str,  # "card", "bank_transfer", "ussd"
  "paidAt": datetime | None,
  "receiptUrl": str | None,
  "receiptNumber": str,
  "metadata": dict,  # Paystack metadata
  "createdAt": datetime,
  "updatedAt": datetime
}
```

**Backend Tasks:**
- [ ] Install Paystack SDK: `pip install paystackapi`
- [ ] Add to `backend/.env`:
  ```
  PAYSTACK_SECRET_KEY=sk_test_...
  PAYSTACK_PUBLIC_KEY=pk_test_...
  ```
- [ ] Create `/api/payments/paystack` router:
  - `POST /api/payments/initialize` - Initialize payment
    ```python
    {
      "paymentId": "...",  # Payment due ID
      "email": "student@stu.ui.edu.ng",
      "amount": 3000  # Kobo (₦30.00)
    }
    Response:
    {
      "authorizationUrl": "https://checkout.paystack.com/...",
      "reference": "trx_abc123",
      "accessCode": "xyz789"
    }
    ```
  - `POST /api/payments/webhook` - Paystack webhook for payment verification
    - Verify payment signature
    - Update transaction status
    - Mark payment as paid
    - Generate receipt
    - Send email notification
  - `GET /api/payments/verify/{reference}` - Manual verification endpoint

**Receipt Generation:**
- [ ] Install ReportLab: `pip install reportlab`
- [ ] Create receipt template:
  - IESA logo
  - Receipt number (format: `IESA-{year}-{6-digit-sequence}`)
  - Student details (name, matric, level)
  - Payment details (amount, date, method)
  - Session (e.g., "2024/2025")
  - QR code for verification (optional)
- [ ] Upload PDF to Cloudinary after generation
- [ ] Store URL in transaction record

**Frontend Tasks:**
- [ ] Update [payments/page.tsx](src/app/(dashboard)/dashboard/payments/page.tsx):
  - Fetch real payment dues from `/api/payments?userId={currentUser}`
  - Add "Pay Now" button for unpaid dues
  - Show payment modal with Paystack inline checkout:
    ```tsx
    import { usePaystackPayment } from 'react-paystack';
    
    const PaymentButton = ({ payment }) => {
      const config = {
        reference: payment.paystackReference,
        email: user.email,
        amount: payment.amount * 100,  // Convert to kobo
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      };
      
      const onSuccess = (reference) => {
        // Verify payment on backend
        verifyPayment(reference);
      };
      
      const initializePayment = usePaystackPayment(config);
      
      return <button onClick={() => initializePayment(onSuccess)}>Pay ₦{payment.amount}</button>;
    };
    ```
  - Show transaction history from `/api/payments/transactions`
  - Add "Download Receipt" button for successful payments
  - Show payment status badges (Pending, Paid, Failed)

**Libraries to Install:**
```bash
npm install react-paystack
```

---

#### **6.2: Digital ID Card** 🆕 MEDIUM PRIORITY

**Features:**
- Student photo (from profile)
- Name, matric number, level
- Department (Industrial Engineering)
- Session (2024/2025)
- Payment status indicator:
  - **Green border** = Paid
  - **Red border** = Owing
- QR code with student ID (for verification)
- Downloadable as image

**Implementation:**

**Backend Tasks:**
- [ ] Add `/api/users/id-card/{userId}` endpoint:
  - Fetch user profile
  - Check payment status for current session
  - Generate QR code with encrypted student ID
  - Return data for frontend rendering

**Frontend Tasks:**
- [ ] Create ID Card component in [profile/page.tsx](src/app/(dashboard)/dashboard/profile/page.tsx):
  - Card design (ID card dimensions: 3.375" x 2.125")
  - Student photo (cropped circular or square)
  - Department logo/crest
  - Payment status border (dynamic color)
  - QR code generated with `qrcode.react`
  - "Download ID" button (html-to-image library)
- [ ] Add print-friendly CSS for physical printing

**Libraries to Install:**
```bash
npm install qrcode.react html-to-image
```

**ID Card Design Example:**
```
┌─────────────────────────────────────┐
│  [IESA LOGO]     Payment Status: ✓  │
│                                     │
│     ┌───────┐                       │
│     │ PHOTO │   John Doe            │
│     └───────┘   236856              │
│                 200 Level           │
│                 Industrial Eng.     │
│                                     │
│  [QR CODE]      2024/2025 Session   │
└─────────────────────────────────────┘
```

---

### **Week 7+: Additional Student Experience Features**

#### **7.1: Personal Planner** 🆕 LOW PRIORITY

**Features:**
- Task lists with deadlines
- Study session timer (Pomodoro technique)
- Deadline reminders
- Integration with timetable (auto-add assignment deadlines)

**Database Schema:**
```python
# New collection: tasks
{
  "_id": ObjectId,
  "userId": ObjectId,
  "title": str,
  "description": str,
  "dueDate": datetime | None,
  "priority": str,  # "high", "medium", "low"
  "status": str,  # "pending", "completed", "cancelled"
  "category": str,  # "assignment", "study", "personal", "project"
  "courseCode": str | None,
  "reminderSent": bool,
  "completedAt": datetime | None,
  "createdAt": datetime,
  "updatedAt": datetime
}

# New collection: studySessions
{
  "_id": ObjectId,
  "userId": ObjectId,
  "courseCode": str | None,
  "duration": int,  # seconds
  "startedAt": datetime,
  "endedAt": datetime | None,
  "notes": str | None
}
```

**Backend Tasks:**
- [ ] Create `/api/planner/tasks` router (full CRUD)
- [ ] Create `/api/planner/sessions` router (track study time)
- [ ] Add email/push notification for deadline reminders

**Frontend Tasks:**
- [ ] Replace [planner/page.tsx](src/app/(dashboard)/dashboard/growth/planner/page.tsx) placeholder:
  - Task list with add/edit/delete
  - Kanban board view (To Do, In Progress, Done)
  - Calendar view with deadlines
  - Pomodoro timer (25min work, 5min break)
  - Study session history/analytics
  - Integration with timetable (show upcoming classes)

---

#### **7.2: Notification System** 🆕 MEDIUM PRIORITY

**Features:**
- In-app notifications
- Email notifications (optional)
- Push notifications (PWA)

**Notification Types:**
- New announcements
- Event reminders (1 day before, 1 hour before)
- Payment deadline reminders
- Class cancellations
- Library resource approvals
- Task deadline reminders

**Database Schema:**
```python
# New collection: notifications
{
  "_id": ObjectId,
  "userId": ObjectId,
  "type": str,  # "announcement", "event", "payment", "class", "library", "task"
  "title": str,
  "message": str,
  "link": str | None,  # Deep link to relevant page
  "isRead": bool,
  "readAt": datetime | None,
  "createdAt": datetime
}
```

**Backend Tasks:**
- [ ] Create `/api/notifications` router
- [ ] Create notification triggers:
  - When announcement is created → Notify targeted students
  - When event is created → Notify all students
  - When payment is due → Notify owing students (3 days before deadline)
  - When class is cancelled → Notify affected level
- [ ] Add cron job for scheduled notifications

**Frontend Tasks:**
- [ ] Add notification bell icon to header
- [ ] Show unread count badge
- [ ] Notification dropdown with list
- [ ] Mark as read functionality
- [ ] "View All" link to dedicated notifications page

---

#### **7.3: Profile Enhancements** 🆕 LOW PRIORITY

**Current Profile:** Basic info display

**Enhancements:**
- [ ] Photo upload (with Cloudinary)
- [ ] Bio/about section
- [ ] Social media links (LinkedIn, GitHub, Twitter)
- [ ] Academic achievements/awards
- [ ] Skills/interests tags
- [ ] Publicly viewable profile (share link)
- [ ] Edit personal email, phone verification
- [ ] Change password (Firebase)

---

#### **7.4: Team/Directory Pages** 🆕 LOW PRIORITY

**Features:**
- Student directory (search by name, level, matric)
- EXCO team page (from roles collection)
- Class Reps page (from roles collection)
- Committee members page
- Contact info (email, phone - with privacy toggle)

**Already Partially Implemented:**
- Team layouts exist at `/dashboard/team/*`
- Just need to connect to backend APIs

---

## 🎯 Phase 2 Implementation Priority

### **CRITICAL (Must Have for MVP)**
1. ✅ CGPA Calculator - **Already done**
2. 🔴 Timetable System - **Week 5**
3. 🔴 Paystack Integration - **Week 6**
4. 🔴 Resource Library - **Week 4**

### **HIGH (Should Have)**
5. 🟡 Digital ID Card - **Week 6**
6. 🟡 IESA Bot (basic) - **Week 5**
7. 🟡 Notification System - **Week 7**

### **MEDIUM (Nice to Have)**
8. 🟢 Personal Planner - **Week 7+**
9. 🟢 Profile Enhancements - **Week 7+**
10. 🟢 Team Directory - **Week 7+**

---

## 📦 Dependencies & Setup

### **Backend Python Packages:**
```bash
pip install cloudinary paystackapi reportlab qrcode pillow
```

### **Frontend NPM Packages:**
```bash
npm install react-paystack qrcode.react html-to-image react-big-calendar date-fns
```

### **Environment Variables:**
```bash
# backend/.env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...

# .env.local (frontend)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

---

## 🚀 Development Workflow

### **Week-by-Week Execution:**

**Week 4: Library**
- Day 1-2: Set up Cloudinary, create resources schema
- Day 3-4: Build upload API + file management
- Day 5-6: Update frontend with real API
- Day 7: Testing + bug fixes

**Week 5: Timetable + Bot**
- Day 1-2: Create timetable schema + API
- Day 3-4: Build timetable UI (calendar view)
- Day 5-6: Implement bot query system
- Day 7: Connect bot to backend, testing

**Week 6: Payments + ID**
- Day 1-2: Paystack integration + webhook
- Day 3-4: Receipt generation + email
- Day 5: Digital ID card component
- Day 6-7: End-to-end payment testing

**Week 7+: Polish + Nice-to-Haves**
- Notifications
- Personal planner
- Profile enhancements
- Bug fixes
- Performance optimization

---

## 📊 Success Metrics

After Phase 2, students should be able to:
- ✅ Calculate CGPA privately (already done)
- ✅ View and download study materials by level/course
- ✅ Check their weekly timetable on mobile/desktop
- ✅ Ask the bot "What classes do I have tomorrow?"
- ✅ Pay departmental dues with card/bank transfer
- ✅ Download payment receipts automatically
- ✅ Generate and download their digital ID card
- ✅ See payment status reflected on ID (green = paid)

**Student Engagement Target:**
- 80%+ students use CGPA calculator monthly
- 60%+ students check timetable weekly
- 90%+ students pay dues via platform
- 50%+ students download library resources per semester

---

## 🔧 Technical Debt to Address

1. **Replace all mock data with real API calls:**
   - Dashboard stats
   - Events list
   - Announcements list
   - Payment history
   - Library resources

2. **Add loading states and error handling:**
   - Skeleton loaders for data fetching
   - Error boundaries for crashes
   - Toast notifications for success/error

3. **Optimize performance:**
   - Add pagination for long lists
   - Implement infinite scroll
   - Cache API responses
   - Lazy load images

4. **Improve mobile responsiveness:**
   - Test all pages on mobile
   - Fix any layout breaks
   - Optimize touch interactions

---

## 🎓 Phase 2 Completion Checklist

- [ ] **Week 4: Library System**
  - [ ] Cloudinary setup
  - [ ] Resource upload API
  - [ ] Frontend integration
  - [ ] Permission gates (Academic Committee)
  
- [ ] **Week 5: Timetable & Bot**
  - [ ] ClassSessions collection + API
  - [ ] Timetable UI (calendar + list views)
  - [ ] Class cancellation feature (Class Rep)
  - [ ] Bot query system
  - [ ] Schedule export (.ics)
  
- [ ] **Week 6: Payments & ID**
  - [ ] Paystack integration
  - [ ] Payment webhook
  - [ ] PDF receipt generation
  - [ ] Digital ID card component
  - [ ] Payment status sync
  
- [ ] **Week 7: Polish**
  - [ ] Notification system
  - [ ] Personal planner (basic)
  - [ ] Replace all mock data
  - [ ] Add loading/error states
  - [ ] Mobile optimization
  - [ ] End-to-end testing

---

## 🎯 Next Steps

**Immediate Actions:**
1. Set up Cloudinary account
2. Set up Paystack test account
3. Install required packages (backend + frontend)
4. Create resource library schema + API
5. Update library frontend to connect to API

**Development Order (Suggested):**
1. Resource Library (most independent)
2. Timetable System (needed for bot)
3. IESA Bot (depends on timetable)
4. Paystack Integration (most complex)
5. PDF Receipts (depends on payments)
6. Digital ID (depends on payments)
7. Notifications (nice-to-have)
8. Personal Planner (nice-to-have)

---

**Phase 2 Estimated Timeline:** 6-8 weeks for full implementation
**Phase 2 Team Requirement:** 1-2 developers (full-stack)
**Phase 2 Budget:** ~$50/month (Cloudinary free + Paystack test mode free)
