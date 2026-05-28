# Graph Report - Invoice-Convertor  (2026-05-28)

## Corpus Check
- 55 files · ~36,593 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 754 nodes · 849 edges · 28 communities (22 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f938f882`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 71 edges
2. `compilerOptions` - 16 edges
3. `Phase 7: Shared Components` - 10 edges
4. `Proposed Changes` - 9 edges
5. `convertInvoice()` - 8 edges
6. `InvoiceBridge — Implementation Plan` - 7 edges
7. `Phase 1: Project Scaffolding & Configuration` - 7 edges
8. `tailwind` - 6 edges
9. `aliases` - 6 edges
10. `Phase 3: Core Libraries` - 6 edges

## Surprising Connections (you probably didn't know these)
- `cn()` --calls--> `clsx`  [INFERRED]
  src/lib/utils.ts → package.json
- `Card()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardTitle()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardDescription()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts

## Communities (28 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (109): Args, At, AtLeast, AtLoose, AtStrict, BatchPayload, Boolean, Bytes (+101 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (95): AggregateInvoice, EnumInvoiceStatusFieldUpdateOperationsInput, FloatFieldUpdateOperationsInput, GetInvoiceAggregateType, GetInvoiceGroupByPayload, Invoice$convertedArgs, Invoice$userArgs, InvoiceAggregateArgs (+87 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (59): cn(), Badge(), badgeVariants, Button(), buttonVariants, Card(), CardAction(), CardContent() (+51 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (75): AggregateConvertedInvoice, ConvertedInvoiceAggregateArgs, ConvertedInvoiceAvgAggregateInputType, ConvertedInvoiceAvgAggregateOutputType, ConvertedInvoiceAvgOrderByAggregateInput, ConvertedInvoiceCountAggregateInputType, ConvertedInvoiceCountAggregateOutputType, ConvertedInvoiceCountArgs (+67 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (75): AggregateUser, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, NullableStringFieldUpdateOperationsInput, Prisma__UserClient, StringFieldUpdateOperationsInput, User$invoicesArgs (+67 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (48): code:block10 (┌─────────────────────────────────────────────┐), code:prisma (generator client {), code:typescript (const globalForPrisma = globalThis as unknown as { prisma: P), code:bash (npx prisma migrate dev --name init), code:typescript (interface ExtractedInvoice {), Database initialization, Error Handling, Framer Motion Animations (+40 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (41): dependencies, @base-ui/react, class-variance-authority, clsx, date-fns, framer-motion, lucide-react, next (+33 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (35): DateTimeFilter, DateTimeWithAggregatesFilter, EnumInvoiceStatusFilter, EnumInvoiceStatusWithAggregatesFilter, FloatFilter, FloatWithAggregatesFilter, JsonFilter, JsonFilterBase (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (26): POST(), convertInvoice(), generateGSTInvoiceNumber(), numberToIndianWords(), round2(), roundOff(), todayFormatted(), saveConvertedPDF() (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (19): GET(), config, LogOptions, PrismaClient, PrismaClientConstructor, CONVERTED_DIR, deleteUploadedFile(), ensureDir() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (15): ConvertedInvoiceScalarFieldEnum, InvoiceScalarFieldEnum, JsonNullValueFilter, JsonNullValueInput, ModelName, NullableJsonNullValueInput, NullsOrder, NullTypes (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (13): Architecture Overview, Automated Checks, Browser Compatibility, code:mermaid (graph TB), code:block11 (src/), Core Library Unit Tests (manual execution in dev), End-to-End Manual Testing, Final File Structure (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (11): code:bash (npx create-next-app@latest ./ --typescript --tailwind --esli), code:bash (npx shadcn@latest init), code:bash (# Database), code:env (DATABASE_URL="postgresql://postgres:your_password@localhost:), [MODIFY] `next.config.mjs`, [NEW] `.env`, [NEW] `.env.example`, [NEW] NPM dependencies (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (3): geistMono, geistSans, metadata

### Community 16 - "Community 16"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **557 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+552 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `clsx` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _557 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._