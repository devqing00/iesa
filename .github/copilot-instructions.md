# Copilot Instructions for IESA Platform

## Project Overview

IESA is a departmental web platform built with Next.js 16 (App Router) and a FastAPI backend. It features JWT authentication, a dashboard with protected routes, and a **vibrant multi-color design system** using Tailwind CSS v4.

**Institution:** University of Ibadan (UI), Nigeria

---

## 🎨 DESIGN SYSTEM v3: Vibrant Academic

### Design Philosophy

Bold, vibrant, multi-color design inspired by modern card-based editorial layouts. Colorful bento grids, thick-bordered cards, playful but professional.

**Core Aesthetic Principles:**

- **Multi-Color Vibrancy** — Full palette: lime, lavender, coral, teal, sunny yellow
- **Thick & Chunky** — 4-8px borders, large radius (16–24px), bold button shapes
- **Hard Shadows** — Pure black/navy shadows (5-10px offset), never lime shadows
- **Bento Everything** — Asymmetric card grids with colored blocks, varied sizes
- **Typography-Led** — TBJ Endgraph black weight headlines, brush highlight accents
- **Playful-Professional** — Diamond sparkle decorators, fun but polished
- **Single Theme** — Light mode only, no dark mode support

---

## 🎨 TAILWIND CSS v4 THEME SYSTEM

### Theme Architecture

```css
/* 1. STATIC COLORS - in @theme, support opacity modifiers */
@theme {
  --color-lime: oklch(88% 0.2 128);
  --color-navy: oklch(15% 0.02 280);
}
/* Usage: bg-lime, text-navy, bg-lime/50, text-navy/60 */

/* 2. DYNAMIC COLORS - CSS variables that change with theme */
:root { --surface: #FAFAFE; }
.dark { --surface: oklch(15% 0.02 280); }

/* 3. DYNAMIC UTILITIES - Map CSS vars to Tailwind via @theme inline */
@theme inline { --color-surface: var(--surface); }
/* Usage: bg-surface (auto-switches with dark mode) */
```

### Color Usage Rules

