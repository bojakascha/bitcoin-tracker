/**
 * Coinbase API Service
 * Handles API calls to Coinbase Public API for cryptocurrency data
 */
import ecbApi from './ecbApi';

class CoinbaseApi {
  constructor() {
    this.baseUrl = 'https://api.coinbase.com/v2';
    this.exchangeUrl = 'https://api.exchange.coinbase.com';
  }

  /**
   * Get the current spot price of BTC for a selected currency
   * Always uses BTC-USD from Coinbase and converts via ECB for non-USD currencies
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY', 'CAD')
   * @returns {Promise<Object>} Promise that resolves to an object with price data
   * @throws {Error} If the API request fails or returns an error
   */
  async getBtcSpotPrice(currency = 'USD') {
    // Always fetch BTC-USD price from Coinbase
    const usdUrl = `${this.baseUrl}/prices/BTC-USD/spot`;
    const usdResponse = await fetch(usdUrl);
    
    if (!usdResponse.ok) {
      const errorText = await usdResponse.text().catch(() => 'Unable to read response body');
      console.error(`Coinbase API Error [${usdResponse.status}]:`, {
        url: usdUrl,
        status: usdResponse.status,
        statusText: usdResponse.statusText,
        body: errorText
      });
      throw new Error(`API request failed: ${usdResponse.status} ${usdResponse.statusText}`);
    }

    const usdData = await usdResponse.json();
    if (!usdData.data || !usdData.data.amount) {
      console.error('Coinbase API: Invalid response format', {
        url: usdUrl,
        response: usdData
      });
      throw new Error('Invalid response format from API');
    }

    const usdAmount = parseFloat(usdData.data.amount);

    // Special case for USD - return directly
    if (currency.toUpperCase() === 'USD') {
      return {
        amount: usdAmount,
        currency: 'USD',
        base: 'BTC',
        timestamp: new Date().toISOString()
      };
    }

    // For all other currencies: convert via ECB
    try {
      const exchangeRate = await ecbApi.getLatestRate('USD', currency);
      
      if (!exchangeRate || exchangeRate === null) {
        throw new Error(`No exchange rate available from ECB for USD->${currency}`);
      }
      
      const convertedAmount = usdAmount * exchangeRate;
      
      console.log(`Converted BTC price from USD ${usdAmount} to ${currency} ${convertedAmount} using ECB rate ${exchangeRate}`);
      
      return {
        amount: convertedAmount,
        currency: currency.toUpperCase(),
        base: 'BTC',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error converting BTC price via ECB:', {
        currency,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get the current spot price of BTC for multiple currencies
   * @param {string[]} currencies - Array of currency codes
   * @returns {Promise<Object>} Promise that resolves to an object with prices keyed by currency
   */
  async getBtcSpotPrices(currencies = ['USD']) {
    try {
      const pricePromises = currencies.map(currency => 
        this.getBtcSpotPrice(currency).catch(error => ({
          currency: currency.toUpperCase(),
          error: error.message
        }))
      );

      const results = await Promise.all(pricePromises);
      
      const prices = {};
      results.forEach(result => {
        if (result.error) {
          prices[result.currency] = { error: result.error };
        } else {
          prices[result.currency] = {
            amount: result.amount,
            currency: result.currency,
            base: result.base
          };
        }
      });

      return prices;
    } catch (error) {
      console.error('Error fetching multiple BTC spot prices:', error);
      throw error;
    }
  }

  /**
   * Get exchange rates for BTC
   * @returns {Promise<Object>} Promise that resolves to exchange rates object
   */
  async getBtcExchangeRates() {
    const url = `${this.baseUrl}/exchange-rates?currency=BTC`;
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response body');
        console.error(`Coinbase API Error [${response.status}]:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.rates) {
        console.error('Coinbase API: Invalid response format', {
          url,
          response: data
        });
        throw new Error('Invalid response format from API');
      }

      return {
        currency: data.data.currency,
        rates: data.data.rates
      };
    } catch (error) {
      console.error('Error fetching BTC exchange rates from Coinbase:', {
        url,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get list of supported currencies from Coinbase
   * @returns {Promise<Array>} Promise that resolves to an array of currency objects
   */
  async getSupportedCurrencies() {
    const url = `${this.baseUrl}/currencies`;
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response body');
        console.error(`Coinbase API Error [${response.status}]:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        console.error('Coinbase API: Invalid response format', {
          url,
          response: data
        });
        throw new Error('Invalid response format from API');
      }

      return data.data.map(currency => ({
        id: currency.id,
        name: currency.name,
        minSize: currency.min_size
      }));
    } catch (error) {
      console.error('Error fetching supported currencies from Coinbase:', {
        url,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get candlestick data (OHLC) for BTC-USD from Coinbase Exchange API
   * Only accepts USD - other currencies should use getBtcCandlesForTimeWindow
   * @param {string} currency - Must be 'USD'
   * @param {number} granularity - Granularity in seconds (60, 300, 900, 3600, 21600, 86400)
   * @param {Date} start - Start time (optional)
   * @param {Date} end - End time (optional)
   * @returns {Promise<Array>} Promise that resolves to array of candle data: [{time, low, high, open, close, volume}, ...]
   */
  async getBtcCandles(currency = 'USD', granularity = 3600, start = null, end = null) {
    // Only allow USD - other currencies should use getBtcCandlesForTimeWindow which handles conversion
    if (currency.toUpperCase() !== 'USD') {
      throw new Error('getBtcCandles should only be called with USD. Use getBtcCandlesForTimeWindow for other currencies.');
    }

    const url = new URL(`${this.exchangeUrl}/products/BTC-USD/candles`);
    
    // Add granularity (required)
    url.searchParams.append('granularity', granularity.toString());
    
    // Add start and end times if provided
    // Coinbase Exchange API expects Unix timestamps in seconds (not ISO strings)
    if (start && end) {
      url.searchParams.append('start', Math.floor(start.getTime() / 1000).toString());
      url.searchParams.append('end', Math.floor(end.getTime() / 1000).toString());
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read response body');
      console.error(`Coinbase Exchange API Error [${response.status}]:`, {
        url: url.toString(),
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error('Coinbase Exchange API: Invalid response format', {
        url: url.toString(),
        response: data
      });
      throw new Error('Invalid response format from API');
    }

    // Log for debugging
    console.log(`Coinbase Exchange API: Received ${data.length} candles for USD, granularity ${granularity}s`);

    if (data.length === 0) {
      console.warn('Coinbase Exchange API: No candles returned', {
        url: url.toString(),
        currency: 'USD',
        granularity,
        start: start?.toISOString(),
        end: end?.toISOString()
      });
      return [];
    }

    // Convert array format [timestamp, low, high, open, close, volume] to object format
    // Note: API returns data in reverse chronological order (newest first)
    const candles = data
      .map(candle => {
        if (!Array.isArray(candle) || candle.length < 6) {
          console.warn('Invalid candle format:', candle);
          return null;
        }
        return {
          time: new Date(candle[0] * 1000), // timestamp in seconds, convert to milliseconds
          low: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          open: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        };
      })
      .filter(c => c !== null) // Remove any invalid candles
      .reverse(); // Reverse to chronological order (oldest first)

    return candles;
  }

  /**
   * Aggregate smaller candles into larger candles
   * @param {Array} candles - Array of candle objects
   * @param {number} aggregationFactor - How many candles to aggregate (e.g., 2 = combine every 2 candles)
   * @returns {Array} Aggregated candles
   */
  aggregateCandles(candles, aggregationFactor) {
    if (!candles || candles.length === 0) {
      return [];
    }

    const aggregated = [];
    
    for (let i = 0; i < candles.length; i += aggregationFactor) {
      const group = candles.slice(i, i + aggregationFactor);
      
      if (group.length === 0) continue;

      const aggregatedCandle = {
        time: group[0].time, // Use the first candle's time as the start time
        open: group[0].open,
        close: group[group.length - 1].close,
        high: Math.max(...group.map(c => c.high)),
        low: Math.min(...group.map(c => c.low)),
        volume: group.reduce((sum, c) => sum + c.volume, 0)
      };

      aggregated.push(aggregatedCandle);
    }

    return aggregated;
  }

  /**
   * Convert candles from USD to another currency using ECB exchange rates
   * @param {Array} usdCandles - Candles in USD
   * @param {string} targetCurrency - Target currency to convert to
   * @param {Date} startDate - Start date of the candle data
   * @param {Date} endDate - End date of the candle data
   * @returns {Promise<Array>} Converted candles in target currency
   */
  async convertCandlesFromUsd(usdCandles, targetCurrency, startDate, endDate) {
    if (!usdCandles || usdCandles.length === 0) {
      return [];
    }

    try {
      // Get exchange rate from ECB (USD to target currency)
      // Note: ECB uses USD as base, so for USD->EUR we query USD/EUR
      const ecbData = await ecbApi.getExchangeRate('USD', targetCurrency, startDate, endDate);
      
      if (!ecbData.rate || ecbData.rate === null) {
        console.warn(`ECB: No exchange rate available for USD->${targetCurrency}, using latest rate`);
        // Try to get latest rate without date range
        const latestRate = await ecbApi.getLatestRate('USD', targetCurrency);
        if (!latestRate || latestRate === null) {
          throw new Error(`No exchange rate available for USD->${targetCurrency}`);
        }
        // Use the latest rate for all candles
        return usdCandles.map(candle => ({
          ...candle,
          open: candle.open * latestRate,
          high: candle.high * latestRate,
          low: candle.low * latestRate,
          close: candle.close * latestRate,
          volume: candle.volume * latestRate
        }));
      }

      // If we have historical rates, use them; otherwise use latest rate for all
      const exchangeRate = ecbData.rate;
      
      console.log(`Converting ${usdCandles.length} candles from USD to ${targetCurrency} using rate: ${exchangeRate}`);
      
      // Convert all candle prices using the exchange rate
      return usdCandles.map(candle => ({
        ...candle,
        open: candle.open * exchangeRate,
        high: candle.high * exchangeRate,
        low: candle.low * exchangeRate,
        close: candle.close * exchangeRate,
        volume: candle.volume * exchangeRate
      }));
    } catch (error) {
      console.error('Error converting candles from USD:', {
        targetCurrency,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get candles for a specific time window
   * Always uses BTC-USD from Coinbase and converts via ECB for non-USD currencies
   * @param {string} currency - The currency code
   * @param {string} timeWindow - Time window: '1h', '24h', '7d', '30d', or '1y'
   * @returns {Promise<Array>} Promise that resolves to array of candle data
   */
  async getBtcCandlesForTimeWindow(currency = 'USD', timeWindow = '24h') {
    const now = new Date();
    let granularity;
    let start;
    let usdCandles;

    // Always fetch USD candles first
    switch (timeWindow) {
      case '1h':
        // 5-minute candles for 1h view = 12 candles
        granularity = 300; // 5 minutes
        start = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        usdCandles = await this.getBtcCandles('USD', granularity, start, now);
        break;

      case '24h':
        // 1-hour candles, then aggregate to 2-hour candles = 12 candles
        granularity = 3600; // 1 hour
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        const hourlyCandles = await this.getBtcCandles('USD', granularity, start, now);
        usdCandles = this.aggregateCandles(hourlyCandles, 2); // Aggregate every 2 hours
        break;

      case '7d':
        // 1-day candles for 7-day view = 7 candles
        granularity = 86400; // 1 day (86400 seconds)
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        usdCandles = await this.getBtcCandles('USD', granularity, start, now);
        break;

      case '30d':
        // 1-day candles, then aggregate to 2-day candles = 15 candles
        granularity = 86400; // 1 day
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const dailyCandles30d = await this.getBtcCandles('USD', granularity, start, now);
        usdCandles = this.aggregateCandles(dailyCandles30d, 2); // Aggregate every 2 days
        break;

      case '1y':
        // 1-day candles, then aggregate to 30-day candles = 12 candles
        // Requires 2 API requests since max is 300 candles (365 days needs 2 requests)
        granularity = 86400; // 1 day
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 365 days ago
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days ago
        
        // First request: 180 days ago to 6 months ago (approximately 180 candles)
        const firstHalf = await this.getBtcCandles('USD', granularity, oneYearAgo, sixMonthsAgo);
        
        // Second request: 6 months ago to now (approximately 185 candles)
        const secondHalf = await this.getBtcCandles('USD', granularity, sixMonthsAgo, now);
        
        // Combine both halves and aggregate every 30 days (approximately 12 candles for 365 days)
        const allDailyCandles1y = [...firstHalf, ...secondHalf];
        usdCandles = this.aggregateCandles(allDailyCandles1y, 30);
        start = oneYearAgo; // For conversion, use the full range
        break;

      default:
        throw new Error(`Unsupported time window: ${timeWindow}`);
    }

    // Special case for USD - return directly without conversion
    if (currency.toUpperCase() === 'USD') {
      return usdCandles;
    }

    // For all other currencies: convert via ECB
    return await this.convertCandlesFromUsd(usdCandles, currency, start, now);
  }
}

// Export a singleton instance
export default new CoinbaseApi();


