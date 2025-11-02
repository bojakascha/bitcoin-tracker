/**
 * Helper script to generate a list of ECB currencies that actually have data
 * Run this script when needed to update the currency list
 * 
 * Usage in browser console:
 *   import('./utils/generateEcbCurrencyList.js').then(m => m.generateCurrencyList())
 * 
 * Or add to package.json script and run: npm run generate-ecb-currencies
 */

import ecbApi from '../services/ecbApi.js';

// Common currencies that ECB typically supports
// This is a comprehensive list - the script will test which ones actually have data
const POTENTIAL_ECB_CURRENCIES = [
  'USD', 'JPY', 'BGN', 'CZK', 'DKK', 'GBP', 'HUF', 'PLN', 'RON', 'SEK',
  'CHF', 'ISK', 'NOK', 'HRK', 'RUB', 'TRY', 'AUD', 'BRL', 'CAD', 'CNY',
  'HKD', 'IDR', 'ILS', 'INR', 'KRW', 'MXN', 'MYR', 'NZD', 'PHP', 'SGD',
  'THB', 'ZAR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP',
  'EGP', 'TND', 'DZD', 'MAD', 'NGN', 'GHS', 'KES', 'BAM', 'UAH', 'BYN',
  'MDL', 'GEL', 'AMD', 'AZN', 'KZT', 'UZS', 'MNT', 'VND', 'KHR', 'BDT',
  'PKR', 'LKR', 'NPR', 'XCD', 'AWG', 'SRD', 'GYD', 'TTD', 'BSD', 'JMD',
  'KYD', 'DOP', 'HTG', 'COP', 'PAB', 'NIO', 'CRC', 'GTQ', 'HNL', 'PEN',
  'BOB', 'PYG', 'UYU', 'CLP', 'ARS', 'VES'
];

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Test if a currency has data available in ECB for the last 7 days
 * @param {string} currency - Currency code to test
 * @returns {Promise<{currency: string, hasData: boolean}>}
 */
async function testCurrency(currency) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    
    // Try to get EUR->currency rate (which internally fetches currency->EUR from ECB)
    const rate = await ecbApi._getEurToCurrencyRate(
      currency,
      formatDate(startDate),
      formatDate(endDate)
    );
    
    if (rate && !isNaN(rate) && rate > 0) {
      console.log(`✓ ${currency} - Has data (rate: ${rate.toFixed(4)})`);
      return { currency, hasData: true };
    } else {
      console.log(`✗ ${currency} - No data or invalid rate`);
      return { currency, hasData: false };
    }
  } catch (error) {
    console.log(`✗ ${currency} - Error: ${error.message}`);
    return { currency, hasData: false };
  }
}

/**
 * Generate list of currencies with data
 * @returns {Promise<Array>} Array of currency codes that have data
 */
async function generateCurrencyList() {
  console.log('Testing ECB currencies for data availability (last 7 days)...\n');
  
  const results = [];
  const currenciesWithData = [];
  
  // Test each currency
  for (const currency of POTENTIAL_ECB_CURRENCIES) {
    // Skip duplicates (clean the list first)
    if (currenciesWithData.includes(currency)) continue;
    
    const result = await testCurrency(currency);
    results.push(result);
    
    if (result.hasData) {
      currenciesWithData.push(currency);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Sort alphabetically
  currenciesWithData.sort();
  
  console.log(`\n=== Results ===`);
  console.log(`Total currencies tested: ${POTENTIAL_ECB_CURRENCIES.length}`);
  console.log(`Currencies with data: ${currenciesWithData.length}`);
  console.log(`\nCurrencies with data:\n${JSON.stringify(currenciesWithData, null, 2)}`);
  
  // Generate the currency list with names
  const currencyList = currenciesWithData.map(code => ({
    id: code,
    name: getCurrencyName(code)
  }));
  
  console.log(`\n=== Formatted Currency List ===`);
  console.log(JSON.stringify(currencyList, null, 2));
  
  return currencyList;
}

/**
 * Get currency name from code
 * @param {string} code - Currency code
 * @returns {string} Currency name
 */
function getCurrencyName(code) {
  const names = {
    'USD': 'United States Dollar',
    'EUR': 'Euro',
    'GBP': 'British Pound',
    'JPY': 'Japanese Yen',
    'CAD': 'Canadian Dollar',
    'AUD': 'Australian Dollar',
    'CHF': 'Swiss Franc',
    'CNY': 'Chinese Yuan',
    'SEK': 'Swedish Krona',
    'NOK': 'Norwegian Krone',
    'DKK': 'Danish Krone',
    'PLN': 'Polish Zloty',
    'HUF': 'Hungarian Forint',
    'CZK': 'Czech Koruna',
    'RUB': 'Russian Ruble',
    'TRY': 'Turkish Lira',
    'BRL': 'Brazilian Real',
    'INR': 'Indian Rupee',
    'KRW': 'South Korean Won',
    'MXN': 'Mexican Peso',
    'ZAR': 'South African Rand',
    'SGD': 'Singapore Dollar',
    'HKD': 'Hong Kong Dollar',
    'NZD': 'New Zealand Dollar',
    'THB': 'Thai Baht',
    'ILS': 'Israeli Shekel',
    'AED': 'United Arab Emirates Dirham',
    'SAR': 'Saudi Riyal',
    // Add more as needed
  };
  
  return names[code] || `${code} Currency`;
}

export { generateCurrencyList, testCurrency, POTENTIAL_ECB_CURRENCIES };

