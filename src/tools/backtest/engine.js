/**
 * engine.js — Signal → position → equity curve backtesting engine.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 *
 * Signal conventions (from strategy files):
 *   1  = go long  (buy)
 *   -1 = go short (sell)
 *   0  = flat     (no position / exit)
 */

/**
 * Run a backtest given an array of OHLCV bars and signal generator.
 *
 * @param {object} params
 * @param {Array<{date, open, high, low, close, volume}>} params.bars
 * @param {Function} params.signalFn  (bars) => number[]  — same length as bars
 * @param {number}   [params.initialCapital]  default 10_000
 * @param {number}   [params.commissionPct]   default 0.001 (0.1%)
 * @param {boolean}  [params.allowShort]      default false (long-only)
 * @returns {{ equity: number[], returns: number[], trades: Array, signals: number[] }}
 */
export function runBacktest({
  bars,
  signalFn,
  initialCapital = 10_000,
  commissionPct = 0.001,
  allowShort = false,
}) {
  if (!bars || bars.length === 0) throw new Error('No bars provided to engine');

  const signals = signalFn(bars);
  if (signals.length !== bars.length) {
    throw new Error(`Signal array length ${signals.length} !== bars length ${bars.length}`);
  }

  const equity = [];
  const returns = [];
  const trades = [];

  let cash = initialCapital;
  let shares = 0;        // + = long, - = short
  let entryPrice = 0;
  let entryDate = null;
  let prevSignal = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const signal = signals[i];
    const price = bar.close;

    // Execute signal at close price (next-bar execution would be more realistic
    // but close is standard for daily strategy comparison purposes)
    if (signal !== prevSignal) {
      // Close existing position
      if (shares !== 0) {
        const exitValue = Math.abs(shares) * price;
        const commission = exitValue * commissionPct;
        const isLong = shares > 0;
        const pnl = isLong
          ? shares * (price - entryPrice) - commission
          : Math.abs(shares) * (entryPrice - price) - commission;
        cash += exitValue - commission;
        trades.push({ entry: entryPrice, exit: price, shares, pnl, entryDate, exitDate: bar.date, type: isLong ? 'long' : 'short' });
        shares = 0;
        entryPrice = 0;
        entryDate = null;
      }

      // Open new position
      if (signal === 1) {
        const commission = cash * commissionPct;
        shares = (cash - commission) / price;
        cash = 0;
        entryPrice = price;
        entryDate = bar.date;
      } else if (signal === -1 && allowShort) {
        const notional = cash;
        const commission = notional * commissionPct;
        shares = -(notional - commission) / price;
        cash = notional;  // cash stays (margin simplified)
        entryPrice = price;
        entryDate = bar.date;
      }

      prevSignal = signal;
    }

    // Mark-to-market equity
    let posValue = 0;
    if (shares > 0) posValue = shares * price;
    else if (shares < 0) posValue = cash + shares * (price - entryPrice);  // short P&L
    const totalEquity = cash + posValue;
    equity.push(totalEquity);

    if (i > 0 && equity[i - 1] !== 0) {
      returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    } else {
      returns.push(0);
    }
  }

  return { equity, returns, trades, signals };
}
