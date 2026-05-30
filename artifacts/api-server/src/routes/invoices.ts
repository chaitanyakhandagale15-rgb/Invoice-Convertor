import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db, invoicesTable, convertedInvoicesTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { convertInvoice, type ExtractedInvoice, type ConversionOptions } from "../lib/converter";
import { generateGSTInvoicePDF } from "../lib/pdf";
import { saveUploadedFile, saveConvertedPDF, readConvertedPDF } from "../lib/file-storage";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function paramId(req: Request): string {
  return String(req.params["id"]);
}

// All routes require authentication
router.use(requireAuth);

// GET /api/invoices
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = parseInt(req.query["limit"] as string) || 10;
    const offset = (page - 1) * limit;

    const userFilter = eq(invoicesTable.userId, userId);

    const [invoices, totalRows, allConverted, allInvoicesCount] = await Promise.all([
      db.query.invoicesTable.findMany({
        where: userFilter,
        orderBy: [desc(invoicesTable.createdAt)],
        limit,
        offset,
        with: { converted: true },
      }),
      db.select({ count: count() }).from(invoicesTable).where(userFilter),
      db.select({ inrAmount: convertedInvoicesTable.inrAmount, processedAt: convertedInvoicesTable.processedAt })
        .from(convertedInvoicesTable)
        .innerJoin(invoicesTable, and(
          eq(convertedInvoicesTable.invoiceId, invoicesTable.id),
          eq(invoicesTable.userId, userId),
        )),
      db.select({ count: count() }).from(invoicesTable).where(userFilter),
    ]);

    const totalCount = totalRows[0]?.count ?? 0;
    const totalInvoicesCount = allInvoicesCount[0]?.count ?? 0;
    const totalConvertedCount = allConverted.length;
    const totalAmountProcessed = allConverted.reduce((s, c) => s + c.inrAmount, 0);

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonthConversions = allConverted.filter((c) => c.processedAt >= thisMonthStart).length;
    const successRate = totalInvoicesCount > 0 ? Math.round((totalConvertedCount / totalInvoicesCount) * 100) : 0;

    res.json({
      invoices,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      stats: { totalInvoices: totalInvoicesCount, totalConverted: totalConvertedCount, totalAmountProcessed, thisMonthConversions, successRate },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list invoices");
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// GET /api/invoices/stats
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const userFilter = eq(invoicesTable.userId, userId);

    const [allConverted, allInvoicesCount] = await Promise.all([
      db.select({ inrAmount: convertedInvoicesTable.inrAmount, processedAt: convertedInvoicesTable.processedAt })
        .from(convertedInvoicesTable)
        .innerJoin(invoicesTable, and(
          eq(convertedInvoicesTable.invoiceId, invoicesTable.id),
          eq(invoicesTable.userId, userId),
        )),
      db.select({ count: count() }).from(invoicesTable).where(userFilter),
    ]);

    const totalInvoices = allInvoicesCount[0]?.count ?? 0;
    const totalConverted = allConverted.length;
    const totalAmountProcessed = allConverted.reduce((s, c) => s + c.inrAmount, 0);
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonthConversions = allConverted.filter((c) => c.processedAt >= thisMonthStart).length;
    const successRate = totalInvoices > 0 ? Math.round((totalConverted / totalInvoices) * 100) : 0;
    res.json({ totalInvoices, totalConverted, totalAmountProcessed, thisMonthConversions, successRate });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// POST /api/invoices — upload file
router.post("/", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type. Please upload PDF, PNG or JPG" });
      return;
    }

    const [invoice] = await db.insert(invoicesTable).values({
      userId: req.userId,
      fileName: file.originalname,
      status: "UPLOADED",
      sourceCountry: "US",
    }).returning();

    const filePath = await saveUploadedFile(file.buffer, file.originalname, invoice.id);
    await db.update(invoicesTable).set({ filePath }).where(eq(invoicesTable.id, invoice.id));

    res.status(201).json({ invoiceId: invoice.id, filePath, fileName: file.originalname });
  } catch (err: any) {
    req.log.error({ err, stack: err.stack }, "Upload error during file processing");
    res.status(500).json({ error: err.message || "Failed to upload file" });
  }
});

// GET /api/invoices/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = paramId(req);
  try {
    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId)),
      with: { converted: true },
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(invoice);
  } catch (err) {
    req.log.error({ err }, "Get invoice error");
    res.status(500).json({ error: "Failed to get invoice" });
  }
});

// DELETE /api/invoices/:id
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = paramId(req);
  try {
    await db.delete(invoicesTable).where(
      and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId))
    );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete invoice error");
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

// POST /api/invoices/:id/extract
router.post("/:id/extract", async (req: Request, res: Response): Promise<void> => {
  const id = paramId(req);
  try {
    const { extractedData, sourceCountry } = req.body as { extractedData: unknown; sourceCountry?: string };
    if (!extractedData) {
      res.status(400).json({ error: "Missing extractedData" });
      return;
    }

    const [updated] = await db.update(invoicesTable).set({
      extractedData,
      status: "EXTRACTED",
      originalAmount: (extractedData as any).total || 0,
      originalCurrency: (extractedData as any).currency || "USD",
      sourceCountry: (extractedData as any).sourceCountry || sourceCountry || "US",
      updatedAt: new Date(),
    }).where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId))).returning();

    if (!updated) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Extract error");
    res.status(500).json({ error: "Failed to save extracted data" });
  }
});

