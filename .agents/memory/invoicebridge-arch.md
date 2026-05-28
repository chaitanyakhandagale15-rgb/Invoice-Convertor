---
name: InvoiceBridge Architecture
description: Key non-obvious decisions for the InvoiceBridge project (OCR, upload, Express 5 types, Drizzle relations)
---

## OCR runs in the browser only
Tesseract.js and pdfjs-dist are frontend dependencies — all OCR happens client-side. The server only stores files and generates PDFs.

**Why:** Avoids heavy server-side processing; keeps the API server lightweight.

**How to apply:** Never import tesseract.js or pdfjs-dist in api-server. They live in `@workspace/invoicebridge`.

## Upload endpoint excluded from OpenAPI codegen
The `POST /api/invoices` multipart endpoint is NOT in the OpenAPI spec. Orval cannot handle `multipart/form-data` with File/Blob types cleanly. The frontend uses raw `fetch` + `FormData`.

**Why:** Orval codegen emits broken types for multipart endpoints with binary fields.

**How to apply:** If you need to add another file upload endpoint, keep it out of openapi.yaml and use raw fetch on the frontend.

## Express 5 req.params typing
In Express 5 with strict TypeScript, `req.params.id` is typed as `string | string[]`. Use a helper `String(req.params["id"])` or `paramId(req)` to narrow to `string`.

**Why:** Drizzle's `eq()` and string functions don't accept `string[]`. TypeScript fails without narrowing.

**How to apply:** Always use `paramId(req)` (defined in routes/invoices.ts) for route params.

## Drizzle relations required for `with:` queries
Relations must be defined using `relations()` in the schema file and exported from `lib/db/src/index.ts` (via schema barrel) for `db.query.*findMany({ with: { converted: true } })` to work.

**Why:** Drizzle ORM requires explicit relation definitions; they aren't inferred from foreign keys.

**How to apply:** Any new table with FK relationships needs both the FK column AND a `relations()` definition.

## Vite dev proxy
The Vite dev server for `@workspace/invoicebridge` proxies `/api` → `http://localhost:8080`. This is configured in `artifacts/invoicebridge/vite.config.ts`.

**Why:** Frontend needs to call `/api/invoices` without CORS issues in dev.
