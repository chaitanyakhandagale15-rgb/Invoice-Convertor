import { useState } from "react";
import { useParams } from "wouter";
import { useGetInvoice } from "@workspace/api-client-react";
import { Link } from "wouter";
import { CheckCircle, Download, Upload, LayoutDashboard, Loader2, AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, getSourceCountry } from "@/lib/types";
import type { SourceCountry } from "@/lib/types";
import { motion } from "framer-motion";
import { SendEmailModal } from "@/components/SendEmailModal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } },
  item: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  },
};

export function DownloadPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useGetInvoice(id);
  const [emailOpen, setEmailOpen] = useState(false);

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="max-w-xl mx-auto px-6 py-16 space-y-6">
      <div className="text-center space-y-4">
        <Skeleton className="w-24 h-24 rounded-full mx-auto" />
        <Skeleton className="h-9 w-56 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </div>
    </div>
  );

  if (!invoice) return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">Invoice not found</h2>
      <p className="text-muted-foreground">This invoice may have been deleted or is unavailable.</p>
    </div>
  );

  const converted = (invoice as any).converted;
  const convertedData = converted?.convertedData;
  const sourceCountry = (convertedData?.sourceCountry ?? (invoice as any).sourceCountry ?? "US") as SourceCountry;
  const countryInfo = getSourceCountry(sourceCountry);

  return (
    <div className="max-w-xl mx-auto px-6 py-14">

      {/* ── Success hero ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-10"
      >
        {/* Animated checkmark with glow */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Outer glow pulse ring */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.8, 1.3, 1.1], opacity: [0, 0.35, 0] }}
            transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-green-400"
          />
          {/* Middle ring */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.8, 1.15, 1], opacity: [0, 0.5, 0.15] }}
            transition={{ duration: 1.0, delay: 0.3, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-green-300"
          />
          {/* Icon container */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.15 }}
            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-200"
          >
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </motion.div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-3xl font-black tracking-tight mb-2"
        >
          Invoice Converted!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-muted-foreground"
        >
          Your GST-compliant invoice is ready to download or send
        </motion.p>
      </motion.div>

      {/* ── Invoice summary card ─────────────────────────────────────────── */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={stagger.item}>
          <Card className="mb-5 shadow-md shadow-black/[0.06] border-border/60 overflow-hidden">
            {/* Route header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-3 border-b border-border/50">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="text-base">{countryInfo.flag}</span>
                <span>{countryInfo.name}</span>
                <span className="text-xs opacity-60">({countryInfo.taxSystemName})</span>
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-blue-400"
                >
                  →
                </motion.span>
                <span className="text-base">🇮🇳</span>
                <span>India</span>
                <span className="text-xs opacity-60">(GST)</span>
              </div>
            </div>

            <CardContent className="p-6 space-y-5">
              {convertedData && (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: "GST Invoice No.", value: convertedData.invoiceNumber },
                      { label: "Date", value: convertedData.invoiceDate },
                      { label: "Original Invoice", value: convertedData.originalInvoiceNumber },
                      { label: "Exchange Rate", value: `1 ${countryInfo.currency} = ₹${convertedData.exchangeRate}` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
                        <p className="font-semibold leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Original Amount</span>
                      <span className="font-medium">{countryInfo.currencySymbol}{Number(convertedData.originalTotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxable Value (INR)</span>
                      <span className="font-medium">₹{formatINR(convertedData.subtotalINR)}</span>
                    </div>
                    {convertedData.supplyType === "inter-state" ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IGST @{convertedData.gstRate}%</span>
                        <span className="font-medium">₹{formatINR(convertedData.igstAmount)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST @{convertedData.gstRate / 2}%</span>
                          <span className="font-medium">₹{formatINR(convertedData.cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SGST @{convertedData.gstRate / 2}%</span>
                          <span className="font-medium">₹{formatINR(convertedData.sgstAmount)}</span>
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-base">Grand Total</span>
                      <span className="text-2xl font-black text-primary">₹{formatINR(convertedData.totalAfterRoundOffINR)}</span>
                    </div>
                  </div>

                  {convertedData.amountInWords && (
                    <p className="text-xs text-muted-foreground italic bg-muted/40 px-3 py-2.5 rounded-xl leading-relaxed">
                      {convertedData.amountInWords}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Action buttons ──────────────────────────────────────────────── */}
        <motion.div variants={stagger.item} className="space-y-3">
          {/* Primary: Download */}
          <a href={`${BASE}/api/invoices/${id}/download`} download className="block">
            <button className="group relative w-full h-14 rounded-xl font-bold text-base text-white overflow-hidden transition-all hover:shadow-lg hover:shadow-blue-200 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)" }}>
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <span className="relative flex items-center justify-center gap-2.5">
                <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Download GST Invoice PDF
              </span>
            </button>
          </a>

          {/* Secondary: Email */}
          <Button
            variant="outline"
            className="w-full h-11 gap-2 border-primary/25 text-primary hover:bg-primary/5 hover:border-primary/40 font-medium"
            onClick={() => setEmailOpen(true)}
          >
            <Mail className="w-4 h-4" />
            Send by Email
          </Button>

          {/* Tertiary: Navigation */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/upload">
              <Button variant="outline" className="w-full gap-2 hover:bg-muted/60 font-medium">
                <Upload className="w-4 h-4" /> Convert Another
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full gap-2 hover:bg-muted/60 font-medium">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>

      <SendEmailModal invoiceId={id} open={emailOpen} onClose={() => setEmailOpen(false)} />
    </div>
  );
}
