import { pgTable, text, doublePrecision, json, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "UPLOADED",
  "EXTRACTING",
  "EXTRACTED",
  "CONVERTING",
  "CONVERTED",
  "FAILED",
]);

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().default(""),
  fileName: text("file_name"),
  filePath: text("file_path"),
  status: invoiceStatusEnum("status").notNull().default("UPLOADED"),
  originalAmount: doublePrecision("original_amount").notNull().default(0),
  originalCurrency: text("original_currency").notNull().default("USD"),
  extractedData: json("extracted_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const convertedInvoicesTable = pgTable("converted_invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  inrAmount: doublePrecision("inr_amount").notNull(),
  cgstAmount: doublePrecision("cgst_amount").notNull().default(0),
  sgstAmount: doublePrecision("sgst_amount").notNull().default(0),
  igstAmount: doublePrecision("igst_amount").notNull().default(0),
  gstRate: doublePrecision("gst_rate").notNull().default(18),
  exchangeRate: doublePrecision("exchange_rate").notNull().default(83),
  convertedData: json("converted_data").notNull(),
  pdfPath: text("pdf_path"),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

export const invoicesRelations = relations(invoicesTable, ({ one }) => ({
  converted: one(convertedInvoicesTable, {
    fields: [invoicesTable.id],
    references: [convertedInvoicesTable.invoiceId],
  }),
}));

export const convertedInvoicesRelations = relations(convertedInvoicesTable, ({ one }) => ({
  invoice: one(invoicesTable, {
    fields: [convertedInvoicesTable.invoiceId],
    references: [invoicesTable.id],
  }),
}));

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConvertedInvoiceSchema = createInsertSchema(convertedInvoicesTable).omit({
  id: true,
  processedAt: true,
});

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type ConvertedInvoice = typeof convertedInvoicesTable.$inferSelect;
export type InsertConvertedInvoice = z.infer<typeof insertConvertedInvoiceSchema>;
