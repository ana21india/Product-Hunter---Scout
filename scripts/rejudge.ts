import fs from "node:fs";
import { q } from "../src/lib/db";
import { getDashboard } from "../src/lib/data";
import { judgeLaunches } from "../src/lib/relevance";

// Re-judges every launch in the 7-day window with the two-step rule, and records before/after so the change can be reviewed.
const out = process.argv[2];
const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`;

const beforeRows = await q(`SELECT l.post_id AS id, l.name, l.votes_count v, r.relevant FROM launches l JOIN relevance r USING(post_id) WHERE l.created_at > now() - interval '7 days'`);
const dash = await getDashboard();
const before = {
  relevant: beforeRows.filter((r: any) => r.relevant).map((r: any) => ({ id: r.id, name: r.name, v: r.v })),
  filtered: beforeRows.filter((r: any) => !r.relevant).length,
  top15: dash.items.slice(0, 15).map((i) => ({ rank: i.rank, name: i.name, score: Math.round(i.finalScore * 10) / 10 })),
};
console.log(stamp(), `before: ${before.relevant.length} relevant, ${before.filtered} filtered out`);

const res = await judgeLaunches({ all: true, log: (s) => console.log(stamp(), s) });
console.log(stamp(), "judged", JSON.stringify(res));

const afterRows = await q(`SELECT l.post_id AS id, l.name, l.votes_count v, r.relevant, r.audience, r.serves, r.reason FROM launches l JOIN relevance r USING(post_id) WHERE l.created_at > now() - interval '7 days'`);
const after = { relevant: afterRows.filter((r: any) => r.relevant), filtered: afterRows.filter((r: any) => !r.relevant).length };
const was = new Set(before.relevant.map((r: any) => r.id));
const now = new Set(after.relevant.map((r: any) => r.id));
const left = before.relevant.filter((r: any) => !now.has(r.id));
const joined = after.relevant.filter((r: any) => !was.has(r.id));
const summary = {
  before: { relevant: before.relevant.length, filtered: before.filtered, top15: before.top15 },
  after: { relevant: after.relevant.length, filtered: after.filtered },
  left: left.sort((a: any, b: any) => b.v - a.v).map((r: any) => ({ name: r.name, v: r.v })),
  joined: joined.sort((a: any, b: any) => b.v - a.v).map((r: any) => ({ name: r.name, v: r.v, serves: r.serves })),
};
fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(stamp(), `after: ${after.relevant.length} relevant, ${after.filtered} filtered out | left the ranking: ${left.length} | joined: ${joined.length}`);
