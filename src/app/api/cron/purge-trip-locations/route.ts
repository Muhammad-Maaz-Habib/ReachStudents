import { NextResponse } from "next/server";
import { purgeExpiredTripLocationCheckIns } from "@/lib/emergency/trip-location-retention";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredTripLocationCheckIns();
  return NextResponse.json(result);
}
