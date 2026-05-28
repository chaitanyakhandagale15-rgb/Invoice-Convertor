import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetInvoice, useConvertInvoice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileDown, Plus, Trash2, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, Globe } from "lucide-react";
import {
  INDIAN_STATES, GST_RATES, DEFAULT_CONVERSION_OPTIONS,
  SOURCE_COUNTRIES, getSourceCountry,
  formatINR, formatCurrency,
  type SourceCountry,
} from "@/lib/types";
import type { ExtractedInvoice, ConversionOptions, LineItem } from "@/lib/types";
import { toast } from "sonner";

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

  // Reload live rate when source country changes
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
    try {
      await convertMutation.mutateAsync({
        id,
        data: {
          extractedData: { ...extracted, sourceCountry } as any,
          conversionOptions: { ...options, sourceCountry } as any,
        },
      });
      toast.success("Invoice converted successfully!");
      navigate(`/download/${id}`);
    } catch (err: any) {
      toast.error(err?.message || "Conversion failed. Please try again.");
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (error || !invoice) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Invoice not found</h2>
      <p className="text-muted-foreground">This invoice may have been deleted or the link is invalid.</p>
    </div>
  );

  if (!extracted) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Convert Invoice</h1>
          <p className="text-muted-foreground">Review extracted data and configure GST settings</p>
        </div>
        <Badge variant={invoice.status === "EXTRACTED" ? "default" : "secondary"}>{invoice.status}</Badge>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Extracted data */}
        <div className="lg:col-span-3 space-y-4">
          {/* Source Country Card */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Conversion Route</p>
                    <p className="font-semibold text-sm">
                      {countryInfo.flag} {countryInfo.name} → 🇮🇳 India
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {countryInfo.taxSystemName} ({countryInfo.currency}) → Indian GST
                    </p>
                  </div>
                </div>
                <Select value={sourceCountry} onValueChange={(v) => handleSourceCountryChange(v as SourceCountry)}>
                  <SelectTrigger className="w-44 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="flex items-center gap-2">
                          <span>{c.flag}</span>
                          <span className="font-medium">{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Invoice info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Invoice Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Invoice Number</Label>
                <Input
                  value={extracted.invoiceNumber}
                  onChange={(e) => setExtracted({ ...extracted, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-001"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Invoice Date</Label>
                <Input
                  value={extracted.invoiceDate}
                  onChange={(e) => setExtracted({ ...extracted, invoiceDate: e.target.value })}
                  placeholder="e.g. 12/31/2024"
                />
              </div>
            </CardContent>
          </Card>

          {/* Seller & Buyer */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Seller Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Company Name</Label>
                  <Input value={extracted.seller.name} onChange={(e) => setExtracted({ ...extracted, seller: { ...extracted.seller, name: e.target.value } })} placeholder="Seller name" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Address</Label>
                  <Textarea value={extracted.seller.address} onChange={(e) => setExtracted({ ...extracted, seller: { ...extracted.seller, address: e.target.value } })} placeholder="Seller address" rows={3} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Buyer Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Company Name</Label>
                  <Input value={extracted.buyer.name} onChange={(e) => setExtracted({ ...extracted, buyer: { ...extracted.buyer, name: e.target.value } })} placeholder="Buyer name" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Address</Label>
                  <Textarea value={extracted.buyer.address} onChange={(e) => setExtracted({ ...extracted, buyer: { ...extracted.buyer, address: e.target.value } })} placeholder="Buyer address" rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items ({countryInfo.currencySymbol})</CardTitle>
              <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                <Plus className="w-3 h-3" /> Add Row
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="pb-2 pr-3 w-8">#</th>
                      <th className="pb-2 pr-3">Description</th>
                      <th className="pb-2 pr-3 w-20">HSN</th>
                      <th className="pb-2 pr-3 w-16">Qty</th>
                      <th className="pb-2 pr-3 w-28">Unit ({countryInfo.currencySymbol})</th>
                      <th className="pb-2 pr-3 w-28">Amount ({countryInfo.currencySymbol})</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extracted.lineItems.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">{item.sno}</td>
                        <td className="py-2 pr-3">
                          <Input value={item.description} onChange={(e) => updateLineItem(i, "description", e.target.value)} className="h-8 text-sm" />
                        </td>
                        <td className="py-2 pr-3">
                          <Input value={item.hsnCode} onChange={(e) => updateLineItem(i, "hsnCode", e.target.value)} className="h-8 text-sm w-20" />
                        </td>
                        <td className="py-2 pr-3">
                          <Input type="number" value={item.quantity} onChange={(e) => updateLineItem(i, "quantity", parseFloat(e.target.value) || 0)} className="h-8 text-sm w-16" />
                        </td>
                        <td className="py-2 pr-3">
                          <Input type="number" value={item.unitPrice} onChange={(e) => updateLineItem(i, "unitPrice", parseFloat(e.target.value) || 0)} className="h-8 text-sm w-24" />
                        </td>
                        <td className="py-2 pr-3 text-right font-medium">
                          {formatCurrency(item.amount, countryInfo.currencySymbol)}
                        </td>
                        <td className="py-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLineItem(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right pt-4 font-semibold">
                Subtotal: {formatCurrency(subtotal, countryInfo.currencySymbol)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Conversion settings + summary */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Conversion Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Live Exchange Rate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">
                    Exchange Rate (1 {countryInfo.currency} = ? INR)
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
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  {rateLoading ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Fetching live rate...
                    </span>
                  ) : liveRate ? (
                    <>
                      {liveRate.live ? (
                        <Wifi className="w-3 h-3 text-green-500" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-orange-400" />
                      )}
                      <span className={`text-xs ${liveRate.live ? "text-green-600" : "text-orange-500"}`}>
                        {liveRate.live ? "Live rate" : "Fallback rate"}: 1 {countryInfo.currency} = ₹{liveRate.rate.toFixed(2)}
                        {rateOverride && " (overridden)"}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">GST Rate (%)</Label>
                <Select
                  value={String(options.gstRate)}
                  onValueChange={(v) => setOptions({ ...options, gstRate: parseFloat(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Supply Type</Label>
                <Select
                  value={options.supplyType}
                  onValueChange={(v) => setOptions({ ...options, supplyType: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter-state">Inter-State (IGST)</SelectItem>
                    <SelectItem value="intra-state">Intra-State (CGST + SGST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Place of Supply</Label>
                <Select value={options.placeOfSupply} onValueChange={handleStateChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.name}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Seller GSTIN</Label>
                <Input
                  value={options.sellerGSTIN}
                  onChange={(e) => setOptions({ ...options, sellerGSTIN: e.target.value.toUpperCase() })}
                  placeholder="27AAAAA0000A1Z5"
                  maxLength={15}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Buyer GSTIN (optional)</Label>
                <Input
                  value={options.buyerGSTIN}
                  onChange={(e) => setOptions({ ...options, buyerGSTIN: e.target.value.toUpperCase() })}
                  placeholder="Leave blank if not registered"
                  maxLength={15}
                />
              </div>
            </CardContent>
          </Card>

          {/* Live summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Conversion Summary</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {countryInfo.flag} {countryInfo.currency} → 🇮🇳 INR · {countryInfo.taxSystemName} → Indian GST
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Amount</span>
                <span className="font-medium">{formatCurrency(subtotal, countryInfo.currencySymbol)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Converted Subtotal</span>
                <span className="font-medium">₹{formatINR(subtotalINR)}</span>
              </div>
              <Separator />
              {isInterState ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGST @{options.gstRate}%</span>
                  <span className="font-medium">₹{formatINR(igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CGST @{options.gstRate / 2}%</span>
                    <span className="font-medium">₹{formatINR(cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SGST @{options.gstRate / 2}%</span>
                    <span className="font-medium">₹{formatINR(sgstAmount)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold text-primary">
                <span>Grand Total</span>
                <span>₹{formatINR(grandTotal)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Rate: 1 {countryInfo.currency} = ₹{options.exchangeRate.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleConvert}
            disabled={convertMutation.isPending || extracted.lineItems.length === 0}
            className="w-full h-12 text-base font-semibold gap-2"
          >
            {convertMutation.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating PDF...</>
            ) : (
              <><FileDown className="w-5 h-5" /> Generate GST Invoice PDF</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
