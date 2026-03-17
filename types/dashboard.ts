export type AssetSnapshot = {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  usdValue: number | null;
  pricePerToken: number | null;
  allocation: number;
  logoUri: string | null;
};

export type TradeLeg = {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
};

export type TradeSnapshot = {
  signature: string;
  timestamp: number;
  source: string;
  summary: string;
  description: string;
  feeSol: number;
  sent: TradeLeg[];
  received: TradeLeg[];
  explorerUrl: string;
};

export type DashboardStats = {
  totalPortfolioUsd: number;
  holdingsCount: number;
  swapCount: number;
  totalFeesSol: number;
  lastTradeAt: number | null;
  uniqueAssetsTraded: number;
};

export type DashboardResponse = {
  wallet: string;
  fetchedAt: string;
  holdings: AssetSnapshot[];
  swaps: TradeSnapshot[];
  stats: DashboardStats;
};
