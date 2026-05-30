import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { extractInvoiceData } from "@/lib/ocr";
import { SOURCE_COUNTRIES, type SourceCountry } from "@/lib/types";
import type { ExtractedInvoice } from "@/lib/types";
import { toast } from "sonner";
import { useAuth } from "@clerk/react";

const API_BASE = import.meta.env.VITE_API_URL;

const STEPS = [
  { label: "Uploading file", sublabel: "Sending to server..." },
  { label: "OCR extraction", sublabel: "Reading invoice text..." },
  { label: "Processing data", sublabel: "Structuring invoice fields..." },
  { label: "Complete", sublabel: "Ready to convert!" },
];

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
  const { getToken } = useAuth();

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
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch(`${API_BASE}/api/invoices`, { 
        method: "POST", 
        body: formData,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        let errMsg = text;
        try { errMsg = JSON.parse(text).error || text; } catch {}
        throw new Error(errMsg || "Upload failed");
      }
      const { invoiceId } = await uploadRes.json();
      
      setProgress(15);
      setStep(1);

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
        toast.warning("OCR extraction was limited — please fill in the details manually.");
      }

      extracted.sourceCountry = sourceCountry;
      extracted.currency = selectedCountry.currency;
      setProgress(88);
      setStep(2);
      setStepLabel("Saving extracted data...");

      const extractRes = await fetch(`${API_BASE}/api/invoices/${invoiceId}/extract`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ extractedData: extracted, sourceCountry }),
      });
      if (!extractRes.ok) {
        const text = await extractRes.text();
        let errMsg = text;
        try { errMsg = JSON.parse(text).error || text; } catch {}
        throw new Error(errMsg || "Failed to save extracted data");
      }

      setProgress(100);
      setStep(3);
      setStepLabel("Complete!");
      await new Promise((r) => setTimeout(r, 700));
      navigate(`/convert/${invoiceId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Invoice</h1>
        <p className="text-muted-foreground">Upload an invoice PDF or image and convert it to Indian GST format</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {!processing ? (
          <motion.div
            key="upload-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Country selector */}
            <Card className="border-primary/20 shadow-sm">
              <CardContent className="p-5">
                <Label className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Invoice Origin Country
                </Label>
                <Select value={sourceCountry} onValueChange={(v) => setSourceCountry(v as SourceCountry)}>
                  <SelectTrigger className="mt-2 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="flex items-center gap-2">
                          <span>{c.flag}</span>
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground text-xs">({c.currency} · {c.taxSystemName})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={sourceCountry}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                  >
                    <span className="text-2xl">{selectedCountry.flag}</span>
                    <div className="text-sm">
                      <p className="font-semibold">{selectedCountry.name} → 🇮🇳 India</p>
                      <p className="text-muted-foreground text-xs">{selectedCountry.taxSystemName} → Indian GST · {selectedCountry.currency} → INR</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Dropzone */}
            <motion.div
              animate={{
                scale: dragOver ? 1.015 : 1,
                boxShadow: dragOver
                  ? "0 0 0 2px #2563eb, 0 8px 24px rgba(37,99,235,0.15)"
                  : file
                  ? "0 0 0 2px #22c55e, 0 4px 12px rgba(34,197,94,0.1)"
                  : "none",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                  ? "border-green-400 bg-green-50/50"
                  : "border-border hover:border-primary/40 hover:bg-muted/20"
              )}
              onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }}
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

              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div
                    key="file-selected"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="space-y-3"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 280, damping: 18 }}
                      className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </motion.div>
                    <div>
                      <p className="font-bold text-lg">{file.name}</p>
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
                  </motion.div>
                ) : (
                  <motion.div
                    key="drop-zone"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4"
                  >
                    <motion.div
                      animate={{ y: dragOver ? -6 : 0 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"
                    >
                      <UploadIcon className="w-8 h-8 text-primary" />
                    </motion.div>
                    <div>
                      <p className="text-lg font-bold">
                        {dragOver ? "Release to upload" : "Drag & drop your invoice here"}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">or click to browse files</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {["PDF", "PNG", "JPG"].map((fmt) => (
                        <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
                      ))}
                      <span className="text-muted-foreground text-sm">· Up to 10MB</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive"
                >
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            <button
              onClick={handleUpload}
              disabled={!file}
              className="group relative w-full h-13 py-3.5 rounded-xl font-bold text-base text-white overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-blue-200 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)" }}
            >
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <span className="relative flex items-center justify-center gap-2.5">
                <UploadIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Upload & Extract
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-md shadow-black/[0.06]">
              <CardContent className="p-8">
                {/* Icon + title */}
                <div className="text-center mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Loader2 className="w-8 h-8 text-primary" />
                  </motion.div>
                  <h2 className="text-xl font-bold mb-1">Processing your invoice</h2>
                  <p className="text-muted-foreground text-sm">{stepLabel}</p>
                </div>

                {/* Progress bar */}
                <div className="mb-8">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="text-right mt-1.5 text-xs text-muted-foreground">{progress}%</div>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  {STEPS.map((s, i) => {
                    const done = i < step;
                    const active = i === step;
                    return (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                          <AnimatePresence mode="wait">
                            {done ? (
                              <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                                <CheckCircle className="w-7 h-7 text-green-500" />
                              </motion.div>
                            ) : active ? (
                              <motion.div key="active" className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              </motion.div>
                            ) : (
                              <div key="idle" className="w-7 h-7 rounded-full border-2 border-muted-foreground/25 flex items-center justify-center">
                                <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div>
                          <p className={cn("text-sm font-medium", done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground")}>
                            {s.label}
                          </p>
                          {active && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground">
                              {stepLabel || s.sublabel}
                            </motion.p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
