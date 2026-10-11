import { after } from "next/server";
import { runScout } from "../../../lib/run";
import { suggestLinkedIn } from "../../../lib/linkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Run scout": always calls Product Hunt live. The answer goes back as soon as the numbers are ready.
// The slow LinkedIn suggestions run afterwards, so they never delay the click.
export async function POST() {
  try {
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
