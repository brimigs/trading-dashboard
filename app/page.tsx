"use client";

import { useEffect, useState } from "react";

import { DashboardResponse, TradeLeg } from "@/types/dashboard";

function formatCurrency(value: number | null, digits = 2) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(value);
}

function formatNumber(value: number, digits = 4) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRelativeDate(timestamp: number | null) {
  if (!timestamp) {
    return "No trade history";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function shortenAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

const HOLDING_COLORS = ["#ff4fa1", "#ff87c4", "#ffb1d8", "#ffd1eb"];

function WalletPill({ wallet }: { wallet: string }) {
  return (
    <div className="wallet-pill">
      <span>Wallet</span>
      <strong>{wallet}</strong>
    </div>
  );
}

function TradeLegList({
  title,
  legs,
  kind,
}: {
  title: string;
  legs: TradeLeg[];
  kind: "sent" | "received";
}) {
  return (
    <div className={`trade-legs trade-legs-${kind}`}>
      <p>{title}</p>
      {legs.length === 0 ? (
        <span className="muted">No parsed assets</span>
      ) : (
        legs.map((leg) => (
          <div className="trade-leg" key={`${kind}-${leg.mint}`}>
            <strong>{formatNumber(leg.amount)}</strong>
            <span>{leg.symbol}</span>
          </div>
        ))
      )}
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

  const topHoldings = data?.holdings.slice(0, 4) ?? [];
  const allocationGradient = topHoldings.length
    ? `conic-gradient(${topHoldings
        .map((holding, index, holdings) => {
          const start =
            holdings
              .slice(0, index)
              .reduce((sum, item) => sum + item.allocation, 0) * 100;
          const end = start + holding.allocation * 100;

          return `${HOLDING_COLORS[index]} ${start}% ${end}%`;
        })
        .join(", ")})`
    : "conic-gradient(#ff4fa1 0% 100%)";

  return (
    <main className="page-shell">
      <div className="page-glow page-glow-left" />
      <div className="page-glow page-glow-right" />

      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Live Wallet</span>
          <h1>Wallet Pulse</h1>
          {data ? (
            <div className="hero-highlights">
              <div className="hero-highlight">
                <span>Value</span>
                <strong>{formatCurrency(data.stats.totalPortfolioUsd)}</strong>
              </div>
              <div className="hero-highlight">
                <span>Holdings</span>
                <strong>{data.stats.holdingsCount}</strong>
              </div>
              <div className="hero-highlight">
                <span>Swaps</span>
                <strong>{data.stats.swapCount}</strong>
              </div>
              <div className="hero-highlight">
                <span>Fees</span>
                <strong>{formatNumber(data.stats.totalFeesSol, 6)} SOL</strong>
              </div>
              <div className="hero-highlight">
                <span>Last Trade</span>
                <strong>{formatRelativeDate(data.stats.lastTradeAt)}</strong>
              </div>
              <div className="hero-highlight">
                <span>Assets Traded</span>
                <strong>{data.stats.uniqueAssetsTraded}</strong>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hero-meta">
          {data ? (
            <div className="portfolio-visual panel-block">
              <div className="portfolio-ring" style={{ background: allocationGradient }}>
                <div className="portfolio-ring-core">
                  <span>Value</span>
                  <strong>{formatCurrency(data.stats.totalPortfolioUsd, 0)}</strong>
                </div>
              </div>
              <div className="portfolio-legend">
                {topHoldings.map((holding, index) => (
                  <div className="legend-row" key={holding.mint}>
                    <span
                      aria-hidden="true"
                      className="legend-dot"
                      style={{ background: HOLDING_COLORS[index] }}
                    />
                    <strong>{holding.symbol}</strong>
                    <span>{formatPercent(holding.allocation)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <WalletPill
            wallet={
              data?.wallet ??
              "jTsP9QPb7b8XKhiexDCoA9DadkocsvFxgaabBCWxCZu"
            }
          />
          <button
            className="refresh-button"
            onClick={() => setRefreshKey((value) => value + 1)}
            type="button"
          >
            {isRefreshing ? "Refreshing..." : "Refresh now"}
          </button>
        </div>
      </section>

      {isLoading ? (
        <section className="panel loading-panel">
          <div className="loading-grid">
            <div className="loading-block" />
            <div className="loading-block" />
            <div className="loading-block" />
            <div className="loading-block" />
          </div>
        </section>
      ) : error ? (
        <section className="panel error-panel">
          <p>Dashboard request failed.</p>
          <strong>{error}</strong>
        </section>
      ) : data ? (
        <>
          <section className="content-grid">
            <article className="panel holdings-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Exposure</span>
                  <h2>Holdings</h2>
                </div>
                <p>{formatCurrency(data.stats.totalPortfolioUsd)}</p>
              </div>

              <div className="holdings-list">
                {data.holdings.map((holding) => (
                  <div className="holding-row" key={holding.mint}>
                    <div className="holding-main">
                      <div className="asset-chip">
                        <div className="asset-mark">{holding.symbol.slice(0, 1)}</div>
                        <div>
                          <strong>{holding.symbol}</strong>
                          <span>{holding.name}</span>
                        </div>
                      </div>
                      <div className="allocation-track" aria-hidden="true">
                        <div
                          className="allocation-fill"
                          style={{ width: `${Math.max(holding.allocation * 100, 6)}%` }}
                        />
                      </div>
                    </div>

                    <div className="holding-metrics">
                      <strong>{formatNumber(holding.balance)}</strong>
                      <span>{formatCurrency(holding.pricePerToken, 4)} each</span>
                    </div>

                    <div className="holding-metrics align-right">
                      <strong>{formatCurrency(holding.usdValue)}</strong>
                      <span>{formatPercent(holding.allocation)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel overview-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Snapshot</span>
                  <h2>At A Glance</h2>
                </div>
              </div>

              <div className="snapshot-grid">
                <div>
                  <span>Assets</span>
                  <strong>{data.stats.uniqueAssetsTraded}</strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>{formatRelativeDate(Date.parse(data.fetchedAt) / 1000)}</strong>
                </div>
                <div>
                  <span>Cadence</span>
                  <strong>60 seconds</strong>
                </div>
                <div>
                  <span>Wallet</span>
                  <strong>
                    <a
                      href={`https://solscan.io/account/${data.wallet}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Solscan
                    </a>
                  </strong>
                </div>
              </div>
            </article>
          </section>

          <section className="panel trades-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Trades</span>
                <h2>Recent Swaps</h2>
              </div>
            </div>

            <div className="trades-list">
              {data.swaps.length === 0 ? (
                <div className="empty-state">No swap transactions found.</div>
              ) : (
                data.swaps.map((swap) => (
                  <article className="trade-card" key={swap.signature}>
                    <div className="trade-topline">
                      <div>
                        <div className="trade-badges">
                          <span className="trade-source">{swap.source}</span>
                          <span className="trade-signature">
                            {shortenAddress(swap.signature)}
                          </span>
                        </div>
                        <h3>{swap.summary}</h3>
                      </div>
                      <div className="trade-meta">
                        <span>{formatRelativeDate(swap.timestamp)}</span>
                        <span>{formatNumber(swap.feeSol, 6)} SOL fee</span>
                      </div>
                    </div>

                    <div className="trade-flow">
                      <TradeLegList kind="sent" legs={swap.sent} title="Sent" />
                      <TradeLegList
                        kind="received"
                        legs={swap.received}
                        title="Received"
                      />
                    </div>

                    <a
                      className="trade-link"
                      href={swap.explorerUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View transaction
                    </a>
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
