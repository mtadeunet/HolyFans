# HolyFans Implementation Kickstart

## Project Overview
Luxury Christian clothing store prototype for HolyFans brand. Single premium t-shirt with "Nossa Senhora da Rosa" design, focusing on visual storytelling and conversion.

## Technical Stack
- **Framework:** Next.js 14 with App Router
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Internationalization:** next-intl
- **State Management:** React Context
- **Images:** Next.js Image Optimization
- **Deployment:** Vercel-ready

## Responsive Strategy
- **Mobile:** 320px - 768px (Primary focus)
- **Tablet:** 768px - 1024px (Touch-optimized)
- **Desktop:** 1024px+ (Full experience)

## File Structure & Implementation Plan

### Core Setup Files
```
package.json                 # Dependencies and scripts
next.config.js              # Next.js config with next-intl
tailwind.config.js          # Tailwind with custom colors
app/globals.css             # Global styles and fonts
```

### App Router Structure
```
app/[locale]/layout.tsx     # Root layout with language support
app/[locale]/page.tsx       # Main landing page
app/[locale]/checkout/page.tsx # Simple checkout flow
app/globals.css             # Global styles
```

### Component Breakdown (Max 400-600 lines each)

#### Layout Components
- `components/layout/header.tsx` - Clean navigation with language toggle
- `components/layout/footer.tsx` - 4-column footer with brand info
- `components/layout/language-toggle.tsx` - PT/EN switcher

#### Section Components
- `components/sections/hero.tsx` - Full viewport hero with CTA
- `components/sections/product-gallery.tsx` - Image gallery with zoom
- `components/sections/variation-selector.tsx` - Male/Female toggle
- `components/sections/craftsmanship.tsx` - Storytelling about quality
- `components/sections/objection-handling.tsx` - Address price/concerns
- `components/sections/faq.tsx` - Expandable FAQ section
- `components/sections/social-proof.tsx` - Customer testimonials
- `components/sections/risk-reversal.tsx` - Guarantees and trust
- `components/sections/final-cta.tsx` - Last conversion chance

#### Product Components
- `components/product/cart.tsx` - Shopping cart sidebar/modal
- `components/product/checkout-flow.tsx` - 2-step checkout

#### Context & State
- `context/cart-context.tsx` - Cart state management
- `context/language-context.tsx` - Language preference

#### Utilities
- `lib/utils.ts` - Helper functions
- `lib/constants.ts` - Product data, colors, etc.
- `lib/messages/pt.json` - Portuguese translations
- `lib/messages/en.json` - English translations
- `types/product.ts` - TypeScript interfaces

## Design System

### Colors
```css
/* Page Design Colors (Light & Clean) */
--primary: #1e3a5f;      /* Deep Navy - for accents only */
--accent: #d4af37;       /* Gold - for CTAs and highlights */
--background: #ffffff;   /* Pure white background */
--surface: #f8fafc;      /* Very light gray for cards */
--text-primary: #1a202c; /* Dark text for readability */
--text-secondary: #4a5568; /* Lighter text for secondary content */
--border: #e2e8f0;       /* Light borders */

/* T-Shirt Design Colors (Separate) */
--tshirt-rose: #e11d48;      /* Rose Red - for design only */
--tshirt-blue: #1e3a8a;      /* Deep Sea Blue - for design only */
--tshirt-gold: #d4af37;      /* Gold - for design only */
--tshirt-gold-light: #fbbf24; /* Light Gold - for design only */
```

### Typography
- **Headings:** Modern serif for luxury feel
- **Body:** Clean sans-serif for readability
- **Accent:** Script font for brand elements

### Spacing
- **Mobile:** 16px base unit
- **Tablet:** 24px base unit  
- **Desktop:** 32px base unit

## SEO Structure

### Meta Tags
```html
<!-- PT Version -->
<title>HolyFans | Faith You'll Want to Share</title>
<meta name="description" content="Premium Christian clothing with discrete but meaningful designs. High quality t-shirts for believers who want to share their faith.">

<!-- EN Version -->
<title>HolyFans | Faith You'll Want to Share</title>
<meta name="description" content="Premium Christian clothing with discrete but meaningful designs. High quality t-shirts for believers who want to share their faith.">
```

### Semantic HTML
- `<header>` for navigation
- `<main>` for content sections
- `<section>` for each content block
- `<footer>` for site footer
- `<nav>` for navigation links

## Component Specifications

### Hero Section
- Full viewport height on mobile/desktop
- Product hero image
- Emotional headline
- Primary CTA button
- Scroll indicator

### Product Gallery
- 3-4 product images
- Touch/swipe on mobile
- Hover/zoom on desktop
- Male/Female image switching

### Variation Selector
- Simple toggle switch
- Male/Female options
- Updates product images
- Size assurance copy

### Cart & Checkout
- Slide-in cart on mobile
- Sidebar cart on desktop
- 2-step checkout flow
- Thank you popup
- No payment processing

## Responsive Breakpoints
```css
/* Mobile */
@media (max-width: 768px) { }

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) { }

/* Desktop */
@media (min-width: 1025px) { }
```

## Performance Requirements
- Image optimization with Next.js
- Lazy loading for below-fold content
- Minimal JavaScript bundle
- Fast first contentful paint
- Touch-optimized interactions

## Implementation Order

### Phase 1: Foundation (Day 1)
1. Project setup and dependencies
2. Basic layout structure
3. Internationalization setup
4. Design system and styling

### Phase 2: Core Sections (Days 2-3)
1. Header and footer
2. Hero section
3. Product gallery
4. Variation selector

### Phase 3: Content Sections (Days 4-5)
1. Craftsmanship story
2. Objection handling
3. FAQ section
4. Social proof

### Phase 4: Conversion Flow (Days 6-7)
1. Cart functionality
2. Checkout flow
3. Risk reversal
4. Final CTA

## Success Criteria
- Visual prototype complete
- All sections responsive
- Language switching functional
- Cart and checkout flow working
- SEO structure implemented
- Performance optimized

## Notes
- No backend integration
- No data persistency
- Mock product data
- Placeholder images
- Focus on visual experience
- Scalable architecture for future
