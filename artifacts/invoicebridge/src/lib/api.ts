/**
 * API configuration and helper utilities.
 */

const rawApiUrl = import.meta.env.VITE_API_URL;

// In development, default to "" to use Vite's dev proxy (/api -> http://localhost:8080) unless VITE_API_URL is explicitly set.
// In production, use VITE_API_URL trimmed of trailing slashes.
export const API_BASE = (
  import.meta.env.DEV
    ? (rawApiUrl || "")
    : (rawApiUrl && rawApiUrl !== "undefined" ? rawApiUrl : "")
).replace(/\/+$/, "");

/**
 * Returns the full API URL for a given endpoint path.
 * e.g. getApiUrl('/api/invoices/123/download')
 * -> 'https://api.example.com/api/invoices/123/download' (prod)
 * -> '/api/invoices/123/download' (dev with proxy, or prod with same-origin)
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) {
    return cleanPath;
  }
  return `${API_BASE}${cleanPath}`;
}

/**
 * Downloads a converted GST Invoice PDF.
 * Handles authentication, validates Content-Type (protecting against HTML/SPA rewrite errors),
 * and triggers a client-side file download.
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  token: string | null,
  fallbackFilename = "GST-Invoice.pdf"
): Promise<void> {
  const url = getApiUrl(`/api/invoices/${invoiceId}/download`);
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      if (contentType.includes("application/json")) {
        const errJson = await response.json();
        errorMsg = errJson.error || errorMsg;
      } else {
        const text = await response.text();
        if (text && !text.includes("<!DOCTYPE") && !text.includes("<html")) {
          errorMsg = text;
        }
      }
    } catch {}
    throw new Error(errorMsg);
  }

  // Guard against HTML responses (e.g. Vercel SPA rewrites returning index.html)
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        "Received HTML instead of invoice PDF. Please ensure VITE_API_URL is configured in your deployment environment."
      );
    }
    throw new Error(`Unexpected response type from server: ${contentType || "unknown"}`);
  }

  const json = await response.json();
  if (!json.data || !json.filename) {
    throw new Error("Invalid response from server: missing PDF file data");
  }

  const filename = json.filename || fallbackFilename;
  const byteCharacters = atob(json.data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
