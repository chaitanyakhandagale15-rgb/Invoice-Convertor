# InvoiceBridge — Implementation Plan

Build a modern full-stack SaaS web application that converts US invoices (PDF/image) into Indian GST-compliant invoices using OCR extraction, currency/tax conversion, and PDF generation.

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Database | **Local PostgreSQL** (already installed on machine) |
| File Storage | **Local filesystem** (`/public/uploads/` and `/public/converted/`) — Cloudinary can be added later |
| OCR Processing | **Client-side** in browser via Tesseract.js Web Workers — avoids server timeouts |
| Tailwind Version | **Tailwind CSS v3** (ShadCN default) |
| Font | **Inter** from Google Fonts |
| Default Exchange Rate | 1 USD = 83 INR (editable by user) |
| Default GST Rate | 18% IGST (editable, with CGST/SGST option) |

---

## Architecture Overview

```mermaid
graph TB
    subgraph Client["Browser — Client Side"]
        A["Upload Page"] -->|File| B["PDF.js renders to Canvas"]
        B --> C["Tesseract.js Web Worker — OCR"]
        C -->|Extracted Text| D["Preview & Edit Page"]
        D -->|Confirmed Data| E["POST /api/convert"]
    end

    subgraph Server["Next.js API Routes — Server Side"]
        F["POST /api/upload"] -->|Save file| G["Local Filesystem"]
        E --> H["Converter Engine — USD→INR, Tax→GST"]
        H --> I["PDFKit — Generate GST PDF Buffer"]
        I --> J["Save PDF to /public/converted/"]
        J --> K["Prisma → Local PostgreSQL"]
    end

    subgraph Dashboard["Dashboard"]
        K --> L["GET /api/invoices"]
        L --> M["Stats Cards + History Table"]
    end
```

### Key Architectural Choices

| Area | Choice | Rationale |
|---|---|---|
| OCR Location | Client-side browser | Tesseract.js in Web Workers — no server timeout risk, works on Vercel free tier |
| PDF Input Handling | `pdfjs-dist` → Canvas → Tesseract.js | Tesseract.js only processes images; PDF pages must be rendered to canvas first |
| Digital PDF Shortcut | `pdfjs-dist` text extraction API | Machine-readable PDFs skip OCR entirely for instant extraction |
| PDF Generation | Server-side PDFKit | In-memory buffer generation, no temp files, streams directly to response |
| Database | Prisma ORM + Local PostgreSQL | Standard setup, easy migration to hosted DB later |
| File Storage | Local `/public/` directories | Simple for MVP; swap to Cloudinary/S3 later with minimal code changes |
| UI Framework | ShadCN UI + Tailwind v3 | Premium accessible components, rapid development |

---

## Proposed Changes

---

### Phase 1: Project Scaffolding & Configuration

Bootstrap the Next.js 14 project with all tooling and dependencies.

#### [NEW] Project initialization

```bash
npx create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

#### [NEW] ShadCN UI setup

```bash
npx shadcn@latest init
# Style: Default | Base color: Slate | CSS variables: Yes

npx shadcn@latest add button card input label table badge dialog tabs toast progress separator dropdown-menu skeleton select
```

#### [NEW] NPM dependencies

```bash
# Database
npm install prisma @prisma/client --save-dev
npm install @prisma/client

# OCR & PDF processing
npm install tesseract.js pdfjs-dist

# PDF generation (server-side)
npm install pdfkit @types/pdfkit

# UI & animation
npm install lucide-react framer-motion date-fns

# File upload handling
npm install formidable @types/formidable
```

#### [NEW] `.env`

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/invoicebridge"
NEXT_PUBLIC_EXCHANGE_RATE="83"
NEXT_PUBLIC_DEFAULT_GST_RATE="18"
```

#### [NEW] `.env.example`

Same as above with placeholder values for documentation.

#### [MODIFY] `next.config.mjs`

- Configure webpack to alias `canvas` to false (for `pdfjs-dist` in browser)
- Set `serverExternalPackages: ['pdfkit']` for server-side PDF generation
- Configure output file tracing for local file access

---

### Phase 2: Database Schema & Prisma ORM

#### [NEW] `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  createdAt DateTime  @default(now())
  invoices  Invoice[]
}

