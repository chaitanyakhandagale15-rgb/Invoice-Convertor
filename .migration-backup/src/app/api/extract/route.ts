import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, extractedData } = body;

    if (!invoiceId || !extractedData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Update invoice record
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        extractedData: extractedData as any, // Prisma Json compatibility
        status: "EXTRACTED",
        originalAmount: extractedData.total || 0,
        originalCurrency: extractedData.currency || "USD",
      },
    });

    return NextResponse.json({
      success: true,
      invoiceId: updatedInvoice.id,
      extractedData,
    });
  } catch (error) {
    console.error("Extraction update error:", error);
    return NextResponse.json({ error: "Failed to save extracted data" }, { status: 500 });
  }
}
