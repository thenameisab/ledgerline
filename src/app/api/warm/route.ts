import getSql from "@/lib/db";

// Keep-warm endpoint for Neon's free-tier autosuspend (fixed 5-min idle, not
// configurable on Free). An external pinger (cron-job.org / UptimeRobot) calls
// this every ~5 min so the compute stays awake during the workday.
//
// It only runs a query inside the working window below — outside it, the
// request returns without touching Neon, so no compute-hours are consumed even
// if the pinger keeps calling 24/7. Widen the window and you burn more of the
// Free compute budget; narrow it to stay under. Tune to taste.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TZ_OFFSET_MIN = 330; // IST = UTC+5:30
const START_HOUR = 9; //   inclusive, IST
const END_HOUR = 19; //    exclusive, IST
const WARM_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri (IST)

export async function GET() {
  const ist = new Date(Date.now() + TZ_OFFSET_MIN * 60_000);
  const hour = ist.getUTCHours();
  const day = ist.getUTCDay(); // 0 = Sun

  if (!WARM_DAYS.includes(day) || hour < START_HOUR || hour >= END_HOUR) {
    return Response.json({ warmed: false, reason: "outside working window" });
  }

  try {
    await getSql()`SELECT 1`;
    return Response.json({ warmed: true });
  } catch (e) {
    return Response.json(
      { warmed: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
