import { DashboardResponse, TradeLeg, TradeSnapshot } from "@/types/dashboard";

const DEFAULT_WALLET_ADDRESS =
  process.env.TRACKED_WALLET_ADDRESS ??
  "jTsP9QPb7b8XKhiexDCoA9DadkocsvFxgaabBCWxCZu";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE_URL = "https://api.helius.xyz";
const CANONICAL_SOL_MINT = "So11111111111111111111111111111111111111111";

const KNOWN_MINTS: Record<
  string,
  { symbol: string; name: string; logoUri?: string | null }
> = {
  So11111111111111111111111111111111111111111: {
    symbol: "SOL",
    name: "Solana",
    logoUri:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111111/logo.png",
  },
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    name: "Solana",
    logoUri:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111111/logo.png",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC",
    name: "USD Coin",
    logoUri:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    symbol: "USDT",
    name: "Tether USD",
  },
};

type BalanceResponse = {
  balances: Array<{
    mint: string;
    symbol?: string;
    name?: string;
    balance: number;
    decimals: number;
    usdValue?: number;
    pricePerToken?: number;
    logoUri?: string;
  }>;
  totalUsdValue: number;
};

type TokenTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  tokenAmount: number;
  mint: string;
};

type NativeTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount: number;
};

type AccountData = {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges?: Array<{
    userAccount?: string;
    rawTokenAmount: {
      tokenAmount: string;
      decimals: number;
    };
    mint: string;
  }>;
};

type EnhancedTransaction = {
  description?: string;
  source?: string;
  fee: number;
  signature: string;
  timestamp: number;
  tokenTransfers?: TokenTransfer[];
  nativeTransfers?: NativeTransfer[];
  accountData?: AccountData[];
};

type TokenMetadata = {
  symbol: string;
  name: string;
  logoUri?: string | null;
};

function assertConfig() {
  if (!HELIUS_API_KEY) {
    throw new Error("Missing HELIUS_API_KEY");
  }
}

function canonicalizeMint(mint: string) {
  if (mint === "So11111111111111111111111111111111111111112") {
    return CANONICAL_SOL_MINT;
  }

  return mint;
}

function lookupToken(
  mint: string,
  tokenMetadata?: Map<string, TokenMetadata>,
) {
  const canonicalMint = canonicalizeMint(mint);
  const known = tokenMetadata?.get(canonicalMint) ?? KNOWN_MINTS[canonicalMint];

  return {
    mint: canonicalMint,
    symbol: known?.symbol ?? shortMint(canonicalMint),
    name: known?.name ?? `Token ${shortMint(canonicalMint)}`,
    logoUri: known?.logoUri ?? null,
  };
}

