import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status") as InvoiceStatus | null;

    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { converted: true },
      }),
      prisma.invoice.count({ where }),
    ]);

    // Aggregate stats
    const allConverted = await prisma.convertedInvoice.findMany({
      select: { inrAmount: true, processedAt: true, invoice: { select: { status: true } } },
    });

    const totalConvertedCount = allConverted.length;
    const totalAmountProcessed = allConverted.reduce((sum, ci) => sum + ci.inrAmount, 0);

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthConversions = allConverted.filter(
      (ci) => ci.processedAt >= thisMonthStart
    ).length;
    
    const allInvoicesCount = await prisma.invoice.count();
    const successRate = allInvoicesCount > 0 ? Math.round((totalConvertedCount / allInvoicesCount) * 100) : 0;

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalInvoices: allInvoicesCount,
        totalConverted: totalConvertedCount,
        totalAmountProcessed,
        thisMonthConversions,
        successRate,
      },
    });
  } catch (error) {
    console.error("Fetch invoices error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
