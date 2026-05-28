import { useListInvoices, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileCheck, IndianRupee, Calendar, TrendingUp, Download, Trash2, Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/types";
import { getSourceCountry, SOURCE_COUNTRIES } from "@/lib/types";
import type { SourceCountry } from "@/lib/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  UPLOADED: "bg-yellow-100 text-yellow-700",
  EXTRACTING: "bg-blue-100 text-blue-700",
  EXTRACTED: "bg-indigo-100 text-indigo-700",
  CONVERTING: "bg-orange-100 text-orange-700",
  CONVERTED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function CountryBadge({ code }: { code?: string }) {
  const country = SOURCE_COUNTRIES.find((c) => c.code === (code ?? "US")) ?? SOURCE_COUNTRIES[0]!;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{country.flag}</span>
      <span>{country.code}</span>
    </span>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListInvoices({ page: 1, limit: 20 });
  const deleteMutation = useDeleteInvoice();

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
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mb-1" />
                ) : (
                  <p className="text-2xl font-bold">{card.value}</p>
                )}
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
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !data?.invoices.length ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
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
                  {data.invoices.map((invoice) => {
                    const sc = (invoice as any).sourceCountry as SourceCountry | undefined;
                    const country = getSourceCountry(sc ?? "US");
                    const convertedData = (invoice as any).converted?.convertedData;
                    const convLabel = convertedData?.conversionLabel;

                    return (
                      <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[140px]" title={invoice.fileName ?? "—"}>
                              {invoice.fileName ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-0.5">
                            <CountryBadge code={sc} />
                            {convLabel ? (
                              <span className="text-xs text-muted-foreground">{convLabel.split("·")[1]?.trim()}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{country.taxSystemName}</span>
                            )}
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
                              <a href={`/api/invoices/${invoice.id}/download`} download>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary">
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </a>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
