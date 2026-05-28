import path from "path";
import fs from "fs/promises";

// Store files in a persistent directory inside the workspace
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const CONVERTED_DIR = path.join(process.cwd(), "data", "converted");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveUploadedFile(buffer: Buffer, fileName: string, invoiceId: string): Promise<string> {
  const invoiceDir = path.join(UPLOADS_DIR, invoiceId);
  await ensureDir(invoiceDir);
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(invoiceDir, sanitized);
  await fs.writeFile(filePath, buffer);
  return `/api/uploads/${invoiceId}/${sanitized}`;
}

export async function saveConvertedPDF(buffer: Buffer, invoiceId: string): Promise<string> {
  await ensureDir(CONVERTED_DIR);
  const filePath = path.join(CONVERTED_DIR, `${invoiceId}.pdf`);
  await fs.writeFile(filePath, buffer);
  return `/api/invoices/${invoiceId}/download`;
}

export async function readConvertedPDF(invoiceId: string): Promise<Buffer> {
  const filePath = path.join(CONVERTED_DIR, `${invoiceId}.pdf`);
  return fs.readFile(filePath);
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
