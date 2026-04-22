/**
 * strategies/supertrend.js — Supertrend trend-following strategy.
 * Long when price is above Supertrend line, exit when price closes below.
 *
 * Supertrend is not in technicalindicators — inlined here (~20 LOC core).
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ATR } = require('technicalindicators');

export const NAME = 'Supertrend';
export const DESCRIPTION = 'Supertrend trend-following: long above supertrend line, exit below';

export const DEFAULTS = {
  period: 7,
  multiplier: 3,
};

/**
 * Inline Supertrend calculation (~20 LOC core).
 * @param {Array<{high, low, close}>} bars
 * @param {number} period  ATR period (default 7)
 * @param {number} multiplier  ATR multiplier (default 3)
 * @returns {number[]} supertrend values (same length as bars, NaN for warmup)
 */
function calcSupertrend(bars, period = 7, multiplier = 3) {
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const closes = bars.map(b => b.close);

  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period });
  const offset = bars.length - atrValues.length;

  const st = new Array(bars.length).fill(NaN);
  let prevUpper = Infinity, prevLower = -Infinity, prevSt = NaN;

  for (let i = 0; i < atrValues.length; i++) {
    const idx = offset + i;
    const hl2 = (bars[idx].high + bars[idx].low) / 2;
    const atr = atrValues[i];
    const rawUpper = hl2 + multiplier * atr;
    const rawLower = hl2 - multiplier * atr;

    const upper = (rawUpper < prevUpper || closes[idx - 1] > prevUpper) ? rawUpper : prevUpper;
    const lower = (rawLower > prevLower || closes[idx - 1] < prevLower) ? rawLower : prevLower;

    if (isNaN(prevSt) || prevSt === prevUpper) {
      st[idx] = closes[idx] <= upper ? upper : lower;
    } else {
      st[idx] = closes[idx] >= lower ? lower : upper;
    }
    prevUpper = upper;
    prevLower = lower;
    prevSt = st[idx];
  }

  return st;
}

/**
 * @param {Array<{high, low, close}>} bars
 * @param {object} [params]
 * @returns {number[]}
 */
export function generateSignals(bars, params = {}) {
  const { period = 7, multiplier = 3 } = params;
  const stLine = calcSupertrend(bars, period, multiplier);
  const signals = new Array(bars.length).fill(0);

  let position = 0;
  for (let i = 1; i < bars.length; i++) {
    if (isNaN(stLine[i])) { signals[i] = 0; continue; }
    const price = bars[i].close;
    // Long when price > supertrend line (price above the trend support)
    if (price > stLine[i]) position = 1;
    else position = 0;
    signals[i] = position;
  }

  return signals;
}
