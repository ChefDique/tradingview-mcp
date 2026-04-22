/**
 * strategies/ema_cross.js — EMA crossover (golden/death cross) strategy.
 * Long when fast EMA crosses above slow EMA, exit when crosses below.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { EMA } = require('technicalindicators');

export const NAME = 'EMACross';
export const DESCRIPTION = 'EMA crossover: long when fast EMA > slow EMA, exit on cross below';

export const DEFAULTS = {
  fastPeriod: 9,
  slowPeriod: 21,
};

/**
 * @param {Array<{close: number}>} bars
 * @param {object} [params]
 * @returns {number[]}
 */
export function generateSignals(bars, params = {}) {
  const { fastPeriod = 9, slowPeriod = 21 } = params;
  const closes = bars.map(b => b.close);

  const fastEma = EMA.calculate({ values: closes, period: fastPeriod });
  const slowEma = EMA.calculate({ values: closes, period: slowPeriod });

  // Align arrays: slowEma is shorter
  const offset = bars.length - slowEma.length;
  const fastOffset = bars.length - fastEma.length;
  const signals = new Array(bars.length).fill(0);

  let position = 0;
  let prevFast = null;
  let prevSlow = null;

  for (let i = 0; i < slowEma.length; i++) {
    // fast index relative to its own offset
    const fastIdx = i + (offset - fastOffset);
    const fast = fastEma[fastIdx];
    const slow = slowEma[i];

    if (prevFast !== null) {
      if (prevFast < prevSlow && fast > slow) position = 1;   // golden cross
      else if (prevFast > prevSlow && fast < slow) position = 0;  // death cross
    }

    signals[offset + i] = position;
    prevFast = fast;
    prevSlow = slow;
  }

  return signals;
}
