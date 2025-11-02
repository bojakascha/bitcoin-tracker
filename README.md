# monoticker

A real-time Bitcoin price tracker Progressive Web App (PWA).
## Features

- **Real-time Bitcoin prices** - Updates every 30 seconds via Coinbase API
- **Multi-currency support** - View prices in 30+ currencies using ECB exchange rates
- **Historical price charts** - Candlestick visualization for 1h, 24h, 7d, 30d, and 1y timeframes
- **Price trends** - Calculate percentage changes from candlestick data
- **Full-screen PWA** - Installable as a mobile app with offline caching
- **Responsive design** - Optimized for mobile devices with adaptive font sizing
- **Persistent preferences** - Currency and time window selections saved in localStorage

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Coinbase API** - Bitcoin spot prices and candlestick data
- **ECB Data API** - Foreign exchange rates for currency conversion

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to the local development URL (usually `http://localhost:5173`)

### Build

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Currency List Generation

The app uses a static list of ECB-supported currencies. To regenerate this list:

```bash
npm run generate-ecb
```

This will test all potential currencies and generate `src/utils/ecbCurrencies.js` with only currencies that have actual exchange rate data.

The currency list is automatically generated before builds via the `prebuild` script. To skip this during builds, set:

```bash
SKIP_ECB_GENERATION=true npm run build
```

## Deployment

The app is configured for GitHub Pages deployment with the base path `/bitcoin-tracker/`. The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically builds and deploys on push to the main branch.

## API Services

### Coinbase API
- **Spot Price**: `https://api.coinbase.com/v2/exchange-rates?currency=BTC`
- **Candlesticks**: `https://api.exchange.coinbase.com/products/BTC-USD/candles`

### ECB Data API
- **Exchange Rates**: `https://data-api.ecb.europa.eu/service/data/EXR/D.{CURRENCY}.EUR.SP00.A`

## License

MIT
