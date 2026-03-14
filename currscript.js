const fs = require('fs-extra')
const path = require('path')
const { firefox, devices } = require('playwright')
const semver = require('semver')

const indent = '\t'
const dateToday = new Date().toISOString().substring(0, 10)
const dateTodaySemVer = semver.clean(dateToday.replaceAll('-', '.'), true)
const pathToSkeletonPackage = path.join(__dirname, 'skeleton-package.json')
const apiVersion = 1
const rootDir = path.join(__dirname, 'package', `v${apiVersion}`)

// The upstream API from fawazahmed0/exchange-api (EUR as base currency)
const UPSTREAM_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json'
// Fallback URL in case jsDelivr is down
const UPSTREAM_API_FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies/eur.json'

// Currency name registry
let allcurr = JSON.parse(fs.readFileSync(path.join(__dirname, 'allcurrencies.min.json')).toString())
const allcurrKeyUpper = {}
for (const [key, value] of Object.entries(allcurr)) { allcurrKeyUpper[key.toUpperCase()] = value }

begin()

async function begin() {
  // 1. Download EUR-based rates from the upstream API
  console.log('Fetching upstream currency data...')
  const eurData = await fetchUpstreamData()
  if (!eurData) {
    console.error('Failed to fetch upstream data. Aborting.')
    process.exit(1)
  }

  const currJSON = eurData.eur
  console.log(`Got ${Object.keys(currJSON).length} currencies from upstream (date: ${eurData.date})`)

  // 2. Scrape the BCCR for the CRC buy rate from ARI Casa de Cambio
  console.log('Scraping BCCR for CRC exchange rate...')
  const crcPerUSD = await getBCCRExchangeRate()
  if (crcPerUSD && currJSON['usd']) {
    // Convert CRC/USD to CRC/EUR: multiply by (USD per 1 EUR)
    const crcPerEUR = crcPerUSD * currJSON['usd']
    console.log(`CRC overridden: ${currJSON['crc']} -> ${crcPerEUR} CRC per 1 EUR (BCCR buy: ${crcPerUSD} CRC/USD)`)
    currJSON['crc'] = crcPerEUR
  } else {
    console.warn('Could not get BCCR rate, keeping upstream CRC value:', currJSON['crc'])
  }

  // 3. Generate all API files
  const availCurrListObj = getAvailCurrencyJSON(currJSON)
  fs.outputFileSync(path.join(rootDir, 'currencies.min.json'), JSON.stringify(availCurrListObj))
  fs.writeFileSync(path.join(rootDir, 'currencies.json'), JSON.stringify(availCurrListObj, null, indent))

  generateFiles(currJSON)

  // 4. Write package metadata
  let barePackage = fs.readJsonSync(pathToSkeletonPackage)
  barePackage['version'] = dateTodaySemVer
  fs.writeJSONSync(path.join(rootDir, '..', 'package.json'), barePackage)
  fs.writeFileSync(path.join(rootDir, '..', 'index.js'), '')
  fs.copyFileSync(path.join(__dirname, 'country.json'), path.join(rootDir, 'country.json'))

  console.log('Done! Files generated in', rootDir)
}

// Fetch EUR-based currency data from the upstream fawazahmed0 API
async function fetchUpstreamData() {
  for (const url of [UPSTREAM_API, UPSTREAM_API_FALLBACK]) {
    try {
      console.log(`  Trying ${url}`)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (e) {
      console.warn(`  Failed: ${e.message}`)
    }
  }
  return null
}

// Scrapes the BCCR ventanilla page to get the CRC/USD buy rate from ARI Casa de Cambio Internacional S.A.
// Returns the buy price (colones per 1 USD), or null if scraping fails.
async function getBCCRExchangeRate() {
  const bcrURL = 'https://gee.bccr.fi.cr/IndicadoresEconomicos/Cuadros/frmConsultaTCVentanilla.aspx'
  const browser = await firefox.launch({ headless: true })
  try {
    const context = await browser.newContext({ ...devices['Desktop Firefox'] })
    const page = await context.newPage()

    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(bcrURL, { waitUntil: 'networkidle', timeout: 30000 })
        break
      } catch (e) {
        if (i === 2) throw e
      }
    }

    // Find the cell containing "ARI Casa de Cambio" and extract the buy (compra) value
    // Row structure: [empty] [entity name] [compra] [venta] [diferencial] [date]
    // The page has nested tables; we filter by text length to skip the wrapper cell.
    const buyRate = await page.evaluate(() => {
      const tds = document.querySelectorAll('td')
      for (const td of tds) {
        const text = td.textContent.trim()
        if (text.startsWith('ARI Casa de Cambio') && text.length < 100) {
          const row = td.parentElement
          const cells = Array.from(row.querySelectorAll(':scope > td'))
          const idx = cells.indexOf(td)
          const buyCell = cells[idx + 1]
          if (buyCell) {
            // Parse "466,06" -> 466.06
            const rawText = buyCell.textContent.trim().replace(/\./g, '').replace(',', '.')
            return parseFloat(rawText)
          }
        }
      }
      return null
    })

    if (buyRate && Number.isFinite(buyRate)) {
      console.log(`  BCCR ARI Casa de Cambio - CRC/USD buy rate: ${buyRate}`)
      return buyRate
    }

    console.error('  BCCR: Could not find ARI Casa de Cambio rate in the page')
    return null
  } catch (e) {
    console.error('  BCCR scraping failed:', e.message)
    return null
  } finally {
    await browser.close()
  }
}

// Returns all available currencies as {code: name}
function getAvailCurrencyJSON(currObj) {
  const result = {}
  for (const key of Object.keys(currObj)) {
    result[key] = allcurrKeyUpper[key.toUpperCase()] || ''
    if (!allcurrKeyUpper[key.toUpperCase()])
      console.log(key, "currency code doesn't exist in allcurrencies.min.json")
  }
  return result
}

// Generates per-currency JSON files with cross-rates
function generateFiles(eurBasedRates) {
  const currenciesDir = path.join(rootDir, 'currencies')
  fs.mkdirSync(currenciesDir, { recursive: true })

  for (const [fromKey, fromValue] of Object.entries(eurBasedRates)) {
    const tempObj = { date: dateToday }
    tempObj[fromKey] = {}

    for (const [toKey, toValue] of Object.entries(eurBasedRates))
      tempObj[fromKey][toKey] = currencyValue(fromValue, toValue)

    fs.writeFileSync(path.join(currenciesDir, fromKey + '.min.json'), JSON.stringify(tempObj))
    fs.writeFileSync(path.join(currenciesDir, fromKey + '.json'), JSON.stringify(tempObj, null, indent))
  }
}

// Compute cross-rate: 1 fromCurr = ? toCurr
function currencyValue(fromCurr, toCurr) {
  return getSignificantNum(toCurr / fromCurr)
}

function getSignificantNum(num) {
  let minSignificantDigits = 8
  if (num >= 0.1)
    return parseFloat(num.toFixed(minSignificantDigits))
  let strNum = num.toFixed(100)
  let numOfZeros = strNum.match(/^0\.0+/i)[0].length - 2
  return parseFloat(num.toFixed(minSignificantDigits + numOfZeros))
}
