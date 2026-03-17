import { NextResponse } from "next/server";

import { getWalletDashboard } from "@/lib/helius";

export async function GET() {
  try {
    const dashboard = await getWalletDashboard();

    return NextResponse.json(dashboard, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load wallet data";

    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
