import { q } from "../src/lib/db";
import * as PH from "../src/lib/ph";

PH.budget.mode = "wait";
const rows = await q(
  `SELECT l.post_id AS id, l.slug, l.name, l.votes_count v, l.comments_count c, l.last_refreshed, m.maker_comment_count mc, m.comments_total_seen seen, m.unattributed_count ua
   FROM launches l JOIN relevance r USING(post_id) LEFT JOIN maker_comments m USING(post_id)
   WHERE r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 12`,
);
const live = await PH.fetchCurrent(rows.map((r: any) => r.id));
const byId = new Map(live.map((l) => [l.id, l]));
console.log("now (UTC):", new Date().toISOString());
for (const r of rows) {
  const l = byId.get(r.id);
  console.log(
    `${r.name.padEnd(26)} stored: ${String(r.v).padStart(4)} votes, ${String(r.c).padStart(4)} comments | Product Hunt API now: ${String(l?.votesCount).padStart(4)} votes, ${String(l?.commentsCount).padStart(4)} comments | maker comments stored ${r.mc} (counted over ${r.seen}) | stored at ${r.last_refreshed.toISOString().slice(11, 19)}`,
  );
}
const run = await q(`SELECT id, status, started_at, finished_at FROM run_log ORDER BY id DESC LIMIT 3`);
for (const x of run) console.log("run", x.id, x.status, x.started_at.toISOString(), x.finished_at?.toISOString());
