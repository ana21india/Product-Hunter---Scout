import { q } from "../../../lib/db";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["contacted", "replied", "skipped"]);

// Kavya records what she did with a launch ("contacted", "replied", "skipped"), or clears it with null.
// This only saves her own note. The app never sends anything to anyone.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const postId = String(body?.postId ?? "");
    const status = body?.status === null ? null : String(body?.status ?? "");
    if (!/^\d{1,20}$/.test(postId)) return Response.json({ error: "Bad launch id." }, { status: 400 });
    if (status !== null && !ALLOWED.has(status)) return Response.json({ error: "Bad status." }, { status: 400 });
    if (status === null) await q("DELETE FROM actions WHERE post_id = $1", [postId]);
    else
      await q(
        `INSERT INTO actions (post_id, status, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (post_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [postId, status],
      );
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save." }, { status: 500 });
  }
}
