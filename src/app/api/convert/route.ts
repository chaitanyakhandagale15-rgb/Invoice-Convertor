import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertInvoice } from "@/lib/converter";
import { generateGSTInvoicePDF } from "@/lib/pdf";
import { saveConvertedPDF } from "@/lib/file-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, extractedData, conversionOptions } = body;

    if (!invoiceId || !extractedData || !conversionOptions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Convert the invoice data
    const convertedData = convertInvoice(extractedData, conversionOptions);

    // 2. Generate PDF
    const pdfBuffer = await generateGSTInvoicePDF(convertedData);

    // 3. Save PDF file
    const pdfPath = await saveConvertedPDF(pdfBuffer, invoiceId);

    // 4. Update database transactionally
    const convertedInvoice = await prisma.$transaction(async (tx) => {
      // Create ConvertedInvoice record
      const converted = await tx.convertedInvoice.create({
        data: {
          invoiceId,
          inrAmount: convertedData.totalAfterRoundOffINR,
          cgstAmount: convertedData.cgstAmount,
          sgstAmount: convertedData.sgstAmount,
          igstAmount: convertedData.igstAmount,
          gstRate: convertedData.gstRate,
          exchangeRate: convertedData.exchangeRate,
          convertedData: convertedData as any,
          pdfPath,
        },
      });

      // Update Invoice status
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "CONVERTED" },
      });

      return converted;
    });

    return NextResponse.json({
      convertedInvoiceId: convertedInvoice.id,
      pdfPath,
      convertedData,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json({ error: "Failed to convert invoice" }, { status: 500 });
  }
}
