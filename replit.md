# InvoiceBridge

Convert US invoices (PDF or image) to Indian GST-compliant tax invoices using OCR, currency conversion, and server-side PDF generation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/invoicebridge run dev` — run the React frontend (port 22201)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui + framer-motion + wouter
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM
- OCR: Tesseract.js + pdfjs-dist (client-side, browser-only)
- PDF generation: pdfkit (server-side)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/invoices.ts` — DB schema (invoicesTable, convertedInvoicesTable, relations)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — auto-generated React hooks (do not edit)
- `artifacts/api-server/src/routes/invoices.ts` — all invoice endpoints
- `artifacts/api-server/src/lib/converter.ts` — USD→INR + GST conversion engine
- `artifacts/api-server/src/lib/pdf.ts` — GST invoice PDF generator (pdfkit)
- `artifacts/api-server/src/lib/file-storage.ts` — file read/write helpers
- `artifacts/invoicebridge/src/lib/ocr.ts` — client-side OCR (Tesseract.js + pdfjs-dist)
- `artifacts/invoicebridge/src/lib/types.ts` — shared frontend types + Indian state list
- `artifacts/invoicebridge/src/pages/` — Upload, Convert, Download, Dashboard, Home pages
- `data/uploads/` — uploaded invoice files (created at runtime)
- `data/converted/` — generated GST PDFs (created at runtime)

## Architecture decisions

- OCR runs entirely in the browser (Tesseract.js + pdfjs-dist) to avoid large server-side processing; fallback to blank form if OCR fails
- File uploads use multer memory storage; files are written to `data/uploads/` by the server (not `public/`)
- The upload endpoint is excluded from OpenAPI codegen (multipart/form-data type issues with Orval); frontend uses raw `fetch` + FormData
- Drizzle relations are defined in `lib/db/src/schema/invoices.ts` using `relations()` to enable `with: { converted: true }` queries
- Express 5 async route handlers need `paramId()` helper because `req.params.id` is `string | string[]` in the type system

## Product

- **Home** — landing page explaining the 4-step pipeline
- **Upload** — drag-and-drop file upload with progress tracker; client-side OCR extraction
- **Convert** — editable form with all extracted invoice fields; live GST calculation preview; configurable exchange rate, GST rate, supply type, GSTIN fields
- **Download** — success screen with converted invoice summary + PDF download button
- **Dashboard** — table of all conversions with stats (total converted, INR processed, success rate); delete + download actions

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after editing the DB schema
- Do NOT add the file upload endpoint to the OpenAPI spec — Orval can't handle multipart File types
- The Vite dev server proxies `/api` to `http://localhost:8080`
- Express 5 `req.params.id` is typed as `string | string[]`; use `String(req.params["id"])` to narrow it

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
