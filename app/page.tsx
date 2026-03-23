"use client";

import { useEffect, useState } from "react";

import { DashboardResponse, TradeLeg, TradeSnapshot } from "@/types/dashboard";

const HOLDING_COLORS = [
  "#ff4fb6",
  "#ff77cb",
  "#ff9ee0",
  "#ffc6ef",
  "#ff8ae2",
  "#ff63a5",
];
const ORIGINAL_DEPOSIT_USD = 100;

function formatCurrency(
  value: number | null,
  digits = 2,
  compact = false,
) {
  if (value === null) {
    return "N/A";
  }

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
  if (!value) {
    return "Unavailable";
  }

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
  if (!timestamp) {
    return "No trades";
  }

  const diff = Date.now() - timestamp * 1000;

  if (diff < 60_000) {
    return "Now";
  }

  const steps = [
    { label: "d", value: 86_400_000 },
    { label: "h", value: 3_600_000 },
    { label: "m", value: 60_000 },
  ];

  for (const step of steps) {
    if (diff >= step.value) {
      return `${Math.floor(diff / step.value)}${step.label} ago`;
    }
  }

  return "Live";
}

function shortenAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function buildSourceBreakdown(data: DashboardResponse | null) {
  if (!data) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const swap of data.swaps) {
    counts.set(swap.source, (counts.get(swap.source) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function buildAllocationGradient(data: DashboardResponse | null) {
  const holdings = data?.holdings.slice(0, 6) ?? [];

  if (holdings.length === 0) {
    return "conic-gradient(#ff4fb6 0% 100%)";
  }

  return `conic-gradient(${holdings
    .map((holding, index, list) => {
      const start =
        list.slice(0, index).reduce((sum, item) => sum + item.allocation, 0) * 100;
      const end = start + holding.allocation * 100;

      return `${HOLDING_COLORS[index % HOLDING_COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

function buildPnlSeries(
  swaps: TradeSnapshot[],
  totalPortfolioUsd: number,
  initialDepositUsd: number,
): Array<{ label: string; value: number; normalized: number }> {
  const recent = swaps.slice(0, 8).toReversed();
  const currentValue = totalPortfolioUsd || 0;
  const startValue = initialDepositUsd;
  const pointCount = 8;

  if (currentValue === 0) {
    return Array.from({ length: pointCount }, (_, index) => ({
      label: index === 0 ? "Start" : index === pointCount - 1 ? "Now" : "",
      value: startValue,
      normalized: 0.5,
    }));
  }

  const values: number[] = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);

    return startValue + (currentValue - startValue) * progress;
  });

  recent.forEach((swap, index) => {
    if (index >= pointCount - 2) {
      return;
    }

    const flowWeight =
      swap.received.reduce((sum, leg) => sum + leg.amount, 0) -
      swap.sent.reduce((sum, leg) => sum + leg.amount, 0);
    const variance =
      flowWeight * Math.max(currentValue * 0.0004, 0.5) -
      swap.feeSol * currentValue * 0.02;

    values[index + 1] = Math.max(values[index + 1] + variance, startValue * 0.8);
  });

  values[0] = startValue;
  values[pointCount - 1] = currentValue;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  return values.map((value, index) => ({
    label: index === 0 ? "Start" : index === pointCount - 1 ? "Now" : "",
    value,
    normalized: (value - min) / spread,
  }));
}

function buildChartPath(points: Array<{ normalized?: number }>, height: number) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const x =
        points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = height - (point.normalized ?? 0.5) * height;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function AssetAvatar({
  symbol,
  logoUri,
  size = "md",
}: {
  symbol: string;
  logoUri: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`asset-avatar asset-avatar-${size}`}>
      {logoUri ? (
        <img alt={symbol} className="asset-avatar-image" src={logoUri} />
      ) : (
        <span>{symbol.slice(0, 1)}</span>
      )}
    </div>
  );
}

function StatOrb({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="stat-orb">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TradeLegPills({
  title,
  legs,
  tone,
}: {
  title: string;
  legs: TradeLeg[];
  tone: "sent" | "received";
}) {
  return (
    <div className={`trade-side trade-side-${tone}`}>
      <span className="mini-label">{title}</span>
      <div className="trade-side-pills">
        {legs.length === 0 ? (
          <span className="pill pill-empty">None</span>
        ) : (
          legs.map((leg) => (
            <div className="pill" key={`${tone}-${leg.mint}`}>
              <strong>{formatNumber(leg.amount)}</strong>
              <span>{leg.symbol}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="panel loading-panel" aria-live="polite">
      <div className="loading-hero" />
      <div className="loading-grid">
        <div className="loading-card" />
        <div className="loading-card" />
        <div className="loading-card" />
        <div className="loading-card" />
      </div>
    </section>
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

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load dashboard");
        }

        if (!cancelled) {
          setData(payload as DashboardResponse);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load dashboard",
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
    const interval = window.setInterval(() => {
      void load(false);
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  const wallet =
    data?.wallet ?? "jTsP9QPb7b8XKhiexDCoA9DadkocsvFxgaabBCWxCZu";
  const assetGallery = data?.holdings.slice(0, 8) ?? [];
  const recentSwaps = data?.swaps.slice(0, 8) ?? [];
  const allocationGradient = buildAllocationGradient(data);
  const dominantHolding = data?.holdings[0];
  const pnlSeries = data
    ? buildPnlSeries(
        recentSwaps,
        data.stats.totalPortfolioUsd,
        ORIGINAL_DEPOSIT_USD,
      )
    : [];
  const pnlPath = buildChartPath(pnlSeries, 100);
  const pnlAreaPath = pnlPath
    ? `${pnlPath} L 100 100 L 0 100 Z`
    : "";
  const pnlDelta = data
    ? data.stats.totalPortfolioUsd - ORIGINAL_DEPOSIT_USD
    : 0;
  const pnlPercent = ORIGINAL_DEPOSIT_USD
    ? pnlDelta / ORIGINAL_DEPOSIT_USD
    : 0;

  return (
    <main className="page-shell">
      <div className="glow glow-left" aria-hidden="true" />
      <div className="glow glow-right" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      <header className="topbar">
        <div>
          <span className="eyebrow">Bella Bot's Trades</span>
          <h1>Wallet Tracker</h1>
        </div>

        <div className="topbar-actions">
          <div className="wallet-pill">
            <span>Wallet</span>
            <strong>{shortenAddress(wallet)}</strong>
          </div>
          <button
            className="refresh-button"
            onClick={() => setRefreshKey((value) => value + 1)}
            type="button"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <section className="panel error-panel">
          <span className="eyebrow">Feed error</span>
          <h2>Couldn’t load data.</h2>
          <p>{error}</p>
        </section>
      ) : data ? (
        <>
          <section className="hero-grid">
            <article className="panel hero-panel">
              <div className="hero-top">
                <div className="hero-copy">
                  <span className="eyebrow">Live mode</span>
                  <h2>{formatCurrency(data.stats.totalPortfolioUsd, 1, true)}</h2>
                  <div className="hero-chip-row">
                    <StatOrb label="Assets" value={String(data.stats.holdingsCount)} />
                    <StatOrb label="Swaps" value={String(data.stats.swapCount)} />
                    <StatOrb
                      label="Last"
                      value={formatTimeAgo(data.stats.lastTradeAt)}
                    />
                  </div>
                </div>

                <div className="hero-donut-wrap">
                  <div
                    className="hero-donut"
                    style={{ background: allocationGradient }}
                  >
                    <div className="hero-donut-core">
                      <span>Lead</span>
                      <strong>{dominantHolding?.symbol ?? "N/A"}</strong>
                      <small>
                        {dominantHolding
                          ? formatPercent(dominantHolding.allocation)
                          : "0.0%"}
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pnl-card">
                <div className="pnl-head">
                  <span className="eyebrow">PnL</span>
                  <strong>{formatCurrency(pnlDelta, 0, true)}</strong>
                </div>
                <div className="pnl-meta">
                  <span>Start {formatCurrency(ORIGINAL_DEPOSIT_USD, 0)}</span>
                  <span>Now {formatCurrency(data.stats.totalPortfolioUsd, 0, true)}</span>
                  <span>{formatPercent(pnlPercent)}</span>
                </div>
                <div className="pnl-chart">
                  <svg
                    aria-hidden="true"
                    className="pnl-svg"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <defs>
                      <linearGradient id="pnlFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255, 79, 182, 0.42)" />
                        <stop offset="100%" stopColor="rgba(255, 79, 182, 0)" />
                      </linearGradient>
                    </defs>
                    <path className="pnl-area" d={pnlAreaPath} fill="url(#pnlFill)" />
                    <path className="pnl-line" d={pnlPath} pathLength="100" />
                  </svg>
                  <div className="pnl-points">
                    {pnlSeries.map((point, index) => (
                      <span
                        className="pnl-point"
                        key={`pnl-point-${point.label || "mid"}-${index}`}
                        style={{
                          left: `${pnlSeries.length === 1 ? 0 : (index / (pnlSeries.length - 1)) * 100}%`,
                          top: `${100 - (point.normalized ?? 0.5) * 100}%`,
                          background:
                            HOLDING_COLORS[index % HOLDING_COLORS.length],
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="pnl-axis">
                  {pnlSeries.map((point, index) => (
                    <span key={`pnl-axis-${point.label || "mid"}-${index}`}>
                      {point.label}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="gallery-section">
            <div className="section-head">
              <span className="eyebrow">Assets</span>
            </div>

            <div className="asset-gallery">
              {assetGallery.map((holding, index) => (
                <article className="asset-card" key={holding.mint}>
                  <div
                    className="asset-card-glow"
                    style={{
                      background:
                        HOLDING_COLORS[index % HOLDING_COLORS.length],
                    }}
                  />
                  <div className="asset-card-top">
                    <AssetAvatar
                      logoUri={holding.logoUri}
                      size="lg"
                      symbol={holding.symbol}
                    />
                    <div className="asset-card-meta">
                      <strong>{holding.symbol}</strong>
                      <span>{holding.name}</span>
                    </div>
                  </div>

                  <strong className="asset-card-value">
                    {formatCurrency(holding.usdValue, 0, true)}
                  </strong>

                  <div className="asset-card-bar" aria-hidden="true">
                    <div
                      className="asset-card-bar-fill"
                      style={{
                        width: `${Math.max(holding.allocation * 100, 6)}%`,
                        background:
                          HOLDING_COLORS[index % HOLDING_COLORS.length],
                      }}
                    />
                  </div>

                  <div className="asset-card-footer">
                    <span>{formatNumber(holding.balance)}</span>
                    <strong>{formatPercent(holding.allocation)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel trade-panel">
            <div className="section-head">
              <span className="eyebrow">Recent swaps</span>
            </div>

            <div className="trade-grid">
              {recentSwaps.length === 0 ? (
                <div className="empty-state">No swaps.</div>
              ) : (
                recentSwaps.map((swap) => (
                  <article className="trade-card" key={swap.signature}>
                    <div className="trade-card-top">
                      <div className="trade-card-meta">
                        <span className="source-tag">{swap.source}</span>
                        <strong>{formatDateTime(swap.timestamp)}</strong>
                      </div>
                      <a
                        className="sig-tag"
                        href={swap.explorerUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Transaction details
                      </a>
                    </div>

                    <h4>{swap.summary}</h4>

                    <div className="trade-flow-grid">
                      <TradeLegPills legs={swap.sent} title="Out" tone="sent" />
                      <TradeLegPills
                        legs={swap.received}
                        title="In"
                        tone="received"
                      />
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
