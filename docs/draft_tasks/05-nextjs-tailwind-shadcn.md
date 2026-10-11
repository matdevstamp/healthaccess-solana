# Task: Next.js + Tailwind CSS + shadcn/ui Setup

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-09-07
- **Status:** DONE
- **Assignee:** matdevstamp
- **Tags:** frontend, tooling, ui, required, gate:2-scaffold
- **Dependencies:** 01-project-setup-group-contract.md, 03-ripwire-architecture-artifacts.md
- **GitHub Issue:** #6 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/6)
- **Estimated Effort:** 3h

## Requirements

- Fullstack **Next.js (App Router)** scaffold — UI and API route handlers in one app (kickoff decision)
- Utility-first CSS (Tailwind CSS)
- Accessible component library (shadcn/ui)

The examples below are optional starting points, not additional requirements. The team may use an equivalent setup if it meets the requirements.

## User Stories

- As a frontend developer, I want a shared accessible UI foundation so that feature branches can build consistent screens without editing the scaffold.
- As a user, I want the interface to work on the required demo viewport sizes so that the presentation is reliable.
- Fast development experience
- Production-ready build output

## Design

### Tech Stack

```
Framework:      Next.js (App Router, TypeScript) — fullstack
CSS Framework:  Tailwind CSS 4.x
Components:     shadcn/ui (Radix UI primitives)
Icons:          Lucide React
Animation:      tailwindcss-animate
Servers:        two instances of the same app (ports 3001 + 3002)
```

### Project Structure

```
src/
├── app/
│   ├── layout.tsx        # root layout (fonts, providers)
│   ├── globals.css       # Tailwind + design tokens
│   ├── page.tsx
│   ├── (auth)/           # login, access-denied pages
│   ├── dashboard/
│   ├── patients/
│   └── api/              # route handlers = the backend
│       ├── auth/
│       ├── patients/
│       ├── records/
│       ├── notes/
│       └── access-log/
├── components/
│   └── ui/               # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── badge.tsx
│       ├── avatar.tsx
│       ├── dropdown-menu.tsx
│       └── ...
├── lib/
│   ├── utils.ts          # cn() utility
│   ├── prisma.ts         # shared Prisma client
│   ├── auth/             # JWT helpers + middleware
│   ├── blockchain/       # chain core
│   └── p2p/              # Socket.IO / peer sync
├── components.json       # shadcn/ui config
├── tsconfig.json         # path alias @/* -> ./src/*
└── next.config.ts
```

### shadcn/ui Installation

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Add components as needed
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add select
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add avatar
npx shadcn@latest add dropdown-menu
npx shadcn@latest add form
npx shadcn@latest add label
npx shadcn@latest add tabs
npx shadcn@latest add toast
npx shadcn@latest add skeleton
```

### Next.js Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Path alias @/* is defined in tsconfig.json; no proxy needed because
  // API route handlers live in the same app (src/app/api).
};

export default nextConfig;
```

### Optional Basic Setup Example

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app
npm install
npm run dev -- -p 3001   # server 1 (Hospital)
npm run dev -- -p 3002   # server 2 (Ambulance), separate terminal
```

Keep the final commands and folder structure documented for the rest of the team, even if the implementation differs from this example.

### Optional Server-State Foundation

TanStack React Query is an optional way to manage server-side state in client components. It is not required if the team chooses another consistent approach.

```bash
npm install @tanstack/react-query
```

```tsx
// src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Keep authentication tokens, API calls, and query keys in shared modules rather than scattering `fetch` calls through components. Client components call route handlers under `src/app/api/`; route handlers call shared `src/lib` services.

### Tailwind Configuration

```javascript
// tailwind.config.ts (or Tailwind 4 CSS-first @theme in globals.css)
import tailwindAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindAnimate],
};
```

### CSS Variables (src/app/globals.css)

```css
@import "tailwindcss";
/* or: @tailwind base; @tailwind components; @tailwind utilities; (v3) */

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Utility Function (src/lib/utils.ts)

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Tasks

- [x] Scaffold Next.js (App Router, TypeScript) at the repo root
- [x] Install and configure Tailwind CSS
- [x] Setup shadcn/ui with components.json
- [x] Install core shadcn/ui components
- [x] Configure path aliases (@/* in tsconfig.json)
- [x] Setup CSS variables for theming
- [x] Create cn() utility function
- [x] Add dark mode support
- [x] Verify the app runs on ports 3001 and 3002
- [x] Add a minimal /api/health route handler and a login shell

## Done Criteria

- [x] `npm run dev -- -p 3001` and `npm run dev -- -p 3002` both start
- [x] Tailwind classes are applied
- [x] shadcn/ui components render properly
- [x] Path aliases work (@/components)
- [x] A route handler responds on /api/health
- [x] Dark mode toggle works
- [x] Hot module replacement works
- [x] Production build succeeds

## Notes

- Stack decision: fullstack Next.js per server (kickoff 2026-09-04) — no separate Vite frontend or Express backend
- Use `npx shadcn@latest add <component>` to add new components
- shadcn/ui components are copied into your project, not installed as a package
- You can customize the components after adding them
- Use the `cn()` utility for merging Tailwind classes

## Questions to Resolve

- [x] Which shadcn/ui components do we need initially?
- [x] Should we use dark mode from the start?
- [x] Custom color palette or default shadcn colors?
