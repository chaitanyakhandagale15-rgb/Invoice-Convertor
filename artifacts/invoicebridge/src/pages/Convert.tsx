import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetInvoice, useConvertInvoice } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileDown, Plus, Trash2, Loader2, AlertCircle, RefreshCw,
  Wifi, WifiOff, Globe, Check, Upload, Sparkles, ArrowLeft,
} from "lucide-react";
import {
  INDIAN_STATES, GST_RATES, DEFAULT_CONVERSION_OPTIONS,
  SOURCE_COUNTRIES, getSourceCountry,
  formatINR, formatCurrency,
  type SourceCountry,
} from "@/lib/types";
import type { ExtractedInvoice, ConversionOptions, LineItem } from "@/lib/types";
import { toast } from "sonner";
import { ConversionAnimation } from "@/components/ConversionAnimation";
import { AnimatedNumber } from "@/components/AnimatedNumber";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LiveRate {
  rate: number;
  live: boolean;
  timestamp: string;
}

async function fetchExchangeRate(currency: string): Promise<LiveRate | null> {
  try {
    const res = await fetch(`${BASE}/api/exchange-rates/${currency}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Extract", icon: Sparkles },
  { label: "Convert", icon: RefreshCw },
  { label: "Generate PDF", icon: FileDown },
];

function ProgressStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto">
      {STEPS.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: done ? "#2563eb" : active ? "#2563eb" : "#e2e8f0",
                  scale: active ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
              >
                {done ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <step.icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-muted-foreground"}`} />
                )}
              </motion.div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 mb-4 rounded-full overflow-hidden bg-border">
                <motion.div
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="h-full bg-primary"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
};

