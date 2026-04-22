/**
 * compare.js — Run all 6 strategies on a symbol and rank by Sharpe ratio.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { getOhlcvBars } from './data_source.js';
import { runBacktest } from './engine.js';
import { computeMetrics } from './metrics.js';
import * as rsi from './strategies/rsi.js';
import * as bollinger from './strategies/bollinger.js';
import * as macd from './strategies/macd.js';
import * as emaCross from './strategies/ema_cross.js';
import * as supertrend from './strategies/supertrend.js';
import * as donchian from './strategies/donchian.js';

const ALL_STRATEGIES = [rsi, bollinger, macd, emaCross, supertrend, donchian];

/**
 * Run a single strategy and return metrics + metadata.
 * @param {object} strat  strategy module
 * @param {Array} bars    OHLCV bars
 * @param {number} initialCapital
 * @returns {object}
 */
export function runStrategy(strat, bars, initialCapital = 10_000) {
  const signals = strat.generateSignals(bars);
  const result = runBacktest({ bars, signalFn: () => signals, initialCapital });
  const metrics = computeMetrics(result);
  return {
    strategy: strat.NAME,
    description: strat.DESCRIPTION,
    ...metrics,
  };
}

/**
 * Compare all 6 strategies on the same symbol/timeframe.
 *
 * @param {object} params
 * @param {string} params.symbol
 * @param {string} [params.timeframe]     default '1D'
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @param {number} [params.initialCapital]
 * @param {string} [params.source]        'auto' | 'cdp' | 'yahoo'
 * @returns {Promise<object>}
 */
export async function compareStrategies({
  symbol,
  timeframe = '1D',
  startDate,
  endDate,
  initialCapital = 10_000,
  source = 'auto',
}) {
  const { bars, source: actualSource } = await getOhlcvBars({
    symbol, timeframe, startDate, endDate, source,
  });

  if (!bars || bars.length < 30) {
    throw new Error(`Insufficient data for comparison: got ${bars?.length ?? 0} bars (need ≥ 30)`);
  }

  const results = ALL_STRATEGIES.map(strat => {
    try {
      return runStrategy(strat, bars, initialCapital);
    } catch (err) {
      return { strategy: strat.NAME, error: err.message };
    }
  });

  // Rank by Sharpe ratio (descending), errors last
  results.sort((a, b) => {
    if (a.error && b.error) return 0;
    if (a.error) return 1;
    if (b.error) return -1;
    return (b.sharpe ?? -Infinity) - (a.sharpe ?? -Infinity);
  });

  return {
    symbol,
    timeframe,
    data_source: actualSource,
    bar_count: bars.length,
    initial_capital: initialCapital,
    rankings: results.map((r, i) => ({ rank: i + 1, ...r })),
  };
}