**For static colors (don't change with theme):**
```jsx
// ✅ CORRECT - Uses @theme colors, supports opacity
<div className="bg-lime text-navy">
<div className="bg-lime/50 text-navy/70">
<div className="bg-lavender text-navy border-lime/30">

// ❌ WRONG - Raw hex or old color names
<div className="bg-[#C8F31D]">
<div className="bg-green-accent">
```

**Shadow & Border Rules:**
```jsx
// ✅ CORRECT - Pure black/navy shadows, navy borders
<div className="bg-snow border-[4px] border-navy shadow-[8px_8px_0_0_#000]">
<button className="bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D]">

// ❌ WRONG - Never use lime shadows or lime borders with black shadows
<div className="shadow-[8px_8px_0_0_#C8F31D]"> // Never lime shadow
<div className="border-lime shadow-[8px_8px_0_0_#000]"> // Conflicts
```

### Available Static Colors

| Color | Value | Usage |
|-------|-------|-------|
| `lime` | `oklch(88% 0.2 128)` | Primary accent, CTAs, active states |
| `lime-light` | `oklch(95% 0.08 128)` | Lime tint backgrounds |
| `lime-dark` | `oklch(75% 0.2 128)` | Hover/pressed states |
| `lavender` | `oklch(72% 0.12 295)` | Secondary: info, tags, decorative |
| `lavender-light` | `oklch(92% 0.05 295)` | Lavender tint backgrounds |
| `coral` | `oklch(68% 0.18 25)` | Alerts, deadlines, important |
| `coral-light` | `oklch(92% 0.06 25)` | Coral tint backgrounds |
| `teal` | `oklch(78% 0.14 175)` | Success, completion, positive |
| `teal-light` | `oklch(94% 0.05 175)` | Teal tint backgrounds |
| `sunny` | `oklch(85% 0.14 90)` | Warnings, stars, ratings |
| `sunny-light` | `oklch(96% 0.05 90)` | Yellow tint backgrounds |
| `navy` | `oklch(15% 0.02 280)` | Dark text, dark backgrounds |
| `navy-light` | `oklch(22% 0.02 280)` | Elevated dark surfaces |
| `navy-muted` | `oklch(35% 0.01 280)` | Secondary dark text |
| `slate` | `oklch(55% 0.01 280)` | Muted text, placeholders |
| `cloud` | `oklch(92% 0.005 280)` | Light borders, dividers |
| `ghost` | `oklch(97% 0.003 280)` | Off-white background |
| `snow` | `#ffffff` | White card surfaces |

### Shadow System Rules

**CRITICAL:** Follow these shadow rules strictly:

1. **Light backgrounds** (snow, ghost, lime-light, etc.) → Use pure black shadow: `shadow-[Xpx_Ypx_0_0_#000]`
2. **Lime buttons/elements** → Use navy shadow: `shadow-[Xpx_Ypx_0_0_#0F0F2D]`
3. **Dark backgrounds** (navy, navy-light) → Use lime shadow: `shadow-[Xpx_Ypx_0_0_#C8F31D]`
4. **NEVER use lime shadow on light backgrounds**
5. **Badges** (small labels like "Est. 2018") → No shadow at all

### Border System Rules

1. **Pair navy borders with black/navy shadows** → `border-navy shadow-[X_X_0_0_#000]`
2. **Never use lime borders when shadow is black** → This creates visual conflict
3. **Standard thickness:** 4-8px borders → `border-[4px]` or `border-[6px]`

---

## Typography System

**Font Families:**
- **Display Font:** `TBJ Endgraph` — Headlines, titles (weight: 900/black)
- **Body Font:** `TBJ Endgraph` — All text content (weights: 100, 300, 400, 500, 700)

**Font Weights:**
```css
.font-display    /* Black: 900 - Use for all headlines */
.font-bold      /* Bold: 700 - Use for emphasis */
.font-medium    /* Medium: 500 - Use for subheadings */
.font-normal    /* Regular: 400 - Use for body text */
.font-light     /* Light: 300 - Use sparingly */
.font-thin      /* Thin: 100 - Use for subtle text */
```

**Type Scale:**
```css
.text-hero       /* Hero: clamp(3.5rem, 10vw, 8rem) */
.text-display-xl /* Section heads: clamp(3rem, 8vw, 5rem) */
.text-display-lg /* Page titles: clamp(2rem, 5vw, 3.5rem) */
.text-display-md /* Card titles: clamp(1.5rem, 3vw, 2.5rem) */
.text-display-sm /* Subheads: clamp(1.25rem, 2vw, 1.75rem) */
.text-label      /* Labels: 0.75rem, tracking 0.08em, uppercase */
.text-label-sm   /* Small labels: 0.625rem, tracking 0.12em */
.text-body       /* Body: tight tracking */
```

## Brush Highlight System

**Purpose:** Add colorful brush-stroke highlights under key words in headlines.

**Base Usage:**
```jsx
<h1><span className="brush-highlight">Industrial Engineering</span></h1>
// Default: lime background, works on white/snow backgrounds
```

**Context-Aware Variants:**
```jsx
// For coral/sunny backgrounds: use sunny yellow brush
<h3 className="bg-coral">
  <span className="brush-highlight brush-coral">Our Mission</span>
</h3>

// For lime backgrounds: use coral brush
<h3 className="bg-lime">
  <span className="brush-highlight brush-lime">Start Your</span>
</h3>

// For navy backgrounds: use sunny yellow brush
<h3 className="bg-navy">
  <span className="brush-highlight brush-navy">Join Us</span>
</h3>
```

**Technical Notes:**
- Brush uses `::after` pseudo-element with `z-index: -1`
- Parent has `overflow: hidden` to prevent rotated brush from extending beyond bounds
- Variants use chained selectors: `.brush-highlight.brush-coral::after`
- Colors set with `!important` to override base style

## Decorator System

**Diamond Sparkles:**
```jsx
// Use 4-point diamond shapes (NOT 5-point stars)
<svg className="fixed top-16 left-[10%] w-6 h-6 text-lime/20" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
</svg>
```

**Rules:**
- Sprinkle 6-10 sparkles across page using fixed positioning
- Use low opacity: 12-20% (`text-lime/20`, `text-coral/15`)
- Add `pointer-events-none` and `z-0` to prevent interaction issues
- Position with percentage values for responsive placement: `left-[10%]`, `right-[12%]`
- Extra sparkles near major headlines for emphasis
- Page must have `overflow-x: hidden` on body to prevent decorator overflow

---

## Card System

**Base Card Pattern:**
```jsx
<div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
  <!-- Card content -->
</div>
```

**Colored Card Variants:**
```jsx
// Lime card
<div className="bg-lime border-[6px] border-navy rounded-3xl p-8 shadow-[10px_10px_0_0_#000] rotate-[-1deg] hover:rotate-0 transition-transform">

// Coral card
<div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">

// Lavender card
<div className="bg-lavender border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[1deg]">

// Navy card (dark background)
<div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[8px_8px_0_0_#C8F31D]">

// Teal card
<div className="bg-teal border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">

// Sunny (yellow) card
<div className="bg-sunny border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
```

**Card Rules:**
- Max 2–3 colored cards per bento grid to avoid visual clutter
- Add slight rotation (`rotate-[-1deg]` or `rotate-[1deg]`) for playfulness
- Use `hover:rotate-0` to straighten on hover
- Border thickness: 4-6px for medium cards, 6-8px for hero cards
- Shadow offset: 8-10px for standard, 5px for small cards
- Navy cards get lime borders + lime shadow (exception to the rule)

---

## Button System

**Primary Pattern (Lime CTA):**
```jsx
<button className="bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] 
  px-8 py-4 rounded-2xl font-display text-lg text-navy 
  hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] 
  transition-all">
  Join IESA
</button>
```

**Secondary Pattern (Navy):**
```jsx
<button className="bg-navy border-[4px] border-lime shadow-[5px_5px_0_0_#000] 
  px-6 py-3 rounded-xl font-display text-base text-lime 
  hover:scale-105 transition-all">
  Learn More
</button>
```

**Outline Pattern:**
```jsx
<button className="bg-transparent border-[3px] border-navy 
  px-6 py-3 rounded-xl font-display text-navy 
  hover:bg-navy hover:text-lime transition-all">
  View All →
</button>
```

**Button Rules:**
- Primary buttons: Lime bg + navy border + navy shadow
- Hover effects: Translate shadow or scale (not both)
- No shadows on small badge-like elements
- Always use thick borders: 3-4px minimum

---

## Bento Grid

```jsx
<div className="bento-grid bento-3 gap-4">
  <div className="card card-lime bento-span-2">Hero Card</div>
  <div className="card card-navy">Stats</div>
  <div className="card">Regular</div>
  <div className="card card-lavender">Info</div>
  <div className="card">Another</div>
</div>
```

---

## Architecture & Key Files

### Frontend
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 with CSS-first configuration
- **Theme:** `next-themes` with `attribute="class"`
- **Auth:** JWT (Argon2id + httpOnly refresh cookies)

### Backend
- **Framework:** FastAPI async
- **Auth:** JWT verification
- **Database:** MongoDB + Pydantic V2

### Key Files
- `src/app/globals.css` — Design tokens and utility classes
- `src/app/layout.tsx` — Root layout, fonts, providers
- `src/context/AuthContext.tsx` — JWT auth state
- `src/components/ui/` — UI component library

---

## Quick Reference

| Purpose | Pattern |
|---------|--------|
| Page background | `bg-snow` (white) or `bg-ghost` (off-white) |
| Card | `bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000]` |
| Colored card | `bg-{color} border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000]` |
| Navy card | `bg-navy border-[4px] border-lime rounded-3xl shadow-[8px_8px_0_0_#C8F31D]` |
| Display heading | `font-display font-black text-4xl text-navy` |
| Headline with brush | `<span className="brush-highlight">Key Word</span>` |
| Label/badge | `text-label uppercase tracking-wider text-xs` (no shadow) |
| Primary button | `bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D]` |
| Secondary button | `bg-navy border-[4px] border-lime shadow-[5px_5px_0_0_#000]` |
| Outline button | `bg-transparent border-[3px] border-navy hover:bg-navy hover:text-lime` |
| Sparkle decorator | `<svg className="fixed top-16 left-[10%] w-6 h-6 text-lime/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>` |
| Container | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12` |

### Don'ts
- ❌ Old tokens: `bg-bg-primary`, `text-text-primary`, `green-accent`, `cream`, `charcoal`
- ❌ Raw Tailwind: `bg-gray-100`, `text-blue-500`
- ❌ Emojis in UI (use SVG icons instead)
- ❌ Lime shadows on light backgrounds
- ❌ Lime borders paired with black shadows
- ❌ 5-point star decorators (use 4-point diamonds)
- ❌ Soft/blurred shadows (use hard offset shadows only)
- ❌ Dark mode classes or logic
- ❌ Forgetting `overflow: hidden` on brush highlight parents
- ❌ Forgetting `overflow-x: hidden` on body when using fixed decorators

### Do's
- ✅ `font-display font-black` for all headlines
- ✅ TBJ Endgraph font for everything (display and body)
- ✅ Brush highlights on key headline words
- ✅ Context-aware brush colors (`.brush-coral`, `.brush-lime`, `.brush-navy`)
- ✅ Diamond sparkle decorators with low opacity
- ✅ Mix 2-3 colored cards per grid
- ✅ 4-8px thick borders on cards and buttons
- ✅ Pure black or navy hard shadows (5-10px offset)
- ✅ SVG icons from libraries (no emojis)
- ✅ Enhanced hover effects (scale, translate)
- ✅ Overflow management on body and containers
