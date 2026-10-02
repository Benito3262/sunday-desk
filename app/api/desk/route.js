import { binance, requiredEnv } from "../../../lib/sign";
import { SEED } from "../../../lib/seed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function gapOf(tokenPrice, referencePrice) {
  const token = num(tokenPrice);
  const reference = num(referencePrice);
  if (!token || !reference) return null;
  return ((token - reference) / reference) * 100;
}

function asArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.list)) return payload.list;
  if (Array.isArray(payload.tokens)) return payload.tokens;
  if (payload.data && Array.isArray(payload.data.list)) return payload.data.list;
  if (payload.data && Array.isArray(payload.data.tokens)) return payload.data.tokens;
  if (payload.data && Array.isArray(payload.data.rows)) return payload.data.rows;
  return [];
}

function binancePayloadOk(data) {
  if (!data || typeof data !== "object") return false;
  if (data.success === false) return false;
  if (typeof data.code === "number" && data.code !== 0 && data.code !== 200) return false;
  if (typeof data.code === "string" && data.code !== "0" && data.code !== "200000") return false;
  return true;
}

function normalize(row, basket) {
  const status = row.statusInfo || row.marketStatusInfo || {};
  const tokenPrice = row.tokenPrice ?? row.price ?? row.onchainPrice;
  const referencePrice = row.referencePrice ?? row.underlyingPrice;
  return {
    ticker: row.underlyingTicker || row.ticker || row.symbol || "",
    name: row.underlyingName || row.underlyingFullName || row.companyName || row.name || "",
    symbol: row.tokenSymbol || row.symbol || "",
    platformId: row.platformId || row.platform || "unknown",
    address: row.tokenContractAddress || row.contractAddress || row.address || "",
    chainId: String(row.binanceChainId || "56"),
    assetType: row.assetType || null,
    basket,
    tokenPrice: num(tokenPrice),
    referencePrice: num(referencePrice),
    gapPct: gapOf(tokenPrice, referencePrice),
    openState: status.openState ?? null,
    marketStatus: status.marketStatus || null,
    reasonCode: status.reasonCode || null,
    reasonMsg: status.reasonMsg || null,
    nextOpenTime: status.nextOpenTime || null,
    nextCloseTime: status.nextCloseTime || null,
    priceUpdatedAt: row.tokenPriceUpdatedAt || null,
  };
}

async function pullTab(tabId, basket) {
  const result = await binance({
    path: "/api/v1/dex/market/rwa/tokens",
    query: `binanceChainId=56&tabId=${tabId}`,
  });
  const businessOk = result.ok && binancePayloadOk(result.data);
  return {
    log: {
      path: result.path,
      status: result.status,
      ms: result.ms,
      ok: businessOk,
      code: result.data?.code ?? null,
      msg: result.data?.msg || result.data?.message || null,
    },
    rows: businessOk ? asArray(result.data).map((row) => normalize(row, basket)) : [],
  };
}

async function pullSearch(keyword) {
  const result = await binance({
    path: "/api/v1/dex/market/rwa/search",
    query: `keyword=${encodeURIComponent(keyword)}`,
  });
  const businessOk = result.ok && binancePayloadOk(result.data);
  const rows = [];
  if (businessOk) {
    for (const item of asArray(result.data)) {
      const assets = item.assets || item.tokens || [item];
      for (const asset of assets) {
        rows.push(
          normalize(
            {
              ...asset,
              ticker: asset.ticker || item.ticker,
              companyName: asset.companyName || item.companyName,
              underlyingTicker: asset.underlyingTicker || item.ticker,
              underlyingName: asset.underlyingName || item.companyName,
            },
            "Search"
          )
        );
      }
    }
  }
  return {
    log: {
      path: result.path,
      status: result.status,
      ms: result.ms,
      ok: businessOk,
      code: result.data?.code ?? null,
      msg: result.data?.msg || result.data?.message || null,
    },
    rows,
  };
}

async function yahooClose(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const quotes = result?.indicators?.quote?.[0]?.close || [];
    for (let i = quotes.length - 1; i >= 0; i -= 1) {
      if (Number.isFinite(quotes[i])) return quotes[i];
    }
    return null;
  } catch {
    return null;
  }
}

async function dexPrice(address) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pairs = json?.pairs || [];
    const bsc = pairs.filter((p) => (p.chainId || "").toLowerCase() === "bsc");
    const best = (bsc.length ? bsc : pairs).sort(
      (a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0)
    )[0];
    const price = num(best?.priceUsd);
    return price;
  } catch {
    return null;
  }
}

async function enrichSeed(reason, logs = []) {
  const rows = await Promise.all(
    SEED.map(async (row) => {
      const [referencePrice, tokenPrice] = await Promise.all([
        yahooClose(row.ticker),
        dexPrice(row.address),
      ]);
      return {
        ...row,
        platformId: "bstock",
        chainId: "56",
        tokenPrice,
        referencePrice,
        gapPct: gapOf(tokenPrice, referencePrice),
        marketStatus: "seed",
        reasonMsg: reason || "Seed / public-price fallback",
      };
    })
  );
  return Response.json({
    live: false,
    reason: reason || "Using public Yahoo + DexScreener prices until Binance RWA is available.",
    rows,
    logs,
  });
}

export async function GET() {
  const { configured } = requiredEnv();
  if (!configured) {
    return enrichSeed("Add BINANCE_WEB3_API_KEY and BINANCE_WEB3_API_SECRET for live Binance RWA gaps.");
  }

  const logs = [];
  const merged = new Map();
  const jobs = [
    ["9", "Magnificent 7"],
    ["4", "AI Chips"],
    ["13", "Buffett Portfolio"],
    ["11", "ETF"],
  ];

  try {
    const tabs = await Promise.all(jobs.map(([id, name]) => pullTab(id, name)));
    for (const tab of tabs) {
      logs.push(tab.log);
      for (const row of tab.rows) {
        if (!row.address) continue;
        merged.set(`${row.platformId}:${row.address.toLowerCase()}`, row);
      }
    }

    const searches = await Promise.all(
      ["NVDA", "AAPL", "TSLA", "MSFT", "SPY"].map((ticker) => pullSearch(ticker))
    );
    for (const search of searches) {
      logs.push(search.log);
      for (const row of search.rows) {
        if (!row.address || row.chainId !== "56") continue;
        const key = `${row.platformId}:${row.address.toLowerCase()}`;
        const existing = merged.get(key);
        merged.set(key, existing ? { ...row, ...existing, basket: existing.basket || row.basket } : row);
      }
    }

    if (merged.size === 0) {
      const first = logs.find((l) => l.msg) || logs[0];
      const reason = first?.msg
        ? `Binance RWA unavailable (${first.code || first.status}): ${first.msg}`
        : "Binance RWA returned no tokens for this region or key.";
      return enrichSeed(reason, logs);
    }

    return Response.json({ live: true, rows: Array.from(merged.values()), logs });
  } catch (error) {
    return enrichSeed(error.message, logs);
  }
}
