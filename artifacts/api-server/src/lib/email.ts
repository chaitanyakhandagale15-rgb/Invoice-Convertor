import { Resend } from "resend";
import { getCountryRule } from "./rules/index";
import type { SourceCountry } from "./rules/index";

function getResend(): Resend {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env["EMAIL_FROM"] || "onboarding@resend.dev";
}

interface SendInvoiceEmailOptions {
  recipientEmail: string;
  subject: string;
  message: string;
  invoiceId: string;
  convertedData: Record<string, unknown>;
  pdfBuffer: Buffer;
  fileName: string;
}

function buildEmailHtml(opts: SendInvoiceEmailOptions): string {
  const { invoiceId, convertedData, message } = opts;
  const sourceCountry = convertedData["sourceCountry"] as SourceCountry | undefined;
  const rule = sourceCountry ? getCountryRule(sourceCountry) : null;

  const invoiceNumber = String(convertedData["invoiceNumber"] ?? "—");
  const invoiceDate = String(convertedData["invoiceDate"] ?? "—");
  const originalTotal = Number(convertedData["originalTotal"] ?? 0).toFixed(2);
  const grandTotal = Number(convertedData["totalAfterRoundOffINR"] ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gstRate = String(convertedData["gstRate"] ?? 18);
  const exchangeRate = Number(convertedData["exchangeRate"] ?? 83).toFixed(2);
  const currency = String(convertedData["originalCurrency"] ?? "USD");
  const symbol = rule?.currencySymbol ?? "$";
  const taxSystem = rule?.taxSystemName ?? "Tax";
  const flag = rule ? getFlag(sourceCountry!) : "🇺🇸";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GST Invoice — InvoiceBridge</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#4338ca);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">📄 InvoiceBridge</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">GST-Compliant Invoice Conversion</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">Your GST Invoice is attached</h2>
            <p style="margin:0 0 24px;color:#555;line-height:1.6;">${message || "Please find the converted GST-compliant invoice attached to this email."}</p>

            <!-- Summary card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Conversion Summary</p>
                </td>
              </tr>
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#555;font-size:14px;">GST Invoice No.</td>
                    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;color:#111;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#555;font-size:14px;">Date</td>
                    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;color:#111;">${invoiceDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#555;font-size:14px;">Route</td>
                    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;color:#111;">${flag} ${currency} (${taxSystem}) → 🇮🇳 INR (GST)</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#555;font-size:14px;">Original Amount</td>
                    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;color:#111;">${symbol}${originalTotal}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#555;font-size:14px;">Exchange Rate</td>
                    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;color:#111;">1 ${currency} = ₹${exchangeRate}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#555;font-size:14px;">GST Rate</td>
                    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;color:#111;">${gstRate}%</td>
                  </tr>
                  <tr style="border-top:1px solid #e2e8f0;">
                    <td style="padding:12px 0 6px;font-size:15px;font-weight:700;color:#2563eb;">Grand Total (INR)</td>
                    <td style="padding:12px 0 6px;text-align:right;font-size:15px;font-weight:700;color:#2563eb;">₹${grandTotal}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:20px;">
              Invoice ID: <code style="font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${invoiceId}</code><br />
              Generated by <strong>InvoiceBridge</strong> — Global Invoice to Indian GST Conversion
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This invoice was generated and sent via InvoiceBridge. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getFlag(code: SourceCountry): string {
  const flags: Record<string, string> = { US: "🇺🇸", UK: "🇬🇧", EU: "🇪🇺", CA: "🇨🇦", AU: "🇦🇺" };
  return flags[code] ?? "🌍";
}

export async function sendInvoiceEmail(opts: SendInvoiceEmailOptions): Promise<void> {
  const resend = getResend();
  const html = buildEmailHtml(opts);

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: opts.recipientEmail,
    subject: opts.subject || "Converted GST Invoice — InvoiceBridge",
    html,
    attachments: [
      {
        filename: opts.fileName.endsWith(".pdf") ? opts.fileName : `${opts.fileName}.pdf`,
        content: opts.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Email send returned no ID — possible silent failure");
  }
}
