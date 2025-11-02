# ECB Currency List Generator

This utility generates a tested list of currencies that actually have exchange rate data available from ECB.

## How to Use

### Option 1: Browser Console (Easiest)

1. Start your dev server: `npm run dev`
2. Open your app in the browser
3. Open the browser console (F12)
4. Run:

```javascript
import('./utils/generateEcbCurrencyList.js').then(async (module) => {
  const list = await module.generateCurrencyList();
  console.log('\n=== Copy this to ecbCurrencies.js ===');
  console.log(`export const ECB_CURRENCIES = ${JSON.stringify(list, null, 2)};`);
});
```

5. Copy the output and paste it into `src/utils/ecbCurrencies.js`

### Option 2: Add a Test Button (Temporary)

Add a temporary button in your app during development:

```jsx
// In App.jsx, add temporarily:
<button onClick={async () => {
  const { generateCurrencyList } = await import('./utils/generateEcbCurrencyList.js');
  const list = await generateCurrencyList();
  console.log(`export const ECB_CURRENCIES = ${JSON.stringify(list, null, 2)};`);
}}>Generate ECB Currencies</button>
```

## What It Does

1. Tests each currency in `POTENTIAL_ECB_CURRENCIES` list
2. For each currency, tries to fetch the last 7 days of exchange rate data from ECB
3. If data is available, includes it in the final list
4. If no data is found, excludes it
5. Returns a formatted list with currency codes and names

## Notes

- The script includes a 100ms delay between requests to avoid rate limiting
- Testing all currencies takes a few minutes
- Only currencies with actual data in the last 7 days are included
- The generated list is sorted alphabetically

