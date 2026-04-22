/**
 * strategies/donchian.js — Donchian Channel breakout strategy.
 * Long on breakout above upper channel, exit on close below lower channel.
 *
 * Donchian Channel is not in technicalindicators — inlined here (~15 LOC core).
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

export const NAME = 'DonchianChannel';
export const DESCRIPTION = 'Donchian Channel breakout: long above upper channel, exit below lower';

export const DEFAULTS = {
  period: 20,
};

/**
 * Inline Donchian Channel calculation (~15 LOC core).
 * @param {Array<{high, low}>} bars
 * @param {number} period
 * @returns {{ upper: number[], lower: number[] }} — same length as bars, NaN for warmup
 */
function calcDonchian(bars, period = 20) {
  const upper = new Array(bars.length).fill(NaN);
  const lower = new Array(bars.length).fill(NaN);

  for (let i = period; i < bars.length; i++) {
    let hi = -Infinity, lo = Infinity;
    // Use previous `period` bars (not current bar) to avoid lookahead
    for (let j = i - period; j < i; j++) {
      if (bars[j].high > hi) hi = bars[j].high;
      if (bars[j].low < lo) lo = bars[j].low;
    }
    upper[i] = hi;
    lower[i] = lo;
  }

  return { upper, lower };
}

/**
 * @param {Array<{high, low, close}>} bars
 * @param {object} [params]
 * @returns {number[]}
 */
export function generateSignals(bars, params = {}) {
  const { period = 20 } = params;
  const { upper, lower } = calcDonchian(bars, period);
  const signals = new Array(bars.length).fill(0);

  let position = 0;
  for (let i = period; i < bars.length; i++) {
    if (isNaN(upper[i])) { signals[i] = 0; continue; }
    const price = bars[i].close;
    if (position === 0 && price >= upper[i]) {
      position = 1;  // breakout long
    } else if (position === 1 && price <= lower[i]) {
      position = 0;  // exit
    }
    signals[i] = position;
  }

  return signals;
}
