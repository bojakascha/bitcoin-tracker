import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, Loader2 } from 'lucide-react';
import coinbaseApi from './services/coinbaseApi';
import { ECB_CURRENCIES } from './utils/ecbCurrencies';

function App() {
  // Initialize from localStorage or defaults
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem('bitcoin-tracker-currency');
    return saved || 'USD';
  });
  const [timeWindow, setTimeWindow] = useState(() => {
    const saved = localStorage.getItem('bitcoin-tracker-timeWindow');
    return saved || '24h';
  });
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
  
  // Save currency to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('bitcoin-tracker-currency', currency);
  }, [currency]);

  // Save timeWindow to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('bitcoin-tracker-timeWindow', timeWindow);
  }, [timeWindow]);

  // Reset timeWindow if it's set to an unsupported value (only once on mount)
  useEffect(() => {
    if (!timeWindows.includes(timeWindow)) {
      const defaultWindow = '24h';
      setTimeWindow(defaultWindow);
      localStorage.setItem('bitcoin-tracker-timeWindow', defaultWindow);
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

  // Get font size class based on price length
  const getPriceFontSize = (price, currency) => {
    if (price === null) return 'text-[3.375rem]'; // ~half step above text-5xl
    
    const formatted = price.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
    
    const length = formatted.length;
    
    // Very long numbers (12+ chars) - smallest
    if (length >= 12) return 'text-[1.6875rem]'; // ~half step above text-2xl
    // Long numbers (10-11 chars) - small
    if (length >= 10) return 'text-[2.0625rem]'; // ~half step above text-3xl
    // Medium numbers (8-9 chars) - medium
    if (length >= 8) return 'text-[2.625rem]'; // ~half step above text-4xl
    // Short numbers (<8 chars) - largest
    return 'text-[3.375rem]'; // ~half step above text-5xl
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
    <div className="h-screen w-screen bg-black text-white relative overflow-hidden fixed inset-0">
      {/* Intense animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500 rounded-full filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl opacity-40 animate-pulse" style={{animationDelay: '0.7s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-500 rounded-full filter blur-3xl opacity-25 animate-pulse" style={{animationDelay: '1.4s'}}></div>
        
        {/* Scanline effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent animate-pulse"></div>
        
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(#fbbf24 1px, transparent 1px), linear-gradient(90deg, #fbbf24 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      
      <div className="relative z-10 max-w-md mx-auto p-6" style={{ height: '100%', overflow: 'hidden' }}>
        
        <div className="bg-slate-950/90 border-2 border-amber-400 rounded-2xl backdrop-blur-md mb-6 overflow-hidden">
          
          {/* Bitcoin Symbol Header */}
          <div className="bg-gradient-to-r from-amber-600/30 via-purple-600/30 to-orange-600/30 border-b-2 border-amber-400/50 px-6 py-4 flex items-center justify-between relative">
            {/* Animated glow line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse"></div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 flex items-center justify-center relative">
                <span className="text-3xl font-bold text-black">₿</span>
                <div className="absolute inset-0 rounded-full border-2 border-amber-300"></div>
                <div className="absolute inset-0 rounded-full border border-yellow-400/50"></div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">Bitcoin</div>
                <div className="text-xs text-amber-300/80 font-mono">BTC</div>
              </div>
            </div>
            <div className="flex gap-1">
              <div className={`w-2 h-2 rounded-full ${
                loading ? 'bg-yellow-400' : error ? 'bg-red-400' : 'bg-amber-400'
              } shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse`}></div>
              <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse" style={{animationDelay: '0.3s'}}></div>
            </div>
          </div>

          {/* Price Display */}
          <div className="px-6 py-6 relative">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-transparent to-purple-600/10"></div>
            
            <div className="flex items-baseline justify-between mb-4 relative gap-2">
              <div className="flex items-baseline gap-2 flex-1 min-w-0 overflow-hidden">
                {loading ? (
                  <div className="flex items-center gap-2 text-[3.375rem] font-bold text-white">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                    <span>Loading...</span>
                  </div>
                ) : error ? (
                  <div className="text-2xl font-bold text-red-400">
                    Error: {error}
                  </div>
                ) : currentPrice !== null ? (
                  <span className={`${getPriceFontSize(currentPrice, currency)} font-bold text-white truncate`} style={{textShadow: '0 0 15px rgba(251,191,36,0.7), 0 0 30px rgba(234,179,8,0.4)'}}>
                    {currentPrice.toLocaleString('en-US', { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 0 
                    })}
                  </span>
                ) : (
                  <span className="text-[3.375rem] font-bold text-white">--</span>
                )}
              </div>
              
              {/* Currency Selector */}
              <div className="relative currency-menu-container flex-shrink-0">
                <button 
                  onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                  className="flex items-center gap-1 text-xl text-amber-400 hover:text-purple-400 transition-colors font-bold"
                  style={{textShadow: '0 0 8px rgba(251,191,36,0.6)'}}
                >
                  {currency}
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Change Display */}
            <div className="flex items-center justify-between mb-6 relative">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${
                isPositive 
                  ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]' 
                  : 'bg-red-500/20 border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.5)]'
              }`}>
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-xl font-bold ${
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                }`} style={{textShadow: isPositive ? '0 0 8px rgba(52,211,153,0.6)' : '0 0 8px rgba(248,113,113,0.6)'}}>
                  {currentChange != null ? (
                    <>
                      {isPositive ? '+' : ''}{currentChange.toFixed(2)}%
                    </>
                  ) : (
                    '--'
                  )}
                </span>
              </div>
            </div>

            <div className="relative">
              {/* Mini Chart Visualization */}
              <div className="space-y-2">
                {/* Graph container */}
                <div className="relative flex items-center justify-center gap-1 h-24 mt-6 mb-2 px-2 py-2">
                  {/* X-axis line */}
                  <div className="absolute left-2 right-2 top-1/2 h-px bg-amber-400/30 z-0 transform -translate-y-1/2"></div>
                  
                  {loadingCandles ? (
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
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
                                ? 'bg-gradient-to-t from-emerald-600 via-emerald-400 to-green-400 rounded-t' 
                                : 'bg-gradient-to-t from-red-500 via-orange-500 to-amber-400 rounded-b'
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
                  <div className="flex-1 flex items-center justify-center h-full text-amber-300/40 text-xs">
                    No candle data
                  </div>
                )}
                </div>
                
                {/* Time indicators */}
                {!loadingCandles && candles.length > 0 && (
                  <div className="flex items-center justify-center gap-1 px-2 mb-2">
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
                              <span className="text-xs text-amber-300/50">
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
                
                {/* Time Window Selector */}
                <div className="flex justify-center pt-2">
                  <div className="relative time-menu-container">
                    <button 
                      onClick={() => setShowTimeMenu(!showTimeMenu)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-amber-400 bg-slate-900/80 border-2 border-amber-400/50 rounded-xl hover:border-purple-400/70 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all font-bold"
                    >
                      {timeWindow}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
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
              className="w-full max-w-md bg-slate-950/98 border-2 border-amber-400/70 rounded-2xl shadow-[0_0_30px_rgba(251,191,36,0.5)] backdrop-blur-md overflow-hidden pointer-events-auto max-h-[80vh] flex flex-col"
              onMouseDown={(e) => {
                // Prevent backdrop click when clicking inside modal
                e.stopPropagation();
              }}
            >
              {/* Header */}
              <div className="p-4 border-b border-amber-400/30 bg-gradient-to-r from-amber-600/30 via-purple-600/30 to-orange-600/30">
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
                    className="text-amber-300 hover:text-purple-400 transition-colors text-xl font-bold"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search currencies..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/80 border border-amber-400/30 rounded-lg text-sm text-white placeholder-amber-100/50 focus:outline-none focus:border-amber-400/50"
                  autoFocus
                />
              </div>
              
              {/* Currency List - Scrollable */}
              <div className="overflow-y-auto flex-1">
                {loadingCurrencies ? (
                  <div className="px-4 py-12 text-center text-amber-100/60 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                    Loading currencies...
                  </div>
                ) : filteredCurrencies.length === 0 ? (
                  <div className="px-4 py-12 text-center text-amber-100/60 text-sm">
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
                          className={`block w-full px-5 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-amber-600/30 hover:to-purple-600/30 transition-all font-bold ${
                            curr.id === currency ? 'bg-gradient-to-r from-amber-600/40 to-purple-600/40 text-amber-300' : 'text-amber-100/90'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{curr.id}</span>
                            <span className="text-xs text-amber-100/50 text-right ml-4 flex-1">{curr.name}</span>
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
              className="w-full max-w-xs bg-slate-950/98 border-2 border-amber-400/70 rounded-2xl shadow-[0_0_30px_rgba(251,191,36,0.5)] backdrop-blur-md overflow-hidden pointer-events-auto max-h-[80vh] flex flex-col"
              onMouseDown={(e) => {
                // Prevent backdrop click when clicking inside modal
                e.stopPropagation();
              }}
            >
              {/* Header */}
              <div className="p-4 border-b border-amber-400/30 bg-gradient-to-r from-amber-600/30 via-purple-600/30 to-orange-600/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Select Time Interval</h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTimeMenu(false);
                    }}
                    className="text-amber-300 hover:text-purple-400 transition-colors text-xl font-bold"
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
                      className={`block w-full px-5 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-amber-600/30 hover:to-purple-600/30 transition-all font-bold whitespace-nowrap ${
                        tw === timeWindow ? 'bg-gradient-to-r from-amber-600/40 to-purple-600/40 text-amber-300' : 'text-amber-100/90'
                      }`}
                    >
                      {tw}
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
