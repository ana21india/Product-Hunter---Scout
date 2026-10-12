import { after } from "next/server";
import { runScout } from "../../../lib/run";
import { suggestLinkedIn } from "../../../lib/linkedin";
import { q } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Run scout": always calls Product Hunt live. The answer goes back as soon as the numbers are ready.
// The slow LinkedIn suggestions run afterwards, so they never delay the click.
// The scheduler calls this every few minutes with ?auto=1. It only runs when the last full run is at least SYNC_HOURS old,
// so the automatic run always happens SYNC_HOURS after the latest run, whether that was a click or an automatic run.
// A clicked run (no ?auto) always runs.
const SYNC_HOURS = 6;

export async function POST(req: Request) {
  try {
    if (new URL(req.url).searchParams.get("auto") === "1") {
      const [last] = await q(`SELECT status, finished_at FROM run_log ORDER BY id DESC LIMIT 1`);
      const ageH = last?.finished_at ? (Date.now() - new Date(last.finished_at).getTime()) / 36e5 : Infinity;
      // a failed run is retried after 30 minutes, a partial run is continued straight away
      if ((last?.status === "live" && ageH < SYNC_HOURS) || (last?.status === "failed" && ageH < 0.5)) return Response.json({ status: "skipped", note: `Last run was ${ageH.toFixed(1)} hours ago` });
    }
    const res = await runScout({ mode: "api", deadlineMs: 120_000 });
    if (res.status === "live" || res.status === "partial") {
      after(async () => {
        try { await suggestLinkedIn({ deadline: Date.now() + 150_000 }); } catch {}
      });
    }
    return Response.json(res);
  } catch (e) {
    return Response.json({ status: "failed", newLaunches: 0, refreshed: 0, note: "", error: "The run could not start." }, { status: 500 });
  }
}