model Invoice {
  id               String            @id @default(cuid())
  userId           String?
  user             User?             @relation(fields: [userId], references: [id])
  sourceCountry    String            @default("US")
  targetCountry    String            @default("IN")
  originalAmount   Float             @default(0)
  originalCurrency String            @default("USD")
  status           InvoiceStatus     @default(UPLOADED)
  filePath         String?
  fileName         String?
  extractedData    Json?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  converted        ConvertedInvoice?
}

model ConvertedInvoice {
  id              String   @id @default(cuid())
  invoiceId       String   @unique
  invoice         Invoice  @relation(fields: [invoiceId], references: [id])
  inrAmount       Float
  cgstAmount      Float    @default(0)
  sgstAmount      Float    @default(0)
  igstAmount      Float    @default(0)
  gstRate         Float    @default(18)
  exchangeRate    Float    @default(83)
  convertedData   Json
  pdfPath         String?
  processedAt     DateTime @default(now())
}

enum InvoiceStatus {
  UPLOADED
  EXTRACTING
  EXTRACTED
  CONVERTING
  CONVERTED
  FAILED
}
```

#### [NEW] `src/lib/prisma.ts`

- Singleton PrismaClient with global caching to prevent hot-reload connection leaks
- Standard pattern: `globalThis` check for development

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### Database initialization

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

### Phase 3: Core Libraries

These are the business-logic modules that power the entire conversion pipeline.

---

#### [NEW] `src/lib/types.ts` — Shared TypeScript Interfaces

```typescript
interface ExtractedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  seller: { name: string; address: string };
  buyer: { name: string; address: string };
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  currency: string;
}

interface LineItem {
  sno: number;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface ConversionOptions {
  exchangeRate: number;
  gstRate: number;
  supplyType: 'intra-state' | 'inter-state';
  sellerGSTIN: string;
  buyerGSTIN: string;
  placeOfSupply: string;
  stateCode: string;
}

interface ConvertedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  seller: { name: string; address: string; gstin: string };
  buyer: { name: string; address: string; gstin: string };
  placeOfSupply: string;
  stateCode: string;
  lineItems: ConvertedLineItem[];
  subtotalINR: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstRate: number;
  totalINR: number;
  exchangeRate: number;
  originalCurrency: string;
  originalTotal: number;
}
```

---

#### [NEW] `src/lib/ocr.ts` — Client-Side OCR Engine

Runs entirely in the browser. Two extraction paths:

**Path A — Image files (PNG/JPG):**
1. Load image file into Tesseract.js worker
2. Run `worker.recognize()` → raw text
3. Parse raw text with `parseInvoiceText()`

**Path B — PDF files:**
1. Load PDF with `pdfjs-dist`
2. Try `page.getTextContent()` for digital/machine-readable PDFs
3. If extracted text is sparse (<50 chars), fall back to:
   - Render page to offscreen Canvas at 2x scale
   - Pass canvas to Tesseract.js worker
4. Parse result with `parseInvoiceText()`

**Text Parser — `parseInvoiceText(rawText: string)`:**
- Regex patterns for invoice number: `INV-\d+`, `Invoice\s*#?\s*:?\s*(\S+)`, `Invoice No\.?\s*:?\s*(\S+)`
- Date formats: `MM/DD/YYYY`, `Month DD, YYYY`, `YYYY-MM-DD`
- Seller/Buyer blocks: look for "Bill To", "Ship To", "From", "To" section headers
- Line items: detect tabular rows with description + quantity + price + amount
- Totals: regex for `Subtotal`, `Tax`, `Total`, `Amount Due`, `Balance Due`
- Currency: detect `$`, `USD`, `US Dollar`

---

#### [NEW] `src/lib/converter.ts` — Invoice Conversion Engine

`convertInvoice(extracted: ExtractedInvoice, options: ConversionOptions): ConvertedInvoiceData`

**Currency Conversion:**
- Every monetary value × `exchangeRate` (default 83)
- `unitPrice`, `amount`, `subtotal`, `taxAmount`, `total` all converted

**Tax Mapping (US Sales Tax → Indian GST):**
- Remove original US tax amount
- Recalculate tax on converted INR subtotal:
  - If `supplyType === 'inter-state'`: `IGST = subtotalINR × gstRate%`
  - If `supplyType === 'intra-state'`: `CGST = subtotalINR × (gstRate/2)%`, `SGST = same`
- Default: inter-state (foreign invoice → IGST)

