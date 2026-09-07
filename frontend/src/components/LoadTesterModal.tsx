import React, { useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { X, Play, Activity, CheckCircle2, XCircle, Gauge, Timer, Zap, BarChart2 } from 'lucide-react';

interface BenchmarkResult {
  totalRequests: number;
  successful: number;
  failed: number;
  totalDurationMs: number;
  reqPerSec: number;
  latencies: number[];
  p50: number;
  p90: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

export const LoadTesterModal: React.FC = () => {
  const { isLoadTesterOpen, setLoadTesterOpen, tabs, activeTabId, interpolate } = useStudioStore();

  const [totalReqs, setTotalReqs] = useState<number>(30);
  const [concurrency, setConcurrency] = useState<number>(5);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [result, setResult] = useState<BenchmarkResult | null>(null);

  if (!isLoadTesterOpen) return null;

  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return null;

  const runBenchmark = async () => {
    setIsRunning(true);
    setCompletedCount(0);
    setResult(null);

    const startTime = performance.now();
    const latencies: number[] = [];
    let successful = 0;
    let failed = 0;

    let index = 0;
    const worker = async () => {
      while (index < totalReqs) {
        const currentIdx = index++;
        if (currentIdx >= totalReqs) break;

        const reqStart = performance.now();
        try {
          const url = interpolate(tab.url);
          const headers: Record<string, string> = {};
          tab.headerParams.filter((h) => h.enabled && h.key).forEach((h) => {
            headers[h.key] = interpolate(h.value);
          });

          let body: any = null;
          if (['POST', 'PUT', 'PATCH'].includes(tab.method) && tab.bodyType === 'raw-json' && tab.bodyJson) {
            body = interpolate(tab.bodyJson);
          }

          const res = await fetch(url, {
            method: tab.method,
            headers,
            body: body ? body : undefined,
          });

          const dur = Math.round(performance.now() - reqStart);
          latencies.push(dur);

          if (res.ok) {
            successful++;
          } else {
            failed++;
          }
        } catch {
          const dur = Math.round(performance.now() - reqStart);
          latencies.push(dur);
          failed++;
        }

        setCompletedCount((prev) => prev + 1);
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, totalReqs) }, () => worker());
    await Promise.all(workers);

    const totalDurationMs = Math.round(performance.now() - startTime);
    latencies.sort((a, b) => a - b);

    const getPercentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.floor((p / 100) * arr.length);
      return arr[Math.min(idx, arr.length - 1)];
    };

    const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const reqPerSec = totalDurationMs > 0 ? Number(((totalReqs / (totalDurationMs / 1000))).toFixed(1)) : 0;

    setResult({
      totalRequests: totalReqs,
      successful,
      failed,
      totalDurationMs,
      reqPerSec,
      latencies,
      p50: getPercentile(latencies, 50),
      p90: getPercentile(latencies, 90),
      p99: getPercentile(latencies, 99),
      min: latencies[0] || 0,
      max: latencies[latencies.length - 1] || 0,
      avg,
    });

    setIsRunning(false);
  };

  return (
    <div
      onClick={() => !isRunning && setLoadTesterOpen(false)}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-input)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              In-Browser Micro-Load Tester & Benchmarker
            </h3>
          </div>
          <button
            onClick={() => !isRunning && setLoadTesterOpen(false)}
            disabled={isRunning}
            className="text-[var(--text-dim)] hover:text-[var(--text-main)] p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Info */}
        <div className="px-4 py-2.5 bg-[var(--bg-card)]/40 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs truncate">
            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">
              {tab.method}
            </span>
            <span className="font-mono text-[var(--text-main)] truncate">{tab.url}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-[var(--border-color)] grid grid-cols-3 gap-3 bg-[var(--bg-app)]">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
              Total Requests
            </label>
            <select
              value={totalReqs}
              onChange={(e) => setTotalReqs(Number(e.target.value))}
              disabled={isRunning}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none"
            >
              <option value={10}>10 Requests</option>
              <option value={30}>30 Requests</option>
              <option value={50}>50 Requests</option>
              <option value={100}>100 Requests</option>
              <option value={200}>200 Requests</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
              Concurrency (Workers)
            </label>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none"
            >
              <option value={1}>1 Worker (Sequential)</option>
              <option value={3}>3 Concurrent</option>
              <option value={5}>5 Concurrent</option>
              <option value={10}>10 Concurrent</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={runBenchmark}
              disabled={isRunning}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all ${
                isRunning
                  ? 'bg-emerald-600/50 cursor-wait'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 cursor-pointer active:scale-98'
              }`}
            >
              {isRunning ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{isRunning ? `Testing (${completedCount}/${totalReqs})...` : 'Start Benchmark'}</span>
            </button>
          </div>
        </div>

        {/* Live Progress Bar */}
        {isRunning && (
          <div className="px-4 py-2 bg-[var(--bg-card)]/50 border-b border-[var(--border-color)]">
            <div className="w-full bg-[var(--bg-input)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-150"
                style={{ width: `${(completedCount / totalReqs) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Results Panel */}
        <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {!result && !isRunning ? (
            <div className="py-8 text-center text-xs text-[var(--text-dim)]">
              Select configuration above and click <strong>Start Benchmark</strong> to measure response times and concurrency.
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-dim)]">Throughput</span>
                  <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                    {result.reqPerSec} <span className="text-[10px] text-[var(--text-dim)]">req/s</span>
                  </div>
                </div>
                <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-dim)]">p50 (Median)</span>
                  <div className="text-base font-extrabold text-blue-400 font-mono mt-0.5">
                    {result.p50} <span className="text-[10px] text-[var(--text-dim)]">ms</span>
                  </div>
                </div>
                <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-dim)]">p90 Latency</span>
                  <div className="text-base font-extrabold text-purple-400 font-mono mt-0.5">
                    {result.p90} <span className="text-[10px] text-[var(--text-dim)]">ms</span>
                  </div>
                </div>
                <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-dim)]">p99 Latency</span>
                  <div className="text-base font-extrabold text-amber-400 font-mono mt-0.5">
                    {result.p99} <span className="text-[10px] text-[var(--text-dim)]">ms</span>
                  </div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="flex items-center justify-between p-2.5 bg-[var(--bg-input)] rounded-lg border border-[var(--border-color)] text-xs">
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {result.successful} Success
                  </span>
                  {result.failed > 0 && (
                    <span className="text-red-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> {result.failed} Failed
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-[var(--text-dim)]">
                  Total: {result.totalDurationMs}ms | Min: {result.min}ms | Max: {result.max}ms | Avg: {result.avg}ms
                </div>
              </div>

              {/* Latency Distribution Histogram */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-2">
                  <span className="flex items-center gap-1">
                    <BarChart2 className="w-3.5 h-3.5 text-blue-400" /> Latency Spread (Fastest to Slowest)
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-dim)]">
                    {result.latencies.length} sampled requests
                  </span>
                </div>
                <div className="h-16 flex items-end gap-1 bg-[var(--bg-input)] p-2 rounded-lg border border-[var(--border-color)] overflow-x-auto">
                  {result.latencies.map((lat, i) => {
                    const heightPct = result.max > 0 ? Math.max((lat / result.max) * 100, 8) : 8;
                    const barColor = lat < 200 ? 'bg-emerald-400' : lat < 500 ? 'bg-blue-400' : 'bg-amber-400';
                    return (
                      <div
                        key={i}
                        style={{ height: `${heightPct}%` }}
                        className={`w-2.5 rounded-t-xs transition-all hover:opacity-80 shrink-0 ${barColor}`}
                        title={`Req #${i + 1}: ${lat}ms`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
