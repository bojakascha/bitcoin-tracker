/**
 * ECB (European Central Bank) API Service
 * Handles API calls to ECB Data API for foreign exchange rates
 * Documentation: https://data.ecb.europa.eu/help/api/data
 */
class EcbApi {
  constructor() {
    this.baseUrl = 'https://data-api.ecb.europa.eu/service/data/EXR';
  }

  /**
   * Get exchange rate from ECB API (ECB only supports EUR as base currency)
   * For non-EUR base currencies, we convert via EUR:
   * - If base is EUR: get EUR->target directly
   * - If base is not EUR: get EUR->base and EUR->target, then calculate base->target = (EUR->target) / (EUR->base)
   * @param {string} baseCurrency - Base currency code (e.g., 'USD')
   * @param {string} targetCurrency - Target currency code (e.g., 'EUR')
   * @param {Date} startDate - Start date (optional, defaults to 30 days ago)
   * @param {Date} endDate - End date (optional, defaults to today)
   * @returns {Promise<Object>} Promise that resolves to exchange rate data
   */
  async getExchangeRate(baseCurrency, targetCurrency, startDate = null, endDate = null) {
    // Default to last 30 days if dates not provided
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    if (!endDate) {
      endDate = new Date();
    }

    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const baseUpper = baseCurrency.toUpperCase();
    const targetUpper = targetCurrency.toUpperCase();

    // ECB only supports EUR as base currency
    // If both are EUR, return 1.0
    if (baseUpper === 'EUR' && targetUpper === 'EUR') {
      return {
        rate: 1.0,
        date: endDate,
        baseCurrency: baseUpper,
        targetCurrency: targetUpper
      };
    }

    let rate, rateDate;

    // Case 1: Base is EUR - get EUR->target directly
    if (baseUpper === 'EUR') {
      rate = await this._getEurToCurrencyRate(targetUpper, formatDate(startDate), formatDate(endDate));
      rateDate = endDate;
    }
    // Case 2: Target is EUR - get EUR->base, then invert
    else if (targetUpper === 'EUR') {
      const eurToBase = await this._getEurToCurrencyRate(baseUpper, formatDate(startDate), formatDate(endDate));
      rate = 1.0 / eurToBase; // Invert to get base->EUR
      rateDate = endDate;
    }
    // Case 3: Neither is EUR - convert via EUR: (EUR->target) / (EUR->base)
    else {
      const eurToBase = await this._getEurToCurrencyRate(baseUpper, formatDate(startDate), formatDate(endDate));
      const eurToTarget = await this._getEurToCurrencyRate(targetUpper, formatDate(startDate), formatDate(endDate));
      rate = eurToTarget / eurToBase;
      rateDate = endDate;
    }

    return {
      rate,
      date: rateDate,
      baseCurrency: baseUpper,
      targetCurrency: targetUpper
    };
  }

