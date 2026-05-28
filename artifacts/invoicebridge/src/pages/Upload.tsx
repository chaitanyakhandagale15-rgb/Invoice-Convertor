import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { extractInvoiceData } from "@/lib/ocr";
import { SOURCE_COUNTRIES, type SourceCountry } from "@/lib/types";
import type { ExtractedInvoice } from "@/lib/types";
import { toast } from "sonner";

const STEPS = ["Uploading file", "Extracting text", "Processing data", "Complete"];

export function Upload() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [sourceCountry, setSourceCountry] = useState<SourceCountry>("US");
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedCountry = SOURCE_COUNTRIES.find((c) => c.code === sourceCountry)!;

  const handleFile = (f: File) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(f.type)) {
      toast.error("Only PDF, PNG, or JPG files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB.");
      return;
    }
    setFile(f);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    setProgress(0);
    setStep(0);
    setStepLabel("Uploading file...");

    try {
      // Step 1: Upload file to server
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/invoices", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const { invoiceId } = await uploadRes.json();
      setProgress(15);
      setStep(1);

      // Step 2: Client-side OCR extraction
      setStepLabel("Extracting text from document...");
      let extracted: ExtractedInvoice;
      try {
        extracted = await extractInvoiceData(file, (label, pct) => {
          setStepLabel(label);
          setProgress(15 + Math.round(pct * 0.7));
        });
      } catch {
        extracted = {
          invoiceNumber: "",
          invoiceDate: "",
          seller: { name: "", address: "" },
          buyer: { name: "", address: "" },
          lineItems: [{ sno: 1, description: "Services", hsnCode: "9954", quantity: 1, unitPrice: 0, amount: 0 }],
          subtotal: 0,
          taxAmount: 0,
          taxRate: 0,
          total: 0,
          currency: selectedCountry.currency,
        };
        toast.warning("OCR extraction was limited. Please fill in the details manually.");
      }

      // Attach source country + currency from user selection
      extracted.sourceCountry = sourceCountry;
      extracted.currency = selectedCountry.currency;

      setProgress(88);
      setStep(2);
      setStepLabel("Saving extracted data...");

      // Step 3: Save extracted data
      const extractRes = await fetch(`/api/invoices/${invoiceId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedData: extracted, sourceCountry }),
      });
      if (!extractRes.ok) throw new Error("Failed to save extracted data");

      setProgress(100);
      setStep(3);
      setStepLabel("Complete!");

      await new Promise((r) => setTimeout(r, 800));
      navigate(`/convert/${invoiceId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Invoice</h1>
        <p className="text-muted-foreground">Upload an invoice PDF or image and convert it to Indian GST format</p>
      </div>

      {!processing ? (
        <div className="space-y-6">
          {/* Source Country Selector */}
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <Label className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Invoice Origin Country
              </Label>
              <Select value={sourceCountry} onValueChange={(v) => setSourceCountry(v as SourceCountry)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                        <span className="text-muted-foreground text-xs">({c.currency} · {c.taxSystemName})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceCountry && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl">{selectedCountry.flag}</span>
                  <div className="text-sm">
                    <p className="font-medium">{selectedCountry.name} → India</p>
                    <p className="text-muted-foreground">{selectedCountry.taxSystemName} → Indian GST · {selectedCountry.currency}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dropzone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
              dragOver
                ? "border-primary bg-primary/5 scale-[1.02]"
                : file
                ? "border-green-400 bg-green-50"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !file && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {file ? (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{file.name}</p>
                  <p className="text-muted-foreground text-sm">{formatSize(file.size)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="gap-2"
                >
                  <X className="w-4 h-4" /> Remove file
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <UploadIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Drag & drop your invoice here</p>
                  <p className="text-muted-foreground mt-1">or click to browse files</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  {["PDF", "PNG", "JPG"].map((fmt) => (
                    <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
                  ))}
                  <span className="text-muted-foreground text-sm">· Up to 10MB</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file}
            className="w-full h-12 text-base font-semibold gap-2"
          >
            <UploadIcon className="w-5 h-5" />
            Upload & Extract
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Processing your invoice</h2>
              <p className="text-muted-foreground text-sm">{stepLabel}</p>
            </div>

            <Progress value={progress} className="h-2" />

            <div className="grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="text-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 text-xs font-bold",
                    i < step ? "bg-green-500 text-white" :
                    i === step ? "bg-primary text-white animate-pulse" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">{s}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
