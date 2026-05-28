import { useParams } from "wouter";
import { useGetInvoice } from "@workspace/api-client-react";
import { Link } from "wouter";
import { CheckCircle, Download, Upload, LayoutDashboard, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatINR, formatUSD } from "@/lib/types";
import { motion } from "framer-motion";

export function DownloadPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useGetInvoice(id);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!invoice) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Invoice not found</h2>
    </div>
  );

  const converted = (invoice as any).converted;
  const convertedData = converted?.convertedData;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle className="w-10 h-10 text-green-600" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Invoice Converted!</h1>
        <p className="text-muted-foreground">Your GST-compliant invoice is ready to download</p>
      </motion.div>

      <Card className="mb-6">
        <CardContent className="p-6 space-y-4">
          {convertedData && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">GST Invoice No.</p>
                  <p className="font-semibold">{convertedData.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Date</p>
                  <p className="font-semibold">{convertedData.invoiceDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Original Invoice</p>
                  <p className="font-semibold">{convertedData.originalInvoiceNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Exchange Rate</p>
                  <p className="font-semibold">1 USD = ₹{convertedData.exchangeRate}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Amount</span>
                  <span>{formatUSD(convertedData.originalTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Value (INR)</span>
                  <span>₹{formatINR(convertedData.subtotalINR)}</span>
                </div>
                {convertedData.supplyType === "inter-state" ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST @{convertedData.gstRate}%</span>
                    <span>₹{formatINR(convertedData.igstAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST @{convertedData.gstRate / 2}%</span>
                      <span>₹{formatINR(convertedData.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST @{convertedData.gstRate / 2}%</span>
                      <span>₹{formatINR(convertedData.sgstAmount)}</span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>Grand Total</span>
                  <span>₹{formatINR(convertedData.totalAfterRoundOffINR)}</span>
                </div>
              </div>

              {convertedData.amountInWords && (
                <p className="text-xs text-muted-foreground italic bg-muted/50 px-3 py-2 rounded-lg">
                  {convertedData.amountInWords}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <a href={`/api/invoices/${id}/download`} download className="block">
          <Button className="w-full h-12 text-base font-semibold gap-2">
            <Download className="w-5 h-5" />
            Download GST Invoice PDF
          </Button>
        </a>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/upload">
            <Button variant="outline" className="w-full gap-2">
              <Upload className="w-4 h-4" /> Convert Another
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full gap-2">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
