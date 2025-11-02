import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, Loader2 } from 'lucide-react';
import coinbaseApi from './services/coinbaseApi';
import { ECB_CURRENCIES } from './utils/ecbCurrencies';

function App() {
  const [currency, setCurrency] = useState('USD');
  const [timeWindow, setTimeWindow] = useState('24h');
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currencies, setCurrencies] = useState(ECB_CURRENCIES);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false); // Using static list, no loading needed
  const [currencySearch, setCurrencySearch] = useState('');
  const [changes, setChanges] = useState({ '1h': null, '24h': null, '7d': null, '30d': null, '1y': null });
  const [candles, setCandles] = useState([]);
  const [loadingCandles, setLoadingCandles] = useState(false);

  // Supported time windows: 1h, 24h, 7d, 30d, 1y
  const timeWindows = ['1h', '24h', '7d', '30d', '1y'];
  
  // Reset timeWindow if it's set to an unsupported value (only once on mount)
  useEffect(() => {
    if (!timeWindows.includes(timeWindow)) {
      setTimeWindow('24h');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount
  
  const currentChange = changes[timeWindow] != null && changes[timeWindow] !== undefined ? changes[timeWindow] : null;
  const isPositive = currentChange != null ? currentChange >= 0 : false;

  // Use static ECB currency list (no API call needed)
  useEffect(() => {
    // Sort by currency code for consistency
    const sortedCurrencies = [...ECB_CURRENCIES].sort((a, b) => a.id.localeCompare(b.id));
    setCurrencies(sortedCurrencies);
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

  // Calculate price changes from candle data
  const calculatePriceChanges = (candleData, timeWindow) => {
    if (!candleData || candleData.length === 0) {
      return null;
    }

    // Get the first (oldest) and last (newest) candles
    const firstCandle = candleData[0];
    const lastCandle = candleData[candleData.length - 1];

    if (!firstCandle || !lastCandle) {
      return null;
    }

    // Calculate percentage change: ((close - open) / open) * 100
    const startPrice = firstCandle.open;
    const endPrice = lastCandle.close;

    if (!startPrice || startPrice === 0) {
      return null;
    }

    const change = ((endPrice - startPrice) / startPrice) * 100;
    return parseFloat(change.toFixed(2));
  };

  // Update price changes when candles or timeWindow changes
  useEffect(() => {
    if (candles.length === 0) {
      return;
    }

    // Calculate change for current time window
    const change = calculatePriceChanges(candles, timeWindow);
    
    // Update the changes object with the calculated value for current timeWindow
    setChanges(prev => ({
      ...prev,
      [timeWindow]: change
    }));
  }, [candles, timeWindow]);

  // Fetch candlestick data when currency or timeWindow changes
  useEffect(() => {
    const fetchCandles = async () => {
      setLoadingCandles(true);
      try {
        const candleData = await coinbaseApi.getBtcCandlesForTimeWindow(currency, timeWindow);
        setCandles(candleData);
      } catch (err) {
        console.error('Failed to fetch candles:', {
          currency,
          timeWindow,
          error: err.message,
          stack: err.stack
        });
        // Set empty array on error
        setCandles([]);
      } finally {
        setLoadingCandles(false);
      }
    };

    fetchCandles();

    // Refresh candles every 30 seconds for 1h view, every 5 minutes for 24h/7d views
    const refreshInterval = timeWindow === '1h' ? 30000 : 300000;
    const candleInterval = setInterval(fetchCandles, refreshInterval);

    return () => clearInterval(candleInterval);
  }, [currency, timeWindow]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is inside the currency menu modal
      const currencyModal = document.querySelector('[data-currency-modal]');
      if (showCurrencyMenu && currencyModal && !currencyModal.contains(event.target) && !event.target.closest('.currency-menu-container')) {
        setShowCurrencyMenu(false);
        setCurrencySearch('');
      }
      // Check if click is inside the time menu modal
      const timeModal = document.querySelector('[data-time-modal]');
      if (showTimeMenu && timeModal && !timeModal.contains(event.target) && !event.target.closest('.time-menu-container')) {
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

  // Format time label based on time window
  const formatTimeLabel = (date, tw) => {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    switch(tw) {
      case '1h':
        const minsAgo = Math.floor(diffMs / (1000 * 60));
        if (minsAgo === 0) return 'Now';
        return `-${minsAgo}m`;
      case '24h':
        if (diffHours === 0) return 'Now';
        return `-${diffHours}h`;
      case '7d':
        if (diffDays === 0) return 'Now';
        return diffDays === 7 ? '-7d' : `-${diffDays}d`;
      case '30d':
        if (diffDays === 0) return 'Now';
        if (diffDays === 30) return '-30d';
        if (diffDays === 15) return '-15d';
        return `-${diffDays}d`;
      case '1y':
        const monthsAgo = Math.floor(diffDays / 30);
        if (monthsAgo === 0) return 'Now';
        if (monthsAgo === 12) return '-1y';
        if (monthsAgo === 6) return '-6m';
        return `-${monthsAgo}m`;
      default:
        return date.toLocaleDateString();
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 text-white relative overflow-hidden fixed inset-0">
      <div className="absolute inset-0 opacity-15">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-400 rounded-full filter blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>
      
      <div className="relative z-10 max-w-md mx-auto p-6" style={{ height: '100%', overflow: 'hidden' }}>
        
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
                  {currentChange != null ? (
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
              </div>
            </div>

            <div className="relative">
              {/* Graph container */}
              <div className="relative flex items-center justify-center gap-1 h-24 mt-6 mb-2 px-2 py-2">
                {/* X-axis line */}
                <div className="absolute left-2 right-2 top-1/2 h-px bg-cyan-500/30 z-0 transform -translate-y-1/2"></div>
                
                {loadingCandles ? (
                  <div className="flex-1 flex items-center justify-center h-full">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  </div>
                ) : candles.length > 0 ? (
                  (() => {
                    // Calculate candle ranges for normalization
                    const candleRanges = candles.map(c => c.high - c.low);
                    const maxRange = Math.max(...candleRanges);
                    
                    return candles.map((candle, i) => {
                      // Determine if candle is bullish (close >= open) or bearish (close < open)
                      const isBullish = candle.close >= candle.open;
                      
                      // Calculate normalized height: tallest candle uses 70% of container (leaving 30% for padding)
                      const candleRange = candle.high - candle.low;
                      const normalizedHeight = maxRange > 0 ? (candleRange / maxRange) * 70 : 5;
                      const finalHeight = Math.max(normalizedHeight, 5); // Minimum 5% for visibility
                      
                      return (
                        <div 
                          key={i}
                          className="flex-1 flex flex-col items-center relative"
                          style={{ height: '100%' }}
                          title={`Time: ${candle.time.toLocaleTimeString()}\nOpen: ${candle.open.toFixed(2)}\nHigh: ${candle.high.toFixed(2)}\nLow: ${candle.low.toFixed(2)}\nClose: ${candle.close.toFixed(2)}`}
                        >
                          {/* Candle bar - positioned above or below center x-axis */}
                          <div 
                            className={`w-full transition-all duration-300 absolute ${
                              isBullish 
                                ? 'bg-gradient-to-t from-emerald-500/60 to-emerald-400/80 border-t border-emerald-300/50 rounded-t' 
                                : 'bg-gradient-to-b from-red-500/60 to-red-400/80 border-b border-red-300/50 rounded-b'
                            }`}
                            style={{ 
                              height: `${finalHeight}%`,
                              minHeight: '2px',
                              bottom: isBullish ? '50%' : 'auto',
                              top: isBullish ? 'auto' : '50%',
                              transform: isBullish ? 'translateY(0)' : 'translateY(0)'
                            }}
                          />
                        </div>
                      );
                    });
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center h-full text-cyan-100/40 text-xs">
                    No candle data
                  </div>
                )}
              </div>

              {/* Time labels below graph */}
              {!loadingCandles && candles.length > 0 && (
                <div className="flex items-center justify-center gap-1 px-2 mb-4">
                  {(() => {
                    // Show labels at start, middle (if enough candles), and end
                    const labelIndices = [];
                    if (candles.length === 1) {
                      labelIndices.push(0);
                    } else if (candles.length === 2) {
                      labelIndices.push(0, 1);
                    } else {
                      labelIndices.push(0); // First
                      if (candles.length > 3) {
                        labelIndices.push(Math.floor(candles.length / 2)); // Middle
                      }
                      labelIndices.push(candles.length - 1); // Last
                    }

                    return candles.map((candle, i) => {
                      const shouldShowLabel = labelIndices.includes(i);
                      
                      return (
                        <div 
                          key={i}
                          className="flex-1 flex items-center justify-center"
                        >
                          {shouldShowLabel ? (
                            <span className="text-xs text-cyan-100/50">
                              {formatTimeLabel(candle.time, timeWindow)}
                            </span>
                          ) : (
                            <span className="text-xs text-transparent">•</span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Currency Selector Modal/Overlay */}
      {showCurrencyMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => {
              setShowCurrencyMenu(false);
              setCurrencySearch('');
            }}
          />
          
          {/* Currency Selector - Centered Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              data-currency-modal
              className="w-full max-w-md bg-slate-800/98 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.4)] backdrop-blur-md overflow-hidden pointer-events-auto max-h-[80vh] flex flex-col"
              onMouseDown={(e) => {
                // Prevent backdrop click when clicking inside modal
                e.stopPropagation();
              }}
            >
              {/* Header */}
              <div className="p-4 border-b border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-amber-400/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Select Currency</h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCurrencyMenu(false);
                      setCurrencySearch('');
                    }}
                    className="text-cyan-300 hover:text-cyan-200 transition-colors text-xl font-bold"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search currencies..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/80 border border-cyan-500/30 rounded-lg text-sm text-white placeholder-cyan-100/50 focus:outline-none focus:border-cyan-500/50"
                  autoFocus
                />
              </div>
              
              {/* Currency List - Scrollable */}
              <div className="overflow-y-auto flex-1">
                {loadingCurrencies ? (
                  <div className="px-4 py-12 text-center text-cyan-100/60 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
                    Loading currencies...
                  </div>
                ) : filteredCurrencies.length === 0 ? (
                  <div className="px-4 py-12 text-center text-cyan-100/60 text-sm">
                    No currencies found
                  </div>
                ) : (
                  <div className="p-2">
                    {filteredCurrencies.map(curr => {
                      const handleCurrencySelect = () => {
                        console.log('Selecting currency:', curr.id);
                        setCurrency(curr.id);
                        setShowCurrencyMenu(false);
                        setCurrencySearch('');
                      };
                      
                      return (
                        <button
                          key={curr.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCurrencySelect();
                          }}
                          className={`w-full px-4 py-3 text-left rounded-lg hover:bg-cyan-500/20 transition-colors mb-1 cursor-pointer ${
                            curr.id === currency ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'text-cyan-100/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-base">{curr.id}</span>
                            <span className="text-xs text-cyan-100/50 text-right ml-4 flex-1">{curr.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Time Interval Selector Modal/Overlay */}
      {showTimeMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => {
              setShowTimeMenu(false);
            }}
          />
          
          {/* Time Interval Selector - Centered Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              data-time-modal
              className="w-full max-w-xs bg-slate-800/98 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.4)] backdrop-blur-md overflow-hidden pointer-events-auto max-h-[80vh] flex flex-col"
              onMouseDown={(e) => {
                // Prevent backdrop click when clicking inside modal
                e.stopPropagation();
              }}
            >
              {/* Header */}
              <div className="p-4 border-b border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-amber-400/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Select Time Interval</h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTimeMenu(false);
                    }}
                    className="text-cyan-300 hover:text-cyan-200 transition-colors text-xl font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {/* Time Interval List */}
              <div className="p-2">
                {timeWindows.map(tw => {
                  const handleTimeSelect = () => {
                    console.log('Selecting time interval:', tw);
                    setTimeWindow(tw);
                    setShowTimeMenu(false);
                  };
                  
                  return (
                    <button
                      key={tw}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTimeSelect();
                      }}
                      className={`w-full px-4 py-3 text-left rounded-lg hover:bg-cyan-500/20 transition-colors mb-1 cursor-pointer ${
                        tw === timeWindow ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'text-cyan-100/80'
                      }`}
                    >
                      <span className="font-semibold text-base">{tw}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
