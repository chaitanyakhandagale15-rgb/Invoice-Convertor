import { Link } from "wouter";
import { Show } from "@clerk/react";
import { motion } from "framer-motion";
import { ScanSearch, ArrowRightLeft, FileDown, ArrowRight, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

export function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white space-y-8">
              <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium">
                  <Zap className="w-4 h-4 text-yellow-300" />
                  AI-Powered Invoice Conversion
                </span>
              </motion.div>

              <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible" className="text-5xl lg:text-6xl font-bold leading-tight">
                Convert Invoices to{" "}
                <span className="text-yellow-300">Indian GST</span>{" "}
                Format in Seconds
              </motion.h1>

              <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible" className="text-xl text-blue-100 max-w-lg">
                Upload US invoices (PDF or image), extract data with OCR, convert currencies and taxes to GST-compliant format, and download professional PDFs instantly.
              </motion.p>

              <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row gap-4">
                {/* CTA changes based on auth state */}
                <Show when="signed-out">
                  <Link href="/sign-up">
                    <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 gap-2">
                      Sign in with Google <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/sign-in">
                    <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">
                      Sign In
                    </Button>
                  </Link>
                </Show>

                <Show when="signed-in">
                  <Link href="/dashboard">
                    <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 gap-2">
                      Go to Dashboard <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/upload">
                    <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">
                      Upload Invoice
                    </Button>
                  </Link>
                </Show>
              </motion.div>
            </div>

            {/* Floating mockup cards */}
            <div className="hidden lg:flex items-center justify-center relative">
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="glass rounded-2xl p-6 shadow-2xl w-72 absolute -top-4 -left-4"
              >
                <div className="text-xs font-semibold text-gray-500 mb-3">US Invoice</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">$1,200.00</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Tax (10%)</span><span className="font-medium">$120.00</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold"><span>Total</span><span>$1,320.00</span></div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="glass rounded-2xl p-6 shadow-2xl w-72 absolute -bottom-4 right-0"
              >
                <div className="text-xs font-semibold text-green-600 mb-3">GST Invoice ✓</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Taxable Value</span><span className="font-medium">₹99,600</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">IGST @18%</span><span className="font-medium">₹17,928</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold text-blue-700"><span>Grand Total</span><span>₹1,17,528</span></div>
                </div>
              </motion.div>

              <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg z-10">
                <ArrowRightLeft className="w-8 h-8 text-blue-900" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">From OCR extraction to GST-compliant PDF generation, InvoiceBridge handles the entire pipeline.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: ScanSearch, color: "text-blue-600", bg: "bg-blue-50", title: "Smart OCR Extraction", desc: "AI-powered text extraction from PDFs and images using Tesseract.js and PDF.js, directly in your browser." },
              { icon: ArrowRightLeft, color: "text-green-600", bg: "bg-green-50", title: "Auto Currency Conversion", desc: "Real-time USD to INR conversion with configurable exchange rates. Handles all GST types — IGST, CGST, SGST." },
              { icon: FileDown, color: "text-purple-600", bg: "bg-purple-50", title: "GST-Compliant PDFs", desc: "Professional tax invoices with all mandatory GST fields — GSTIN, HSN/SAC codes, place of supply, and more." },
            ].map((feature, i) => (
              <motion.div key={feature.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="rounded-2xl border border-border p-8 hover:shadow-lg transition-shadow group">
                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How it works</h2>
            <p className="text-xl text-muted-foreground">Four simple steps to a GST-compliant invoice</p>
          </motion.div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", icon: Upload, title: "Upload", desc: "Upload your US invoice as PDF or image" },
              { step: "2", icon: ScanSearch, title: "Extract", desc: "Browser-side OCR extracts all invoice data" },
              { step: "3", icon: ArrowRightLeft, title: "Convert", desc: "Configure GST rates and convert currency" },
              { step: "4", icon: FileDown, title: "Download", desc: "Download your GST-compliant PDF invoice" },
            ].map((step, i) => (
              <motion.div key={step.step} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold text-blue-900">{step.step}</div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-bold text-white mb-4">Ready to convert your first invoice?</h2>
            <p className="text-blue-100 text-xl mb-8">Start converting US invoices to Indian GST format in seconds.</p>
            <Show when="signed-out">
              <Link href="/sign-up">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-10 gap-2">
                  Get Started for Free <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/upload">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-10 gap-2">
                  Upload Invoice <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </Show>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
