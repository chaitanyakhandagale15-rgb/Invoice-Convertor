import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import type { SourceCountry } from "@/lib/types";
import { getSourceCountry } from "@/lib/types";

interface Step {
  id: string;
  label: string;
  sublabel: string;
}

function buildSteps(countryInfo: { flag: string; name: string; currency: string; taxSystemName: string }): Step[] {
  return [
    { id: "analyze", label: "Analyzing invoice structure", sublabel: `Parsing ${countryInfo.name} invoice fields` },
    { id: "rate", label: "Fetching live exchange rate", sublabel: `${countryInfo.currency} → INR via open.er-api.com` },
    { id: "tax", label: `Stripping ${countryInfo.taxSystemName}`, sublabel: "Normalizing to pre-tax taxable base" },
    { id: "gst", label: "Applying Indian GST", sublabel: "Calculating IGST / CGST + SGST components" },
    { id: "pdf", label: "Generating GST-compliant PDF", sublabel: "Rendering tax invoice with all mandatory fields" },
  ];
}

interface ConversionAnimationProps {
  open: boolean;
  sourceCountry: SourceCountry;
  error?: string | null;
  onDone?: () => void;
}

export function ConversionAnimation({ open, sourceCountry, error, onDone }: ConversionAnimationProps) {
  const countryInfo = getSourceCountry(sourceCountry);
  const steps = buildSteps(countryInfo);

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setShowSuccess(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setCurrentStep(i);
        if (i > 0) {
          setCompletedSteps((prev) => new Set([...prev, i - 1]));
        }
      }, i * 700));
    });

    timers.push(setTimeout(() => {
      setCompletedSteps(new Set([0, 1, 2, 3, 4]));
    }, steps.length * 700 + 200));

    return () => timers.forEach(clearTimeout);
  }, [open]);

  useEffect(() => {
    if (!error && !open && onDone) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
  }, [open, error, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(15,23,42,0.75)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="text-xl">{countryInfo.flag}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{countryInfo.name}</p>
                    <p className="text-blue-200 text-xs">{countryInfo.currency} · {countryInfo.taxSystemName}</p>
                  </div>
                </div>
                <motion.div
                  animate={{ x: [0, 8, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="text-white/60 text-lg">→</span>
                </motion.div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-white font-semibold text-sm text-right">India</p>
                    <p className="text-blue-200 text-xs text-right">INR · GST</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="text-xl">🇮🇳</span>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="flex items-center gap-2 bg-red-500/30 rounded-xl px-4 py-2.5">
                  <XCircle className="w-4 h-4 text-red-200 shrink-0" />
                  <span className="text-sm text-red-100 font-medium">Conversion failed</span>
                </div>
              ) : showSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 bg-green-500/30 rounded-xl px-4 py-2.5"
                >
                  <CheckCircle className="w-4 h-4 text-green-200" />
                  <span className="text-sm text-green-100 font-medium">GST invoice ready</span>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span className="text-sm text-white/80 font-medium">Converting invoice…</span>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="px-8 py-6 space-y-4">
              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4"
                >
                  <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                  <p className="font-semibold text-sm text-destructive mb-1">Something went wrong</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </motion.div>
              ) : (
                steps.map((step, i) => {
                  const isComplete = completedSteps.has(i);
                  const isActive = currentStep === i && !isComplete;

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: i <= currentStep ? 1 : 0.25, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.3 }}
                      className="flex items-start gap-3"
                    >
                      <div className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          {isComplete ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </motion.div>
                          ) : isActive ? (
                            <motion.div key="spin">
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="idle"
                              className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"
                            />
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium leading-snug transition-colors ${isComplete ? "text-foreground" : isActive ? "text-primary" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {(isActive || isComplete) && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="text-xs text-muted-foreground mt-0.5"
                          >
                            {step.sublabel}
                          </motion.p>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Progress bar */}
            {!error && (
              <div className="px-8 pb-6">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: showSuccess ? "100%" : `${Math.round((currentStep / steps.length) * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