export function Convert() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: invoice, isLoading, error } = useGetInvoice(id);
  const convertMutation = useConvertInvoice();

  const [extracted, setExtracted] = useState<ExtractedInvoice | null>(null);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_CONVERSION_OPTIONS);
  const [liveRate, setLiveRate] = useState<LiveRate | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateOverride, setRateOverride] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const sourceCountry: SourceCountry = extracted?.sourceCountry ?? options.sourceCountry ?? "US";
  const countryInfo = getSourceCountry(sourceCountry);

  const loadLiveRate = useCallback(async (currency: string) => {
    setRateLoading(true);
    const rate = await fetchExchangeRate(currency);
    setRateLoading(false);
    if (rate) {
      setLiveRate(rate);
      if (!rateOverride) {
        setOptions((prev) => ({ ...prev, exchangeRate: rate.rate }));
      }
    }
  }, [rateOverride]);

  useEffect(() => {
    if (invoice?.extractedData) {
      const data = invoice.extractedData as unknown as ExtractedInvoice;
      setExtracted(data);
      const country = data.sourceCountry ?? "US";
      const info = getSourceCountry(country);
      setOptions((prev) => ({ ...prev, sourceCountry: country }));
      loadLiveRate(info.currency);
    }
  }, [invoice, loadLiveRate]);

  useEffect(() => {
    loadLiveRate(countryInfo.currency);
  }, [sourceCountry, loadLiveRate, countryInfo.currency]);

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    if (!extracted) return;
    const items = [...extracted.lineItems];
    items[index] = { ...items[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      items[index]!.amount = items[index]!.quantity * items[index]!.unitPrice;
    }
    setExtracted({ ...extracted, lineItems: items });
  };

  const addLineItem = () => {
    if (!extracted) return;
    const sno = extracted.lineItems.length + 1;
    setExtracted({
      ...extracted,
      lineItems: [...extracted.lineItems, { sno, description: "", hsnCode: "9954", quantity: 1, unitPrice: 0, amount: 0 }],
    });
  };

  const removeLineItem = (index: number) => {
    if (!extracted) return;
    const items = extracted.lineItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, sno: i + 1 }));
    setExtracted({ ...extracted, lineItems: items });
  };

  const handleSourceCountryChange = (country: SourceCountry) => {
    const info = getSourceCountry(country);
    setExtracted((prev) => prev ? { ...prev, sourceCountry: country, currency: info.currency } : prev);
    setOptions((prev) => ({ ...prev, sourceCountry: country }));
    setRateOverride(false);
    loadLiveRate(info.currency);
  };

  const handleStateChange = (stateName: string) => {
    const state = INDIAN_STATES.find((s) => s.name === stateName);
    setOptions({ ...options, placeOfSupply: stateName, stateCode: state?.code ?? "" });
  };

  const subtotal = extracted?.lineItems.reduce((s, i) => s + i.amount, 0) ?? 0;
  const subtotalINR = subtotal * options.exchangeRate;
  const isInterState = options.supplyType === "inter-state";
  const igstAmount = isInterState ? subtotalINR * (options.gstRate / 100) : 0;
  const cgstAmount = !isInterState ? subtotalINR * (options.gstRate / 2 / 100) : 0;
  const sgstAmount = !isInterState ? subtotalINR * (options.gstRate / 2 / 100) : 0;
  const grandTotal = subtotalINR + igstAmount + cgstAmount + sgstAmount;

  const handleConvert = async () => {
    if (!extracted) return;
    setConvertError(null);
    try {
      await convertMutation.mutateAsync({
        id,
        data: {
          extractedData: { ...extracted, sourceCountry } as any,
          conversionOptions: { ...options, sourceCountry } as any,
        },
      });
      setTimeout(() => navigate(`/download/${id}`), 500);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || "Conversion failed. Please review invoice details.";
      setConvertError(message);
      toast.error(message);
    }
  };

  // ─── Skeleton loading ──────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex justify-center mb-10">
        <Skeleton className="h-12 w-lg rounded-2xl" />
      </div>
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid md:grid-cols-2 gap-5">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
        <div className="lg:col-span-2 space-y-5">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );

  // ─── Error state ───────────────────────────────────────────────────────────
  if (error || !invoice) return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">Invoice not found</h2>
      <p className="text-muted-foreground mb-6">This invoice may have been deleted or the link is invalid.</p>
      <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>
    </div>
  );

  if (!extracted) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // ─── Tax breakdown percentages for visual bars ─────────────────────────────
  const taxTotal = igstAmount + cgstAmount + sgstAmount;
  const taxPct = grandTotal > 0 ? (taxTotal / grandTotal) * 100 : 0;
  const basePct = 100 - taxPct;

  return (
    <>
      <ConversionAnimation
        open={convertMutation.isPending}
        sourceCountry={sourceCountry}
        error={convertError}
      />

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Progress stepper */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <ProgressStepper currentStep={2} />
        </motion.div>

        {/* Page header */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Convert Invoice</h1>
              <p className="text-muted-foreground">Review extracted data and configure GST settings</p>
            </div>
            <Badge variant="outline" className="text-xs px-3 py-1 font-medium">
              {invoice.status}
            </Badge>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ─── Left column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Conversion route card */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{countryInfo.flag}</span>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{countryInfo.name}</p>
                          <p className="text-xs text-muted-foreground">{countryInfo.taxSystemName} · {countryInfo.currency}</p>
                        </div>
                      </div>
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="text-muted-foreground/50 text-sm font-light"
                      >
                        →
                      </motion.div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🇮🇳</span>
                        <div>
                          <p className="font-semibold text-sm leading-tight">India</p>
                          <p className="text-xs text-muted-foreground">GST · INR</p>
                        </div>
                      </div>
                    </div>
                    <Select value={sourceCountry} onValueChange={(v) => handleSourceCountryChange(v as SourceCountry)}>
                      <SelectTrigger className="w-48 bg-white shadow-sm">
                        <Globe className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span className="font-medium">{c.name}</span>
                              <span className="text-muted-foreground text-xs">({c.currency})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Invoice info */}
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold">Invoice Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Invoice Number</Label>
                    <Input
                      value={extracted.invoiceNumber}
                      onChange={(e) => setExtracted({ ...extracted, invoiceNumber: e.target.value })}
                      placeholder="e.g. INV-001"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Invoice Date</Label>
                    <Input
                      value={extracted.invoiceDate}
                      onChange={(e) => setExtracted({ ...extracted, invoiceDate: e.target.value })}
                      placeholder="e.g. 12/31/2024"
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Seller & Buyer */}
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="grid md:grid-cols-2 gap-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold">Seller Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Company Name</Label>
                    <Input
                      value={extracted.seller.name}
                      onChange={(e) => setExtracted({ ...extracted, seller: { ...extracted.seller, name: e.target.value } })}
                      placeholder="Seller name"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Address</Label>
                    <Textarea
                      value={extracted.seller.address}
                      onChange={(e) => setExtracted({ ...extracted, seller: { ...extracted.seller, address: e.target.value } })}
                      placeholder="Seller address"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold">Buyer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Company Name</Label>
                    <Input
                      value={extracted.buyer.name}
                      onChange={(e) => setExtracted({ ...extracted, buyer: { ...extracted.buyer, name: e.target.value } })}
                      placeholder="Buyer name"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Address</Label>
                    <Textarea
                      value={extracted.buyer.address}
                      onChange={(e) => setExtracted({ ...extracted, buyer: { ...extracted.buyer, address: e.target.value } })}
                      placeholder="Buyer address"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Line items */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Line Items
                    <span className="ml-2 text-xs font-normal text-muted-foreground">({countryInfo.currencySymbol})</span>
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1.5 h-8 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="pb-3 pr-3 w-8 font-medium">#</th>
                          <th className="pb-3 pr-3 font-medium">Description</th>
                          <th className="pb-3 pr-3 w-20 font-medium">HSN</th>
                          <th className="pb-3 pr-3 w-16 font-medium">Qty</th>
                          <th className="pb-3 pr-3 w-28 font-medium">Unit ({countryInfo.currencySymbol})</th>
                          <th className="pb-3 pr-3 w-28 font-medium text-right">Amount</th>
                          <th className="pb-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {extracted.lineItems.map((item, i) => (
                            <motion.tr
                              key={i}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="border-b last:border-0 group"
                            >
                              <td className="py-2.5 pr-3 text-muted-foreground text-xs">{item.sno}</td>
                              <td className="py-2.5 pr-3">
                                <Input value={item.description} onChange={(e) => updateLineItem(i, "description", e.target.value)} className="h-8 text-sm min-w-[120px]" />
                              </td>
                              <td className="py-2.5 pr-3">
                                <Input value={item.hsnCode} onChange={(e) => updateLineItem(i, "hsnCode", e.target.value)} className="h-8 text-sm w-20" />
                              </td>
                              <td className="py-2.5 pr-3">
                                <Input type="number" value={item.quantity} onChange={(e) => updateLineItem(i, "quantity", parseFloat(e.target.value) || 0)} className="h-8 text-sm w-16" />
                              </td>
                              <td className="py-2.5 pr-3">
                                <Input type="number" value={item.unitPrice} onChange={(e) => updateLineItem(i, "unitPrice", parseFloat(e.target.value) || 0)} className="h-8 text-sm w-24" />
                              </td>
                              <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                                {formatCurrency(item.amount, countryInfo.currencySymbol)}
                              </td>
                              <td className="py-2.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                  onClick={() => removeLineItem(i)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end pt-4 border-t mt-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Subtotal: </span>
                      <span className="font-bold">{formatCurrency(subtotal, countryInfo.currencySymbol)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Error state with retry */}
            <AnimatePresence>
              {convertError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertCircle className="w-5 h-5 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-destructive text-sm mb-1">Conversion Failed</h3>
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{convertError}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => { setConvertError(null); handleConvert(); }}
                              disabled={convertMutation.isPending}
                              className="gap-1.5 h-8 text-xs"
                            >
                              <RefreshCw className="w-3 h-3" /> Retry Conversion
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate("/upload")}
                              className="gap-1.5 h-8 text-xs"
                            >
                              <Upload className="w-3 h-3" /> Upload New
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Right column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Conversion settings */}
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold">Conversion Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Exchange Rate */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground font-medium">
                        Exchange Rate <span className="text-foreground/60">(1 {countryInfo.currency} = ? INR)</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => { setRateOverride(false); loadLiveRate(countryInfo.currency); }}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        disabled={rateLoading}
                      >
                        <RefreshCw className={`w-3 h-3 ${rateLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </button>
                    </div>
                    <Input
                      type="number"
                      value={options.exchangeRate}
                      onChange={(e) => {
                        setRateOverride(true);
                        setOptions({ ...options, exchangeRate: parseFloat(e.target.value) || countryInfo.fallbackRate });
                      }}
                      className="h-10"
                    />
                    <div className="flex items-center gap-1.5 min-h-[18px]">
                      {rateLoading ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Fetching live rate…
                        </span>
                      ) : liveRate ? (
                        <>
                          {liveRate.live
                            ? <Wifi className="w-3 h-3 text-green-500 shrink-0" />
                            : <WifiOff className="w-3 h-3 text-orange-400 shrink-0" />}
                          <span className={`text-xs ${liveRate.live ? "text-green-600" : "text-orange-500"}`}>
                            {liveRate.live ? "Live" : "Fallback"}: 1 {countryInfo.currency} = ₹{liveRate.rate.toFixed(2)}
                            {rateOverride && <span className="text-muted-foreground"> (manual override)</span>}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">GST Rate (%)</Label>
                    <Select value={String(options.gstRate)} onValueChange={(v) => setOptions({ ...options, gstRate: parseFloat(v) })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => (<SelectItem key={r} value={String(r)}>{r}%</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Supply Type</Label>
                    <Select value={options.supplyType} onValueChange={(v) => setOptions({ ...options, supplyType: v as any })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inter-state">Inter-State (IGST)</SelectItem>
                        <SelectItem value="intra-state">Intra-State (CGST + SGST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Place of Supply</Label>
                    <Select value={options.placeOfSupply} onValueChange={handleStateChange}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (<SelectItem key={s.code} value={s.name}>{s.name} ({s.code})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Seller GSTIN</Label>
                    <Input
                      value={options.sellerGSTIN}
                      onChange={(e) => setOptions({ ...options, sellerGSTIN: e.target.value.toUpperCase() })}
                      placeholder="27AAAAA0000A1Z5"
                      maxLength={15}
                      className="h-10 font-mono text-sm tracking-wide"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Buyer GSTIN <span className="text-muted-foreground/60">(optional)</span></Label>
                    <Input
                      value={options.buyerGSTIN}
                      onChange={(e) => setOptions({ ...options, buyerGSTIN: e.target.value.toUpperCase() })}
                      placeholder="Leave blank if unregistered"
                      maxLength={15}
                      className="h-10 font-mono text-sm tracking-wide"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Live summary — premium focal card */}
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
              <div className="rounded-2xl p-[1.5px] bg-gradient-to-br from-blue-400 via-indigo-500 to-blue-600 shadow-lg shadow-blue-100">
                <div className="rounded-[14px] bg-white p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-base">Conversion Summary</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {countryInfo.flag} {countryInfo.currency} → 🇮🇳 INR
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      GST {options.gstRate}%
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Original Subtotal</span>
                      <span className="font-medium tabular-nums">{formatCurrency(subtotal, countryInfo.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Converted (INR)</span>
                      <AnimatedNumber value={subtotalINR} format={(n) => `₹${formatINR(n)}`} className="font-semibold tabular-nums" />
                    </div>
                    <Separator />
                    {isInterState ? (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">IGST @{options.gstRate}%</span>
                        <AnimatedNumber value={igstAmount} format={(n) => `₹${formatINR(n)}`} className="font-medium tabular-nums" />
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">CGST @{options.gstRate / 2}%</span>
                          <AnimatedNumber value={cgstAmount} format={(n) => `₹${formatINR(n)}`} className="font-medium tabular-nums" />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">SGST @{options.gstRate / 2}%</span>
                          <AnimatedNumber value={sgstAmount} format={(n) => `₹${formatINR(n)}`} className="font-medium tabular-nums" />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Tax breakdown bar */}
                  {grandTotal > 0 && (
                    <div className="mt-4 mb-4">
                      <div className="flex rounded-full overflow-hidden h-1.5">
                        <motion.div
                          className="bg-blue-500 h-full"
                          animate={{ width: `${basePct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                        <motion.div
                          className="bg-indigo-400 h-full"
                          animate={{ width: `${taxPct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Base
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Tax
                        </span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Grand total — premium emphasis */}
                  <div className="mt-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Grand Total (INR)</p>
                        <AnimatedNumber
                          value={grandTotal}
                          format={(n) => `₹${formatINR(n)}`}
                          className="text-2xl font-black text-primary tracking-tight"
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Rate</p>
                        <p className="text-xs font-medium">1 {countryInfo.currency} = ₹{options.exchangeRate.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CTA button */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <button
                onClick={handleConvert}
                disabled={convertMutation.isPending || extracted.lineItems.length === 0}
                className="group relative w-full h-14 rounded-xl font-bold text-base text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-blue-200 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                }}
              >
                {/* Shine sweep on hover */}
                <span
                  className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                  }}
                />
                <span className="relative flex items-center justify-center gap-2.5">
                  {convertMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileDown className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  )}
                  Generate GST Invoice PDF
                </span>
              </button>

              {extracted.lineItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Add at least one line item to continue</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
