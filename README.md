# Solana Wallet Trade Dashboard

Tracks swap activity and current holdings for the Solana wallet
`jTsP9QPb7b8XKhiexDCoA9DadkocsvFxgaabBCWxCZu` using Helius.

## Run locally

```bash
pnpm install
pnpm dev
```

The app starts at `http://localhost:3000`.

## Environment

The local workspace already has a `.env.local` file configured. To rotate or
reuse the setup, copy `.env.example` and set:

- `HELIUS_API_KEY`
- `TRACKED_WALLET_ADDRESS`

## What the dashboard shows

- Current wallet holdings and USD allocation
- Parsed swap history with sent/received assets
- Aggregate wallet stats like trade count, fees, and last trade time
