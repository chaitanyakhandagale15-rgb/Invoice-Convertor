import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConvertedPDF } from "@/lib/file-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: convertedInvoiceId } = await params;

    const convertedInvoice = await prisma.convertedInvoice.findUnique({
      where: { id: convertedInvoiceId },
      include: { invoice: true },
    });

    if (!convertedInvoice || !convertedInvoice.pdfPath) {
      return NextResponse.json({ error: "Converted invoice PDF not found" }, { status: 404 });
    }

    const pdfBuffer = await readConvertedPDF(convertedInvoice.invoiceId);
    const invoiceNumber = (convertedInvoice.convertedData as any).invoiceNumber || "Invoice";

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to download PDF" }, { status: 500 });
  }
}
