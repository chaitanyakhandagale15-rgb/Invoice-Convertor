// InvoiceBridge — Invoice Conversion Engine (ported from Next.js)
// Converts extracted US invoice data into Indian GST-compliant format.

export interface LineItem {
  sno: number;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PartyDetails {
  name: string;
  address: string;
  gstin?: string;
}

export interface ExtractedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  seller: PartyDetails;
  buyer: PartyDetails;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  currency: string;
}

export interface ConversionOptions {
  exchangeRate: number;
  gstRate: number;
  supplyType: "intra-state" | "inter-state";
  sellerGSTIN: string;
  buyerGSTIN: string;
  placeOfSupply: string;
  stateCode: string;
}

export interface ConvertedLineItem {
  sno: number;
  description: string;
  hsnCode: string;
  quantity: number;
  rateINR: number;
  taxableValueINR: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalINR: number;
}

export interface ConvertedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  originalInvoiceNumber: string;
  seller: { name: string; address: string; gstin: string };
  buyer: { name: string; address: string; gstin: string };
  placeOfSupply: string;
  stateCode: string;
  supplyType: "intra-state" | "inter-state";
  reverseCharge: boolean;
  lineItems: ConvertedLineItem[];
  subtotalINR: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstRate: number;
  totalTaxINR: number;
  grandTotalINR: number;
  roundOffINR: number;
  totalAfterRoundOffINR: number;
  exchangeRate: number;
  originalCurrency: string;
  originalTotal: number;
  amountInWords: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundOff(n: number): number {
  const rounded = Math.round(n);
  return rounded - n;
}

function numberToIndianWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "");
  }

  const wholePart = Math.floor(amount);
  const paisePart = Math.round((amount - wholePart) * 100);

  if (wholePart === 0) return "Zero Rupees Only";

  let result = "";
  const crore = Math.floor(wholePart / 10000000);
  const lakh = Math.floor((wholePart % 10000000) / 100000);
  const thousand = Math.floor((wholePart % 100000) / 1000);
  const rest = wholePart % 1000;

  if (crore > 0) result += convertLessThanThousand(crore) + " Crore ";
  if (lakh > 0) result += convertLessThanThousand(lakh) + " Lakh ";
  if (thousand > 0) result += convertLessThanThousand(thousand) + " Thousand ";
  if (rest > 0) result += convertLessThanThousand(rest);

  result = result.trim() + " Rupees";
  if (paisePart > 0) result += " and " + convertLessThanThousand(paisePart) + " Paise";
  result += " Only";
  return result;
}

function generateGSTInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = Date.now().toString().slice(-5);
  return `GST-INV-${year}${month}-${seq}`;
}

function todayFormatted(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function convertInvoice(extracted: ExtractedInvoice, options: ConversionOptions): ConvertedInvoiceData {
  const { exchangeRate, gstRate, supplyType, sellerGSTIN, buyerGSTIN, placeOfSupply, stateCode } = options;
  const isInterState = supplyType === "inter-state";
  const halfGSTRate = gstRate / 2;

  const convertedItems: ConvertedLineItem[] = extracted.lineItems.map((item) => {
    const taxableValueINR = round2(item.amount * exchangeRate);
    const rateINR = round2(item.unitPrice * exchangeRate);

    let cgstAmount: number | undefined;
    let sgstAmount: number | undefined;
    let igstAmount: number | undefined;

    if (isInterState) {
      igstAmount = round2(taxableValueINR * (gstRate / 100));
    } else {
      cgstAmount = round2(taxableValueINR * (halfGSTRate / 100));
      sgstAmount = round2(taxableValueINR * (halfGSTRate / 100));
    }

    const taxOnItem = isInterState ? (igstAmount ?? 0) : (cgstAmount ?? 0) + (sgstAmount ?? 0);
    const totalINR = round2(taxableValueINR + taxOnItem);

    return {
      sno: item.sno,
      description: item.description,
      hsnCode: item.hsnCode || "9954",
      quantity: item.quantity,
      rateINR,
      taxableValueINR,
      ...(isInterState
        ? { igstRate: gstRate, igstAmount }
        : { cgstRate: halfGSTRate, cgstAmount, sgstRate: halfGSTRate, sgstAmount }),
      totalINR,
    };
  });

  const subtotalINR = round2(convertedItems.reduce((sum, item) => sum + item.taxableValueINR, 0));

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = round2(subtotalINR * (gstRate / 100));
  } else {
    cgstAmount = round2(subtotalINR * (halfGSTRate / 100));
    sgstAmount = round2(subtotalINR * (halfGSTRate / 100));
  }

  const totalTaxINR = round2(cgstAmount + sgstAmount + igstAmount);
  const grandTotalINR = round2(subtotalINR + totalTaxINR);
  const roundOffValue = round2(roundOff(grandTotalINR));
  const totalAfterRoundOffINR = Math.round(grandTotalINR);

  return {
    invoiceNumber: generateGSTInvoiceNumber(),
    invoiceDate: todayFormatted(),
    originalInvoiceNumber: extracted.invoiceNumber || "N/A",
    seller: {
      name: extracted.seller.name || "Seller Name",
      address: extracted.seller.address || "Seller Address",
      gstin: sellerGSTIN || "27AAAAA0000A1Z5",
    },
    buyer: {
      name: extracted.buyer.name || "Buyer Name",
      address: extracted.buyer.address || "Buyer Address",
      gstin: buyerGSTIN || "",
    },
    placeOfSupply,
    stateCode,
    supplyType,
    reverseCharge: false,
    lineItems: convertedItems,
    subtotalINR,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstRate,
    totalTaxINR,
    grandTotalINR,
    roundOffINR: roundOffValue,
    totalAfterRoundOffINR,
    exchangeRate,
    originalCurrency: extracted.currency || "USD",
    originalTotal: extracted.total,
    amountInWords: numberToIndianWords(totalAfterRoundOffINR),
  };
}
