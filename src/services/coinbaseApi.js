/**
 * Coinbase API Service
 * Handles API calls to Coinbase Public API for cryptocurrency data
 */
class CoinbaseApi {
  constructor() {
    this.baseUrl = 'https://api.coinbase.com/v2';
    this.exchangeUrl = 'https://api.exchange.coinbase.com';
  }

  /**
   * Get the current spot price of BTC for a selected currency
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY', 'CAD')
   * @returns {Promise<Object>} Promise that resolves to an object with price data
   * @throws {Error} If the API request fails or returns an error
   */
  async getBtcSpotPrice(currency = 'USD') {
    const url = `${this.baseUrl}/prices/BTC-${currency.toUpperCase()}/spot`;
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

      if (!data.data || !data.data.amount) {
        console.error('Coinbase API: Invalid response format', {
          url,
          response: data
        });
        throw new Error('Invalid response format from API');
      }

      return {
        amount: parseFloat(data.data.amount),
        currency: data.data.currency,
        base: 'BTC',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching BTC spot price from Coinbase:', {
        url,
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
   * Get candlestick data (OHLC) for BTC from Coinbase Exchange API
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR', 'GBP')
   * @param {number} granularity - Granularity in seconds (60, 300, 900, 3600, 21600, 86400)
   * @param {Date} start - Start time (optional)
   * @param {Date} end - End time (optional)
   * @returns {Promise<Array>} Promise that resolves to array of candle data: [{time, low, high, open, close, volume}, ...]
   */
  async getBtcCandles(currency = 'USD', granularity = 3600, start = null, end = null) {
    const productId = `BTC-${currency.toUpperCase()}`;
    const url = new URL(`${this.exchangeUrl}/products/${productId}/candles`);
    
    // Add granularity (required)
    url.searchParams.append('granularity', granularity.toString());
    
    // Add start and end times if provided
    // Coinbase Exchange API expects Unix timestamps in seconds (not ISO strings)
    if (start && end) {
      url.searchParams.append('start', Math.floor(start.getTime() / 1000).toString());
      url.searchParams.append('end', Math.floor(end.getTime() / 1000).toString());
    }

    try {
      // Log the URL being called for debugging
      console.log('Coinbase Exchange API request:', {
        url: url.toString(),
        currency,
        granularity,
        start: start?.toISOString(),
        end: end?.toISOString(),
        startUnix: start ? Math.floor(start.getTime() / 1000) : null,
        endUnix: end ? Math.floor(end.getTime() / 1000) : null
      });

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
      console.log(`Coinbase Exchange API: Received ${data.length} candles for ${currency}, granularity ${granularity}s`);

      if (data.length === 0) {
        console.warn('Coinbase Exchange API: No candles returned', {
          url: url.toString(),
          currency,
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
    } catch (error) {
      console.error('Error fetching BTC candles from Coinbase Exchange:', {
        url: url.toString(),
        currency,
        granularity,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
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
   * Get candles for a specific time window
   * @param {string} currency - The currency code
   * @param {string} timeWindow - Time window: '1h', '24h', '7d', '30d', or '1y'
   * @returns {Promise<Array>} Promise that resolves to array of candle data
   */
  async getBtcCandlesForTimeWindow(currency = 'USD', timeWindow = '24h') {
    const now = new Date();
    let granularity;
    let start;
    let candles;

    switch (timeWindow) {
      case '1h':
        // 5-minute candles for 1h view = 12 candles
        granularity = 300; // 5 minutes
        start = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        candles = await this.getBtcCandles(currency, granularity, start, now);
        break;

      case '24h':
        // 1-hour candles, then aggregate to 2-hour candles = 12 candles
        granularity = 3600; // 1 hour
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        const hourlyCandles = await this.getBtcCandles(currency, granularity, start, now);
        candles = this.aggregateCandles(hourlyCandles, 2); // Aggregate every 2 hours
        break;

      case '7d':
        // 1-day candles for 7-day view = 7 candles
        granularity = 86400; // 1 day (86400 seconds)
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        candles = await this.getBtcCandles(currency, granularity, start, now);
        break;

      case '30d':
        // 1-day candles, then aggregate to 2-day candles = 15 candles
        granularity = 86400; // 1 day
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const dailyCandles30d = await this.getBtcCandles(currency, granularity, start, now);
        candles = this.aggregateCandles(dailyCandles30d, 2); // Aggregate every 2 days
        break;

      case '1y':
        // 1-day candles, then aggregate to 30-day candles = 12 candles
        // Requires 2 API requests since max is 300 candles (365 days needs 2 requests)
        granularity = 86400; // 1 day
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 365 days ago
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days ago
        
        // First request: 180 days ago to 6 months ago (approximately 180 candles)
        const firstHalf = await this.getBtcCandles(currency, granularity, oneYearAgo, sixMonthsAgo);
        
        // Second request: 6 months ago to now (approximately 185 candles)
        const secondHalf = await this.getBtcCandles(currency, granularity, sixMonthsAgo, now);
        
        // Combine both halves
        const allDailyCandles1y = [...firstHalf, ...secondHalf];
        
        // Aggregate every 30 days (approximately 12 candles for 365 days)
        candles = this.aggregateCandles(allDailyCandles1y, 30);
        break;

      default:
        throw new Error(`Unsupported time window: ${timeWindow}`);
    }

    return candles;
  }
}

// Export a singleton instance
export default new CoinbaseApi();