  /**
   * Internal method to get currency->EUR rate from ECB
   * ECB format: D.{currency}.EUR means "{currency} per EUR" (how many units of currency for 1 EUR)
   * To get EUR->currency, we need to invert: EUR->currency = 1 / (currency->EUR)
   * @param {string} currency - Currency code (e.g., 'USD', 'SEK')
   * @param {string} startPeriod - Start date as YYYY-MM-DD
   * @param {string} endPeriod - End date as YYYY-MM-DD
   * @returns {Promise<number>} EUR->currency exchange rate
   * @public - Exposed for currency testing utility
   */
  async _getEurToCurrencyRate(currency, startPeriod, endPeriod) {
    // ECB API format: EXR/D.{currency}.EUR.SP00.A
    // This returns "{currency} per EUR" (e.g., D.USD.EUR returns USD per EUR)
    // SP00 = spot rate, A = average
    const url = new URL(`${this.baseUrl}/D.${currency}.EUR.SP00.A`);
    url.searchParams.append('startPeriod', startPeriod);
    url.searchParams.append('endPeriod', endPeriod);
    url.searchParams.append('detail', 'dataonly');
    url.searchParams.append('format', 'jsondata');

    const fullUrl = url.toString();

    try {
      const response = await fetch(fullUrl);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response body');
        console.error(`ECB API Error [${response.status}]:`, {
          url: fullUrl,
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ECB API request failed: ${response.status} ${response.statusText}`);
      }

      // Log response details before parsing
      
      // Check if response body is empty (ECB returns empty file when no data)
      const responseText = await response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        console.warn('ECB API: Received empty response (no data for requested period), trying fallback', {
          url: fullUrl,
          currency
        });
        return await this._getEurToCurrencyRateFallback(currency);
      }

      // Parse JSON response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('ECB API: Failed to parse JSON response', {
          url: fullUrl,
          responseText: responseText.substring(0, 200), // Log first 200 chars
          error: parseError.message
        });
        throw new Error('Invalid JSON response from ECB API');
      }

      // ECB API returns data in a specific structure
      // Check if data structure is valid
      if (!data || !data.dataSets || !Array.isArray(data.dataSets) || data.dataSets.length === 0) {
        console.warn('ECB API: Empty or invalid response format, trying fallback', {
          url: fullUrl,
          currency
        });
        return await this._getEurToCurrencyRateFallback(currency);
      }

      const dataSet = data.dataSets[0];
      const structure = data.structure;

      if (!dataSet.series || Object.keys(dataSet.series).length === 0) {
        console.warn('ECB API: No exchange rate data found for requested period, trying wider date range', {
          url: fullUrl,
          currency
        });
        // Try with a wider date range (last 90 days) to find latest available rate
        return await this._getEurToCurrencyRateFallback(currency);
      }

      // Get the first (and usually only) series
      const seriesKey = Object.keys(dataSet.series)[0];
      const series = dataSet.series[seriesKey];

      // Get observations - ECB returns observations as {key: value} where key is period index
      const observations = series.observations || {};
      const observationKeys = Object.keys(observations).sort((a, b) => parseInt(a) - parseInt(b));
      
      if (observationKeys.length === 0) {
        console.warn('ECB API: No exchange rate observations for requested period, trying wider date range', {
          url: fullUrl,
          currency
        });
        // Try with a wider date range (last 90 days) to find latest available rate
        return await this._getEurToCurrencyRateFallback(currency);
      }

      // Get the most recent exchange rate (last observation)
      const latestKey = observationKeys[observationKeys.length - 1];
      const currencyPerEur = parseFloat(observations[latestKey][0]); // First dimension value
      
      // ECB returns "{currency} per EUR" (e.g., D.USD.EUR = 1.05 means 1.05 USD = 1 EUR)
      // This IS already EUR->currency, so we use it directly (no inversion needed)
      // Example: D.USD.EUR = 1.05 means EUR->USD = 1.05 (1 EUR = 1.05 USD)
      // Example: D.SEK.EUR = 11.5 means EUR->SEK = 11.5 (1 EUR = 11.5 SEK)
      const eurToCurrency = currencyPerEur;
      

      return eurToCurrency;
    } catch (error) {
      console.error('Error fetching EUR->currency rate from ECB:', {
        currency,
        url: fullUrl,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Fallback method to get latest available EUR->currency rate with wider date range
   * Used when requested period has no data (ECB rates aren't updated daily)
   * @param {string} currency - Currency code
   * @returns {Promise<number>} Latest available exchange rate
   */
  async _getEurToCurrencyRateFallback(currency) {
    // Try with last 90 days to find latest available rate
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const url = new URL(`${this.baseUrl}/D.${currency}.EUR.SP00.A`);
    url.searchParams.append('startPeriod', formatDate(startDate));
    url.searchParams.append('endPeriod', formatDate(endDate));
    url.searchParams.append('detail', 'dataonly');
    url.searchParams.append('format', 'jsondata');

    const fullUrl = url.toString();

    try {
      const response = await fetch(fullUrl);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response body');
        console.error(`ECB API Fallback Error [${response.status}]:`, {
          url: fullUrl,
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ECB API fallback request failed: ${response.status} ${response.statusText}`);
      }

      // Check if response body is empty
      const responseText = await response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error(`No exchange rate data available for ${currency}->EUR (empty response even with 90-day range)`);
      }

      // Parse JSON response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('ECB API Fallback: Failed to parse JSON response', {
          url: fullUrl,
          responseText: responseText.substring(0, 200),
          error: parseError.message
        });
        throw new Error('Invalid JSON response from ECB API (fallback)');
      }

      if (!data || !data.dataSets || !Array.isArray(data.dataSets) || data.dataSets.length === 0) {
        throw new Error('Invalid response format from ECB API (fallback)');
      }

      const dataSet = data.dataSets[0];

      if (!dataSet.series || Object.keys(dataSet.series).length === 0) {
        throw new Error(`No exchange rate data available for ${currency}->EUR even with 90-day range`);
      }

      const seriesKey = Object.keys(dataSet.series)[0];
      const series = dataSet.series[seriesKey];
      const observations = series.observations || {};
      const observationKeys = Object.keys(observations).sort((a, b) => parseInt(a) - parseInt(b));
      
      if (observationKeys.length === 0) {
        throw new Error(`No exchange rate observations available for ${currency}->EUR even with 90-day range`);
      }

      // Get the most recent available rate
      const latestKey = observationKeys[observationKeys.length - 1];
      const currencyPerEur = parseFloat(observations[latestKey][0]);
      
      // ECB returns "{currency} per EUR" which IS already EUR->currency (no inversion needed)
      const eurToCurrency = currencyPerEur;
      

      return eurToCurrency;
    } catch (error) {
      console.error('Error in ECB API fallback:', {
        currency,
        url: fullUrl,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get the latest exchange rate (convenience method)
   * @param {string} baseCurrency - Base currency code
   * @param {string} targetCurrency - Target currency code
   * @returns {Promise<number>} Promise that resolves to exchange rate
   */
  async getLatestRate(baseCurrency, targetCurrency) {
    const data = await this.getExchangeRate(baseCurrency, targetCurrency);
    return data.rate;
  }
}

// Export a singleton instance
export default new EcbApi();

