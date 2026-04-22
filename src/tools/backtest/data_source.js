/**
 * data_source.js — OHLCV data fetcher: TV CDP preferred, Yahoo Finance fallback.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import YahooFinance from 'yahoo-finance2';
// yahoo-finance2 v3: must instantiate before use
const yahooFinance = new YahooFinance();

/**
 * Timeframe string → Yahoo Finance interval mapping.
 */
const TF_TO_YAHOO = {
  '1D': '1d', 'D': '1d', 'daily': '1d',
  '1W': '1wk', 'W': '1wk', 'weekly': '1wk',
  '1M': '1mo', 'M': '1mo', 'monthly': '1mo',
  '1h': '1h', '60': '1h', '60m': '1h',
  '4h': '1d', '4H': '1d',  // Yahoo doesn't have 4h; fall to 1d
  '15': '15m', '15m': '15m',
  '5': '5m', '5m': '5m',
};

/**
 * Attempt to read OHLCV via the local CDP-connected TV instance.
 * Returns null if TV is unavailable rather than throwing.
 */
async function fetchFromTV(symbol, _timeframe, count) {
  try {
    const { getOhlcv } = await import('../../core/data.js');
    const result = await getOhlcv({ count: count || 500, summary: false });
    if (!result?.bars?.length) return null;
    return result.bars.map(b => ({
      date: new Date(b.time * 1000),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  } catch {
    return null;
  }
}

/**
 * Fetch OHLCV from Yahoo Finance.
 * @param {string} symbol
 * @param {string} timeframe
 * @param {string} startDate  ISO date string, e.g. '2020-01-01'
 * @param {string} endDate    ISO date string
 * @returns {Promise<Array<{date, open, high, low, close, volume}>>}
 */
async function fetchFromYahoo(symbol, timeframe, startDate, endDate) {
  const interval = TF_TO_YAHOO[timeframe] ?? '1d';
  const period1 = startDate ? new Date(startDate) : new Date(Date.now() - 5 * 365.25 * 24 * 3600 * 1000);
  const period2 = endDate ? new Date(endDate) : new Date();

  const result = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval,
  });

  const quotes = result?.quotes ?? [];
  return quotes
    .filter(q => q.close != null)
    .map(q => ({
      date: new Date(q.date),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? 0,
    }));
}

/**
 * Get OHLCV bars for a symbol. Uses TV CDP if available, Yahoo fallback otherwise.
 *
 * @param {object} params
 * @param {string} params.symbol   e.g. 'AAPL', 'BTCUSDT'
 * @param {string} params.timeframe  '1D', '1h', '15m' etc.
 * @param {string} [params.startDate]  ISO date string
 * @param {string} [params.endDate]    ISO date string
 * @param {number} [params.count]      number of bars (TV CDP only)
 * @param {string} [params.source]     'auto' | 'cdp' | 'yahoo'  (default 'auto')
 * @returns {Promise<{ bars: Array, source: string }>}
 */
export async function getOhlcvBars({
  symbol,
  timeframe = '1D',
  startDate,
  endDate,
  count = 500,
  source = 'auto',
}) {
  if (source === 'cdp') {
    const bars = await fetchFromTV(symbol, timeframe, count);
    if (!bars) throw new Error('TV Desktop not available (CDP source forced)');
    return { bars, source: 'cdp' };
  }

  if (source === 'yahoo') {
    const bars = await fetchFromYahoo(symbol, timeframe, startDate, endDate);
    return { bars, source: 'yahoo' };
  }

  // auto: try TV first
  const tvBars = await fetchFromTV(symbol, timeframe, count);
  if (tvBars && tvBars.length >= 20) {
    return { bars: tvBars, source: 'cdp' };
  }

  // Fallback to Yahoo
  const yahooBars = await fetchFromYahoo(symbol, timeframe, startDate, endDate);
  return { bars: yahooBars, source: 'yahoo' };
}
