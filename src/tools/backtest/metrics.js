/**
 * metrics.js — Backtest performance metrics: Sharpe, Calmar, max_dd, win_rate.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

const TRADING_DAYS = 252;

/**
 * Compute equity curve drawdown series.
 * @param {number[]} equity
 * @returns {number[]} drawdowns (0 to -1 scale)
 */
export function drawdownSeries(equity) {
  const dd = [];
  let peak = equity[0] ?? 1;
  for (const v of equity) {
    if (v > peak) peak = v;
    dd.push(peak > 0 ? (v - peak) / peak : 0);
  }
  return dd;
}

/**
 * Maximum drawdown (negative number, e.g. -0.25 = -25%).
 * @param {number[]} equity
 * @returns {number}
 */
export function maxDrawdown(equity) {
  const dd = drawdownSeries(equity);
  return Math.min(...dd, 0);
}

/**
 * Annualised Sharpe ratio (risk-free rate = 0 for simplicity).
 * @param {number[]} dailyReturns  — arithmetic returns, one per bar
 * @returns {number}
 */
export function sharpeRatio(dailyReturns) {
  if (!dailyReturns.length) return 0;
  const n = dailyReturns.length;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / n;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(TRADING_DAYS);
}

/**
 * Annualised Calmar ratio = annual_return / |max_drawdown|.
 * @param {number[]} equity
 * @param {number} nDays  number of trading days in the test
 * @returns {number}
 */
export function calmarRatio(equity, nDays) {
  if (!equity.length || nDays <= 0) return 0;
  const totalReturn = (equity[equity.length - 1] - equity[0]) / equity[0];
  const annualReturn = (1 + totalReturn) ** (TRADING_DAYS / nDays) - 1;
  const mdd = Math.abs(maxDrawdown(equity));
  if (mdd === 0) return 0;
  return annualReturn / mdd;
}

/**
 * Win rate = fraction of closed trades with positive P&L.
 * @param {number[]} tradePnls  — list of per-trade P&L values
 * @returns {number}  0-1
 */
export function winRate(tradePnls) {
  if (!tradePnls.length) return 0;
  const wins = tradePnls.filter(p => p > 0).length;
  return wins / tradePnls.length;
}

/**
 * Total return as a fraction, e.g. 0.25 = +25%.
 * @param {number[]} equity
 * @returns {number}
 */
export function totalReturn(equity) {
  if (equity.length < 2 || equity[0] === 0) return 0;
  return (equity[equity.length - 1] - equity[0]) / equity[0];
}

/**
 * Compute all metrics in one pass. Returns a metrics object.
 * @param {{ equity: number[], returns: number[], trades: {pnl: number}[] }} result
 * @returns {object}
 */
export function computeMetrics(result) {
  const { equity = [], returns = [], trades = [] } = result;
  const tradePnls = trades.map(t => t.pnl);
  return {
    total_return: totalReturn(equity),
    sharpe: sharpeRatio(returns),
    calmar: calmarRatio(equity, returns.length),
    max_drawdown: maxDrawdown(equity),
    win_rate: winRate(tradePnls),
    num_trades: trades.length,
  };
}
