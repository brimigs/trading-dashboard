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

function WalletPill({ wallet }: { wallet: string }) {
  return (
    <div className="wallet-pill">
      <span>Tracking wallet</span>
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

  return (
    <main className="page-shell">
      <div className="page-glow page-glow-left" />
      <div className="page-glow page-glow-right" />

      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Solana Trade Tracker</span>
          <h1>Wallet flow, swap history, and current exposure in one view.</h1>
          <p>
            This dashboard pulls directly from Helius and refreshes every 60
            seconds so you can monitor swap activity on the tracked wallet
            without exposing the API key in the browser.
          </p>
        </div>

        <div className="hero-meta">
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
          <section className="stats-grid">
            <article className="panel stat-card">
              <span>Portfolio value</span>
              <strong>{formatCurrency(data.stats.totalPortfolioUsd)}</strong>
              <p>Current marked value from Helius balances.</p>
            </article>
            <article className="panel stat-card">
              <span>Open holdings</span>
              <strong>{data.stats.holdingsCount}</strong>
              <p>Tracked SPL and native assets with non-zero balance.</p>
            </article>
            <article className="panel stat-card">
              <span>Swap count</span>
              <strong>{data.stats.swapCount}</strong>
              <p>Enhanced swap transactions parsed for this wallet.</p>
            </article>
            <article className="panel stat-card">
              <span>Fees paid</span>
              <strong>{formatNumber(data.stats.totalFeesSol, 6)} SOL</strong>
              <p>Network fees attached to parsed swap transactions.</p>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel holdings-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Holdings</span>
                  <h2>Current wallet exposure</h2>
                </div>
                <p>Last swap: {formatRelativeDate(data.stats.lastTradeAt)}</p>
              </div>

              <div className="holdings-list">
                {data.holdings.map((holding) => (
                  <div className="holding-row" key={holding.mint}>
                    <div className="asset-chip">
                      <div className="asset-mark">{holding.symbol.slice(0, 1)}</div>
                      <div>
                        <strong>{holding.symbol}</strong>
                        <span>{holding.name}</span>
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
                  <span className="eyebrow">Overview</span>
                  <h2>Wallet profile</h2>
                </div>
              </div>

              <div className="overview-list">
                <div>
                  <span>Unique assets traded</span>
                  <strong>{data.stats.uniqueAssetsTraded}</strong>
                </div>
                <div>
                  <span>Latest fetch</span>
                  <strong>{formatRelativeDate(Date.parse(data.fetchedAt) / 1000)}</strong>
                </div>
                <div>
                  <span>Refresh cadence</span>
                  <strong>60 seconds</strong>
                </div>
                <div>
                  <span>Explorer</span>
                  <strong>
                    <a
                      href={`https://solscan.io/account/${data.wallet}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open wallet
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
                <h2>Recent swap activity</h2>
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
                        <span className="trade-source">{swap.source}</span>
                        <h3>{swap.summary}</h3>
                      </div>
                      <div className="trade-meta">
                        <span>{formatRelativeDate(swap.timestamp)}</span>
                        <span>{formatNumber(swap.feeSol, 6)} SOL fee</span>
                      </div>
                    </div>

                    <p className="trade-description">{swap.description}</p>

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
