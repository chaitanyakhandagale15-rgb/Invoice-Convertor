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
    }).returning();

    const filePath = await saveUploadedFile(file.buffer, file.originalname, invoice.id);
    await db.update(invoicesTable).set({ filePath }).where(eq(invoicesTable.id, invoice.id));

    res.status(201).json({ invoiceId: invoice.id, filePath, fileName: file.originalname });
  } catch (err) {
    req.log.error({ err }, "Upload error");
    res.status(500).json({ error: "Failed to upload file" });
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
    const { extractedData } = req.body as { extractedData: unknown };
    if (!extractedData) {
      res.status(400).json({ error: "Missing extractedData" });
      return;
    }

    const [updated] = await db.update(invoicesTable).set({
      extractedData,
      status: "EXTRACTED",
      originalAmount: (extractedData as any).total || 0,
      originalCurrency: (extractedData as any).currency || "USD",
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
  try {
    const { extractedData, conversionOptions } = req.body as { extractedData: unknown; conversionOptions: unknown };
    if (!extractedData || !conversionOptions) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const ownerCheck = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId)),
    });
    if (!ownerCheck) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    await db.update(invoicesTable).set({ status: "CONVERTING", updatedAt: new Date() }).where(eq(invoicesTable.id, id));

    const convertedData = convertInvoice(extractedData as ExtractedInvoice, conversionOptions as ConversionOptions);
    const pdfBuffer = await generateGSTInvoicePDF(convertedData);
    const pdfPath = await saveConvertedPDF(pdfBuffer, id);

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

    await db.update(invoicesTable).set({ status: "CONVERTED", updatedAt: new Date() }).where(eq(invoicesTable.id, id));

    res.json({ convertedInvoiceId: convertedInvoice.id, pdfPath, convertedData });
  } catch (err) {
    req.log.error({ err }, "Conversion error");
    await db.update(invoicesTable).set({ status: "FAILED", updatedAt: new Date() }).where(eq(invoicesTable.id, id)).catch(() => {});
    res.status(500).json({ error: "Failed to convert invoice" });
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

export default router;
