export const dynamic = "force-dynamic";
export const revalidate = 0;

import { binance, requiredEnv } from "../../../lib/sign";
import { USDT } from "../../../lib/seed";

function queryString(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function call(method, path, query, body) {
  const result = await binance({ method, path, query, body });
  return {
    ok: result.ok,
    status: result.status,
    ms: result.ms,
    path: result.path,
    data: result.data,
  };
}

export async function POST(request) {
  const { configured } = requiredEnv();
  if (!configured) {
    return Response.json(
      { ok: false, error: "API key missing. Add it in Vercel env settings, then redeploy." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const action = body.action;

  try {
    if (action === "quote") {
      const quote = await call(
        "GET",
        "/api/v1/dex/aggregator/quote",
        queryString({
          binanceChainId: "56",
          fromTokenAddress: body.fromToken || USDT,
          toTokenAddress: body.toToken,
          amount: body.amount,
          userWalletAddress: body.wallet,
        })
      );
      return Response.json({ ok: quote.ok, quote });
    }

    if (action === "build") {
      const swap = await call(
        "GET",
        "/api/v1/dex/aggregator/swap",
        queryString({
          binanceChainId: "56",
          quoteId: body.quoteId,
          fromTokenAddress: body.fromToken || USDT,
          toTokenAddress: body.toToken,
          amount: body.amount,
          userWalletAddress: body.wallet,
          slippagePercent: body.slippagePercent || "1",
        })
      );
      return Response.json({ ok: swap.ok, swap });
    }

    if (action === "approve") {
      const approve = await call(
        "GET",
        "/api/v1/dex/aggregator/approve-transaction",
        queryString({
          binanceChainId: "56",
          tokenAddress: body.tokenAddress || USDT,
          tokenContractAddress: body.tokenAddress || USDT,
          amount: body.amount,
          userWalletAddress: body.wallet,
          vendor: body.vendor || "",
        })
      );
      return Response.json({ ok: approve.ok, approve });
    }

    if (action === "simulate") {
      const tx = body.tx || {};
      const attempts = [];
      const payloads = [
        {
          binanceChainId: "56",
          from: tx.from,
          to: tx.to,
          data: tx.data,
          value: tx.value || "0",
          gas: tx.gas,
        },
        {
          binanceChainId: "56",
          tx: {
            from: tx.from,
            to: tx.to,
            data: tx.data,
            value: tx.value || "0",
            gas: tx.gas,
          },
        },
      ];
      for (const payload of payloads) {
        const result = await call("POST", "/api/v1/dex/pre-transaction/simulate", "", payload);
        attempts.push(result);
        if (result.ok) break;
      }
      return Response.json({ ok: attempts.some((item) => item.ok), attempts });
    }

    if (action === "broadcast") {
      const broadcast = await call("POST", "/api/v1/dex/pre-transaction/broadcast-transaction", "", {
        binanceChainId: "56",
        signedTransaction: body.signedTransaction,
        rawTx: body.signedTransaction,
      });
      return Response.json({ ok: broadcast.ok, broadcast });
    }

    if (action === "rfq") {
      const submit = await call("POST", "/api/v1/dex/aggregator/order/submit", "", {
        quoteId: body.quoteId,
        signature: body.signature,
        order: body.order,
        requestId: body.requestId,
        typedData: body.typedData,
      });
      return Response.json({ ok: submit.ok, submit });
    }

    if (action === "rfq-status") {
      const status = await call("GET", `/api/v1/dex/aggregator/order/${body.orderId}`, "");
      return Response.json({ ok: status.ok, status });
    }

    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 502 });
  }
}
