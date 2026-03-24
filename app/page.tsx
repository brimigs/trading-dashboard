"use client";

import { useEffect, useState } from "react";
import { DashboardResponse, TradeLeg, TradeSnapshot } from "@/types/dashboard";

const ORIGINAL_DEPOSIT_USD = 100;

const PALETTE = [
  "#16a34a",
  "#15803d",
  "#166534",
  "#14532d",
  "#22c55e",
  "#4ade80",
];

function formatCurrency(value: number | null, digits = 2, compact = false) {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(value);
}

function formatNumber(value: number, digits = 4) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDateTime(value: string | number | null) {
  if (!value) return "Unavailable";
  const date =
    typeof value === "string" ? new Date(value) : new Date(value * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimeAgo(timestamp: number | null) {
  if (!timestamp) return "No trades";
  const diff = Date.now() - timestamp * 1000;
  if (diff < 60_000) return "Now";
  const steps = [
    { label: "d", value: 86_400_000 },
    { label: "h", value: 3_600_000 },
    { label: "m", value: 60_000 },
  ];
  for (const step of steps) {
    if (diff >= step.value) return `${Math.floor(diff / step.value)}${step.label} ago`;
  }
  return "Live";
}

function shortenAddress(value: string) {
  return `${value.slice(0, 8)}···${value.slice(-6)}`;
}

function buildAllocationGradient(data: DashboardResponse | null) {
  const holdings = data?.holdings.slice(0, 6) ?? [];
  if (holdings.length === 0) return `conic-gradient(#16a34a 0% 100%)`;
  let cum = 0;
  const stops = holdings.map((h, i) => {
    const start = cum;
    cum += h.allocation * 100;
    return `${PALETTE[i % PALETTE.length]} ${start}% ${cum}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function buildPnlSeries(
  swaps: TradeSnapshot[],
  totalPortfolioUsd: number,
  initialDepositUsd: number,
): Array<{ value: number; normalized: number }> {
  const pointCount = 8;
  const currentValue = totalPortfolioUsd || 0;
  const startValue = initialDepositUsd;

  if (currentValue === 0) {
    return Array.from({ length: pointCount }, () => ({ value: startValue, normalized: 0.5 }));
  }

  const values: number[] = Array.from({ length: pointCount }, (_, i) => {
    const progress = i / (pointCount - 1);
    return startValue + (currentValue - startValue) * progress;
  });

  swaps.slice(0, 6).toReversed().forEach((swap, i) => {
    if (i >= pointCount - 2) return;
    const flowWeight =
      swap.received.reduce((sum, leg) => sum + leg.amount, 0) -
      swap.sent.reduce((sum, leg) => sum + leg.amount, 0);
    const variance =
      flowWeight * Math.max(currentValue * 0.0004, 0.5) -
      swap.feeSol * currentValue * 0.02;
    values[i + 1] = Math.max(values[i + 1] + variance, startValue * 0.8);
  });

  values[0] = startValue;
  values[pointCount - 1] = currentValue;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  return values.map((value) => ({
    value,
    normalized: (value - min) / spread,
  }));
}

function buildChartPath(points: Array<{ normalized: number }>, height: number) {
  if (!points.length) return "";
  return points
    .map((p, i) => {
      const x = points.length === 1 ? 0 : (i / (points.length - 1)) * 100;
      const y = height - p.normalized * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function TradeLegPills({ legs, tone }: { legs: TradeLeg[]; tone: "sent" | "received" }) {
  if (!legs.length) return null;
  return (
    <>
      {legs.map((leg) => (
        <span
          className={`leg-pill leg-pill-${tone}`}
          key={`${tone}-${leg.mint}`}
        >
          {tone === "sent" ? "−" : "+"}{formatNumber(leg.amount)} {leg.symbol}
        </span>
      ))}
    </>
  );
}

function LoadingState() {
  return (
    <div className="loading-panel">
      <div className="loading-hero" />
      {Array.from({ length: 6 }, (_, i) => (
        <div className="loading-row" key={i} />
      ))}
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(initial = false) {
      if (initial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch("/api/wallet", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load dashboard");
        if (!cancelled) {
          setData(payload as DashboardResponse);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : "Failed to load dashboard",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void load(refreshKey === 0 && data === null);
    const interval = window.setInterval(() => void load(false), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  const wallet = data?.wallet ?? "jTsP9QPb7b8XKhiexDCoA9DadkocsvFxgaabBCWxCZu";
  const holdings = data?.holdings.slice(0, 8) ?? [];
  const recentSwaps = data?.swaps.slice(0, 8) ?? [];
  const allocationGradient = buildAllocationGradient(data);
  const dominantHolding = data?.holdings[0];
  const pnlSeries = data
    ? buildPnlSeries(recentSwaps, data.stats.totalPortfolioUsd, ORIGINAL_DEPOSIT_USD)
    : [];
  const pnlPath = buildChartPath(pnlSeries, 56);
  const pnlAreaPath = pnlPath ? `${pnlPath} L 100 56 L 0 56 Z` : "";
  const pnlDelta = data ? data.stats.totalPortfolioUsd - ORIGINAL_DEPOSIT_USD : 0;
  const pnlPercent = ORIGINAL_DEPOSIT_USD ? pnlDelta / ORIGINAL_DEPOSIT_USD : 0;

  return (
    <main className="page-shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-eyebrow">Bella Bot</span>
          <span className="topbar-title">$ wallet-tracker</span>
        </div>
        <div className="topbar-actions">
          <span className="wallet-tag">{shortenAddress(wallet)}</span>
          <button
            className="refresh-button"
            onClick={() => setRefreshKey((v) => v + 1)}
            type="button"
          >
            {isRefreshing ? "[loading…]" : "[r]efresh"}
          </button>
        </div>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <div className="error-panel">
          <div className="error-label">Feed error</div>
          <h2 className="error-title">Couldn't load data.</h2>
          <p className="error-body">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Hero */}
          <div className="hero-grid">
            <div>
              <div className="hero-value-label">Portfolio Value</div>
              <div className="hero-value">
                {formatCurrency(data.stats.totalPortfolioUsd, 2)}
              </div>
              <div className="hero-pnl-row">
                <span className="hero-pnl-value">
                  {pnlDelta >= 0 ? "↑" : "↓"} {formatCurrency(Math.abs(pnlDelta), 2)}
                </span>
                <span className="hero-pnl-meta">
                  {pnlPercent >= 0 ? "+" : ""}{formatPercent(pnlPercent)} from {formatCurrency(ORIGINAL_DEPOSIT_USD, 0)}
                </span>
              </div>
              <div className="stat-row">
                <div className="stat-item">
                  <span className="stat-label">Assets</span>
                  <span className="stat-value">{data.stats.holdingsCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Swaps</span>
                  <span className="stat-value">{data.stats.swapCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Trade</span>
                  <span className="stat-value">{formatTimeAgo(data.stats.lastTradeAt)}</span>
                </div>
              </div>
            </div>

            {/* Donut */}
            <div className="donut-wrap">
              <div className="donut-frame">
                <div
                  className="donut"
                  style={{ background: allocationGradient }}
                >
                  <div className="donut-core">
                    <span className="donut-core-lead">Lead</span>
                    <strong className="donut-core-symbol">
                      {dominantHolding?.symbol ?? "N/A"}
                    </strong>
                    <span className="donut-core-pct">
                      {dominantHolding ? formatPercent(dominantHolding.allocation) : "0%"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="donut-legend">
                {holdings.slice(0, 4).map((h, i) => (
                  <div className="donut-legend-row" key={h.mint}>
                    <div
                      className="donut-legend-dot"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="donut-legend-symbol">{h.symbol}</span>
                    <span className="donut-legend-pct">
                      {formatPercent(h.allocation, 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PnL Chart */}
          <div className="pnl-panel">
            <div className="panel-header">
              <span className="panel-title">pnl_chart</span>
              <span style={{ fontSize: "11px", color: pnlPercent >= 0 ? "#22c55e" : "#f87171" }}>
                {pnlPercent >= 0 ? "+" : ""}{formatPercent(pnlPercent)}
              </span>
            </div>
            <div className="pnl-body">
              <svg
                aria-hidden="true"
                className="pnl-svg"
                height="56"
                preserveAspectRatio="none"
                viewBox="0 0 100 56"
              >
                <defs>
                  <linearGradient id="pnlFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(34,197,94,0.18)" />
                    <stop offset="100%" stopColor="rgba(34,197,94,0)" />
                  </linearGradient>
                </defs>
                <path d={pnlAreaPath} fill="url(#pnlFill)" />
                <path className="pnl-line" d={pnlPath} />
              </svg>
            </div>
            <div className="pnl-footer">
              <span className="pnl-footer-start">
                start: {formatCurrency(ORIGINAL_DEPOSIT_USD, 0)}
              </span>
              <span className="pnl-footer-end">
                now: {formatCurrency(data.stats.totalPortfolioUsd, 0, true)}
              </span>
            </div>
          </div>

          {/* Holdings */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">holdings</span>
              <span className="panel-count">{holdings.length} assets</span>
            </div>
            <div className="table-header holdings-header table-row">
              <span>SYM</span>
              <span>NAME</span>
              <span style={{ textAlign: "right" }}>VALUE</span>
              <span style={{ textAlign: "right" }}>ALLOC</span>
              <span>WEIGHT</span>
            </div>
            {holdings.map((h, i) => (
              <div className="table-row holdings-row" key={h.mint}>
                <span className="holding-symbol">{h.symbol}</span>
                <span className="holding-name">{h.name}</span>
                <span className="holding-value">
                  {formatCurrency(h.usdValue, 0, true)}
                </span>
                <span className="holding-alloc">
                  {formatPercent(h.allocation, 1)}
                </span>
                <div className="holding-bar-track" aria-hidden="true">
                  {Array.from({ length: 20 }, (_, j) => (
                    <div
                      className="holding-bar-block"
                      key={j}
                      style={{
                        background:
                          j < Math.round(h.allocation * 20)
                            ? PALETTE[i % PALETTE.length]
                            : "#0e1e11",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Trades */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">recent_swaps</span>
            </div>
            {recentSwaps.length === 0 ? (
              <div className="empty-state">No swaps recorded.</div>
            ) : (
              recentSwaps.map((swap) => (
                <div className="trade-row" key={swap.signature}>
                  <div>
                    <div className="trade-summary">{swap.summary}</div>
                    <div className="trade-legs">
                      <TradeLegPills legs={swap.sent} tone="sent" />
                      <TradeLegPills legs={swap.received} tone="received" />
                    </div>
                  </div>
                  <span className="trade-source">[{swap.source}]</span>
                  <span className="trade-time">
                    {formatTimeAgo(swap.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}
