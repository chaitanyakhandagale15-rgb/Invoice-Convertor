# InvoiceBridge

**Multi-Country GST Invoice Conversion SaaS**

Convert global invoices (PDF or image) into fully compliant Indian GST invoices — with live exchange rates, OCR extraction, and server-side PDF generation.

---

## Features

| Feature | Description |
|---|---|
| Google Authentication | Secure sign-in via Clerk (Google OAuth) |
| OCR Invoice Extraction | Client-side text extraction using Tesseract.js + pdfjs-dist |
| Multi-Country Conversion | Supports US, UK, EU, Canada, Australia, Singapore, UAE, and more |
| Live Exchange Rates | Real-time currency conversion via public exchange-rate API |
| GST Transformation | Configurable GST rate, IGST/CGST/SGST split, inter-state vs intra-state |
| PDF Generation | Server-side GST-compliant invoice PDF via pdfkit |
| Re-convert Workflow | Edit and re-generate any previously converted invoice |
| Dashboard Analytics | Conversion history, total INR processed, success rate, this-month stats |

---

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + Framer Motion + Wouter
- **Backend**: Express 5 + Node.js 24 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (Google OAuth, email/password)
- **OCR**: Tesseract.js + pdfjs-dist (client-side, browser-only)
- **PDF**: pdfkit (server-side)
- **Monorepo**: pnpm workspaces + TypeScript project references
- **API Codegen**: Orval (from OpenAPI spec)

---

## Project Structure

```
artifacts/
  api-server/          Express 5 API (port 8080)
  invoicebridge/       React + Vite frontend
lib/
  db/                  Drizzle ORM schema + migrations
  api-spec/            OpenAPI YAML (source of truth)
  api-client-react/    Auto-generated React hooks (do not edit)
data/
  uploads/             Uploaded invoice files (runtime)
  converted/           Generated GST PDFs (runtime)
```

---

## Local Development

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/invoicebridge
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Database Setup

```bash
pnpm --filter @workspace/db run push
```

### Run in Development

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 22201)
pnpm --filter @workspace/invoicebridge run dev
```

### Typecheck

```bash
pnpm run typecheck
```

### Regenerate API Client

After editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Deployment

InvoiceBridge is deployed on [Replit](https://replit.com).

### Required Production Environment Variables

```env
DATABASE_URL=
VITE_CLERK_PUBLISHABLE_KEY=
VITE_CLERK_PROXY_URL=
CLERK_SECRET_KEY=
```

> The `VITE_CLERK_PROXY_URL` is set automatically by Replit's Clerk integration.

---

## Pages

| Page | Route | Description |
|---|---|---|
| Home | `/` | Landing page — 4-step pipeline overview |
| Upload | `/upload` | Drag-and-drop file upload + client-side OCR |
| Convert | `/convert/:id` | Editable invoice form + live GST preview |
| Download | `/download/:id` | Success page + PDF download |
| Dashboard | `/dashboard` | Conversion history + analytics |

---

## Screenshots

| Page | Description |
|---|---|
| Home | Landing page with feature overview |
| Upload | Drag-and-drop zone with country selector |
| Convert | Invoice editor with live GST calculation |
| Dashboard | Conversion table with stats cards |
| Download | Success animation + PDF download |

---

## Architecture Notes

- **OCR runs entirely in the browser** — avoids large server-side processing overhead; gracefully falls back to an empty form if extraction fails
- **File uploads** use multer memory storage; files are saved to `data/uploads/` server-side (not served as static assets)
- **Upload endpoint excluded from OpenAPI codegen** — Orval cannot handle multipart/form-data File types; the frontend uses raw `fetch` + `FormData`
- **pdfkit externalized from esbuild bundle** — pdfkit's dependency `fontkit` uses `@swc/helpers`; bundling it causes runtime MODULE_NOT_FOUND errors
- **Idempotent conversion** — the convert endpoint deletes any existing converted record before inserting, preventing unique-constraint errors on re-convert

---

## License

MIT