**Field Mapping:**
- Generate new invoice number: `GST-INV-{timestamp}`
- Add mandatory GST fields: GSTIN, HSN/SAC code placeholders (`9954` for services), Place of Supply, State Code
- Add "Reverse Charge: No" flag
- Recalculate grand total: `subtotalINR + cgst + sgst + igst`

---

#### [NEW] `src/lib/pdf.ts` — GST Invoice PDF Generator

`generateGSTInvoicePDF(data: ConvertedInvoiceData): Promise<Buffer>`

Uses PDFKit in-memory buffer pattern (no temp files):

```
┌─────────────────────────────────────────────┐
│              TAX INVOICE                     │
├─────────────────────┬───────────────────────┤
│ Supplier Details    │ Invoice Details        │
│ Name               │ Invoice #: GST-INV-... │
│ Address            │ Date: DD/MM/YYYY       │
│ GSTIN: XXXXXXXXX   │ Place of Supply: XX    │
├─────────────────────┴───────────────────────┤
│ Buyer Details                                │
│ Name / Address / GSTIN                       │
├──┬────────────┬─────┬───┬──────┬────────────┤
│# │Description │HSN  │Qty│Rate  │Amount (₹)  │
├──┼────────────┼─────┼───┼──────┼────────────┤
│1 │Service A   │9954 │ 1 │8,300 │ 8,300.00   │
├──┴────────────┴─────┴───┴──────┴────────────┤
│                    Subtotal:    ₹ 8,300.00   │
│                    IGST @18%:   ₹ 1,494.00   │
│                    Grand Total: ₹ 9,794.00   │
├─────────────────────────────────────────────┤
│ Amount in words: Nine Thousand Seven ...     │
│ Reverse Charge: No                           │
│ Terms & Conditions                           │
│                      Authorized Signatory    │
└─────────────────────────────────────────────┘
```

- Rupee symbol (₹) formatting with Indian number system (lakhs/crores)
- Amount in words converter
- Professional blue accent colors matching the app theme

---

#### [NEW] `src/lib/file-storage.ts` — Local File Storage

- `saveUploadedFile(file: Buffer, fileName: string): Promise<string>` → saves to `public/uploads/{invoiceId}/`
- `saveConvertedPDF(buffer: Buffer, invoiceId: string): Promise<string>` → saves to `public/converted/{invoiceId}.pdf`
- `getFilePath(relativePath: string): string` → resolves to absolute path
- Creates directories if they don't exist (`fs.mkdir` with `recursive: true`)

---

### Phase 4: API Routes

---

#### [NEW] `src/app/api/upload/route.ts` — POST

- Accept multipart form data (PDF/PNG/JPG)
- Validate file type (`application/pdf`, `image/png`, `image/jpeg`) and size (max 10MB)
- Save file to `public/uploads/{invoiceId}/` using `file-storage.ts`
- Create `Invoice` record in PostgreSQL with status `UPLOADED`
- Return `{ invoiceId, filePath, fileName }`

#### [NEW] `src/app/api/extract/route.ts` — POST

- Receive already-extracted data from client-side OCR
- Body: `{ invoiceId, extractedData: ExtractedInvoice }`
- Validate required fields are present
- Update `Invoice` record: set `extractedData` JSON, status → `EXTRACTED`, `originalAmount`
- Return `{ success: true, invoiceId, extractedData }`

#### [NEW] `src/app/api/convert/route.ts` — POST

- Body: `{ invoiceId, extractedData, conversionOptions }`
- Run `converter.convertInvoice(extractedData, conversionOptions)`
- Run `pdf.generateGSTInvoicePDF(convertedData)` → get PDF buffer
- Save PDF buffer to `public/converted/{invoiceId}.pdf`
- Create `ConvertedInvoice` record with all tax amounts and PDF path
- Update `Invoice` status → `CONVERTED`
- Return `{ convertedInvoiceId, pdfPath, convertedData }`

#### [NEW] `src/app/api/download/[id]/route.ts` — GET

