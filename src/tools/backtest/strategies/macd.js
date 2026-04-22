/**
 * strategies/macd.js — MACD crossover strategy.
 * Long when MACD line crosses above signal line, exit when crosses below.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MACD } = require('technicalindicators');

export const NAME = 'MACD';
export const DESCRIPTION = 'MACD crossover: long when MACD crosses above signal, exit on cross below';

export const DEFAULTS = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
};

/**
 * @param {Array<{close: number}>} bars
 * @param {object} [params]
 * @returns {number[]}
 */
export function generateSignals(bars, params = {}) {
  const {
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
  } = params;

  const closes = bars.map(b => b.close);
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const offset = bars.length - macdValues.length;
  const signals = new Array(bars.length).fill(0);

  let position = 0;
  let prevMacd = null;
  let prevSignal = null;

  for (let i = 0; i < macdValues.length; i++) {
    const { MACD: macdLine, signal } = macdValues[i];
    if (macdLine == null || signal == null) {
      signals[offset + i] = position;
      continue;
    }

    // Cross up: MACD was below signal, now above
    if (prevMacd !== null && prevMacd < prevSignal && macdLine > signal) {
      position = 1;
    }
    // Cross down: MACD was above signal, now below
    else if (prevMacd !== null && prevMacd > prevSignal && macdLine < signal) {
      position = 0;
    }

    signals[offset + i] = position;
    prevMacd = macdLine;
    prevSignal = signal;
  }

  return signals;
}
