# Sunday Desk

> Local / personal build. Not Trex’s BNB Hack submission.

A weekend desk for tokenized stocks on BNB Smart Chain. It reads the gap between the on-chain price and the reference price, compares bStocks, Ondo and xStocks, simulates the buy, then lets you sign on phone or desktop.

Built for BNB Hack: Tokenized Stocks Edition. Spot only. BSC mainnet only.

## What you do (no coding)

1. Register the hackathon: https://www.bnbchain.org/en/hackathons/tokenized-stocks
2. Create a free API key: https://web3.binance.com/en/dev-portal
3. Create a free WalletConnect project id: https://cloud.reown.com
4. Put this folder on GitHub.
5. Import that GitHub repo into Vercel and paste the keys.
6. Put about $5 of BNB on BSC in the wallet you will demo with, plus a little USDT if you want a live buy.
7. Record a video under 4 minutes. Fill `DEVEX_REPORT.md` from the evidence log on the site. Do not paste an AI-written report. Judges reject those.

## Run it on your laptop first

Install Node.js 20 from https://nodejs.org (the LTS button).

Then, in this folder:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

Edit `.env.local` and paste:

```
BINANCE_WEB3_API_KEY=paste
BINANCE_WEB3_API_SECRET=paste
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=paste
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Restart `npm run dev` after saving the file.

## Host it free on Vercel

1. Make a GitHub account.
2. New repository, name it `sunday-desk`, public.
3. Upload this folder (drag the files in, or use GitHub Desktop).
4. Make a Vercel account with that same GitHub login: https://vercel.com
5. Add New Project, pick `sunday-desk`.
6. Before deploy, open Environment Variables and add the same three keys. Set `NEXT_PUBLIC_APP_URL` to the Vercel URL after the first deploy, then redeploy.
7. The `.vercel.app` link is what you submit. Leave the repo public through the end of judging.

## Wallet, phone and desktop

- Desktop: MetaMask, Binance Wallet extension, or any injected wallet. The connect sheet lists wallets it finds.
- Phone: tap Open in MetaMask or Open in Trust Wallet. That opens the site inside the wallet, which is the reliable path.
- QR: WalletConnect, after the project id is set. Scan with Trust, MetaMask, or Binance Wallet.

The app switches the wallet to BSC (chain 56). It never asks for a seed phrase.

## Demo path for judges

1. Open the deployed link. Market status and the gap table load from the RWA API.
2. Connect a wallet.
3. Open a ticker that is under the reference. Show the other issuer if one exists.
4. Tap Simulate only. Leave the raw response on screen.
5. Optional: Sign and send a $5 buy. Show the BscScan link.

## Submit

- Public repo
- Deployed link
- Video, 4 minutes or less
- `DEVEX_REPORT.md` filled with real errors from the evidence log
- Registration form linked from the hackathon page
