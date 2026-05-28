export type SourceCountry = "US" | "UK" | "EU" | "CA" | "AU";

export interface SourceCountryInfo {
  code: SourceCountry;
  name: string;
  currency: string;
  currencySymbol: string;
  taxSystemName: string;
  flag: string;
  fallbackRate: number;
}

export const SOURCE_COUNTRIES: SourceCountryInfo[] = [
  { code: "US", name: "United States", currency: "USD", currencySymbol: "$", taxSystemName: "Sales Tax", flag: "🇺🇸", fallbackRate: 83 },
  { code: "UK", name: "United Kingdom", currency: "GBP", currencySymbol: "£", taxSystemName: "VAT", flag: "🇬🇧", fallbackRate: 105 },
  { code: "EU", name: "European Union", currency: "EUR", currencySymbol: "€", taxSystemName: "VAT", flag: "🇪🇺", fallbackRate: 90 },
  { code: "CA", name: "Canada", currency: "CAD", currencySymbol: "CA$", taxSystemName: "GST/HST", flag: "🇨🇦", fallbackRate: 61 },
  { code: "AU", name: "Australia", currency: "AUD", currencySymbol: "A$", taxSystemName: "GST", flag: "🇦🇺", fallbackRate: 55 },
];

export function getSourceCountry(code: SourceCountry): SourceCountryInfo {
  return SOURCE_COUNTRIES.find((c) => c.code === code) ?? SOURCE_COUNTRIES[0]!;
}

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
  sourceCountry?: SourceCountry;
}

export interface ConversionOptions {
  exchangeRate: number;
  gstRate: number;
  supplyType: "intra-state" | "inter-state";
  sellerGSTIN: string;
  buyerGSTIN: string;
  placeOfSupply: string;
  stateCode: string;
  sourceCountry?: SourceCountry;
}

export const INDIAN_STATES: { name: string; code: string }[] = [
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Delhi", code: "07" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Ladakh", code: "38" },
  { name: "Chandigarh", code: "04" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Lakshadweep", code: "31" },
  { name: "Puducherry", code: "34" },
  { name: "Andaman and Nicobar Islands", code: "35" },
];

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export type GSTRate = (typeof GST_RATES)[number];

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  exchangeRate: 83,
  gstRate: 18,
  supplyType: "inter-state",
  sellerGSTIN: "",
  buyerGSTIN: "",
  placeOfSupply: "Maharashtra",
  stateCode: "27",
  sourceCountry: "US",
};

export type InvoiceStatus = "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "CONVERTING" | "CONVERTED" | "FAILED";

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
