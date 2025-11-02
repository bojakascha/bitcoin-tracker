/**
 * Node.js script to generate ECB currency list during build
 * Run with: node scripts/generate-ecb-currencies.js
 * Or set UPDATE_ECB_CURRENCIES=true npm run build
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Currency names mapping
const CURRENCY_NAMES = {
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
  'RON': 'Romanian Leu',
  'BGN': 'Bulgarian Lev',
  'HRK': 'Croatian Kuna',
  'IDR': 'Indonesian Rupiah',
  'PHP': 'Philippine Peso',
  'MYR': 'Malaysian Ringgit',
  'ISK': 'Icelandic Krona',
  'QAR': 'Qatari Riyal',
  'KWD': 'Kuwaiti Dinar',
  'BHD': 'Bahraini Dinar',
  'OMR': 'Omani Rial',
  'JOD': 'Jordanian Dinar',
};

// Common currencies that ECB typically supports
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
 */
async function testCurrency(currency) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const baseUrl = 'https://data-api.ecb.europa.eu/service/data/EXR';
    const url = new URL(`${baseUrl}/D.${currency}.EUR.SP00.A`);
    url.searchParams.append('startPeriod', formatDate(startDate));
    url.searchParams.append('endPeriod', formatDate(endDate));
    url.searchParams.append('detail', 'dataonly');
    url.searchParams.append('format', 'jsondata');
    
    // Add timeout to prevent hanging (10 seconds per request)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url.toString(), { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { currency, hasData: false };
    }
    
    const responseText = await response.text();
    
    if (!responseText || responseText.trim().length === 0) {
      return { currency, hasData: false };
    }
    
    const data = JSON.parse(responseText);
    
    if (!data || !data.dataSets || !Array.isArray(data.dataSets) || data.dataSets.length === 0) {
      return { currency, hasData: false };
    }
    
    const dataSet = data.dataSets[0];
    
    if (!dataSet.series || Object.keys(dataSet.series).length === 0) {
      return { currency, hasData: false };
    }
    
    const seriesKey = Object.keys(dataSet.series)[0];
    const series = dataSet.series[seriesKey];
    const observations = series.observations || {};
    const observationKeys = Object.keys(observations).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (observationKeys.length === 0) {
      return { currency, hasData: false };
    }
    
    // Get the most recent rate
    const latestKey = observationKeys[observationKeys.length - 1];
    const currencyPerEur = parseFloat(observations[latestKey][0]);
    
    if (currencyPerEur && !isNaN(currencyPerEur) && currencyPerEur > 0) {
      console.log(`✓ ${currency} - Has data (rate: ${currencyPerEur.toFixed(4)})`);
      return { currency, hasData: true };
    }
    
    return { currency, hasData: false };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`✗ ${currency} - Timeout (ECB API too slow)`);
    } else {
      console.log(`✗ ${currency} - Error: ${error.message}`);
    }
    return { currency, hasData: false };
  }
}

/**
 * Get currency name from code
 */
function getCurrencyName(code) {
  return CURRENCY_NAMES[code] || `${code} Currency`;
}

/**
 * Generate currency list
 */
async function generateCurrencyList() {
  console.log('Testing ECB currencies for data availability (last 7 days)...\n');
  
  const currenciesWithData = [];
  const seen = new Set();
  const total = POTENTIAL_ECB_CURRENCIES.length;
  let current = 0;
  
  for (const currency of POTENTIAL_ECB_CURRENCIES) {
    if (seen.has(currency)) continue;
    seen.add(currency);
    
    current++;
    if (current % 10 === 0) {
      console.log(`Progress: ${current}/${total} currencies tested...`);
    }
    
    const result = await testCurrency(currency);
    
    if (result.hasData) {
      currenciesWithData.push(currency);
    }
    
    // Small delay to avoid rate limiting (reduced for faster builds)
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  currenciesWithData.sort();
  
  console.log(`\n=== Results ===`);
  console.log(`Total currencies tested: ${POTENTIAL_ECB_CURRENCIES.length}`);
  console.log(`Currencies with data: ${currenciesWithData.length}`);
  
  const currencyList = currenciesWithData.map(code => ({
    id: code,
    name: getCurrencyName(code)
  }));
  
  return currencyList;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if we should skip generation (e.g., in CI/CD where we want fast builds)
    if (process.env.SKIP_ECB_GENERATION === 'true') {
      console.log('Skipping ECB currency generation (SKIP_ECB_GENERATION=true)');
      process.exit(0);
    }
    
    const list = await generateCurrencyList();
    
    // If we got no currencies, don't overwrite the existing file
    if (list.length === 0) {
      console.warn('\n⚠ Warning: No currencies found with data. Keeping existing list.');
      process.exit(0);
    }
    
    const fileContent = `/**
 * Static list of ECB currencies that have actual exchange rate data
 * Generated automatically during build (run: node scripts/generate-ecb-currencies.js)
 * Last updated: ${new Date().toISOString()}
 */

export const ECB_CURRENCIES = ${JSON.stringify(list, null, 2)};
`;
    
    const outputPath = join(__dirname, '..', 'src', 'utils', 'ecbCurrencies.js');
    writeFileSync(outputPath, fileContent, 'utf8');
    
    console.log(`\n✓ Successfully generated currency list with ${list.length} currencies`);
    console.log(`  Written to: ${outputPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error generating currency list:', error.message);
    console.error('  The build will continue using the existing currency list.');
    console.error('  To skip this step in CI/CD, set SKIP_ECB_GENERATION=true');
    // Don't fail the build - exit with 0 so build continues
    process.exit(0);
  }
}

main();

