import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, Loader2 } from 'lucide-react';
import coinbaseApi from './services/coinbaseApi';
import coinloreApi from './services/coinloreApi';

// Cache duration for CoinLore data (30 minutes)
const COINLORE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

function App() {
  const [currency, setCurrency] = useState('USD');
  const [timeWindow, setTimeWindow] = useState('24h');
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currencies, setCurrencies] = useState([
    { id: 'USD', name: 'United States Dollar' },
    { id: 'EUR', name: 'Euro' },
    { id: 'GBP', name: 'British Pound' },
    { id: 'JPY', name: 'Japanese Yen' },
    { id: 'CAD', name: 'Canadian Dollar' }
  ]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [currencySearch, setCurrencySearch] = useState('');
  const [marketCap, setMarketCap] = useState(null);
  const [volume24h, setVolume24h] = useState(null);
  const [changes, setChanges] = useState({ '1h': null, '24h': null, '7d': null });
  const [loadingMarketData, setLoadingMarketData] = useState(true);

  // Cache for CoinLore data (keyed by currency)
  const coinloreCache = React.useRef({});

  // CoinLore only supports 1h, 24h, and 7d time windows
  const timeWindows = ['1h', '24h', '7d'];
  
  // Reset timeWindow if it's set to an unsupported value (only once on mount)
  useEffect(() => {
    if (!timeWindows.includes(timeWindow)) {
      setTimeWindow('24h');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount
  
  const currentChange = changes[timeWindow] !== null ? changes[timeWindow] : 0;
  const isPositive = currentChange >= 0;

  // Fetch supported currencies on mount
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const supportedCurrencies = await coinbaseApi.getSupportedCurrencies();
        // Filter to only show fiat currencies (exclude crypto currencies like BTC, ETH, etc.)
        const fiatCurrencies = supportedCurrencies.filter(
          curr => !['BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'XLM', 'ADA', 'DOT', 'SOL', 'USDC', 'USDT', 'DAI'].includes(curr.id)
        );
        // Sort by currency code
        fiatCurrencies.sort((a, b) => a.id.localeCompare(b.id));
        setCurrencies(fiatCurrencies);
      } catch (err) {
        console.error('Failed to fetch supported currencies from Coinbase:', {
          error: err.message,
          stack: err.stack,
          name: err.name
        });
        // Keep default currencies if API fails
      } finally {
        setLoadingCurrencies(false);
      }
    };

    fetchCurrencies();
  }, []);

  // Fetch Coinbase spot price (every 30 seconds)
  useEffect(() => {
    const fetchPrice = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const priceData = await coinbaseApi.getBtcSpotPrice(currency);
        setCurrentPrice(priceData.amount);
      } catch (err) {
        console.error('Failed to fetch BTC price:', {
          currency,
          error: err.message,
          stack: err.stack,
          name: err.name
        });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Refresh price every 30 seconds
    const priceInterval = setInterval(fetchPrice, 30000);
    
    return () => clearInterval(priceInterval);
  }, [currency]);

  // Fetch CoinLore market data (market cap, volume, trends) with caching (every 30 minutes)
  useEffect(() => {
    const fetchMarketData = async (useCache = true) => {
      const cacheKey = `market_${currency.toLowerCase()}`;
      const cached = coinloreCache.current[cacheKey];
      
      // Check cache if not forced refresh
      if (useCache && cached && (Date.now() - cached.timestamp) < COINLORE_CACHE_DURATION) {
        console.log('Using cached market data for', currency);
        setMarketCap(cached.marketCap);
        setVolume24h(cached.volume24h);
        setChanges(cached.changes);
        setLoadingMarketData(false);
        return;
      }

      setLoadingMarketData(true);
      
      try {
        // Fetch market data from CoinLore (volume, market cap, 24h change)
        const marketData = await coinloreApi.getBtcMarketData(currency);
        
        // Fetch price changes for different time periods from CoinLore
        // CoinLore supports: 1h, 24h, and 7d (if available)
        const priceChanges = await coinloreApi.getBtcPriceChanges(currency);
        
        const newChanges = {
          '1h': priceChanges['1h'],
          '24h': marketData.change24h !== null ? marketData.change24h : priceChanges['24h'],
          '7d': priceChanges['7d']
        };

        // Update state
        setMarketCap(marketData.marketCap);
        setVolume24h(marketData.volume24h);
        setChanges(newChanges);

        // Update cache
        coinloreCache.current[cacheKey] = {
          marketCap: marketData.marketCap,
          volume24h: marketData.volume24h,
          changes: newChanges,
          timestamp: Date.now()
        };
      } catch (err) {
        console.error('Failed to fetch CoinLore market data:', {
          currency,
          error: err.message,
          stack: err.stack,
          name: err.name
        });
        // Use cached data if available even if expired
        if (cached) {
          console.warn('Using expired cached data due to API error');
          setMarketCap(cached.marketCap);
          setVolume24h(cached.volume24h);
          setChanges(cached.changes);
        } else {
          // Set defaults if no cache available
          setChanges({
            '1h': null,
            '24h': null,
            '7d': null
          });
        }
      } finally {
        setLoadingMarketData(false);
      }
    };

    // Fetch immediately on currency change (will use cache if available)
    fetchMarketData(true);
    
    // Set up interval to refresh market data every 30 minutes
    const marketDataInterval = setInterval(() => fetchMarketData(false), COINLORE_CACHE_DURATION);
    
    return () => clearInterval(marketDataInterval);
  }, [currency]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCurrencyMenu && !event.target.closest('.currency-menu-container')) {
        setShowCurrencyMenu(false);
        setCurrencySearch('');
      }
      if (showTimeMenu && !event.target.closest('.time-menu-container')) {
        setShowTimeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCurrencyMenu, showTimeMenu]);

  // Filter currencies based on search
  const filteredCurrencies = currencies.filter(curr =>
    curr.id.toLowerCase().includes(currencySearch.toLowerCase()) ||
    curr.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  // Format large numbers (market cap, volume) with appropriate suffixes
  const formatLargeNumber = (value, curr) => {
    if (value === null || value === undefined) return '--';
    
    const currencySymbol = getCurrencySymbol(curr);
    const absValue = Math.abs(value);
    
    if (absValue >= 1e12) {
      return `${currencySymbol}${(value / 1e12).toFixed(2)}T`;
    } else if (absValue >= 1e9) {
      return `${currencySymbol}${(value / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
      return `${currencySymbol}${(value / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
      return `${currencySymbol}${(value / 1e3).toFixed(2)}K`;
    } else {
      return `${currencySymbol}${value.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    }
  };

  // Get currency symbol
  const getCurrencySymbol = (curr) => {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF ',
      'CNY': '¥',
      'INR': '₹',
      'KRW': '₩'
    };
    return symbols[curr] || curr + ' ';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-15">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-400 rounded-full filter blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>
      
      <div className="relative z-10 max-w-md mx-auto p-6">
        
        <div className="bg-slate-900/80 border-2 border-cyan-500/50 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.2)] mb-6 overflow-hidden">
          
          <div className="bg-gradient-to-r from-cyan-500/20 to-amber-400/20 border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-[0_0_35px_rgba(251,191,36,1),0_0_60px_rgba(251,191,36,0.6)] relative">
                <span className="text-3xl font-bold text-white" style={{textShadow: '0 0 10px rgba(251,191,36,1), 0 0 20px rgba(251,191,36,0.8), 0 0 30px rgba(251,191,36,0.6), 0 0 40px rgba(251,146,60,0.4)'}}>₿</span>
                <div className="absolute inset-0 rounded-full border-2 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.8)] animate-pulse"></div>
                <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-md animate-pulse"></div>
              </div>
              <div>
                <div className="text-base font-semibold text-white">Bitcoin</div>
                <div className="text-xs text-cyan-100/60">BTC</div>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${
              loading ? 'bg-yellow-400' : error ? 'bg-red-400' : 'bg-cyan-400'
            } shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse`}></div>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-baseline gap-2">
                {loading ? (
                  <div className="flex items-center gap-2 text-4xl font-bold text-white">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <span>Loading...</span>
                  </div>
                ) : error ? (
                  <div className="text-2xl font-bold text-red-400">
                    Error: {error}
                  </div>
                ) : currentPrice !== null ? (
                  <span className="text-4xl font-bold text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    {currentPrice.toLocaleString('en-US', { 
                      minimumFractionDigits: ['JPY', 'KRW', 'CLP', 'VND'].includes(currency) ? 0 : 2, 
                      maximumFractionDigits: ['JPY', 'KRW', 'CLP', 'VND'].includes(currency) ? 0 : 2 
                    })}
                  </span>
                ) : (
                  <span className="text-4xl font-bold text-white">--</span>
                )}
                
                <div className="relative currency-menu-container">
                  <button 
                    onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                    className="flex items-center gap-1 text-lg text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    {currency}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {showCurrencyMenu && (
                    <div className="absolute top-full mt-2 left-0 w-72 bg-slate-800/95 border border-cyan-500/50 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-md overflow-hidden z-50">
                      <div className="p-2 border-b border-cyan-500/30">
                        <input
                          type="text"
                          placeholder="Search currencies..."
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/80 border border-cyan-500/30 rounded-lg text-sm text-white placeholder-cyan-100/50 focus:outline-none focus:border-cyan-500/50"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {loadingCurrencies ? (
                          <div className="px-4 py-8 text-center text-cyan-100/60 text-sm">
                            Loading currencies...
                          </div>
                        ) : filteredCurrencies.length === 0 ? (
                          <div className="px-4 py-8 text-center text-cyan-100/60 text-sm">
                            No currencies found
                          </div>
                        ) : (
                          filteredCurrencies.map(curr => (
                            <button
                              key={curr.id}
                              onClick={() => {
                                setCurrency(curr.id);
                                setShowCurrencyMenu(false);
                                setCurrencySearch('');
                              }}
                              className={`block w-full px-4 py-2 text-left hover:bg-cyan-500/20 transition-colors ${
                                curr.id === currency ? 'bg-cyan-500/30 text-cyan-300' : 'text-cyan-100/80'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{curr.id}</span>
                                <span className="text-xs text-cyan-100/50 truncate ml-2">{curr.name}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isPositive 
                  ? 'bg-emerald-500/20 border border-emerald-500/40' 
                  : 'bg-red-500/20 border border-red-500/40'
              }`}>
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-lg font-bold ${
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {currentChange !== null ? (
                    <>
                      {isPositive ? '+' : ''}{currentChange.toFixed(2)}%
                    </>
                  ) : (
                    '--'
                  )}
                </span>
              </div>

              <div className="relative time-menu-container">
                <button 
                  onClick={() => setShowTimeMenu(!showTimeMenu)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-cyan-300 bg-slate-800/60 border border-cyan-500/30 rounded-lg hover:border-cyan-500/50 transition-colors"
                >
                  {timeWindow}
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showTimeMenu && (
                  <div className="absolute top-full mt-2 right-0 bg-slate-800/95 border border-cyan-500/50 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-md overflow-hidden z-50">
                    {timeWindows.map(tw => (
                      <button
                        key={tw}
                        onClick={() => {
                          setTimeWindow(tw);
                          setShowTimeMenu(false);
                        }}
                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-cyan-500/20 transition-colors ${
                          tw === timeWindow ? 'bg-cyan-500/30 text-cyan-300' : 'text-cyan-100/80'
                        }`}
                      >
                        {tw}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end gap-1 h-12 mt-4 px-2">
              {[45, 52, 48, 65, 58, 70, 68, 75, 72, 80, 85, 78, 90, 88, 95].map((height, i) => (
                <div 
                  key={i} 
                  className={`flex-1 rounded-t transition-all duration-300 ${
                    isPositive ? 'bg-gradient-to-t from-emerald-500/40 to-emerald-400/60' : 'bg-gradient-to-t from-red-500/40 to-red-400/60'
                  }`}
                  style={{ height: `${height}%` }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/70 border-2 border-cyan-500/40 p-4 rounded-xl backdrop-blur-md shadow-lg">
            <div className="text-xs text-cyan-100/60 uppercase tracking-wide mb-1">Volume 24h</div>
            {loadingMarketData ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-xl font-bold text-cyan-300">Loading...</span>
              </div>
            ) : volume24h !== null ? (
              <div className="text-xl font-bold text-cyan-300">
                {formatLargeNumber(volume24h, currency)}
              </div>
            ) : (
              <div className="text-xl font-bold text-cyan-300">--</div>
            )}
          </div>
          <div className="bg-slate-900/70 border-2 border-cyan-500/40 p-4 rounded-xl backdrop-blur-md shadow-lg">
            <div className="text-xs text-cyan-100/60 uppercase tracking-wide mb-1">Market Cap</div>
            {loadingMarketData ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-xl font-bold text-cyan-300">Loading...</span>
              </div>
            ) : marketCap !== null ? (
              <div className="text-xl font-bold text-cyan-300">
                {formatLargeNumber(marketCap, currency)}
              </div>
            ) : (
              <div className="text-xl font-bold text-cyan-300">--</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
