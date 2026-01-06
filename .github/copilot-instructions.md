# Copilot Instructions for IESA Platform

## Project Overview

IESA is a departmental web platform built with Next.js 16 (App Router) and a FastAPI backend. It features authentication via Firebase, a dashboard with protected routes, and a **refined editorial/academic design system** using Tailwind CSS v4.

**Institution:** University of Ibadan (UI), Nigeria

---

## 🎨 DESIGN SYSTEM: Editorial Academic Style

### Design Philosophy

The IESA design system is inspired by **high-end editorial publications** and **classic academic institutions**. Think: architectural magazines, museum websites, and prestigious university portals.

**Core Aesthetic Principles:**

- **Minimal & Refined** - Clean layouts with generous whitespace
- **Typographic Excellence** - Display serif for headlines, condensed sans for body
- **Subtle Sophistication** - Thin borders, muted colors, restrained decoration
- **Functional Beauty** - Every element serves a purpose

---

## 🎨 TAILWIND CSS v4 THEME SYSTEM

Tailwind v4 uses a new `@theme` directive for defining design tokens. Understanding this is critical for proper color usage.

### Theme Architecture

```css
/* 1. STATIC COLORS - Defined in @theme block */
/* These create utility classes with opacity support */
@theme {
  --color-cream: oklch(97.5% 0.005 90);
  --color-charcoal: oklch(15% 0 0);
}
/* Usage: bg-cream, text-charcoal, bg-cream/50, text-charcoal/60 */

/* 2. DYNAMIC COLORS - CSS variables that change with theme */
:root {
  --bg-primary: oklch(97.5% 0.005 90);
}
.dark {
  --bg-primary: oklch(8% 0 0);
}

/* 3. DYNAMIC UTILITIES - Map CSS vars to Tailwind via @theme inline */
@theme inline {
  --color-bg-primary: var(--bg-primary);
}
/* Usage: bg-bg-primary (auto-switches with dark mode) */
```

### Color Usage Rules

