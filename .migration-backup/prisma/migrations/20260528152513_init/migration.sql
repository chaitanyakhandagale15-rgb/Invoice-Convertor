-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'EXTRACTED', 'CONVERTING', 'CONVERTED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sourceCountry" TEXT NOT NULL DEFAULT 'US',
    "targetCountry" TEXT NOT NULL DEFAULT 'IN',
    "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originalCurrency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UPLOADED',
    "filePath" TEXT,
    "fileName" TEXT,
    "extractedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvertedInvoice" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "inrAmount" DOUBLE PRECISION NOT NULL,
    "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 83,
    "convertedData" JSONB NOT NULL,
    "pdfPath" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConvertedInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConvertedInvoice_invoiceId_key" ON "ConvertedInvoice"("invoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertedInvoice" ADD CONSTRAINT "ConvertedInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
