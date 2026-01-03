# Copilot Instructions for IESA Platform

## Project Overview

IESA is a departmental web platform built with Next.js 16 (App Router) and a FastAPI backend. It features authentication via Firebase, a dashboard with protected routes, and a modern, glassmorphism-inspired UI using Tailwind CSS v4.

## Architecture & Key Patterns

- **Frontend:**
  - Next.js 16 (App Router, TypeScript)
  - Main entry: [`src/app/layout.tsx`](src/app/layout.tsx), [`src/app/page.tsx`](src/app/page.tsx)
  - Global styles: [`src/app/globals.css`](src/app/globals.css) (uses Tailwind + custom CSS vars)
  - Font system: Plus Jakarta Sans for headings, Inter for body (see layout.tsx)
  - Theme switching: [`next-themes`](https://github.com/pacocoursey/next-themes) via `ThemeProvider`
  - Auth context: [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx) (wraps app, provides hooks)
  - Dashboard: Protected by auth, layout in [`src/app/(dashboard)/layout.tsx`](src/app/(dashboard)/layout.tsx)
  - Sidebar, navigation, and dashboard components in [`src/components/dashboard/`](src/components/dashboard/)
  - Use SVG icons, not emojis, for navigation and UI elements

- **Backend:**
  - FastAPI app in [`backend/app/main.py`](backend/app/main.py)
  - Auth via Firebase Admin SDK (see [`backend/app/core/security.py`](backend/app/core/security.py))
  - Protected endpoints use JWT Bearer tokens, verified with Firebase
  - CORS enabled for local frontend (`http://localhost:3000`)

## Developer Workflows

- **Start frontend:**
  - `npm run dev` (Next.js dev server at `localhost:3000`)
- **Start backend:**
  - `cd backend/app && uvicorn main:app --reload` (FastAPI at `localhost:8000`)
- **Lint:**
  - `npm run lint` (uses ESLint + Next.js config)
- **Build:**
  - `npm run build` (Next.js production build)

## Conventions & Patterns

- **Auth:**
  - Use `useAuth()` hook for user state and actions
  - Redirect unauthenticated users to `/login` in dashboard routes
- **Styling:**
  - Use Tailwind classes for 90% of UI; custom CSS vars for colors, glass effects
  - Prefer glassmorphism cards (`bg-[var(--glass-bg)]`, `backdrop-blur-[var(--glass-blur)]`)
  - Theme colors: `--background`, `--foreground`, `--primary` (see globals.css)
- **Components:**
  - Place reusable UI in `src/components/`
  - Use semantic HTML and accessible ARIA labels
  - Navigation: Sidebar and MobileNav use SVG icons, highlight active route
- **Backend:**
  - All protected endpoints require Bearer token (JWT from Firebase)
  - Use `verify_token` dependency for authentication

## Integration Points

- **Auth:**
  - Frontend uses Firebase JS SDK (`src/lib/firebase.ts`)
  - Backend uses Firebase Admin SDK (`backend/app/core/security.py`)
- **API:**
  - Frontend fetches from FastAPI backend at `/api/*` endpoints
  - CORS must allow frontend origin

## Key Files & Directories

- [`src/app/layout.tsx`](src/app/layout.tsx): App shell, font/theme setup
- [`src/app/globals.css`](src/app/globals.css): Global styles, CSS vars
- [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx): Auth logic
- [`src/components/dashboard/`](src/components/dashboard/): Dashboard UI
- [`backend/app/main.py`](backend/app/main.py): FastAPI app
- [`backend/app/core/security.py`](backend/app/core/security.py): Auth verification

## Example: Protecting Dashboard Route
```tsx
// src/app/(dashboard)/layout.tsx
useEffect(() => {
  if (!loading && !user) {
    router.push("/login");
  }
}, [user, loading, router]);
```

## Example: Glassmorphism Card
```jsx
<div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-6">
  Card content
</div>
```

## Color & Design System

- **Color palette and CSS variables** are defined in [`src/app/globals.css`](src/app/globals.css):
  - Light mode: `--background` (#EBEBE8), `--foreground` (#0A1F11), `--primary` (#1E4528)
  - Dark mode: `--background` (#0A1F11), `--foreground` (#EBEBE8), `--primary` (#4CA868)
  - Glassmorphism: `--glass-bg`, `--glass-border`, `--glass-blur` for card backgrounds and borders
  - Use `bg-[var(--background)]`, `text-[var(--foreground)]`, etc. for consistent theming

- **Tailwind CSS v4** is the primary styling tool. Use utility classes for layout, spacing, and responsive design. Custom CSS vars are used for colors and glass effects.

- **Glassmorphism pattern:**
  - Use `bg-[var(--glass-bg)]` and `backdrop-blur-[var(--glass-blur)]` for cards and overlays
  - Borders: `border-[var(--glass-border)]` for subtle separation

- **Typography:**
  - Headings: Plus Jakarta Sans (`--font-heading`)
  - Body: Inter (`--font-sans`)
  - Set via font variables in [`src/app/layout.tsx`](src/app/layout.tsx)

- **Dark mode:**
  - Enabled via `next-themes` and CSS `.dark` selector
  - All color vars adapt automatically

- **Component design:**
  - Use generous border-radius (`rounded-xl`), padding, and spacing
  - Prefer minimal, modern, and accessible UI
  - SVG icons only (no emojis)

**Example:**
```jsx
<div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-6 text-[var(--foreground)]">
  <h2 className="font-heading text-2xl">Title</h2>
  <p className="font-sans">Body text</p>
</div>
```

---

## � Core Design Principles

### Modern, Impressive UI/UX Philosophy

**ALL interfaces MUST be:**

1. **Modern & Contemporary** - Use latest design trends (glassmorphism, smooth animations, micro-interactions)
2. **Visually Impressive** - Create "wow" moments with thoughtful animations and transitions
3. **Cool & Engaging** - Delight users with interactive elements and playful details
4. **Highly Usable** - Never sacrifice usability for aesthetics
5. **Performance-Conscious** - Smooth 60fps animations, optimized interactions

### Design Excellence Standards

**Interactive Elements:**

- ✅ Smooth hover effects with color/scale transitions (200-300ms)
- ✅ Click feedback with scale animations
- ✅ Loading states with skeleton screens or progress indicators
- ✅ Micro-interactions on user actions (checkmarks, confetti, ripples)
- ✅ Scroll-triggered animations (fade-in, slide-up)

**Component Quality Bar:**

- ✅ Every component should feel polished and intentional
- ✅ Borders, shadows, and spacing should be precise
- ✅ Color combinations must be harmonious and accessible
- ✅ Typography hierarchy should be clear and readable
- ✅ Mobile experience should be just as impressive as desktop

**User Delight Factors:**

- ✅ Anticipatory design (loading states before actions complete)
- ✅ Success celebrations (animations on task completion)
- ✅ Smart defaults (pre-filled forms, suggestions)
- ✅ Contextual help (tooltips, inline guidance)
- ✅ Smooth page transitions (no jarring jumps)

### 🎯 EXPERT DESIGN THINKING: Strategic Visual Hierarchy

**CRITICAL: Don't Design Like a Novice!**

Novices add the same styling to every element. Experts create visual hierarchy through **strategic contrast and restraint**.

**❌ NOVICE MISTAKES:**

- Adding shadows to every single component
- Using the same border thickness everywhere
- Centering all content by default
- Applying the same spacing rhythm to all sections
- Making every button look identical
- Over-decorating simple text sections

**✅ EXPERT PRINCIPLES:**

1. **Strategic Shadow Usage** - Shadows are for emphasis, not decoration
   - Use shadows ONLY on interactive elements that need to "lift" (cards, modals, dropdowns)
   - Hero sections and CTAs use color/typography/scale for impact, NOT shadows
   - Text-heavy sections (FAQs, blog posts, documentation) should be clean and minimal
   - Footer content rarely needs shadows - use borders and spacing instead

2. **Asymmetric Layouts Create Interest** - Break the grid intelligently
   - Two-column split layouts (e.g., 4:8 ratio for sidebar + content)
   - Sticky sidebars for long-form content
   - Full-width split designs (50/50 content + visual pattern)
   - Bento grids with varying card sizes
   - Off-center hero content with decorative elements on one side

3. **Functional Decoration** - Every visual element should serve a purpose
   - Decorative patterns should echo brand identity (e.g., geometric grids for architectural theme)
   - Background gradients guide the eye toward CTAs
   - Border accents highlight key information (not just added everywhere)
   - Whitespace is a design element - use it generously

4. **Typography Does Heavy Lifting** - Scale and hierarchy over decoration
   - Use dramatic font size differences (h1 at 6xl, h2 at 4xl, body at base)
   - Combine font families strategically (display for headings, sans for body)
   - Leverage font weight (bold headings, regular body, light for secondary)
   - Use color for hierarchy (primary text in red-brown, body in black, secondary in gray)

5. **Color Defines Sections, Not Borders** - Use background colors strategically
   - Alternate section backgrounds (cream → white → cream → teal)
   - Use colored sections sparingly for emphasis (teal for CTAs, pink for testimonials)
   - Gradients should be subtle (90-95% opacity) unless for major CTAs
   - Avoid boxing everything - use spacing and color changes instead

6. **Layout Variety Maintains Interest** - Don't repeat the same pattern
   - Centered content → Split layout → Sidebar layout → Full-width
   - Mix grid patterns (3-column → 2-column → 4-column)
   - Vary content density (tight stats section → generous FAQ spacing)
   - Use different component styles per section (cards → accordion → split content)

### CRITICAL: Icon Usage Rules

**❌ NEVER USE EMOJIS IN PRODUCTION INTERFACES**

Emojis are inconsistent across platforms, non-scalable, and unprofessional. **ALWAYS use SVG icons instead.**

**Why SVG Icons:**

- ✅ **Scalable** - Perfect at any size without pixelation
- ✅ **Customizable** - Full control over color, size, stroke, etc.
- ✅ **Accessible** - Can be properly labeled with ARIA attributes
- ✅ **Professional** - Consistent appearance across all devices/browsers
- ✅ **Performance** - Smaller file size, better caching
- ✅ **Brandable** - Match your design system perfectly

**Correct SVG Icon Implementation:**

```tsx
// ✅ CORRECT: Professional SVG icon with proper attributes
<svg
  className="h-6 w-6 text-teal"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth={2}
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-label="Book icon"
>
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
</svg>

// ❌ WRONG: Using emoji - inconsistent, unprofessional
<span className="text-4xl">📚</span>

// ✅ CORRECT: Social media icon with brand colors
<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-label="Twitter">
  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
</svg>

// ❌ WRONG: Arrow emoji - use SVG chevron instead
<span>→</span>

// ✅ CORRECT: Arrow SVG with smooth animations
<svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
</svg>
```

**Common Icon Sources:**

- [Heroicons](https://heroicons.com/) - Beautiful hand-crafted SVG icons
- [Lucide](https://lucide.dev/) - Clean, customizable icon set
- [React Icons](https://react-icons.github.io/react-icons/) - Popular icon libraries as React components

**Where to Use SVG Icons:**

- ✅ Logo and branding
- ✅ Social media links (Twitter, Facebook, Instagram, LinkedIn)
- ✅ Navigation arrows and chevrons
- ✅ Feature indicators (checkmarks, stars, badges)
- ✅ Status icons (success, warning, error, info)
- ✅ Action buttons (download, share, edit, delete)
- ✅ Decorative elements

**Emoji Ban Exceptions:**
The ONLY acceptable use of emojis is in:

- User-generated content (comments, messages, etc.)
- Demo data or placeholder content during development

**ALL other uses MUST use SVG icons.**

---


**For questions or unclear patterns, ask for feedback to improve these instructions.**