- Look up `ConvertedInvoice` by ID
- Read PDF file from local filesystem
- Return with headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=GST-Invoice-{id}.pdf`
- 404 if not found

#### [NEW] `src/app/api/invoices/route.ts` — GET

- Query all invoices with optional filters: `?status=CONVERTED&page=1&limit=10`
- Include related `ConvertedInvoice` data
- Compute aggregate stats:
  - Total invoices count
  - Total converted count
  - Total INR amount processed
  - This month's conversion count
- Return `{ invoices: [...], stats: {...}, pagination: {...} }`

---

### Phase 5: Design System & Layout Shell

---

#### [MODIFY] `src/app/globals.css`

- CSS custom properties for color palette:
  - Primary: `hsl(220, 70%, 50%)` (rich blue)
  - Primary light: `hsl(220, 70%, 96%)`
  - Accent: `hsl(200, 80%, 55%)` (cyan-blue)
  - Success: `hsl(145, 65%, 42%)`
  - Warning: `hsl(38, 92%, 50%)`
  - Error: `hsl(0, 72%, 51%)`
  - Neutrals: Slate scale from 50 to 950
- Glassmorphism utilities: `.glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.7); }`
- Keyframe animations:
  - `@keyframes fadeInUp` — elements slide up + fade in
  - `@keyframes shimmer` — loading skeleton shimmer
  - `@keyframes pulse-glow` — subtle glow pulse on CTAs
  - `@keyframes float` — gentle floating for hero decorations
- Gradient text utility: `.gradient-text { background: linear-gradient(...); -webkit-background-clip: text; }`
- Indian Rupee formatting class

#### [MODIFY] `src/app/layout.tsx`

- Import Inter font via `next/font/google`
- Root metadata: title "InvoiceBridge — AI-Powered Invoice Conversion", description, Open Graph tags
- Body wrapper with `<Navbar />` + `<main>` + `<Footer />`
- `<Toaster />` provider for notifications (sonner)

#### [NEW] `src/components/layout/navbar.tsx`

- Sticky top bar with glassmorphism (`backdrop-blur-md bg-white/80`)
- Logo: "InvoiceBridge" with gradient text (`blue → cyan`)
- Navigation links: Home, Upload, Dashboard — active state underline
- Responsive: hamburger menu icon below `md` breakpoint with animated slide-in drawer
- Subtle bottom border with gradient line

#### [NEW] `src/components/layout/footer.tsx`

- Minimal footer: "Built with InvoiceBridge" + copyright year
- GitHub link icon
- Matches overall blue theme

---

### Phase 6: Frontend Pages (5 Pages)

---

#### [NEW] `src/app/page.tsx` — Landing Page

**Hero Section:**
- Full-viewport height with animated gradient background (blue → indigo → purple, slowly shifting)
- Headline: "Convert International Invoices to **Indian GST Format** in Seconds" (bold keywords)
- Subtitle paragraph explaining the value proposition
- Two CTA buttons: "Start Converting →" (primary), "View Dashboard" (outline)
- Floating decorative elements: invoice card mockups with parallax-like float animation
- Framer Motion `fadeInUp` entrance animations, staggered by 0.1s per element

**Features Section:**
- 3-column card grid on desktop, single column on mobile
- Each card: icon (Lucide), title, description, hover lift effect
  - 🔍 **Smart OCR** — "AI-powered text extraction from PDFs and images"
  - 💱 **Auto Conversion** — "Currency and tax mapping from USD to INR with GST"
  - 📄 **PDF Generation** — "Professional GST-compliant invoice PDFs ready to download"

**How It Works Section:**
- 4-step horizontal flow with numbered circles connected by lines
  1. Upload → 2. Extract → 3. Convert → 4. Download
- Each step: icon + title + brief text
- Animated: steps light up sequentially on scroll (Framer Motion `whileInView`)

**Bottom CTA:**
- Full-width gradient banner
- "Ready to convert your first invoice?" + button

---

#### [NEW] `src/app/upload/page.tsx` — Upload Page

- Page title: "Upload Invoice" with breadcrumb

**Dropzone Component:**
- Large centered drop area (dashed border, rounded-2xl)
- Drag-over state: blue border + blue background tint + scale animation
- Center content: upload cloud icon (Lucide `Upload`), "Drag & drop your invoice here", "or click to browse"
- Accepted formats chips: PDF, PNG, JPG
- Max size label: "Up to 10MB"

**After File Selected:**
- File preview card: icon + filename + file size + remove button
- For images: thumbnail preview
- For PDFs: first page rendered via PDF.js as thumbnail

**Upload + OCR Flow:**
- "Upload & Extract" button
- On click:
  1. Upload file → `POST /api/upload` → get `invoiceId`
  2. Run client-side OCR (Tesseract.js / PDF.js)
  3. Send extracted data → `POST /api/extract`
  4. Redirect to `/convert/{invoiceId}`
- Progress indicator: multi-step stepper showing current phase
  - ⬆️ Uploading... → 🔄 Processing... → 📝 Extracting text... → ✅ Complete!
- Error handling: toast notification for invalid files, OCR failures

---

#### [NEW] `src/app/convert/[id]/page.tsx` — Conversion Preview Page

**Layout:** Two-panel (desktop: side-by-side, mobile: stacked)

**Left Panel — Extracted Invoice Data:**
- Section header: "Extracted Data" with edit icon
- Grouped form fields using ShadCN `Card`:
  - **Invoice Info**: Invoice number (input), Date (input)
  - **Seller Details**: Name (input), Address (textarea)
  - **Buyer Details**: Name (input), Address (textarea)
  - **Line Items**: Editable table
    - Columns: Description, HSN Code, Qty, Unit Price (USD), Amount (USD)
    - Add row / Delete row buttons
    - Auto-calculate amount = qty × unitPrice
  - **Totals**: Subtotal, Tax Amount, Total (auto-calculated, editable)

**Right Panel — Conversion Settings:**
- ShadCN Card with settings:
  - Exchange Rate input: `1 USD = _____ INR` (default 83)
  - GST Rate selector: dropdown with 5%, 12%, 18%, 28%
  - Supply Type: radio/toggle — "Inter-State (IGST)" / "Intra-State (CGST+SGST)"
  - Seller GSTIN input (with format validation: `\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1}`)
  - Buyer GSTIN input
  - Place of Supply dropdown (all 36 Indian states/UTs)
  - State Code (auto-filled from Place of Supply)

**Conversion Summary Card (bottom of right panel):**
- Live-updating as fields change
- Original: $XXX.XX USD
- Converted Subtotal: ₹XX,XXX.XX
- CGST @9%: ₹X,XXX.XX (or hidden if inter-state)
- SGST @9%: ₹X,XXX.XX (or hidden if inter-state)
- IGST @18%: ₹X,XXX.XX (or hidden if intra-state)
- **Grand Total: ₹XX,XXX.XX** (bold, large)

**Action Button:**
- "Generate GST Invoice PDF" (primary, full-width)
- Loading spinner during conversion
- On success: redirect to `/download/{convertedInvoiceId}`

---

#### [NEW] `src/app/dashboard/page.tsx` — Dashboard

**Stats Cards Row (4 cards):**
- Total Invoices Converted — with `FileCheck` icon, animated count-up number
- Total Amount Processed (₹) — with `IndianRupee` icon
- This Month's Conversions — with `Calendar` icon
- Success Rate (%) — with `TrendingUp` icon
- Each card: gradient left border accent, hover lift shadow, Framer Motion `fadeInUp` staggered

**Recent Conversions Section:**
- Section header: "Recent Conversions" + "Upload New" link button
- ShadCN `Table` component:
  - Columns: Invoice #, Date, Original Amount (USD), Converted Amount (INR), Status, Actions
  - Status column: colored `Badge` components
    - `UPLOADED` → yellow
    - `EXTRACTED` → blue
    - `CONVERTED` → green
    - `FAILED` → red
  - Actions column: View button, Download PDF button (icon), Delete button (icon)
  - Row hover highlight
- Pagination: Previous / Next with page numbers
- Empty state: illustration + "No invoices yet" + "Upload your first invoice" CTA

**Quick Upload Card:**
- Small card at bottom: "Ready to convert another?" + upload button

---

#### [NEW] `src/app/download/[id]/page.tsx` — Download Page

- Success animation on page load (checkmark with confetti-like particles)
- Invoice summary card:
  - Invoice #, Date, Original Amount, Converted Amount
  - Tax breakdown (CGST/SGST/IGST)
  - Grand total highlighted
- Large download button: "Download GST Invoice PDF" with `Download` icon
  - File size indicator below button
- PDF preview: embedded `<iframe>` showing the generated PDF
- Secondary actions:
  - "Convert Another Invoice" → `/upload`
  - "View Dashboard" → `/dashboard`

---

### Phase 7: Shared Components

#### [NEW] `src/components/upload/dropzone.tsx`
- Reusable drag-and-drop component with `onFileSelect` callback
- Visual states: idle, drag-over, file-selected, error
- File type + size validation built in
- Animated transitions between states

#### [NEW] `src/components/upload/ocr-progress.tsx`
- Multi-step progress stepper
- Props: `currentStep`, `steps[]`, `progress` (0-100)
- Animated progress bar fill
- Step icons change: pending (circle) → active (spinner) → done (checkmark)

#### [NEW] `src/components/invoice/extracted-form.tsx`
- Controlled form component for all extracted invoice fields
- `onChange` callback for live updates
- Field validation with error messages
- Organized in collapsible sections

#### [NEW] `src/components/invoice/conversion-summary.tsx`
- Real-time computation display
- Animated number transitions when values change
- Arrow visualization: USD amount → INR amount
- Tax breakdown rows with conditional visibility (IGST vs CGST+SGST)

#### [NEW] `src/components/invoice/line-items-table.tsx`
- Editable table for invoice line items
- Add/remove rows with animation
- Auto-calculate row totals
- Running subtotal at bottom

#### [NEW] `src/components/dashboard/stats-card.tsx`
- Animated count-up number on mount
- Icon + label + formatted value
- Gradient left border accent
- Hover: lift + enhanced shadow

#### [NEW] `src/components/dashboard/invoice-table.tsx`
- ShadCN Table wrapper with invoice-specific columns
- Status badges with color mapping
- Action buttons (view, download, delete)
- Skeleton loading rows
- Empty state component

#### [NEW] `src/components/common/page-header.tsx`
- Reusable page title + optional description + optional breadcrumb
- Consistent spacing across all pages

#### [NEW] `src/components/common/loading-spinner.tsx`
- Branded spinner with InvoiceBridge colors
- Used in buttons, page loading, and OCR processing

---

### Phase 8: Polish, Animations & Responsive Design

#### Framer Motion Animations

- **Page transitions**: `fadeInUp` on every page mount (layout-level `motion.main`)
- **Card entrance**: staggered `fadeInUp` with 0.1s delay per card (dashboard stats, features)
- **Button micro-interactions**: `whileHover: { scale: 1.02 }`, `whileTap: { scale: 0.98 }`
- **Number counters**: animated count-up from 0 to target value over 1.5s
- **Progress bars**: spring animation with `damping: 20, stiffness: 100`
- **Dropzone**: `scale: 1.02` on drag-over with border color transition
- **Table rows**: subtle fade-in on data load

#### Responsive Breakpoints

| Breakpoint | Layout Changes |
|---|---|
| < 640px (mobile) | Single column, full-width cards, stacked panels, hamburger nav |
| 640-768px (sm) | 2-column stats grid, slightly larger dropzone |
| 768-1024px (md) | Side navigation visible, 2-column convert layout begins |
| 1024px+ (lg/xl) | Full 4-column stats, side-by-side convert panels, wide table |

#### SEO Implementation

- `metadata` export on every page with unique title and description
- Open Graph image (auto-generated or static)
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`
- Single `<h1>` per page, proper heading hierarchy
- All interactive elements have unique `id` attributes

