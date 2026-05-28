// ─── InvoiceBridge — Client-Side OCR Engine ──────────────────────────────────
// Runs entirely in the browser using:
//  - pdfjs-dist: render PDF pages to canvas / extract text from digital PDFs
//  - Tesseract.js: OCR on canvas image data
//
// NOTE: This file must only be imported in client components or browser contexts.

import type { ExtractedInvoice, LineItem } from "./types";

// ─── Text Parser ─────────────────────────────────────────────────────────────

/**
 * Parse raw OCR/extracted text into a structured ExtractedInvoice object.
 * Uses regex patterns tuned for common US invoice formats.
 */
export function parseInvoiceText(rawText: string): ExtractedInvoice {
  const text = rawText.replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── Invoice Number ─────────────────────────────────────────────────────────
  let invoiceNumber = "";
  const invoiceNumPatterns = [
    /invoice\s*(?:#|no\.?|number)?\s*:?\s*([A-Z0-9-]+)/i,
    /inv[-\s]?([A-Z0-9-]+)/i,
    /(?:^|\s)(INV-[A-Z0-9-]+)/i,
  ];
  for (const pattern of invoiceNumPatterns) {
    const match = text.match(pattern);
    if (match) { invoiceNumber = match[1].trim(); break; }
  }

  // ── Invoice Date ────────────────────────────────────────────────────────────
  let invoiceDate = "";
  const datePatterns = [
    /(?:invoice\s*)?date\s*:?\s*([A-Za-z]+ \d{1,2},?\s*\d{4})/i,
    /(?:invoice\s*)?date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /([A-Za-z]+ \d{1,2},?\s*\d{4})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) { invoiceDate = match[1].trim(); break; }
  }

  // ── Currency ────────────────────────────────────────────────────────────────
  const currency = text.match(/\b(USD|US Dollar|United States Dollar)\b/i)
    ? "USD"
    : text.includes("$") ? "USD" : "USD"; // default USD for US invoices

  // ── Seller / Buyer blocks ────────────────────────────────────────────────────
  let sellerName = "";
  let sellerAddress = "";
  let buyerName = "";
  let buyerAddress = "";

  // Try to detect "From" / "Bill To" / "To" sections
  const fromMatch = text.match(/(?:from|seller|vendor)\s*:?\s*\n+([^\n]+)\n([^\n]+(?:\n[^\n]+)?)/i);
  if (fromMatch) {
    sellerName = fromMatch[1].trim();
    sellerAddress = fromMatch[2].trim();
  }

  const toMatch = text.match(/(?:bill\s*to|ship\s*to|buyer|client)\s*:?\s*\n+([^\n]+)\n([^\n]+(?:\n[^\n]+)?)/i);
  if (toMatch) {
    buyerName = toMatch[1].trim();
    buyerAddress = toMatch[2].trim();
  }

  // Fallback: first 2 non-numeric lines as seller name
  if (!sellerName && lines.length >= 1) {
    sellerName = lines[0];
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  function extractAmount(pattern: RegExp): number {
    const match = text.match(pattern);
    if (!match) return 0;
    return parseFloat(match[1].replace(/,/g, "")) || 0;
  }

  const subtotal = extractAmount(/(?:subtotal|sub-total|sub\s*total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i) ||
                   extractAmount(/(?:amount|net\s*amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i);
  const taxAmount = extractAmount(/(?:tax|sales\s*tax|vat|hst|gst)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i);
  const total = extractAmount(/(?:total|amount\s*due|balance\s*due|grand\s*total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i) ||
                extractAmount(/total\s*:?\s*\$?\s*([\d,]+\.?\d*)/i);

  // Tax rate as percentage
  let taxRate = 0;
  if (subtotal > 0 && taxAmount > 0) {
    taxRate = Math.round((taxAmount / subtotal) * 100);
  } else {
    const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tax|sales tax|vat)/i);
    if (rateMatch) taxRate = parseFloat(rateMatch[1]);
  }

  // ── Line Items ──────────────────────────────────────────────────────────────
  const lineItems: LineItem[] = [];

  // Pattern: description ... qty ... unit price ... amount
  // Try table-style rows with numbers
  const lineItemPattern = /^(.+?)\s{2,}(\d+(?:\.\d+)?)\s{2,}\$?([\d,]+\.?\d*)\s{2,}\$?([\d,]+\.?\d*)$/gm;
  let itemMatch;
  let sno = 1;

  while ((itemMatch = lineItemPattern.exec(text)) !== null) {
    const description = itemMatch[1].trim();
    const quantity = parseFloat(itemMatch[2]) || 1;
    const unitPrice = parseFloat(itemMatch[3].replace(/,/g, "")) || 0;
    const amount = parseFloat(itemMatch[4].replace(/,/g, "")) || unitPrice * quantity;

    // Skip rows that look like totals
    if (/total|subtotal|tax|discount/i.test(description)) continue;

    lineItems.push({ sno: sno++, description, hsnCode: "9954", quantity, unitPrice, amount });
  }

  // If no tabular line items found, create a single line item from total
  if (lineItems.length === 0) {
    const effectiveAmount = subtotal || total;
    if (effectiveAmount > 0) {
      lineItems.push({
        sno: 1,
        description: "Professional Services",
        hsnCode: "9954",
        quantity: 1,
        unitPrice: effectiveAmount,
        amount: effectiveAmount,
      });
    }
  }

  return {
    invoiceNumber,
    invoiceDate,
    seller: { name: sellerName, address: sellerAddress },
    buyer: { name: buyerName, address: buyerAddress },
    lineItems,
    subtotal,
    taxAmount,
    taxRate,
    total,
    currency,
  };
}

// ─── OCR Progress Callback ────────────────────────────────────────────────────
export type OCRProgressCallback = (step: string, progress: number) => void;

// ─── Image OCR (PNG / JPG) ────────────────────────────────────────────────────

/**
 * Extract text from an image file using Tesseract.js.
 */
async function extractTextFromImage(
  file: File,
  onProgress?: OCRProgressCallback
): Promise<string> {
  const { createWorker } = await import("tesseract.js");

  onProgress?.("Loading OCR engine...", 10);

  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.("Recognizing text...", 20 + Math.round(m.progress * 60));
      }
    },
  });

  onProgress?.("Processing image...", 25);

  const imageUrl = URL.createObjectURL(file);
  try {
    const { data } = await worker.recognize(imageUrl);
    onProgress?.("Extraction complete", 90);
    return data.text;
  } finally {
    URL.revokeObjectURL(imageUrl);
    await worker.terminate();
  }
}