function shortMint(mint: string) {
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

async function fetchHeliusJson<T>(path: string) {
  assertConfig();

  const response = await fetch(`${HELIUS_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Helius request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchBalances(address: string) {
  const search = new URLSearchParams({
    "api-key": HELIUS_API_KEY as string,
    showZeroBalance: "false",
    showNative: "true",
    limit: "50",
  });

  return fetchHeliusJson<BalanceResponse>(
    `/v1/wallet/${address}/balances?${search.toString()}`,
  );
}

async function fetchSwapTransactions(address: string) {
  const pageSize = 100;
  const maxPages = 5;
  const allTransactions: EnhancedTransaction[] = [];
  let before: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const search = new URLSearchParams({
      "api-key": HELIUS_API_KEY as string,
      type: "SWAP",
      limit: String(pageSize),
    });

    if (before) {
      search.set("before", before);
    }

    const pageTransactions = await fetchHeliusJson<EnhancedTransaction[]>(
      `/v0/addresses/${address}/transactions?${search.toString()}`,
    );

    if (pageTransactions.length === 0) {
      break;
    }

    allTransactions.push(...pageTransactions);

    if (pageTransactions.length < pageSize) {
      break;
    }

    before = pageTransactions.at(-1)?.signature ?? null;
  }

  return allTransactions;
}

function addAmount(
  target: Map<string, number>,
  mint: string,
  amount: number,
) {
  const canonicalMint = canonicalizeMint(mint);
  const previous = target.get(canonicalMint) ?? 0;
  target.set(canonicalMint, previous + amount);
}

function mapToLegs(
  amounts: Map<string, number>,
  tokenMetadata?: Map<string, TokenMetadata>,
) {
  return [...amounts.entries()]
    .filter(([, amount]) => Math.abs(amount) > 0.000000001)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([mint, amount]) => {
      const token = lookupToken(mint, tokenMetadata);

      return {
        mint,
        symbol: token.symbol,
        name: token.name,
        amount,
      } satisfies TradeLeg;
    });
}

function summarizeLegs(legs: TradeLeg[]) {
  if (legs.length === 0) {
    return "Unknown asset flow";
  }

  return legs
    .map((leg) => `${trimAmount(leg.amount)} ${leg.symbol}`)
    .join(" + ");
}

function trimAmount(amount: number) {
  if (amount >= 1000) {
    return amount.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }

  return amount.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

function normalizeTrade(
  transaction: EnhancedTransaction,
  wallet: string,
  tokenMetadata?: Map<string, TokenMetadata>,
): TradeSnapshot {
  const sentAmounts = new Map<string, number>();
  const receivedAmounts = new Map<string, number>();

  for (const transfer of transaction.tokenTransfers ?? []) {
    if (transfer.fromUserAccount === wallet) {
      addAmount(sentAmounts, transfer.mint, transfer.tokenAmount);
    }

    if (transfer.toUserAccount === wallet) {
      addAmount(receivedAmounts, transfer.mint, transfer.tokenAmount);
    }
  }

  const hasTokenLegs = sentAmounts.size > 0 || receivedAmounts.size > 0;

  if (!hasTokenLegs) {
    for (const account of transaction.accountData ?? []) {
      if (account.account === wallet && account.nativeBalanceChange !== 0) {
        const netChange = account.nativeBalanceChange / 1_000_000_000;

        if (netChange < 0) {
          addAmount(sentAmounts, CANONICAL_SOL_MINT, Math.abs(netChange));
        } else {
          addAmount(receivedAmounts, CANONICAL_SOL_MINT, netChange);
        }
      }

      for (const change of account.tokenBalanceChanges ?? []) {
        if (change.userAccount !== wallet) {
          continue;
        }

        const amount =
          Number(change.rawTokenAmount.tokenAmount) /
          10 ** change.rawTokenAmount.decimals;

        if (amount < 0) {
          addAmount(sentAmounts, change.mint, Math.abs(amount));
        } else if (amount > 0) {
          addAmount(receivedAmounts, change.mint, amount);
        }
      }
    }
  }

  const sent = mapToLegs(sentAmounts, tokenMetadata);
  const received = mapToLegs(receivedAmounts, tokenMetadata);

  return {
    signature: transaction.signature,
    timestamp: transaction.timestamp,
    source: transaction.source ?? "UNKNOWN",
    summary: `${summarizeLegs(sent)} -> ${summarizeLegs(received)}`,
    description: transaction.description ?? "Swap",
    feeSol: transaction.fee / 1_000_000_000,
    sent,
    received,
    explorerUrl: `https://solscan.io/tx/${transaction.signature}`,
  };
}

export async function getWalletDashboard(address = DEFAULT_WALLET_ADDRESS) {
  const [balanceResponse, swapTransactions] = await Promise.all([
    fetchBalances(address),
    fetchSwapTransactions(address),
  ]);

  const tokenMetadata = new Map<string, TokenMetadata>();

  const holdings = balanceResponse.balances
    .map((balance) => {
      const token = lookupToken(balance.mint);
      const usdValue = balance.usdValue ?? null;
      const canonicalMint = canonicalizeMint(balance.mint);
      const symbol = balance.symbol ?? token.symbol;
      const name = balance.name ?? token.name;
      const logoUri = balance.logoUri ?? token.logoUri;

      tokenMetadata.set(canonicalMint, {
        symbol,
        name,
        logoUri,
      });

      return {
        mint: canonicalMint,
        symbol,
        name,
        balance: balance.balance,
        decimals: balance.decimals,
        usdValue,
        pricePerToken: balance.pricePerToken ?? null,
        allocation:
          balanceResponse.totalUsdValue > 0 && usdValue !== null
            ? usdValue / balanceResponse.totalUsdValue
            : 0,
        logoUri,
      };
    })
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  const swaps = swapTransactions
    .map((transaction) => normalizeTrade(transaction, address, tokenMetadata))
    .sort((a, b) => b.timestamp - a.timestamp);

  const uniqueAssetsTraded = new Set(
    swaps.flatMap((swap) => [
      ...swap.sent.map((leg) => leg.mint),
      ...swap.received.map((leg) => leg.mint),
    ]),
  ).size;

  return {
    wallet: address,
    fetchedAt: new Date().toISOString(),
    holdings,
    swaps,
    stats: {
      totalPortfolioUsd: balanceResponse.totalUsdValue,
      holdingsCount: holdings.length,
      swapCount: swaps.length,
      totalFeesSol: swaps.reduce((sum, swap) => sum + swap.feeSol, 0),
      lastTradeAt: swaps[0]?.timestamp ?? null,
      uniqueAssetsTraded,
    },
  } satisfies DashboardResponse;
}
