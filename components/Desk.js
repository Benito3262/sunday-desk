"use client";

import { useEffect, useMemo, useState } from "react";

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org";
const CHAIN_ID = "0x38";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const WC_PROJECT = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const BASKETS = ["All", "Magnificent 7", "AI Chips", "Buffett Portfolio", "ETF", "Held"];

function short(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function gapLabel(gap) {
  if (gap === null || gap === undefined || Number.isNaN(Number(gap))) return { text: "—", cls: "flat" };
  const n = Number(gap);
  if (Math.abs(n) < 0.05) return { text: "in line", cls: "flat" };
  if (n < 0) return { text: `${Math.abs(n).toFixed(2)}% under`, cls: "under" };
  return { text: `${n.toFixed(2)}% over`, cls: "over" };
}

function host() {
  try {
    return new URL(APP_URL).host;
  } catch {
    return "localhost:3000";
  }
}

async function rpc(method, params) {
  const response = await fetch(BSC_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

function padAddress(address) {
  return address.toLowerCase().replace("0x", "").padStart(64, "0");
}

async function readBalance(token, wallet) {
  const data = `0x70a08231${padAddress(wallet)}`;
  const raw = await rpc("eth_call", [{ to: token, data }, "latest"]);
  return BigInt(raw);
}

function formatUnits(value, decimals = 18) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracText = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fracText ? `.${fracText}` : ""}`;
}

async function discoverInjected() {
  const found = [];
  const announced = new Promise((resolve) => {
    const items = [];
    const onAnnounce = (event) => items.push(event.detail);
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve(items);
    }, 250);
  });
  const details = await announced;
  for (const detail of details) {
    found.push({
      id: detail.info.uuid,
      name: detail.info.name,
      provider: detail.provider,
    });
  }
  if (!found.length && window.ethereum) {
    found.push({ id: "injected", name: window.ethereum.isMetaMask ? "MetaMask" : "Browser wallet", provider: window.ethereum });
  }
  return found;
}

async function ensureBsc(provider) {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId === CHAIN_ID) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_ID,
        chainName: "BNB Smart Chain",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
        rpcUrls: [BSC_RPC],
        blockExplorerUrls: ["https://bscscan.com"],
      }],
    });
  }
}

export default function Desk() {
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(false);
  const [reason, setReason] = useState("");
  const [logs, setLogs] = useState([]);
  const [basket, setBasket] = useState("Magnificent 7");
  const [wallet, setWallet] = useState("");
  const [provider, setProvider] = useState(null);
  const [bnb, setBnb] = useState("");
  const [held, setHeld] = useState({});
  const [connectOpen, setConnectOpen] = useState(false);
  const [injected, setInjected] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amountUsd, setAmountUsd] = useState("10");
  const [tradeLog, setTradeLog] = useState("Connect a wallet, then simulate. Nothing sends until you tap Sign.");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/desk")
      .then((response) => response.json())
      .then((data) => {
        setRows(data.rows || []);
        setLive(Boolean(data.live));
        setReason(data.reason || "");
        setLogs(data.logs || []);
      })
      .catch((error) => setReason(error.message));
  }, []);

  useEffect(() => {
    if (!wallet) return;
    rpc("eth_getBalance", [wallet, "latest"])
      .then((value) => setBnb(formatUnits(BigInt(value))))
      .catch(() => setBnb(""));
    const tokens = rows.map((row) => row.address).filter(Boolean).slice(0, 24);
    Promise.all(
      tokens.map(async (token) => {
        try {
          const balance = await readBalance(token, wallet);
          return [token.toLowerCase(), balance];
        } catch {
          return [token.toLowerCase(), 0n];
        }
      })
    ).then((pairs) => {
      const next = {};
      for (const [token, balance] of pairs) if (balance > 0n) next[token] = formatUnits(balance);
      setHeld(next);
    });
  }, [wallet, rows]);

  const nextOpen = useMemo(() => {
    const times = rows.map((row) => Number(row.nextOpenTime)).filter((value) => value > now);
    if (!times.length) return null;
    return Math.min(...times);
  }, [rows, now]);

  const closed = rows.some((row) => row.marketStatus === "closed" || row.openState === false);
  const countdown = nextOpen ? formatCountdown(nextOpen - now) : closed ? "closed" : "checking session";

  const visible = rows.filter((row) => {
    if (basket === "All") return true;
    if (basket === "Held") return held[row.address?.toLowerCase()];
    if (basket === "Magnificent 7") return ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"].includes(row.ticker);
    if (basket === "AI Chips") return ["NVDA", "AMD", "TSM", "AVGO", "ARM", "MU"].includes(row.ticker);
    if (basket === "Buffett Portfolio") return row.basket === "Buffett Portfolio" || ["AAPL", "KO", "BAC", "AXP", "CVX"].includes(row.ticker);
    if (basket === "ETF") return row.basket === "ETF" || row.assetType === 3;
    return true;
  });

  const siblings = selected
    ? rows.filter((row) => row.ticker === selected.ticker)
    : [];

  async function openConnect() {
    setConnectOpen(true);
    setInjected(await discoverInjected());
  }

  async function useProvider(nextProvider, label) {
    await ensureBsc(nextProvider);
    const accounts = await nextProvider.request({ method: "eth_requestAccounts" });
    setProvider(nextProvider);
    setWallet(accounts[0]);
    setConnectOpen(false);
    setTradeLog(`Connected ${label} on BSC. ${short(accounts[0])}`);
    nextProvider.on?.("accountsChanged", (accountsNext) => setWallet(accountsNext[0] || ""));
    nextProvider.on?.("chainChanged", () => window.location.reload());
  }

  async function connectWalletConnect() {
    if (!WC_PROJECT) {
      setTradeLog("Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to show the phone QR. In-app wallets still work from the buttons below.");
      return;
    }
    const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const wc = await EthereumProvider.init({
      projectId: WC_PROJECT,
      chains: [56],
      showQrModal: true,
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4"],
      metadata: {
        name: "Sunday Desk",
        description: "Weekend gap desk for tokenized stocks",
        url: APP_URL,
        icons: ["https://www.bnbchain.org/favicon.ico"],
      },
    });
    await wc.connect();
    await useProvider(wc, "WalletConnect");
  }

  async function simulateAndMaybeSend(send) {
    if (!selected || !wallet || !provider) {
      setTradeLog("Connect a wallet first.");
      return;
    }
    setBusy(true);
    try {
      const amount = (BigInt(amountUsd) * 10n ** 18n).toString();
      const quoteResponse = await fetch("/api/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          toToken: selected.address,
          amount,
          wallet,
        }),
      }).then((response) => response.json());
      const quoteData = quoteResponse.quote?.data?.data || quoteResponse.quote?.data || {};
      const quoteId = quoteData.quoteId || quoteData.id;
      const executionMode = quoteData.executionMode || quoteData.mode || "unknown";
      setTradeLog(`Quote ${quoteResponse.quote?.status} in ${quoteResponse.quote?.ms}ms. Mode ${executionMode}.\n${JSON.stringify(quoteData, null, 2).slice(0, 1200)}`);
      if (!quoteResponse.ok || !quoteId) return;

      const buildResponse = await fetch("/api/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "build",
          quoteId,
          toToken: selected.address,
          amount,
          wallet,
        }),
      }).then((response) => response.json());
      const built = buildResponse.swap?.data?.data || buildResponse.swap?.data || {};
      const tx = built.tx || built.swapTransaction || built.transaction;
      const typed = built.rfq?.typedDataToSign || built.typedDataToSign;
      setTradeLog((current) => `${current}\n\nBuild ${buildResponse.swap?.status} in ${buildResponse.swap?.ms}ms.`);

      if (tx) {
        const sim = await fetch("/api/trade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "simulate",
            tx: { from: wallet, to: tx.to, data: tx.data, value: tx.value || "0", gas: tx.gas },
          }),
        }).then((response) => response.json());
        setTradeLog((current) => `${current}\n\nSimulation:\n${JSON.stringify(sim.attempts, null, 2).slice(0, 1400)}`);
        if (!send) return;
        const hash = await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: wallet,
            to: tx.to,
            data: tx.data,
            value: tx.value || "0x0",
            gas: tx.gas,
          }],
        });
        setTradeLog((current) => `${current}\n\nSent ${hash}\nhttps://bscscan.com/tx/${hash}`);
        return;
      }

      if (typed) {
        setTradeLog((current) => `${current}\n\nThis issuer wants an RFQ signature, not a router swap.`);
        if (!send) return;
        const signature = await provider.request({
          method: "eth_signTypedData_v4",
          params: [wallet, JSON.stringify(typed)],
        });
        const submitted = await fetch("/api/trade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "rfq",
            quoteId,
            signature,
            typedData: typed,
            requestId: crypto.randomUUID(),
          }),
        }).then((response) => response.json());
        setTradeLog((current) => `${current}\n\nRFQ submit:\n${JSON.stringify(submitted, null, 2).slice(0, 1400)}`);
        return;
      }

      setTradeLog((current) => `${current}\n\nNo transaction or RFQ payload came back. Raw build saved above for the DevEx report.`);
    } catch (error) {
      setTradeLog((current) => `${current}\n\n${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const briefing = buildBrief(visible, closed);

  return (
    <main className="wrap">
      <header className="top">
        <div className="mark">
          <b>Sunday Desk</b>
          <span>After the bell · BSC</span>
        </div>
        <button className="connect" onClick={wallet ? () => setWallet("") : openConnect}>
          {wallet ? short(wallet) : "Connect wallet"}
        </button>
      </header>

      <section className="hero">
        <div>
          <h1>The bell rang. The token didn’t.</h1>
          <p className="lede">{briefing}</p>
        </div>
        <aside className="panel">
          <div className="kicker">Next cash session</div>
          <div className="clock">{countdown}</div>
          <p className="note">
            {live ? "Live Binance Web3 RWA feed." : "Sample contract list. Prices appear after the API key is set."}
            {wallet ? ` Wallet ${short(wallet)} · ${bnb || "…"} BNB` : " Phone and desktop wallets both connect."}
          </p>
          {reason ? <div className="warn">{reason}</div> : null}
        </aside>
      </section>

      <div className="tabs">
        {BASKETS.map((item) => (
          <button key={item} className={item === basket ? "chip on" : "chip"} onClick={() => setBasket(item)}>
            {item}
          </button>
        ))}
      </div>

      <section className="table">
        {visible.length === 0 ? <p className="note">Nothing in this basket yet. Try All, or connect a wallet for Held.</p> : null}
        {visible.map((row) => {
          const gap = gapLabel(row.gapPct);
          return (
            <article key={`${row.platformId}-${row.address}`} className="row">
              <div>
                <div className="ticker">{row.ticker || row.symbol}</div>
                <div className="sub">{row.name} · {row.symbol}</div>
              </div>
              <div><span className="issuer">{row.platformId}</span></div>
              <div className="mono hide-sm">{money(row.tokenPrice)}<div className="sub">on-chain</div></div>
              <div className={`mono ${gap.cls}`}>{gap.text}<div className="sub">{row.marketStatus || row.reasonMsg || "reference"}</div></div>
              <button className="ghost" onClick={() => { setSelected(row); setTradeLog("Pick an amount, then simulate. Sign is a separate tap."); }}>
                Plan buy
              </button>
            </article>
          );
        })}
      </section>

      <section className="evidence">
        <div className="kicker">Evidence log · for the DevEx report</div>
        <div className="log">{logs.length ? JSON.stringify(logs, null, 2) : "No API calls yet."}</div>
        <p className="fine">
          Spot only. Not financial advice. Tokenized stocks are not the share itself. You confirm every signature.
          Judges need the repo, this deployed link, a video under 4 minutes, and an honest DevEx report.
        </p>
      </section>

      {connectOpen ? (
        <div className="sheet" onClick={() => setConnectOpen(false)}>
          <div className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="kicker">Connect</div>
            <h2>Phone or desktop.</h2>
            <p className="note">No seed phrase. Ever. This app only asks the wallet to switch to BSC and to sign what you confirm.</p>
            <div className="wallets">
              {injected.map((item) => (
                <button key={item.id} onClick={() => useProvider(item.provider, item.name)}>{item.name} on this device</button>
              ))}
              <button onClick={connectWalletConnect}>WalletConnect QR — Trust, MetaMask, Binance Wallet</button>
              <a className="linkish" href={`https://metamask.app.link/dapp/${host()}`}>Open in MetaMask</a>
              <a className="linkish" href={`https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(APP_URL)}`}>Open in Trust Wallet</a>
            </div>
            <p className="fine">On a phone, the two links open this site inside the wallet browser, which is the most reliable mobile path. The QR needs a free WalletConnect project id.</p>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="sheet" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="kicker">{selected.platformId} · {selected.marketStatus || "status pending"}</div>
            <h2>{selected.ticker} plan</h2>
            <p className="note">
              On-chain {money(selected.tokenPrice)} versus reference {money(selected.referencePrice)}. {gapLabel(selected.gapPct).text}.
              {selected.reasonMsg ? ` ${selected.reasonMsg}.` : ""} Same ticker on other issuers is listed under this plan.
            </p>
            <div className="wallets">
              {siblings.map((row) => (
                <button key={row.address} onClick={() => setSelected(row)}>
                  {row.platformId} · {row.symbol} · {gapLabel(row.gapPct).text}
                </button>
              ))}
            </div>
            <div className="amounts">
              {["5", "10", "25"].map((value) => (
                <button key={value} className={amountUsd === value ? "chip on" : "chip"} onClick={() => setAmountUsd(value)}>${value}</button>
              ))}
            </div>
            <div className="actions">
              <button className="ghost" disabled={busy} onClick={() => simulateAndMaybeSend(false)}>Simulate only</button>
              <button className="solid" disabled={busy} onClick={() => simulateAndMaybeSend(true)}>{busy ? "Working…" : "Sign and send"}</button>
              <button className="ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="log">{tradeLog}</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatCountdown(ms) {
  if (ms <= 0) return "open window";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function buildBrief(rows, closed) {
  const priced = rows.filter((row) => typeof row.gapPct === "number");
  if (!priced.length) {
    return "Wall Street freezes at 4pm New York. These tokens keep a price. Sunday Desk lines up on-chain price against the last reference, across bStocks, Ondo and xStocks, and will not send anything until you sign.";
  }
  const worst = [...priced].sort((a, b) => a.gapPct - b.gapPct)[0];
  const side = worst.gapPct < 0 ? "under" : "over";
  return `${closed ? "Cash session is closed. " : ""}${worst.ticker} on ${worst.platformId} is ${Math.abs(worst.gapPct).toFixed(2)}% ${side} the reference. Compare the other wrapper before you simulate a spot buy.`;
}
