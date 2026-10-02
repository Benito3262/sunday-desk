import crypto from "crypto";

const HOST = "https://web3.binance.com";

export function requiredEnv() {
  const apiKey = process.env.BINANCE_WEB3_API_KEY || "";
  const secret = process.env.BINANCE_WEB3_API_SECRET || "";
  return { apiKey, secret, configured: Boolean(apiKey && secret) };
}

function sign({ method, pathWithQuery, body, apiKey, secret }) {
  const timestamp = new Date().toISOString();
  const preHash = timestamp + method.toUpperCase() + pathWithQuery + (body || "");
  const signature = crypto.createHmac("sha256", secret).update(preHash, "utf8").digest("base64");
  return {
    "X-OC-APIKEY": apiKey,
    "X-OC-TIMESTAMP": timestamp,
    "X-OC-SIGN": signature,
    "X-OC-RECV-WINDOW": "60000",
    "Content-Type": "application/json",
  };
}

export async function binance({ method = "GET", path, query = "", body }) {
  const { apiKey, secret, configured } = requiredEnv();
  if (!configured) {
    const error = new Error("API key not configured");
    error.code = "NO_KEY";
    throw error;
  }
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const requestPath = `/build${path}${qs}`;
  const rawBody = body ? JSON.stringify(body) : "";
  const headers = sign({
    method,
    pathWithQuery: requestPath,
    body: method === "GET" || method === "HEAD" ? "" : rawBody,
    apiKey,
    secret,
  });
  const started = Date.now();
  const response = await fetch(`${HOST}${requestPath}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : rawBody,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return {
    ok: response.ok,
    status: response.status,
    ms: Date.now() - started,
    path: requestPath,
    data: json,
  };
}
