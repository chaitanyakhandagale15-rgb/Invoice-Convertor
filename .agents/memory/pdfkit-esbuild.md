---
name: pdfkit esbuild bundling
description: pdfkit and fontkit must be externalized in build.mjs or PDF generation fails at runtime
---

# pdfkit must be externalized from esbuild bundle

## The rule
Add `"pdfkit"` and `"fontkit"` to the `external` array in `artifacts/api-server/build.mjs` — never bundle them.

**Why:** fontkit (pdfkit's font dependency) internally uses `@swc/helpers`. Since `@swc/*` is already in externals, esbuild skips bundling it. When fontkit is bundled but @swc/helpers is not, you get `Cannot find module '@swc/helpers/cjs/_define_property.cjs'` at runtime. Externalizing pdfkit/fontkit makes Node load them directly from node_modules, where @swc/helpers is available.

**How to apply:** Any time pdfkit is added, upgraded, or the build config is modified — verify these two entries exist in `external`.

## Secondary fix: safe CJS import
In `pdf.ts`, use:
```typescript
const pdfkitPkg = await import("pdfkit");
const PDFDocument = (pdfkitPkg.default ?? pdfkitPkg) as unknown as new (opts: object) => PDFKit.PDFDocument;
```
The `?? pdfkitPkg` fallback handles CJS interop edge cases where `.default` may be undefined.
