import { useState } from "react";
import { useListInvoices, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck, IndianRupee, Calendar, TrendingUp, Download, Trash2, Upload, FileText, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, getSourceCountry, SOURCE_COUNTRIES } from "@/lib/types";
import type { SourceCountry } from "@/lib/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { SendEmailModal } from "@/components/SendEmailModal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const statusColors: Record<string, string> = {
  UPLOADED: "bg-yellow-100 text-yellow-700",
  EXTRACTING: "bg-blue-100 text-blue-700",
  EXTRACTED: "bg-indigo-100 text-indigo-700",
  CONVERTING: "bg-orange-100 text-orange-700",
  CONVERTED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export function Dashboard() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data, isLoading } = useListInvoices({ page: 1, limit: 20 });
  const deleteMutation = useDeleteInvoice();
  const [emailInvoiceId, setEmailInvoiceId] = useState<string | null>(null);
  const [reconvertingId, setReconvertingId] = useState<string | null>(null);

  const stats = data?.stats;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      toast.success("Invoice deleted");
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const handleReconvert = async (id: string) => {
    setReconvertingId(id);
    try {
      const res = await fetch(`${BASE}/api/invoices/${id}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      await queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      toast.success("Ready to re-convert");
      navigate(`/convert/${id}`);
    } catch {
      toast.error("Failed to reset invoice");
    } finally {
      setReconvertingId(null);
    }
  };

  const statCards = [
    { icon: FileCheck, label: "Total Converted", value: stats?.totalConverted ?? 0, color: "text-green-600", bg: "bg-green-50" },
    { icon: IndianRupee, label: "Total Processed (₹)", value: stats ? `₹${formatINR(stats.totalAmountProcessed)}` : "₹0.00", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Calendar, label: "This Month", value: stats?.thisMonthConversions ?? 0, color: "text-purple-600", bg: "bg-purple-50" },
    { icon: TrendingUp, label: "Success Rate", value: stats ? `${stats.successRate}%` : "0%", color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground">Track your invoice conversion history</p>
        </div>
        <Link href="/upload">
          <Button className="gap-2">
            <Upload className="w-4 h-4" /> Upload New
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="w-10 h-10 rounded-xl mb-3" />
                  <Skeleton className="h-8 w-24 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Conversions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded" />
                </div>
              ))}
            </div>
          ) : !data?.invoices.length ? (
            <div className="text-center py-16 space-y-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto"
              >
                <FileText className="w-8 h-8 text-muted-foreground" />
              </motion.div>
              <h3 className="text-lg font-semibold">No invoices yet</h3>
              <p className="text-muted-foreground">Upload your first invoice to get started</p>
              <Link href="/upload">
                <Button className="gap-2 mt-2">
                  <Upload className="w-4 h-4" /> Upload Invoice
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-3 pr-4 font-medium">File</th>
                    <th className="pb-3 pr-4 font-medium">Origin</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Original</th>
                    <th className="pb-3 pr-4 font-medium">Converted (INR)</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {data.invoices.map((invoice, rowIdx) => {
                      const sc = (invoice as any).sourceCountry as SourceCountry | undefined;
                      const country = getSourceCountry(sc ?? "US");
                      const convertedData = (invoice as any).converted?.convertedData;
                      const convLabel = convertedData?.conversionLabel;
                      const isResetting = reconvertingId === invoice.id;

                      return (
                        <motion.tr
                          key={invoice.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: rowIdx * 0.04 }}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors group"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate max-w-[130px]" title={invoice.fileName ?? "—"}>
                                {invoice.fileName ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{country.flag}</span>
                                <span>{country.code}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {convLabel ? convLabel.split("·")[1]?.trim() : country.taxSystemName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                            {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {invoice.originalAmount > 0
                              ? `${country.currencySymbol}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.originalAmount)}`
                              : "—"}
                          </td>
                          <td className="py-3 pr-4 font-medium whitespace-nowrap">
                            {(invoice as any).converted?.inrAmount
                              ? `₹${formatINR((invoice as any).converted.inrAmount)}`
                              : "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[invoice.status] ?? "bg-muted text-muted-foreground"}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              {invoice.status === "EXTRACTED" && (
                                <Link href={`/convert/${invoice.id}`}>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                                    Convert
                                  </Button>
                                </Link>
                              )}
                              {invoice.status === "CONVERTED" && (
                                <>
                                  <a href={`/api/invoices/${invoice.id}/download`} download>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Download PDF">
                                      <Download className="w-3.5 h-3.5" />
                                    </Button>
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-blue-500 hover:text-blue-700"
                                    title="Send by email"
                                    onClick={() => setEmailInvoiceId(invoice.id)}
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-orange-500 hover:text-orange-700"
                                    title="Re-convert with new settings"
                                    onClick={() => handleReconvert(invoice.id)}
                                    disabled={isResetting}
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(invoice.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SendEmailModal
        invoiceId={emailInvoiceId ?? ""}
        open={!!emailInvoiceId}
        onClose={() => setEmailInvoiceId(null)}
      />
    </div>
  );
}
