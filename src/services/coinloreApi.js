/**
 * CoinLore API Service
 * Handles API calls to CoinLore Public API for cryptocurrency market data
 * CoinLore provides volume, market cap, and market data
 */
class CoinLoreApi {
  constructor() {
    this.baseUrl = 'https://api.coinlore.net/api';
    this.bitcoinId = 90; // Bitcoin's ID in CoinLore
  }

  /**
   * Get current market data for Bitcoin including market cap and 24h volume
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR', 'GBP')
   * Note: CoinLore returns USD by default, we'll convert for other currencies
   * @returns {Promise<Object>} Promise that resolves to an object with price, market cap, volume, and 24h change
   */
  async getBtcMarketData(currency = 'USD') {
    const url = `${this.baseUrl}/ticker/?id=${this.bitcoinId}`;
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response body');
        console.error(`CoinLore API Error [${response.status}]:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0 || !data[0]) {
        console.error('CoinLore API: Invalid response format', {
          url,
          response: data
        });
        throw new Error('Invalid response format from API');
      }

      const btc = data[0];
      
      // CoinLore returns USD values, convert to target currency if needed
      let exchangeRate = 1;
      if (currency.toUpperCase() !== 'USD') {
        try {
          exchangeRate = await this.getExchangeRate(currency);
        } catch (err) {
          console.warn('Failed to get exchange rate, using USD:', err.message);
        }
      }

      // Log available fields for debugging
      console.log('CoinLore API response fields:', Object.keys(btc));

      return {
        price: parseFloat(btc.price_usd) * exchangeRate,
        marketCap: parseFloat(btc.market_cap_usd) * exchangeRate,
        volume24h: parseFloat(btc.volume24) * exchangeRate,
        change24h: parseFloat(btc.percent_change_24h) || 0,
        change1h: btc.percent_change_1h ? parseFloat(btc.percent_change_1h) : null,
        change7d: btc.percent_change_7d ? parseFloat(btc.percent_change_7d) : null,
        currency: currency.toUpperCase()
      };
    } catch (error) {
      console.error('Error fetching BTC market data from CoinLore:', {
        url,
        currency,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get exchange rate for a currency to USD using Coinbase API
   * @param {string} currency - The currency code (e.g., 'EUR', 'GBP')
   * @returns {Promise<number>} Exchange rate (e.g., for EUR returns 0.92 means 1 USD = 0.92 EUR)
   */
  async getExchangeRate(currency) {
    try {
      // Use Coinbase API to get USD price in the target currency
      const response = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${currency.toUpperCase()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rate: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data.rates || !data.data.rates.USD) {
        throw new Error('Invalid exchange rate response');
      }

      // rates.USD gives us how many USD = 1 unit of target currency
      // We need the inverse: how many target currency = 1 USD
      const usdRate = parseFloat(data.data.rates.USD);
      return 1 / usdRate;
    } catch (error) {
      console.warn(`Failed to fetch exchange rate for ${currency}, using USD:`, error.message);
      // Fallback: return 1 (use USD values)
      return 1;
    }
  }

  /**
   * Get historical data for Bitcoin price
   * Note: CoinLore doesn't have a standard historical endpoint, so we'll calculate trends from current data
   * For more detailed historical data, we may need to use a different approach
   * @param {string} currency - The currency code
   * @param {number} days - Number of days of historical data requested
   * @returns {Promise<Array>} Promise that resolves to an array of price data points
   */
  async getBtcHistory(currency = 'USD', days = 7) {
    // CoinLore doesn't provide historical price endpoints
    // We'll return a limited array or use current data
    // For now, return an empty array and handle trend calculation differently
    console.warn('CoinLore API does not provide historical price data endpoints');
    return [];
  }

  /**
   * Get price change percentage for different time periods
   * CoinLore provides: percent_change_1h, percent_change_24h, percent_change_7d
   * For 30d and 1y, we cannot calculate without historical data
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR', 'GBP')
   * @returns {Promise<Object>} Promise that resolves to an object with price changes for different periods
   */
  async getBtcPriceChanges(currency = 'USD') {
    try {
      // Get current market data which includes change1h, change24h, change7d if available
      const marketData = await this.getBtcMarketData(currency);

      // CoinLore provides 1h, 24h, and 7d changes directly from the ticker endpoint
      // For 30d and 1y, we cannot calculate without historical data
      return {
        '1h': marketData.change1h,
        '24h': marketData.change24h,
        '7d': marketData.change7d,
        '30d': null, // Not available from CoinLore API
        '1y': null // Not available from CoinLore API
      };
    } catch (error) {
      console.error('Error fetching BTC price changes from CoinLore:', {
        currency,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Export a singleton instance
export default new CoinLoreApi();

