/**
 * strategies/rsi.js — RSI mean-reversion strategy.
 * Buy when RSI crosses below oversold threshold, sell when crosses above overbought.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { RSI } = require('technicalindicators');

export const NAME = 'RSI';
export const DESCRIPTION = 'RSI mean-reversion: long below oversold, exit above overbought';

/**
 * Default parameters matching the Python reference.
 */
export const DEFAULTS = {
  period: 14,
  oversold: 30,
  overbought: 70,
};

/**
 * Generate signals for RSI strategy.
 * @param {Array<{close: number}>} bars
 * @param {object} [params]
 * @returns {number[]}  1=long, -1=short, 0=flat
 */
export function generateSignals(bars, params = {}) {
  const { period = 14, oversold = 30, overbought = 70 } = params;

  const closes = bars.map(b => b.close);
  const rsiValues = RSI.calculate({ values: closes, period });

  // rsiValues is shorter by `period` bars
  const offset = bars.length - rsiValues.length;
  const signals = new Array(bars.length).fill(0);

  let position = 0;  // 0=flat, 1=long
  for (let i = 0; i < rsiValues.length; i++) {
    const rsi = rsiValues[i];
    if (position === 0 && rsi < oversold) {
      position = 1;
    } else if (position === 1 && rsi > overbought) {
      position = 0;
    }
    signals[offset + i] = position === 1 ? 1 : 0;
  }

  return signals;
}

/**
 * Return raw RSI values alongside bars for diagnostics.
 * @param {Array<{close: number}>} bars
 * @param {object} [params]
 * @returns {{ rsi: number[], offset: number }}
 */
export function getRsiValues(bars, params = {}) {
  const { period = 14 } = params;
  const closes = bars.map(b => b.close);
  const rsiValues = RSI.calculate({ values: closes, period });
  return { rsi: rsiValues, offset: bars.length - rsiValues.length };
}