// POST /api/invoices/:id/convert
router.post("/:id/convert", async (req: Request, res: Response): Promise<void> => {
  const id = paramId(req);
  let stage = "validation";
  try {
    const { extractedData, conversionOptions } = req.body as { extractedData: unknown; conversionOptions: unknown };

    // Validate required payload fields
    if (!extractedData || typeof extractedData !== "object") {
      res.status(400).json({ error: "Missing or invalid extractedData" });
      return;
    }
    if (!conversionOptions || typeof conversionOptions !== "object") {
      res.status(400).json({ error: "Missing or invalid conversionOptions" });
      return;
    }
    const opts = conversionOptions as Record<string, unknown>;
    if (!opts["exchangeRate"] || isNaN(Number(opts["exchangeRate"])) || Number(opts["exchangeRate"]) <= 0) {
      res.status(400).json({ error: "Invalid exchangeRate — must be a positive number" });
      return;
    }
    if (!opts["gstRate"] && opts["gstRate"] !== 0) {
      res.status(400).json({ error: "Missing gstRate" });
      return;
    }

    stage = "database-lookup";
    const ownerCheck = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId)),
    });
    if (!ownerCheck) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (ownerCheck.status === "UPLOADED") {
      res.status(400).json({ error: "Invoice data not yet extracted — please complete OCR first" });
      return;
    }

    stage = "status-update";
    await db.update(invoicesTable).set({ status: "CONVERTING", updatedAt: new Date() }).where(eq(invoicesTable.id, id));

    // Idempotent: remove any existing converted record before inserting fresh
    // Handles re-convert and double-submit without unique-constraint errors
    stage = "cleanup";
    await db.delete(convertedInvoicesTable).where(eq(convertedInvoicesTable.invoiceId, id)).catch(() => {});

    stage = "converter";
    const convertedData = convertInvoice(extractedData as ExtractedInvoice, conversionOptions as ConversionOptions);

    // Guard: if line-item sanitization produced an empty invoice, warn but continue
    if (!convertedData.lineItems.length) {
      req.log.warn({ id }, "Conversion produced no line items — check extracted data");
    }

    stage = "pdf";
    const pdfBuffer = await generateGSTInvoicePDF(convertedData);

    stage = "file-save";
    const pdfPath = await saveConvertedPDF(pdfBuffer, id);

    stage = "database-insert";
    const [convertedInvoice] = await db.insert(convertedInvoicesTable).values({
      invoiceId: id,
      inrAmount: convertedData.totalAfterRoundOffINR,
      cgstAmount: convertedData.cgstAmount,
      sgstAmount: convertedData.sgstAmount,
      igstAmount: convertedData.igstAmount,
      gstRate: convertedData.gstRate,
      exchangeRate: convertedData.exchangeRate,
      convertedData: convertedData as any,
      pdfPath,
    }).returning();

    stage = "status-converted";
    await db.update(invoicesTable).set({ status: "CONVERTED", updatedAt: new Date() }).where(eq(invoicesTable.id, id));

    res.json({ convertedInvoiceId: convertedInvoice.id, pdfPath, convertedData });
  } catch (err) {
    req.log.error({ err, stage, invoiceId: id }, "Conversion error");
    await db.update(invoicesTable).set({ status: "FAILED", updatedAt: new Date() }).where(eq(invoicesTable.id, id)).catch(() => {});

    const stageMessages: Record<string, string> = {
      "database-lookup": "Invoice lookup failed — please try again",
      "status-update": "Could not update invoice status",
      "cleanup": "Failed to clear previous conversion",
      "converter": "Invoice calculation failed — check line items and exchange rate",
      "pdf": "PDF generation failed — invoice data may be incomplete",
      "file-save": "Failed to save the generated PDF",
      "database-insert": "Failed to save converted invoice to database",
      "status-converted": "Conversion complete but status update failed",
    };
    const message = stageMessages[stage] ?? "Failed to convert invoice";
    res.status(500).json({ error: message, stage });
  }
});

// GET /api/invoices/:id/download
router.get("/:id/download", async (req: Request, res: Response): Promise<void> => {
  const id = paramId(req);
  try {
    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId)),
      with: { converted: true },
    });

    const converted = (invoice as any)?.converted as { convertedData: unknown } | null | undefined;
    if (!invoice || !converted) {
      res.status(404).json({ error: "Converted invoice not found" });
      return;
    }

    const pdfBuffer = await readConvertedPDF(invoice.id);
    const invoiceNumber = (converted.convertedData as any)?.invoiceNumber ?? "GST-Invoice";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    req.log.error({ err }, "Download error");
    res.status(404).json({ error: "PDF not found" });
  }
});

// POST /api/invoices/:id/reset  — reset CONVERTED back to EXTRACTED for re-conversion
router.post("/:id/reset", async (req: Request, res: Response): Promise<void> => {
  const id = paramId(req);
  try {
    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId)),
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    await db.delete(convertedInvoicesTable).where(eq(convertedInvoicesTable.invoiceId, id));
    const [updated] = await db.update(invoicesTable)
      .set({ status: "EXTRACTED", updatedAt: new Date() })
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId)))
      .returning();

    // Best-effort delete old PDF
    const { join } = await import("path");
    const { unlink } = await import("fs/promises");
    const pdfPath = join(process.cwd(), "data", "converted", `${id}.pdf`);
    unlink(pdfPath).catch(() => {});

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Reset invoice error");
    res.status(500).json({ error: "Failed to reset invoice" });
  }
});

// POST /api/invoices/:id/send-email — coming soon
router.post("/:id/send-email", (_req: Request, res: Response): void => {
  res.status(200).json({ message: "Coming soon" });
});

export default router;
