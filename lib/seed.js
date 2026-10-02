// Fallback list used only when the Binance Web3 key is missing.
// Live mode replaces this with the RWA token list (bStocks, Ondo, xStocks).
// Addresses are BSC mainnet bStocks contracts published by Binance.

export const USDT = "0x55d398326f99059fF775485246999027B3197955";

const RAW = [
  { ticker: "AAPL", name: "Apple", symbol: "AAPLB", address: "0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a", basket: "Magnificent 7" },
  { ticker: "MSFT", name: "Microsoft", symbol: "MSFTB", address: "0x80106cb3ead06659a5ad19df39d9b4733863b9b0", basket: "Magnificent 7" },
  { ticker: "GOOGL", name: "Alphabet", symbol: "GOOGLB", address: "0x3f53de71c126bdabae20f9cd64848d317f6c3238", basket: "Magnificent 7" },
  { ticker: "AMZN", name: "Amazon", symbol: "AMZNB", address: "0x1a4b499833a79a09ad7cf1d42d7dacf71e92eb00", basket: "Magnificent 7" },
  { ticker: "META", name: "Meta", symbol: "METAB", address: "0x7425889fe94f9d693e8daefe88bcced6acfef4c0", basket: "Magnificent 7" },
  { ticker: "NVDA", name: "NVIDIA", symbol: "NVDAB", address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436", basket: "Magnificent 7" },
  { ticker: "TSLA", name: "Tesla", symbol: "TSLAB", address: "0x5b1910eaad6450e50f816082aa078c41f10c292f", basket: "Magnificent 7" },
  { ticker: "AMD", name: "AMD", symbol: "AMDB", address: "0x75fd4cf6f8392e41e70391d60c90c0d5211603a1", basket: "AI Chips" },
  { ticker: "TSM", name: "TSMC", symbol: "TSMB", address: "0xab78b89b5bb00236be0b4b20704cbfa04efc711c", basket: "AI Chips" },
  // Placeholder AVGO address was invalid — omit until a verified BSC contract is known.
  { ticker: "NFLX", name: "Netflix", symbol: "NFLXB", address: "0xd6829ea836b6fa224d099d40e54b31262f874631", basket: "Watchlist" },
  { ticker: "PLTR", name: "Palantir", symbol: "PLTRB", address: "0x0ca5d51d0277bd006fd9607d3e560785ebad8222", basket: "Watchlist" },
  { ticker: "ORCL", name: "Oracle", symbol: "ORCLB", address: "0x4684d9887fc1c71cba7bab8e88835cec217eb598", basket: "Watchlist" },
  { ticker: "SPY", name: "SPY", symbol: "SPYB", address: "0x7138b48df7d98d7e3cc221bfe7192d0a178182d8", basket: "ETF" },
];

export const SEED = RAW;

export const BASKETS = {
  "Magnificent 7": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"],
  "AI Chips": ["NVDA", "AMD", "TSM"],
  "Buffett Portfolio": ["AAPL", "KO", "BAC", "AXP", "CVX"],
  ETF: ["SPY", "QQQ"],
};
