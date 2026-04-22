/**
 * strategies/bollinger.js — Bollinger Bands mean-reversion strategy.
 * Buy when price closes below lower band, exit when price closes above upper band.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BollingerBands } = require('technicalindicators');

export const NAME = 'BollingerBands';
export const DESCRIPTION = 'Bollinger Bands mean-reversion: long below lower band, exit above upper band';

export const DEFAULTS = {
  period: 20,
  stdDev: 2,
};

/**
 * @param {Array<{close: number}>} bars
 * @param {object} [params]
 * @returns {number[]}
 */
export function generateSignals(bars, params = {}) {
  const { period = 20, stdDev = 2 } = params;
  const closes = bars.map(b => b.close);

  const bbValues = BollingerBands.calculate({
    values: closes,
    period,
    stdDev,
  });

  const offset = bars.length - bbValues.length;
  const signals = new Array(bars.length).fill(0);

  let position = 0;
  for (let i = 0; i < bbValues.length; i++) {
    const { lower, upper } = bbValues[i];
    const price = closes[offset + i];

    if (position === 0 && price < lower) {
      position = 1;
    } else if (position === 1 && price > upper) {
      position = 0;
    }
    signals[offset + i] = position;
  }

  return signals;
}
