import "./globals.css";

export const metadata = {
  title: "Sunday Desk — tokenized stocks after the bell",
  description:
    "See the gap between Friday's reference price and the on-chain tokenized stock price. Compare bStocks, Ondo and xStocks, simulate, then sign.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@380;460;560&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#10140f" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
