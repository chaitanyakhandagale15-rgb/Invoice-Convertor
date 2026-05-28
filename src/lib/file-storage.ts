import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const CONVERTED_DIR = path.join(process.cwd(), "public", "converted");

// Ensure directories exist on first use
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save an uploaded invoice file to public/uploads/{invoiceId}/
 * Returns the relative public URL path (e.g. /uploads/abc123/invoice.pdf)
 */
export async function saveUploadedFile(
  buffer: Buffer,
  fileName: string,
  invoiceId: string
): Promise<string> {
  const invoiceDir = path.join(UPLOADS_DIR, invoiceId);
  await ensureDir(invoiceDir);

  // Sanitize filename
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(invoiceDir, sanitized);
  await fs.writeFile(filePath, buffer);

  return `/uploads/${invoiceId}/${sanitized}`;
}

/**
 * Save a generated GST PDF to public/converted/{invoiceId}.pdf
 * Returns the relative public URL path (e.g. /converted/abc123.pdf)
 */
export async function saveConvertedPDF(
  buffer: Buffer,
  invoiceId: string
): Promise<string> {
  await ensureDir(CONVERTED_DIR);

  const filePath = path.join(CONVERTED_DIR, `${invoiceId}.pdf`);
  await fs.writeFile(filePath, buffer);

  return `/converted/${invoiceId}.pdf`;
}

/**
 * Read a converted PDF as a Buffer (for streaming download)
 */
export async function readConvertedPDF(invoiceId: string): Promise<Buffer> {
  const filePath = path.join(CONVERTED_DIR, `${invoiceId}.pdf`);
  return fs.readFile(filePath);
}

/**
 * Get the absolute filesystem path from a relative public URL path
 */
export function getAbsolutePath(relativePath: string): string {
  return path.join(process.cwd(), "public", relativePath);
}

/**
 * Delete an uploaded file (for cleanup)
 */
export async function deleteUploadedFile(relativePath: string): Promise<void> {
  try {
    const absolutePath = getAbsolutePath(relativePath);
    await fs.unlink(absolutePath);
  } catch {
    // File may not exist — ignore
  }
}

/**
 * Check if a converted PDF exists
 */
export async function convertedPDFExists(invoiceId: string): Promise<boolean> {
  try {
    const filePath = path.join(CONVERTED_DIR, `${invoiceId}.pdf`);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
