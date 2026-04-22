/**
 * CLI command: tv backtest <strategy> <symbol> [options]
 *              tv backtest compare <symbol> [options]
 *
 * Ported from atilaahmettaner/tradingview-mcp (MIT) into tradesdontlie/tradingview-mcp (Node).
 * Original Python: MIT License — attribution: atilaahmettaner/tradingview-mcp
 * Port: MIT License — trading-dept fork, Bud Fox, 2026-04-22
 */

import { register } from '../router.js';
import { getOhlcvBars } from '../../tools/backtest/data_source.js';
import { runBacktest } from '../../tools/backtest/engine.js';
import { computeMetrics } from '../../tools/backtest/metrics.js';
import { compareStrategies } from '../../tools/backtest/compare.js';
import * as rsiStrat from '../../tools/backtest/strategies/rsi.js';
import * as bollingerStrat from '../../tools/backtest/strategies/bollinger.js';
import * as macdStrat from '../../tools/backtest/strategies/macd.js';
import * as emaCrossStrat from '../../tools/backtest/strategies/ema_cross.js';
import * as supertrendStrat from '../../tools/backtest/strategies/supertrend.js';
import * as donchianStrat from '../../tools/backtest/strategies/donchian.js';

const STRATEGIES = {
  rsi: rsiStrat,
  bollinger: bollingerStrat,
  macd: macdStrat,
  ema_cross: emaCrossStrat,
  supertrend: supertrendStrat,
  donchian: donchianStrat,
};

const sharedOptions = {
  timeframe: { type: 'string', short: 't', description: 'Timeframe: 1D, 1h, 15m (default 1D)' },
  start: { type: 'string', description: 'Start date ISO string (default 5y ago)' },
  end: { type: 'string', description: 'End date ISO string (default today)' },
  capital: { type: 'string', short: 'c', description: 'Initial capital USD (default 10000)' },
  source: { type: 'string', short: 's', description: 'Data source: auto|cdp|yahoo (default auto)' },
};

register('backtest', {
  description: 'Backtest trading strategies on historical data (Yahoo fallback when TV offline)',
  subcommands: new Map([
    ['compare', {
      description: 'Compare all 6 strategies on a symbol, ranked by Sharpe ratio',
      options: sharedOptions,
      handler: async (opts, positionals) => {
        const symbol = positionals[0];
        if (!symbol) throw new Error('Usage: tv backtest compare <symbol>');
        return compareStrategies({
          symbol,
          timeframe: opts.timeframe ?? '1D',
          startDate: opts.start,
          endDate: opts.end,
          initialCapital: opts.capital ? Number(opts.capital) : 10000,
          source: opts.source ?? 'auto',
        });
      },
    }],
    ...Object.entries(STRATEGIES).map(([key, strat]) => [
      key,
      {
        description: `Backtest ${strat.NAME}: ${strat.DESCRIPTION}`,
        options: sharedOptions,
        handler: async (opts, positionals) => {
          const symbol = positionals[0];
          if (!symbol) throw new Error(`Usage: tv backtest ${key} <symbol>`);
          const { bars, source: actualSource } = await getOhlcvBars({
            symbol,
            timeframe: opts.timeframe ?? '1D',
            startDate: opts.start,
            endDate: opts.end,
            source: opts.source ?? 'auto',
          });
          if (!bars || bars.length < 30) {
            throw new Error(`Insufficient data: ${bars?.length ?? 0} bars`);
          }
          const signals = strat.generateSignals(bars);
          const result = runBacktest({
            bars,
            signalFn: () => signals,
            initialCapital: opts.capital ? Number(opts.capital) : 10000,
          });
          const metrics = computeMetrics(result);
          return {
            symbol,
            strategy: strat.NAME,
            timeframe: opts.timeframe ?? '1D',
            data_source: actualSource,
            bar_count: bars.length,
            ...metrics,
          };
        },
      },
    ]),
  ]),
});
