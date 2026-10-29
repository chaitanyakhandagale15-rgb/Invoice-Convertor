<div align="center">

<img src=".github/assets/banner.svg" alt="InvoiceBridge — Multi-Country GST Invoice Converter" width="100%"/>

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)](https://clerk.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🏗 Architecture](#-architecture) · [📐 Data Flow](#-data-flow) · [🌍 Country Support](#-country-support) · [📋 API Reference](#-api-reference) · [☁️ Deployment](#️-deployment)

<br/>

---

</div>

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔐 Authentication
- Google OAuth via **Clerk**
- Email/password sign-in
- JWT-based session management
- Clerk proxy middleware for multi-host setups
- Dev mode mock auth bypass (no Clerk needed locally)

### 🔍 Browser-Side OCR
- **Tesseract.js** for image invoice text extraction
- **pdfjs-dist** renders PDF pages to canvas before OCR
- Zero server processing — runs 100% in the browser
- Graceful fallback to editable blank form on failure

### 💱 Multi-Currency Conversion
- Live exchange rates via public API
- Fallback hardcoded rates (USD→83, GBP→105, EUR→90, CAD→61, AUD→55)
- Source tax stripped before re-applying Indian GST
- Precise 2-decimal rounding throughout

</td>
<td width="50%">

### 🧮 GST Transformation Engine
- Configurable GST rate (0%, 5%, 12%, 18%, 28%)
- **IGST** for inter-state · **CGST + SGST** for intra-state
- Per-line-item tax breakdown with HSN codes
- Indian rounding (round-off to nearest rupee)
- Amount in words (Crore / Lakh / Thousand — Indian number system)

### 📄 Server-Side PDF Generation
- Legally-formatted GST invoice via **pdfkit**
- Includes: seller/buyer GSTIN, place of supply, state code, reverse charge flag
- PDF cached to disk; auto-regenerated from DB if missing
- Returned as Base64 JSON to avoid binary proxy truncation

### 📊 Analytics Dashboard
- Paginated conversion history
- Total INR processed across all conversions
- This-month conversion count
- Success rate (converted / total uploaded)
- Download + delete actions per invoice

</td>
</tr>
</table>

---

## 🏗 Architecture

```
Invoice-Convertor/
│
├── 📁 artifacts/
│   ├── 🖥️  api-server/                 Express 5 REST API  ──► port 8080
│   │   └── src/
│   │       ├── app.ts                  Express app setup (CORS, pino, Clerk middleware)
│   │       ├── index.ts                Server entrypoint (port binding)
│   │       ├── routes/
│   │       │   ├── index.ts            Router registry
│   │       │   ├── invoices.ts         All invoice endpoints (upload/extract/convert/download/reset)
│   │       │   ├── exchange-rate.ts    Live rate proxy endpoint
│   │       │   └── health.ts           Health-check endpoint
│   │       ├── lib/
│   │       │   ├── converter.ts        🧮 GST conversion engine
│   │       │   ├── pdf.ts              📄 GST invoice PDF generator (pdfkit)
│   │       │   ├── file-storage.ts     💾 Upload/PDF read-write helpers
│   │       │   ├── email.ts            📧 Resend transactional email (coming soon)
│   │       │   ├── logger.ts           🪵 Pino structured logger
│   │       │   └── rules/
│   │       │       └── index.ts        🌍 Per-country tax rules (US/UK/EU/CA/AU)
│   │       └── middlewares/
│   │           ├── requireAuth.ts      🔒 Clerk JWT guard (injects req.userId)
│   │           └── clerkProxyMiddleware.ts  Clerk proxy for multi-host auth
│   │
│   └── 🌐 invoicebridge/               React + Vite frontend  ──► port 3000 (dev)
│       └── src/
│           ├── pages/
│           │   ├── Home.tsx            Landing + 4-step pipeline explainer
│           │   ├── Upload.tsx          Drag-and-drop + OCR extraction
│           │   ├── Convert.tsx         Invoice editor + live GST preview
│           │   ├── Download.tsx        Success screen + PDF download
│           │   └── Dashboard.tsx       History table + analytics
│           └── lib/
│               ├── ocr.ts              Tesseract.js + pdfjs-dist OCR pipeline
│               ├── types.ts            Frontend types + Indian state list
│               └── mockAuth.tsx        Dev-mode Clerk stub
│
├── 📁 lib/
│   ├── api-spec/openapi.yaml           📝 OpenAPI spec (source of truth)
│   ├── api-client-react/generated/     🤖 Auto-generated React hooks (Orval — do not edit)
│   └── db/src/schema/invoices.ts       🗄️ Drizzle ORM schema + relations
│
├── 📁 data/
│   ├── uploads/                        📥 Uploaded invoice files (runtime)
│   └── converted/                      📤 Generated GST PDFs (runtime)
│
└── vercel.json                         ☁️ Vercel frontend deployment config
```

---

## 📐 Data Flow

```mermaid
flowchart TD
    A["👤 User"] -->|"Drag & Drop\nPDF or Image"| B["📤 Upload Page"]
    B -->|"POST /api/invoices\nmultipart/form-data"| C["🖥️ API Server\n:8080"]
    C -->|"multer memory storage\n→ saveUploadedFile()"| D[("💾 data/uploads/")]
    C -->|"INSERT invoices\nstatus=UPLOADED"| E[("🗄️ PostgreSQL")]

    B -->|"File read in browser"| F["🔍 OCR Engine\nTesseract.js + pdfjs-dist"]
    F -->|"Extracted invoice\nfields + line items"| G["📝 Editable Form\nConvert Page"]

    G -->|"POST /api/invoices/:id/extract\nextractedData + sourceCountry"| C
    C -->|"UPDATE invoices\nstatus=EXTRACTED"| E

    G -->|"POST /api/invoices/:id/convert\nextractedData + conversionOptions"| H["🧮 Converter Engine\nconverter.ts"]
    H -->|"getCountryRule()\nstrip source tax"| I["🌍 Country Rules\nUS/UK/EU/CA/AU"]
    H -->|"apply exchange rate\napply IGST or CGST+SGST\nrounding + amountInWords"| J["📋 ConvertedInvoiceData"]

    J -->|"generateGSTInvoicePDF()"| K["📄 pdfkit PDF\nGST-INV-YYMM-XXXXX.pdf"]
    K -->|"saveConvertedPDF()"| L[("💾 data/converted/")]
    J -->|"INSERT convertedInvoices\nstatus=CONVERTED"| E

    G -->|"Redirect"| M["⬇️ Download Page"]
    M -->|"GET /api/invoices/:id/download"| C
    C -->|"readConvertedPDF()\nor regenerate from DB"| N["📥 Base64 PDF Response"]
    N -->|"Client-side blob download"| A

    E -->|"Paginated query\n+ stats aggregation"| O["📊 Dashboard\nHistory + Analytics"]
```

---

## 🔄 Invoice Lifecycle

```mermaid
stateDiagram-v2
    [*] --> UPLOADED : POST /api/invoices\n(file upload)
    UPLOADED --> EXTRACTED : POST /api/invoices/:id/extract\n(OCR data saved)
    EXTRACTED --> CONVERTING : POST /api/invoices/:id/convert\n(conversion started)
    CONVERTING --> CONVERTED : PDF generated\n+ DB record inserted
    CONVERTING --> FAILED : Any stage error\n(stage tag in response)
    CONVERTED --> EXTRACTED : POST /api/invoices/:id/reset\n(re-convert workflow)
    CONVERTED --> [*] : DELETE /api/invoices/:id
    FAILED --> [*] : DELETE /api/invoices/:id
```

---

## 🧮 GST Conversion Logic

```mermaid
flowchart LR
    A["🌍 Source Invoice\n(foreign currency)"] --> B["Strip Source Tax\nnormalizeTaxedAmount()"]
    B --> C["Apply Exchange Rate\ntaxableValueINR = amount × rate"]
    C --> D{"Supply Type?"}
    D -->|"Inter-State"| E["IGST\nigstAmount = taxable × gstRate%"]
    D -->|"Intra-State"| F["CGST + SGST\neach = taxable × (gstRate/2)%"]
    E --> G["Line Item Total\ntaxable + IGST"]
    F --> G
    G --> H["Grand Total\nsubtotal + totalTax"]
    H --> I["Round Off\nto nearest ₹"]
    I --> J["Amount in Words\nIndian number system\nCrore/Lakh/Thousand"]
    J --> K["📄 GST Invoice\nGST-INV-YYMM-XXXXX"]
```

---

## 🌍 Country Support

| Flag | Country | Currency | Tax System | Fallback Rate (→ ₹) |
|:---:|---|---|---|:---:|
| 🇺🇸 | United States | USD | Sales Tax | ₹83 |
| 🇬🇧 | United Kingdom | GBP | VAT | ₹105 |
| 🇪🇺 | European Union | EUR | VAT | ₹90 |
| 🇨🇦 | Canada | CAD | GST / HST | ₹61 |
| 🇦🇺 | Australia | AUD | GST | ₹55 |

> **How tax normalization works**: Each country rule exposes a `normalizeTaxedAmount(gross, taxRate)` function. For all supported countries, source tax is stripped from the gross amount before applying Indian GST — ensuring there is no double-taxation.

---

## 🛠 Tech Stack

### Frontend

| Package | Version | Role |
|---|---|---|
| React | 18 | UI component framework |
| Vite | Latest | Dev server + production bundler |
| TailwindCSS | v4 (via `@tailwindcss/vite`) | Utility-first styling |
| shadcn/ui | Latest | Accessible component library |
| Framer Motion | Latest | Animations + page transitions |
| Wouter | Latest | Lightweight client-side router |
| Tesseract.js | Latest | Browser-side OCR engine |
| pdfjs-dist | 5.x | PDF → canvas rendering for OCR |

### Backend

| Package | Version | Role |
|---|---|---|
| Express | 5.x | HTTP server |
| Node.js | 24+ | Runtime |
| TypeScript | 5.9 | End-to-end type safety |
| `@clerk/express` | 2.x | JWT auth middleware |
| Drizzle ORM | Latest | Type-safe PostgreSQL query builder |
| pdfkit | 0.18 | GST invoice PDF generation |
| multer | 2.x | File upload (memory storage, 10MB limit) |
| pino + pino-http | Latest | Structured high-performance logging |
| Resend | Latest | Transactional email (coming soon) |
| Zod (v4) | Latest | Runtime schema validation |

### Tooling

| Tool | Role |
|---|---|
| pnpm workspaces | Monorepo package management |
| Orval | Type-safe API client codegen from OpenAPI |
| esbuild | Fast CJS bundle for API server (with pdfkit external) |
| TypeScript project references | Incremental cross-package typecheck |
| drizzle-zod | Auto-derive Zod schemas from Drizzle tables |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 24+ |
| pnpm | 9+ |
| PostgreSQL | Any modern version |

### 1 · Clone & Install

```bash
git clone https://github.com/your-username/Invoice-Convertor.git
cd Invoice-Convertor
pnpm install
```

### 2 · Configure Environment

Create a `.env` file in the project root:

```env
# ── Database ────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/invoicebridge

# ── Clerk Authentication ─────────────────────────────────────────
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ── Production only (set automatically on Vercel / Replit) ───────
VITE_CLERK_PROXY_URL=
```

> **Local development without Clerk**: The frontend uses `mockAuth.tsx` as a stub — full auth is only enforced by the API server's `requireAuth` middleware. Set valid Clerk keys for auth to work end-to-end, or the backend will return 401s.

### 3 · Set Up the Database

```bash
pnpm --filter @workspace/db run push
```

### 4 · Start Development Servers

```bash
# Terminal 1 — API server  →  http://localhost:8080
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend    →  http://localhost:3000
pnpm --filter @workspace/invoicebridge run dev
```

> The Vite dev server proxies `/api` → `http://localhost:8080` via `vite.config.ts`. No CORS issues in dev.

---

## 🧰 Developer Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-server run dev` | Start API with hot-rebuild (esbuild + node) |
| `pnpm --filter @workspace/api-server run start` | Start production API build |
| `pnpm --filter @workspace/invoicebridge run dev` | Start Vite frontend dev server |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema to database (dev only) |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React hooks + Zod schemas from `openapi.yaml` |

---

## 📋 API Reference

> All endpoints require a valid **Clerk JWT** in the `Authorization` header. The `requireAuth` middleware extracts `userId` from the token and injects it into `req.userId`.

**Base URL (dev):** `http://localhost:8080`

### Invoice Endpoints

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/invoices` | ✅ | List all invoices (paginated) + dashboard stats |
| `GET` | `/api/invoices/stats` | ✅ | Aggregate stats only (no invoice list) |
| `POST` | `/api/invoices` | ✅ | Upload invoice file (PDF/PNG/JPG, max 10MB) |
| `GET` | `/api/invoices/:id` | ✅ | Get single invoice with conversion data |
| `DELETE` | `/api/invoices/:id` | ✅ | Delete invoice and associated files |
| `POST` | `/api/invoices/:id/extract` | ✅ | Save OCR-extracted data (status → EXTRACTED) |
| `POST` | `/api/invoices/:id/convert` | ✅ | Run GST conversion + generate PDF |
| `GET` | `/api/invoices/:id/download` | ✅ | Download GST PDF as Base64 JSON |
| `POST` | `/api/invoices/:id/reset` | ✅ | Reset CONVERTED → EXTRACTED for re-conversion |
| `POST` | `/api/invoices/:id/send-email` | ✅ | Send invoice by email (coming soon) |
| `GET` | `/api/health` | ❌ | Health check |

### Pagination Response Shape

```json
{
  "invoices": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalCount": 42,
    "totalPages": 5
  },
  "stats": {
    "totalInvoices": 42,
    "totalConverted": 38,
    "totalAmountProcessed": 1850000.50,
    "thisMonthConversions": 7,
    "successRate": 90
  }
}
```

### Conversion Request Payload

```json
{
  "extractedData": {
    "invoiceNumber": "INV-2024-001",
    "invoiceDate": "2024-10-01",
    "seller": { "name": "Acme Corp", "address": "123 Main St, NY" },
    "buyer":  { "name": "Buyer Ltd", "address": "456 Park Ave, NY" },
    "lineItems": [
      {
        "sno": 1,
        "description": "Software License",
        "hsnCode": "9954",
        "quantity": 1,
        "unitPrice": 1000,
        "amount": 1000
      }
    ],
    "subtotal": 1000,
    "taxAmount": 100,
    "taxRate": 10,
    "total": 1100,
    "currency": "USD",
    "sourceCountry": "US"
  },
  "conversionOptions": {
    "exchangeRate": 83.5,
    "gstRate": 18,
    "supplyType": "inter-state",
    "sellerGSTIN": "27AAAAA0000A1Z5",
    "buyerGSTIN": "29BBBBB1111B1Z3",
    "placeOfSupply": "Karnataka",
    "stateCode": "29",
    "sourceCountry": "US"
  }
}
```

> Full contract: [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml)

---

## 📄 Pages & Routes

| Page | Route | Description |
|---|---|---|
| 🏠 **Home** | `/` | Landing page — animated 4-step pipeline overview |
| 📤 **Upload** | `/upload` | Drag-and-drop file upload + browser OCR progress |
| ✏️ **Convert** | `/convert/:id` | Editable invoice form + live GST preview + exchange rate |
| ⬇️ **Download** | `/download/:id` | Success animation + PDF download button |
| 📊 **Dashboard** | `/dashboard` | Paginated history + stats cards + delete/download actions |

---

## ☁️ Deployment

### Vercel (Frontend)

The frontend deploys automatically from [`vercel.json`](vercel.json):

```json
{
  "buildCommand": "pnpm --filter @workspace/invoicebridge run build",
  "outputDirectory": "artifacts/invoicebridge/dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

> SPA routing is handled via the catch-all rewrite — all URLs resolve to `index.html` and Wouter handles client-side routing.

### API Server

The API server is a Node.js process built with esbuild into `artifacts/api-server/dist/index.mjs`.

```bash
# Build
pnpm --filter @workspace/api-server run build

# Start
pnpm --filter @workspace/api-server run start
```

### Required Production Environment Variables

```env
DATABASE_URL=                    # PostgreSQL connection string
VITE_CLERK_PUBLISHABLE_KEY=      # Clerk publishable key (frontend)
CLERK_SECRET_KEY=                # Clerk secret key (API server only)
VITE_CLERK_PROXY_URL=            # Auto-set by Replit / Vercel Clerk integration
```

---

## 🏛 Key Design Decisions

### OCR in the Browser
Tesseract.js + pdfjs-dist run entirely client-side. PDF pages are rendered to `<canvas>` by pdfjs-dist, then passed as image data to Tesseract.js for text recognition. This eliminates server-side OCR infrastructure, avoids upload latency for large files, and degrades gracefully (blank editable form) when recognition fails.

### OpenAPI-First Contract
`lib/api-spec/openapi.yaml` is the single source of truth. Running `pnpm --filter @workspace/api-spec run codegen` generates:
- Fully-typed `useQuery` / `useMutation` hooks (via Orval + React Query)
- Zod validation schemas matching each endpoint's request/response shape

### Idempotent Conversion
The convert endpoint deletes any existing `convertedInvoices` row before inserting fresh. This makes re-conversion (via the reset → convert flow) safe against unique-constraint violations and double-submit races.

### pdfkit Externalized from esbuild
pdfkit's `fontkit` dependency uses `@swc/helpers`. Bundling it with esbuild causes `MODULE_NOT_FOUND` at runtime. The build script marks pdfkit (and its transitive deps) as `external` so they are loaded from `node_modules` at runtime.

### PDF as Base64 JSON
The download endpoint returns `{ filename, data: base64String }` instead of `application/octet-stream`. Binary streaming through reverse proxies (Replit, Vercel) can corrupt PDF bytes; JSON transmission is proxy-safe and decoded client-side into a Blob for download.

### Express 5 Param Typing
Express 5 types `req.params.id` as `string | string[]`. Every route uses `String(req.params["id"])` via the `paramId()` helper to safely narrow the type without a cast.

### Clerk Proxy Middleware
The `clerkProxyMiddleware` transparently forwards Clerk's authentication API calls through the Express server. This is required for environments (Replit, custom domains) where the frontend and backend share a host and Clerk's JS SDK cannot reach `clerk.accounts.dev` directly.

---

## ⚠️ Gotchas & Tips

> [!IMPORTANT]
> Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml` — generated hooks will be stale and cause type errors otherwise.

> [!IMPORTANT]
> Always run `pnpm --filter @workspace/db run push` after modifying the Drizzle schema in `lib/db/src/schema/invoices.ts`.

> [!WARNING]
> Do **NOT** add the file upload endpoint to `openapi.yaml`. Orval cannot generate correct types for `multipart/form-data` with `File` inputs. The upload uses raw `fetch` + `FormData` on the frontend.

> [!WARNING]
> Do **NOT** bundle pdfkit into the esbuild output. It must be loaded from `node_modules` at runtime to avoid `MODULE_NOT_FOUND` from `fontkit`'s `@swc/helpers` dependency.

> [!TIP]
> The Vite dev server proxies `/api` → `http://localhost:8080` via `vite.config.ts`. You never need to hard-code the API port in frontend code.

> [!TIP]
> In Express 5, always use `String(req.params["id"])` or the `paramId()` helper. Direct `req.params.id` access is typed as `string | string[]` and will cause TS errors without narrowing.

---

## 📜 License

[MIT](LICENSE) © 2026 InvoiceBridge

<div align="center">

---

<sub>Built with ❤️ using React, Express, pdfkit, Tesseract.js, Drizzle ORM, and Clerk</sub>

</div>