**For static colors (don't change with theme):**

```jsx
// ✅ CORRECT - Uses @theme colors, supports opacity
<div className="bg-cream text-charcoal">
<div className="bg-cream/50 text-charcoal/70">
<div className="border-cream/30">

// ❌ WRONG - These won't support opacity modifiers
<div className="bg-[#f7f6f3]">
```

**For dynamic colors (change with dark mode):**

```jsx
// ✅ CORRECT - Auto-switches with theme
<div className="bg-bg-primary text-text-primary">
<div className="bg-bg-secondary text-text-secondary">
<div className="border-border">

// ⚠️ NOTE: Dynamic colors from @theme inline don't support opacity
// Use static colors when opacity is needed
```

### Inverted Sections Pattern

For sections with inverted backgrounds (dark in light mode, light in dark mode):

```jsx
// ✅ CORRECT - Using static colors for inverted sections
<div className="bg-charcoal dark:bg-cream">
  <h2 className="text-cream dark:text-charcoal">Title</h2>
  <p className="text-cream/70 dark:text-charcoal/70">Description</p>
  <button className="border-cream dark:border-charcoal text-cream dark:text-charcoal">
    Button
  </button>
</div>

// ❌ WRONG - bg-inverse doesn't support opacity on children
<div className="bg-bg-inverse">
  <p className="text-text-inverse/70"> {/* Won't work properly */}
```

### Available Colors

**Static Colors (in `@theme`, support opacity):**
| Color | Value | Usage |
|-------|-------|-------|
| `cream` | `oklch(97.5% 0.005 90)` | Light backgrounds, inverted text |
| `cream-dark` | `oklch(94% 0.005 90)` | Subtle backgrounds |
| `cream-darker` | `oklch(91% 0.005 90)` | Borders, dividers |
| `charcoal` | `oklch(15% 0 0)` | Dark backgrounds, primary text |
| `charcoal-light` | `oklch(22% 0 0)` | Hover states |
| `charcoal-muted` | `oklch(35% 0 0)` | Secondary text |

**Dynamic Colors (in `@theme inline`, auto-switch):**
| Color | Light Mode | Dark Mode |
|-------|------------|-----------|
| `bg-primary` | cream | near-black |
| `bg-secondary` | cream-dark | dark gray |
| `bg-card` | white | charcoal |
| `bg-inverse` | charcoal | cream |
| `text-primary` | charcoal | cream |
| `text-secondary` | gray | light gray |
| `text-muted` | light gray | dark gray |
| `border` | light gray | dark gray |
| `border-dark` | charcoal | cream |

### Typography System

**Font Families:**

- **Display Font:** `Balvier` (Serif) - For headlines, titles, large display text
- **Body Font:** `Inter` with condensed letter-spacing for a narrower feel

**Type Scale (using `clamp()` for fluid sizing):**

```css
.text-display-xl  /* Hero headlines: clamp(4rem, 12vw, 10rem) */
/* Hero headlines: clamp(4rem, 12vw, 10rem) */
.text-display-lg  /* Section headlines: clamp(3rem, 8vw, 6rem) */
.text-display-md  /* Card titles: clamp(2rem, 5vw, 4rem) */
.text-display-sm  /* Subheadings: clamp(1.5rem, 3vw, 2.5rem) */
.text-label       /* Uppercase labels: 0.75rem, tracking 0.1em */
.text-label-sm; /* Small labels: 0.625rem, tracking 0.15em */
```

**Usage Rules:**

- Headlines: `font-display` class (Balvier serif)
- Body text: Default sans-serif with `.text-body` for tighter tracking
- Labels/Navigation: `.text-label` with uppercase
- Page numbers: `.page-number` class

### Decorative Elements

**Star Accent (✦):**

```jsx
<span className="star-accent">✦</span>
// Or use the CSS class for ::before content
<span className="star-accent-before">Label</span>
```

**Diamond Accent (◆):**

```jsx
<span>◆</span>
```

**Page Numbers:**

```jsx
<span className="page-number">Page 01</span>
```

### Component Patterns

**Editorial Button:**

```jsx
<button className="btn-editorial">
  Button Text
</button>

// With plus accents
<button className="btn-editorial btn-editorial-plus">
  + Button Text +
</button>
```

**Framed Image (Grayscale with hover color):**

```jsx
<div className="framed-image aspect-4/3">
  <Image src="..." fill className="object-cover" />
</div>
```

**Page Frame (Bordered card):**

```jsx
<div className="page-frame p-8">Content here</div>
```

**Section Container:**

```jsx
<div className="section-container">
  {/* max-width: 1400px, centered, with horizontal padding */}
</div>
```

### Layout Patterns

**Split Layout (50/50):**

```jsx
<div className="split-layout">
  <div>Left content</div>
  <div>Right content</div>
</div>
```

**Asymmetric Grid (2:1 ratio):**

```jsx
<div className="grid-asymmetric">
  <div>Large content (2/3)</div>
  <div>Small content (1/3)</div>
</div>
```

**Section with Header:**

```jsx
<section className="py-20 border-t border-border">
  <div className="section-container">
    {/* Section Header */}
    <div className="flex justify-between items-center mb-16">
      <div className="flex items-center gap-4">
        <span className="text-label text-text-muted">01</span>
        <span className="text-label">Section Title</span>
      </div>
      <span className="page-number">Page 02</span>
    </div>
    {/* Section Content */}
    ...
  </div>
</section>
```

### Background Patterns

**Dot Grid Pattern:**

```jsx
<div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
```

**Cross Grid Pattern:**

```jsx
<div className="absolute inset-0 bg-cross-grid opacity-20 pointer-events-none" />
```

### Custom Cursor

The design system includes a custom crosshair cursor for an editorial feel:

- Default cursor: Custom crosshair SVG
- Interactive elements: Standard pointer
- Text: Text cursor

---

## Architecture & Key Patterns

### Frontend

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 with CSS-first configuration
- **Theme:** `next-themes` with `attribute="class"` and `disableTransitionOnChange`
- **Auth:** Firebase JS SDK via `useAuth()` hook

### Backend

- **Framework:** FastAPI with async patterns
- **Auth:** Firebase Admin SDK for JWT verification
- **Database:** MongoDB with Pydantic V2 models

### Key Files

- `src/app/globals.css` - Design system CSS variables and utilities
- `src/app/layout.tsx` - App shell, fonts, theme provider
- `src/context/AuthContext.tsx` - Authentication state
- `src/components/dashboard/` - Dashboard UI components

---

## Coding Conventions

### Tailwind Class Usage

**✅ CORRECT - Use design system colors:**

```jsx
<div className="bg-bg-primary text-text-primary border-border">
<div className="bg-bg-secondary text-text-secondary">
<div className="bg-bg-inverse text-text-inverse">
```

**❌ WRONG - Don't use raw colors:**

```jsx
<div className="bg-gray-100 text-gray-900">
<div className="bg-white text-black">
```

### Component Structure

```tsx
// Always include "use client" for interactive components
"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

// Hydration helper for theme-dependent rendering
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function Component() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme } = useTheme();

  if (!mounted) return null;

  return (
    <div className="bg-bg-primary text-text-primary">
      {/* Component content */}
    </div>
  );
}
```

### Icon Usage

**✅ ALWAYS use SVG icons:**

```jsx
<svg
  className="w-5 h-5"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth={1.5}
>
  <path strokeLinecap="round" strokeLinejoin="round" d="..." />
</svg>
```

**❌ NEVER use emojis in production UI**

### Form Inputs

```jsx
<input
  type="text"
  className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
  placeholder="Enter text..."
/>
```

### Buttons

```jsx
// Primary action
<button className="btn-editorial btn-editorial-plus">
  Primary Action
</button>

// Secondary action
<button className="btn-editorial">
  Secondary
</button>

// Ghost button
<button className="px-4 py-2 text-label text-text-secondary hover:text-text-primary transition-colors">
  Ghost
</button>
```

---

## Page Templates

### Auth Page Template

```tsx
<div className="min-h-screen bg-bg-primary flex">
  {/* Left - Form */}
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2">
        <span className="text-label-sm text-text-muted flex items-center gap-2">
          <span>✦</span> Welcome
        </span>
        <h1 className="font-display text-display-md">Sign In</h1>
      </div>
      {/* Form fields */}
    </div>
  </div>

  {/* Right - Decorative (hidden on mobile) */}
  <div className="hidden lg:flex flex-1 bg-bg-secondary items-center justify-center relative overflow-hidden">
    <div className="absolute inset-0 bg-dot-grid opacity-30" />
    {/* Decorative content */}
  </div>
</div>
```

### Dashboard Page Template

```tsx
<div className="space-y-8">
  {/* Page Header */}
  <div className="flex justify-between items-center">
    <div className="space-y-1">
      <span className="text-label-sm text-text-muted flex items-center gap-2">
        <span>✦</span> Dashboard
      </span>
      <h1 className="font-display text-display-sm">Page Title</h1>
    </div>
    <button className="btn-editorial btn-editorial-plus">Action</button>
  </div>

  {/* Content */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* Cards */}
  </div>
</div>
```

### Card Component

```tsx
<div className="page-frame p-6 space-y-4">
  <div className="flex items-center justify-between">
    <span className="text-label-sm text-text-muted">◆ Label</span>
    <span className="page-number">01</span>
  </div>
  <h3 className="font-display text-xl">Card Title</h3>
  <p className="text-text-secondary text-body text-sm">Card description...</p>
</div>
```

---

## Mobile-First Responsive Design

### Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Responsive Patterns

```jsx
// Stack on mobile, side-by-side on desktop
<div className="flex flex-col lg:flex-row gap-8">

// Full width on mobile, constrained on desktop
<div className="w-full max-w-md mx-auto lg:mx-0">

// Hide on mobile, show on desktop
<div className="hidden lg:block">

// Different padding per breakpoint
<div className="p-4 md:p-6 lg:p-8">
```

---

## Animation Guidelines

### Transitions

```jsx
// Color/opacity transitions
className = "transition-colors duration-200";
className = "transition-opacity duration-300";

// Transform transitions
className = "transition-transform duration-200 hover:scale-105";
```

### Hover States

```jsx
// Subtle lift on hover
className = "hover:-translate-y-0.5 transition-transform";

// Color change
className = "text-text-secondary hover:text-text-primary transition-colors";

// Background change
className = "hover:bg-bg-secondary transition-colors";
```

---

## Accessibility Requirements

1. **Color Contrast:** All text must meet WCAG AA standards
2. **Focus States:** All interactive elements must have visible focus indicators
3. **Touch Targets:** Minimum 44x44px for buttons and links
4. **Screen Readers:** Use proper ARIA labels and semantic HTML
5. **Keyboard Navigation:** All functionality accessible via keyboard

---

## File Organization

```
src/
├── app/
│   ├── globals.css          # Design system
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   ├── (auth)/              # Auth pages
│   ├── (student)/           # Student dashboard
│   └── (admin)/             # Admin dashboard
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── dashboard/           # Dashboard-specific
│   └── admin/               # Admin-specific
├── context/                 # React contexts
└── lib/                     # Utilities
```

---

## Quick Reference

### Common Classes

| Purpose            | Class                          |
| ------------------ | ------------------------------ |
| Page background    | `bg-bg-primary`                |
| Card background    | `bg-bg-card` or `page-frame`   |
| Section background | `bg-bg-secondary`              |
| Primary text       | `text-text-primary`            |
| Secondary text     | `text-text-secondary`          |
| Body text          | `text-body`                    |
| Muted text         | `text-text-muted`              |
| Border             | `border-border`                |
| Dark border        | `border-border-dark`           |
| Display heading    | `font-display text-display-md` |
| Label              | `text-label`                   |
| Button             | `btn-editorial`                |
| Container          | `section-container`            |
| Card               | `page-frame p-6`               |

### Don't Forget

- ✅ Use `font-display` for all headlines
- ✅ Use `text-body` for body text (tighter tracking)
- ✅ Add `✦` star accents for labels
- ✅ Include page numbers where appropriate
- ✅ Use thin 1px borders (`border-border`)
- ✅ Apply grayscale to images with hover color
- ✅ Test dark mode for every component
- ❌ Don't use shadows excessively
- ❌ Don't use emojis
- ❌ Don't use rounded corners larger than `rounded-lg`
