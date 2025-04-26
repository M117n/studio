 # App Name: StockWatch AI

 ## Core Features
 - Inventory Display
   - Shows current inventory grouped into Cooler, Freezer, Dry, Canned, Other (with subcategories).
   - Supports search/filter by item name.
 - Manual Input
   - Add items via form (name, quantity, unit, category).
   - Default unit & category can be set in the Settings menu.
 - Edit & Delete
   - Inline editing of items with unit conversion and category updates.
   - Delete items.
 - Change Log
   - Timestamped log of all changes (add, edit, delete, restore).
   - Clear with long-press confirmation to prevent accidental deletion.
 - Undo
   - Restore the previous inventory state (undo last change).
 - CSV Import/Export
   - Import inventory from CSV files.
   - Export current inventory to CSV.
 - Image to Inventory
   - Upload an image; AI (GenKit + Google Gemini) extracts item names, quantities, and units.
   - Adds extracted items under the default category.

 ## Persistence
 - All state (inventory list, change log, default unit/category) is persisted to localStorage.
 - Client-only React hooks; no external database or backend required.

 ## Tech Stack
 - Next.js (App Router) & React 18 with TypeScript.
 - Tailwind CSS + CSS Variables + shadcn-UI (Radix UI primitives).
 - GenKit + @genkit-ai/googleai for AI flow definition.
 - Papaparse for CSV parsing and unparsing.
 - React hooks and custom useToast hook for state management and notifications.

 ## Folder Structure
 - src/app/page.tsx – main page managing global state and rendering tabs.
 - src/components/ui – reusable UI primitives (buttons, dialogs, forms, tables).
 - src/components/inventory – feature components: InventoryForm, InventoryList, ChangeLog, CsvImportExport, ImageToInventory.
 - src/ai – GenKit setup and flows (extract-inventory-from-image).
 - src/hooks – custom hooks (useToast, useMobile).
 - src/lib/utils.ts – shared utility functions.

 ## Style Guidelines
 - Uses CSS variables (globals.css) and Tailwind for theming and layout.
 - Consistent typography and spacing across components.
 - Accent colors and animations configured in tailwind.config.ts (tailwindcss-animate plugin).
 - Icons provided by lucide-react.