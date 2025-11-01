import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';

function App() {
  const [currency, setCurrency] = useState('USD');
  const [timeWindow, setTimeWindow] = useState('24h');
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];
  const timeWindows = ['1h', '24h', '7d', '30d', '1y'];

  const prices = { USD: 67234.50, EUR: 61842.30, GBP: 53124.80, JPY: 9876543, CAD: 91234.60 };
  const changes = { '1h': 0.45, '24h': 2.34, '7d': -1.23, '30d': 8.76, '1y': 145.32 };
  
  const currentPrice = prices[currency];
  const currentChange = changes[timeWindow];
  const isPositive = currentChange >= 0;

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
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></div>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  {currentPrice.toLocaleString('en-US', { 
                    minimumFractionDigits: currency === 'JPY' ? 0 : 2, 
                    maximumFractionDigits: currency === 'JPY' ? 0 : 2 
                  })}
                </span>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                    className="flex items-center gap-1 text-lg text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    {currency}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {showCurrencyMenu && (
                    <div className="absolute top-full mt-2 left-0 bg-slate-800/95 border border-cyan-500/50 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-md overflow-hidden z-50">
                      {currencies.map(curr => (
                        <button
                          key={curr}
                          onClick={() => {
                            setCurrency(curr);
                            setShowCurrencyMenu(false);
                          }}
                          className={`block w-full px-4 py-2 text-left text-sm hover:bg-cyan-500/20 transition-colors ${
                            curr === currency ? 'bg-cyan-500/30 text-cyan-300' : 'text-cyan-100/80'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
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
                  {isPositive ? '+' : ''}{currentChange}%
                </span>
              </div>

              <div className="relative">
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
          {[
            { label: 'Volume 24h', value: '$28.4B' },
            { label: 'Market Cap', value: '$1.31T' }
          ].map((stat, i) => (
            <div key={i} className="bg-slate-900/70 border-2 border-cyan-500/40 p-4 rounded-xl backdrop-blur-md shadow-lg">
              <div className="text-xs text-cyan-100/60 uppercase tracking-wide mb-1">{stat.label}</div>
              <div className="text-xl font-bold text-cyan-300">{stat.value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default App;
