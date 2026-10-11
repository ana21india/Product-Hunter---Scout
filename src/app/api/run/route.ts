import { runScout } from "../../../lib/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Run scout": always calls Product Hunt live. Works in steps and reports "partial" if it has to stop early,
// so the page can ask again and the run continues where it left off.
export async function POST() {
  try {
    const res = await runScout({ mode: "api", deadlineMs: 240_000 });
    return Response.json(res);
  } catch (e) {
    return Response.json({ status: "failed", newLaunches: 0, refreshed: 0, note: "", error: "The run could not start." }, { status: 500 });
  }
}
