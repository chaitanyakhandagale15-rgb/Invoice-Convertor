import type { ExtractedInvoice, LineItem } from "./types";

export function parseInvoiceText(rawText: string): ExtractedInvoice {
  const text = rawText.replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

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

  const currency = "USD";

  let sellerName = "";
  let sellerAddress = "";
  let buyerName = "";
  let buyerAddress = "";

  const fromMatch = text.match(/(?:from|seller|vendor)\s*:?\s*\n+([^\n]+)\n([^\n]+(?:\n[^\n]+)?)/i);
  if (fromMatch) { sellerName = fromMatch[1].trim(); sellerAddress = fromMatch[2].trim(); }

  const toMatch = text.match(/(?:bill\s*to|ship\s*to|buyer|client)\s*:?\s*\n+([^\n]+)\n([^\n]+(?:\n[^\n]+)?)/i);
  if (toMatch) { buyerName = toMatch[1].trim(); buyerAddress = toMatch[2].trim(); }

  if (!sellerName && lines.length >= 1) sellerName = lines[0];

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

  let taxRate = 0;
  if (subtotal > 0 && taxAmount > 0) {
    taxRate = Math.round((taxAmount / subtotal) * 100);
  } else {
    const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tax|sales tax|vat)/i);
    if (rateMatch) taxRate = parseFloat(rateMatch[1]);
  }

  const lineItems: LineItem[] = [];
  const lineItemPattern = /^(.+?)\s{2,}(\d+(?:\.\d+)?)\s{2,}\$?([\d,]+\.?\d*)\s{2,}\$?([\d,]+\.?\d*)$/gm;
  let itemMatch;
  let sno = 1;

  while ((itemMatch = lineItemPattern.exec(text)) !== null) {
    const description = itemMatch[1].trim();
    const quantity = parseFloat(itemMatch[2]) || 1;
    const unitPrice = parseFloat(itemMatch[3].replace(/,/g, "")) || 0;
    const amount = parseFloat(itemMatch[4].replace(/,/g, "")) || unitPrice * quantity;
    if (/total|subtotal|tax|discount/i.test(description)) continue;
    lineItems.push({ sno: sno++, description, hsnCode: "9954", quantity, unitPrice, amount });
  }

  if (lineItems.length === 0) {
    const effectiveAmount = subtotal || total;
    if (effectiveAmount > 0) {
      lineItems.push({ sno: 1, description: "Professional Services", hsnCode: "9954", quantity: 1, unitPrice: effectiveAmount, amount: effectiveAmount });
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

export type OCRProgressCallback = (step: string, progress: number) => void;

async function extractTextFromImage(file: File, onProgress?: OCRProgressCallback): Promise<string> {
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

async function extractTextFromDigitalPDF(file: File, onProgress?: OCRProgressCallback): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  onProgress?.("Loading PDF...", 15);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  onProgress?.("Extracting text...", 30);
  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    fullText += pageText + "\n";
    onProgress?.(`Extracting page ${pageNum}/${pdf.numPages}...`, 30 + Math.round((pageNum / pdf.numPages) * 40));
  }
  return fullText.trim();
}

async function extractTextFromScannedPDF(file: File, onProgress?: OCRProgressCallback): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading scanned PDF...", 15);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d")!;
  onProgress?.("Rendering PDF page...", 30);
  await page.render({ canvasContext: context, viewport, canvas } as any).promise;
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

export async function extractInvoiceData(file: File, onProgress?: OCRProgressCallback): Promise<ExtractedInvoice> {
  onProgress?.("Starting...", 5);
  let rawText = "";

  if (file.type === "application/pdf") {
    onProgress?.("Checking PDF type...", 10);
    rawText = await extractTextFromDigitalPDF(file, onProgress);
    const meaningfulChars = rawText.replace(/\s/g, "").length;
    if (meaningfulChars < 50) {
      onProgress?.("PDF appears scanned — switching to OCR...", 20);
      rawText = await extractTextFromScannedPDF(file, onProgress);
    }
  } else if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg") {
    rawText = await extractTextFromImage(file, onProgress);
  } else {
    throw new Error(`Unsupported file type: ${file.type}. Please upload a PDF, PNG, or JPG.`);
  }

  onProgress?.("Parsing invoice data...", 92);

  if (!rawText || rawText.trim().length < 10) {
    throw new Error("Could not extract readable text from the document. Please try a clearer scan or a digital PDF.");
  }

  const parsed = parseInvoiceText(rawText);
  onProgress?.("Done!", 100);
  return parsed;
}
