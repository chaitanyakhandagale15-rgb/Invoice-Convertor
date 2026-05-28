import { Router, type Request, type Response } from "express";
import { FALLBACK_RATES, type SourceCountry } from "../lib/rules/index";

const router = Router();

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RatesCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const SUPPORTED_CURRENCIES: Record<string, SourceCountry> = {
  USD: "US",
  GBP: "UK",
  EUR: "EU",
  CAD: "CA",
  AUD: "AU",
};

async function fetchLiveRates(): Promise<Record<string, number>> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Exchange rate API responded ${res.status}`);
  const data = (await res.json()) as { rates: Record<string, number>; result: string };
  if (data.result !== "success") throw new Error("Exchange rate API returned non-success");

  const usdToInr = data.rates["INR"];
  if (!usdToInr) throw new Error("INR rate missing from response");

  const result: Record<string, number> = {};
  for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
    const usdToCurrency = data.rates[currency];
    if (usdToCurrency && usdToCurrency > 0) {
      result[currency] = usdToInr / usdToCurrency;
    } else {
      result[currency] = FALLBACK_RATES[currency] ?? 83;
    }
  }
  return result;
}

async function getRates(): Promise<{ rates: Record<string, number>; live: boolean }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { rates: cache.rates, live: true };
  }

  try {
    const rates = await fetchLiveRates();
    cache = { rates, fetchedAt: now };
    return { rates, live: true };
  } catch {
    return { rates: FALLBACK_RATES, live: false };
  }
}

// GET /api/exchange-rates
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { rates, live } = await getRates();
  const result = Object.entries(SUPPORTED_CURRENCIES).map(([currency]) => ({
    from: currency,
    to: "INR",
    rate: Math.round(rates[currency] * 100) / 100,
    live,
    timestamp: cache?.fetchedAt ? new Date(cache.fetchedAt).toISOString() : new Date().toISOString(),
  }));
  res.json({ rates: result, live });
});

// GET /api/exchange-rates/:currency
router.get("/:currency", async (req: Request, res: Response): Promise<void> => {
  const currency = String(req.params["currency"]).toUpperCase();
  if (!SUPPORTED_CURRENCIES[currency]) {
    res.status(400).json({ error: `Unsupported currency: ${currency}. Supported: ${Object.keys(SUPPORTED_CURRENCIES).join(", ")}` });
    return;
  }
  const { rates, live } = await getRates();
  res.json({
    from: currency,
    to: "INR",
    rate: Math.round(rates[currency] * 100) / 100,
    live,
    timestamp: cache?.fetchedAt ? new Date(cache.fetchedAt).toISOString() : new Date().toISOString(),
  });
});

export default router;
