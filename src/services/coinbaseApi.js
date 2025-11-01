/**
 * Coinbase API Service
 * Handles API calls to Coinbase Public API for cryptocurrency data
 */
class CoinbaseApi {
  constructor() {
    this.baseUrl = 'https://api.coinbase.com/v2';
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
}

// Export a singleton instance
export default new CoinbaseApi();

