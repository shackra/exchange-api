# exchange-api

Fork of [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) with an accurate Costa Rican Colon (CRC) exchange rate sourced directly from the [Banco Central de Costa Rica (BCCR)](https://gee.bccr.fi.cr/IndicadoresEconomicos/Cuadros/frmConsultaTCVentanilla.aspx).

[![Publish-Currencies](https://github.com/shackra/exchange-api/actions/workflows/run.yml/badge.svg)](https://github.com/shackra/exchange-api/actions/workflows/run.yml)

## Why this fork?

The upstream exchange-api provides exchange rates for 200+ currencies, but its CRC value comes from generic aggregator sources that often differ significantly from what Costa Rican financial entities actually report. This fork replaces the CRC rate with the **buy price from ARI Casa de Cambio Internacional S.A.**, as published on the BCCR's official ventanilla page.

Everything else (all other currencies, crypto, metals) remains identical to the upstream.

## How it works

A daily GitHub Actions cron job:

1. Downloads the latest EUR-based rates from the upstream [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api)
2. Scrapes the BCCR ventanilla page using Playwright to get the CRC/USD buy rate from ARI Casa de Cambio Internacional S.A.
3. Overrides the CRC value and regenerates all cross-rate JSON files
4. Publishes to npm and Cloudflare Pages

If the BCCR scrape fails, the upstream CRC value is kept as a fallback.

## Usage

### URL structure

```
https://cdn.jsdelivr.net/npm/@shackra/exchange-api@{date}/{apiVersion}/{endpoint}
```

`date` should be `latest` or `YYYY-MM-DD` format.

### Endpoints

List all available currencies:

```
https://cdn.jsdelivr.net/npm/@shackra/exchange-api@latest/v1/currencies.json
```

Get rates with USD as base currency:

```
https://cdn.jsdelivr.net/npm/@shackra/exchange-api@latest/v1/currencies/usd.json
```

Get rates with CRC as base currency:

```
https://cdn.jsdelivr.net/npm/@shackra/exchange-api@latest/v1/currencies/crc.json
```

Each endpoint is available in prettified (`.json`) and minified (`.min.json`) formats.

## Local development

This project includes a `flake.nix` for NixOS users. Since Playwright downloads its own Firefox binary, a FHS environment is needed:

```bash
# Enter the FHS chroot where Playwright works
nix run .#fhs

# Then inside:
npm install
npx playwright install firefox
node currscript.js
```

On non-NixOS systems, just run directly:

```bash
npm install
npx playwright install --with-deps firefox
node currscript.js
```

## License

[MIT](LICENSE)