// ─── PDF Text Extraction ──────────────────────────────────────────────────────

/**
 * Try to extract text directly from a digital (machine-readable) PDF.
 * Returns empty string if the PDF is scanned/image-based.
 */
async function extractTextFromDigitalPDF(
  file: File,
  onProgress?: OCRProgressCallback
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set the worker source — needed for pdfjs-dist in browser
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  onProgress?.("Loading PDF...", 15);

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  onProgress?.("Extracting text...", 30);

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
    onProgress?.(
      `Extracting page ${pageNum}/${pdf.numPages}...`,
      30 + Math.round((pageNum / pdf.numPages) * 40)
    );
  }

  return fullText.trim();
}

/**
 * Render a PDF page to a canvas and extract text via Tesseract.js OCR.
 * Used as fallback for scanned/image-based PDFs.
 */
async function extractTextFromScannedPDF(
  file: File,
  onProgress?: OCRProgressCallback
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const { createWorker } = await import("tesseract.js");

  onProgress?.("Loading scanned PDF...", 15);

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // For MVP: OCR only the first page to stay fast
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d")!;

  onProgress?.("Rendering PDF page...", 30);

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  onProgress?.("Running OCR on scanned page...", 50);

  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.("OCR processing...", 50 + Math.round(m.progress * 35));
      }
    },
  });

  try {
    const { data } = await worker.recognize(canvas);
    onProgress?.("OCR complete", 90);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main extraction function — auto-detects file type and uses the best method.
 *
 * Flow for PDFs:
 *   1. Try digital text extraction (fast, instant)
 *   2. If text is sparse (<50 meaningful characters), fall back to OCR
 *
 * Flow for images (PNG/JPG):
 *   1. Tesseract.js OCR directly
 */
export async function extractInvoiceData(
  file: File,
  onProgress?: OCRProgressCallback
): Promise<ExtractedInvoice> {
  onProgress?.("Uploading file...", 5);

  let rawText = "";

  if (file.type === "application/pdf") {
    // Try digital extraction first
    onProgress?.("Checking PDF type...", 10);
    rawText = await extractTextFromDigitalPDF(file, onProgress);

    // Check if extracted text is meaningful
    const meaningfulChars = rawText.replace(/\s/g, "").length;
    if (meaningfulChars < 50) {
      // Fall back to OCR for scanned PDFs
      onProgress?.("PDF appears scanned — switching to OCR...", 20);
      rawText = await extractTextFromScannedPDF(file, onProgress);
    }
  } else if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg") {
    rawText = await extractTextFromImage(file, onProgress);
  } else {
    throw new Error(
      `Unsupported file type: ${file.type}. Please upload a PDF, PNG, or JPG.`
    );
  }

  onProgress?.("Parsing invoice data...", 92);

  if (!rawText || rawText.trim().length < 10) {
    throw new Error(
      "Could not extract readable text from the document. Please try a clearer scan or a digital PDF."
    );
  }

  const parsed = parseInvoiceText(rawText);

  onProgress?.("Done!", 100);
  return parsed;
}
