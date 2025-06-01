# Sawhinv

StockWatch AI is a full-stack inventory management application built with Next.js 13 and React 18. It offers:
  - Offline-first support with localStorage sync queue
  - AI-driven image-to-inventory extraction (OpenAI GPT-4o)
  - Real-time synchronization with Firebase Firestore

## Features
  - Inventory display grouped into Cooler, Freezer, Dry, Canned, and Other (with subcategories)
  - Search and filter items by name
  - Add new items (name, quantity, unit, category)
  - Inline edit and delete with unit conversion support
  - Change log with undo (restore previous state) and long-press clear confirmation
  - CSV import/export using Papaparse
  - Settings: default unit, default category, dark mode toggle

## Tech Stack
  - Next.js 13 (App Router) & React 18 with TypeScript
  - Firebase Admin SDK & Firestore via Next.js API routes
  - Tailwind CSS & CSS Variables, shadcn-UI (Radix UI primitives)
  - GenKit & @genkit-ai/googleai for AI flows
  - Papaparse for CSV parsing/unparsing
  - Jest & React Testing Library for unit & integration tests
  - Playwright for end-to-end tests
  - TypeScript for static type checking

    [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/M117n/studio)

## Getting Started

### Prerequisites
  - Node.js >= 18
  - A Firebase project with Firestore enabled and a service account JSON
  - Environment variables (in `.env.local`):
    ```bash
    FIREBASE_PROJECT_ID=your-project-id
    FIREBASE_CLIENT_EMAIL=your-client-email
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
    OPENAI_API_KEY=your-openai-api-key
    GOOGLE_GENAI_API_KEY=your-google-genai-api-key
    ```

### Installation
```bash
npm install
```

### Development
```bash
npm run dev          # Next.js dev server at http://localhost:9002
npm run genkit:dev   # (Optional) Watch and run GenKit AI flows locally
```

### Building
```bash
npm run build
npm run start       # Runs production build
```

### Testing
```bash
npm run test          # unit, integration, typecheck, and e2e tests
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:types
```

## Deployment
Deploy to Vercel or any Next.js-compatible hosting. Ensure environment variables are set in production.

## Folder Structure
```
src/
  ai/                   AI flows & GenKit setup
  app/                  Next.js App Router pages and API routes
    api/inventory/      Firestore CRUD endpoints
    layout.tsx          Root layout
    page.tsx            Main client UI
  components/
    inventory/          Inventory feature components (List, Form, ChangeLog, CSV, Image)
    ui/                 Reusable UI primitives (shadcn-UI)
  hooks/                Custom React hooks (useToast, useMobile)
  lib/
    firebaseAdmin.ts    Firebase Admin SDK initialization
    validateEnv.ts      Environment variable validation
    utils.ts            Shared utilities
  services/
    csv.ts              CSV import/export logic
  types/
    inventory.ts        TypeScript types for inventory items
```
