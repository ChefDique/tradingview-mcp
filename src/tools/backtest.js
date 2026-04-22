/**
 * backtest.js — MCP tool registration for backtest_strategy + compare_strategies.
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { z } from 'zod';
import { jsonResult } from './_format.js';
import { getOhlcvBars } from './backtest/data_source.js';
import { runBacktest } from './backtest/engine.js';
import { computeMetrics } from './backtest/metrics.js';
import { compareStrategies } from './backtest/compare.js';
import * as rsiStrat from './backtest/strategies/rsi.js';
import * as bollingerStrat from './backtest/strategies/bollinger.js';
import * as macdStrat from './backtest/strategies/macd.js';
import * as emaCrossStrat from './backtest/strategies/ema_cross.js';
import * as supertrendStrat from './backtest/strategies/supertrend.js';
import * as donchianStrat from './backtest/strategies/donchian.js';

const STRATEGIES = {
  rsi: rsiStrat,
  bollinger: bollingerStrat,
  macd: macdStrat,
  ema_cross: emaCrossStrat,
  supertrend: supertrendStrat,
  donchian: donchianStrat,
};

export function registerBacktestTools(server) {
  server.tool(
    'backtest_strategy',
    'Backtest a trading strategy on historical OHLCV data. Uses TradingView CDP if available, Yahoo Finance as fallback. Returns Sharpe, Calmar, max_dd, total_return, win_rate.',
    {
      symbol: z.string().describe('Ticker symbol, e.g. "AAPL", "BTCUSDT", "SPY"'),
      strategy: z.enum(['rsi', 'bollinger', 'macd', 'ema_cross', 'supertrend', 'donchian'])
        .describe('Strategy to backtest'),
      timeframe: z.string().optional().default('1D')
        .describe('Chart timeframe: 1D, 1h, 15m etc. (default 1D)'),
      start_date: z.string().optional()
        .describe('Start date ISO string, e.g. "2020-01-01" (default 5 years ago)'),
      end_date: z.string().optional()
        .describe('End date ISO string (default today)'),
      initial_capital: z.coerce.number().optional().default(10000)
        .describe('Starting capital in USD (default 10000)'),
      source: z.enum(['auto', 'cdp', 'yahoo']).optional().default('auto')
        .describe('Data source: auto (TV first, Yahoo fallback), cdp, or yahoo'),
    },
    async ({ symbol, strategy, timeframe, start_date, end_date, initial_capital, source }) => {
      try {
        const strat = STRATEGIES[strategy];
        if (!strat) throw new Error(`Unknown strategy: ${strategy}`);

        const { bars, source: actualSource } = await getOhlcvBars({
          symbol,
          timeframe: timeframe ?? '1D',
          startDate: start_date,
          endDate: end_date,
          source: source ?? 'auto',
        });

        if (!bars || bars.length < 30) {
          throw new Error(`Insufficient data: got ${bars?.length ?? 0} bars (need ≥ 30)`);
        }

        const signals = strat.generateSignals(bars);
        const result = runBacktest({
          bars,
          signalFn: () => signals,
          initialCapital: initial_capital ?? 10000,
        });
        const metrics = computeMetrics(result);

        return jsonResult({
          success: true,
          symbol,
          strategy: strat.NAME,
          description: strat.DESCRIPTION,
          timeframe: timeframe ?? '1D',
          data_source: actualSource,
          bar_count: bars.length,
          date_range: {
            start: bars[0]?.date?.toISOString?.() ?? null,
            end: bars[bars.length - 1]?.date?.toISOString?.() ?? null,
          },
          initial_capital: initial_capital ?? 10000,
          ...metrics,
        });
      } catch (err) {
        return jsonResult({ success: false, error: err.message }, true);
      }
    }
  );

  server.tool(
    'compare_strategies',
    'Run all 6 strategies (RSI, Bollinger, MACD, EMA Cross, Supertrend, Donchian) on a symbol and rank by Sharpe ratio.',
    {
      symbol: z.string().describe('Ticker symbol, e.g. "AAPL", "SPY"'),
      timeframe: z.string().optional().default('1D')
        .describe('Chart timeframe (default 1D)'),
      start_date: z.string().optional()
        .describe('Start date ISO string (default 5 years ago)'),
      end_date: z.string().optional()
        .describe('End date ISO string (default today)'),
      initial_capital: z.coerce.number().optional().default(10000)
        .describe('Starting capital in USD (default 10000)'),
      source: z.enum(['auto', 'cdp', 'yahoo']).optional().default('auto')
        .describe('Data source override'),
    },
    async ({ symbol, timeframe, start_date, end_date, initial_capital, source }) => {
      try {
        const result = await compareStrategies({
          symbol,
          timeframe: timeframe ?? '1D',
          startDate: start_date,
          endDate: end_date,
          initialCapital: initial_capital ?? 10000,
          source: source ?? 'auto',
        });
        return jsonResult({ success: true, ...result });
      } catch (err) {
        return jsonResult({ success: false, error: err.message }, true);
      }
    }
  );
}
