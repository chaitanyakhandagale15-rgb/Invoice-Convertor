import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/file-storage";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type. Please upload PDF, PNG or JPG" }, { status: 400 });
    }

    // Create an initial invoice record in the database
    const invoice = await prisma.invoice.create({
      data: {
        status: "UPLOADED",
        fileName: file.name,
      },
    });

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file locally
    const filePath = await saveUploadedFile(buffer, file.name, invoice.id);

    // Update record with file path
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { filePath },
    });

    return NextResponse.json({
      invoiceId: invoice.id,
      filePath,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