#### Error Handling

- Toast notifications for all user-facing errors (file too large, invalid type, OCR failure, server error)
- Graceful fallbacks: if OCR produces empty results, show manual entry form
- API error responses with meaningful messages
- Loading skeletons on all data-fetching pages

---

## Final File Structure

```
src/
├── app/
│   ├── layout.tsx                        # Root layout, Inter font, nav, footer, toaster
│   ├── globals.css                       # Design system tokens, animations, utilities
│   ├── page.tsx                          # Landing page — hero, features, how-it-works
│   ├── upload/
│   │   └── page.tsx                      # Upload + client-side OCR processing
│   ├── convert/
│   │   └── [id]/
│   │       └── page.tsx                  # Editable preview + conversion settings
│   ├── dashboard/
│   │   └── page.tsx                      # Stats cards + invoice history table
│   ├── download/
│   │   └── [id]/
│   │       └── page.tsx                  # PDF download + preview
│   └── api/
│       ├── upload/route.ts               # POST — file upload + DB record
│       ├── extract/route.ts              # POST — save extracted OCR data
│       ├── convert/route.ts              # POST — convert + generate PDF
│       ├── download/[id]/route.ts        # GET — stream PDF file
│       └── invoices/route.ts             # GET — list invoices + stats
│
├── components/
│   ├── layout/
│   │   ├── navbar.tsx                    # Sticky glassmorphism nav
│   │   └── footer.tsx                    # Minimal footer
│   ├── upload/
│   │   ├── dropzone.tsx                  # Drag-and-drop file upload
│   │   └── ocr-progress.tsx              # Multi-step OCR progress indicator
│   ├── invoice/
│   │   ├── extracted-form.tsx            # Editable extracted invoice form
│   │   ├── conversion-summary.tsx        # Live conversion calculation display
│   │   └── line-items-table.tsx          # Editable line items table
│   ├── dashboard/
│   │   ├── stats-card.tsx                # Animated stat card
│   │   └── invoice-table.tsx             # Invoice history table
│   ├── common/
│   │   ├── page-header.tsx               # Reusable page title
│   │   └── loading-spinner.tsx           # Branded loading indicator
│   └── ui/                              # ShadCN auto-generated components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── table.tsx
│       ├── badge.tsx
│       ├── select.tsx
│       ├── skeleton.tsx
│       ├── toast.tsx
│       ├── progress.tsx
│       └── ...
│
├── lib/
│   ├── prisma.ts                        # Prisma client singleton
│   ├── ocr.ts                           # Client-side OCR (Tesseract.js + PDF.js)
│   ├── converter.ts                     # USD→INR + Tax→GST conversion engine
│   ├── pdf.ts                           # PDFKit GST invoice generator
│   ├── file-storage.ts                  # Local file read/write helpers
│   ├── types.ts                         # Shared TypeScript interfaces
│   └── utils.ts                         # ShadCN cn() + formatting helpers
│
├── prisma/
│   └── schema.prisma                    # PostgreSQL schema
│
├── public/
│   ├── uploads/                         # Uploaded invoice files (gitignored)
│   └── converted/                       # Generated GST PDFs (gitignored)
│
├── .env                                 # Local environment variables
├── .env.example                         # Template for env vars
├── .gitignore                           # Include public/uploads/, public/converted/
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Verification Plan

### Automated Checks

| Check | Command | Criteria |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Zero type errors |
| ESLint | `npm run lint` | Zero lint errors |
| Build | `npm run build` | Successful production build |
| Prisma | `npx prisma validate` | Schema valid |

### Core Library Unit Tests (manual execution in dev)

- **`converter.ts`**: USD 100 at rate 83 → ₹8,300. GST 18% inter-state → IGST ₹1,494. Total ₹9,794
- **`converter.ts`**: GST 18% intra-state → CGST ₹747 + SGST ₹747
- **`converter.ts`**: Edge case — zero tax, missing fields, empty line items
- **`pdf.ts`**: Buffer starts with `%PDF-` header, buffer size > 0
- **`ocr.ts`** parser: Test against sample invoice text → correct field extraction

### End-to-End Manual Testing

1. **Upload flow**: Upload sample US invoice PDF → verify file saved locally → DB record created
2. **OCR extraction**: Verify Tesseract.js extracts text in browser → fields populate in preview
3. **Conversion preview**: Edit exchange rate, GST rate → verify live recalculation
4. **PDF generation**: Click convert → verify PDF downloads → open and verify GST layout is correct
5. **Dashboard**: Verify stats update, table shows new invoice, download button works
6. **Responsive**: Test at 375px, 768px, 1440px viewport widths
7. **Error cases**: Upload .txt file (rejected), upload 15MB file (rejected), upload corrupt PDF (graceful error)

### Browser Compatibility

- Chrome (primary) — full Tesseract.js Web Worker + PDF.js support
- Firefox — verify Web Worker compatibility
- Edge — verify as Chromium-based

---

## Implementation Order

| Phase | What | Est. Time |
|---|---|---|
| **1** | Project scaffolding, deps, config, ShadCN init | 30 min |
| **2** | Prisma schema, migrations, client singleton | 20 min |
| **3** | Core libs: types, converter, PDF generator, OCR parser, file storage | 2 hrs |
| **4** | API routes: upload, extract, convert, download, invoices | 1 hr |
| **5** | Design system (globals.css), layout, navbar, footer | 1 hr |
| **6** | 5 frontend pages: landing, upload, convert, dashboard, download | 3 hrs |
| **7** | Shared components: dropzone, progress, forms, tables, cards | 1.5 hrs |
| **8** | Polish: Framer Motion animations, responsive tweaks, SEO, error handling | 1 hr |

**Total estimated: ~10 hours**
