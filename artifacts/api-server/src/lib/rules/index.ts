export type SourceCountry = "US" | "UK" | "EU" | "CA" | "AU";

export interface CountryRule {
  code: SourceCountry;
  name: string;
  currency: string;
  currencySymbol: string;
  taxSystemName: string;
  fallbackRateToINR: number;
  normalizeTaxedAmount(grossAmount: number, taxRate: number): number;
}

// All country rules — strip source tax to get pre-tax taxable base
// GST is applied fresh by the converter
const rules: Record<SourceCountry, CountryRule> = {
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    taxSystemName: "Sales Tax",
    fallbackRateToINR: 83,
    normalizeTaxedAmount(gross, taxRate) {
      return taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
    },
  },
  UK: {
    code: "UK",
    name: "United Kingdom",
    currency: "GBP",
    currencySymbol: "£",
    taxSystemName: "VAT",
    fallbackRateToINR: 105,
    normalizeTaxedAmount(gross, taxRate) {
      return taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
    },
  },
  EU: {
    code: "EU",
    name: "European Union",
    currency: "EUR",
    currencySymbol: "€",
    taxSystemName: "VAT",
    fallbackRateToINR: 90,
    normalizeTaxedAmount(gross, taxRate) {
      return taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
    },
  },
  CA: {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    currencySymbol: "CA$",
    taxSystemName: "GST/HST",
    fallbackRateToINR: 61,
    normalizeTaxedAmount(gross, taxRate) {
      return taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
    },
  },
  AU: {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    currencySymbol: "A$",
    taxSystemName: "GST",
    fallbackRateToINR: 55,
    normalizeTaxedAmount(gross, taxRate) {
      return taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
    },
  },
};

export function getCountryRule(code: SourceCountry): CountryRule {
  return rules[code];
}

export function getAllCountryRules(): CountryRule[] {
  return Object.values(rules);
}

export const FALLBACK_RATES: Record<string, number> = {
  USD: 83,
  GBP: 105,
  EUR: 90,
  CAD: 61,
  AUD: 55,
};
