import { q } from "../src/lib/db";
import * as PH from "../src/lib/ph";

PH.budget.mode = "stop";
const rows = await q(`SELECT l.post_id AS id FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days'`);
const ids = rows.map((r: any) => r.id as string);
console.log("relevant launches:", ids.length);
for (const n of [ids.length]) {
  const t0 = Date.now();
  try {
    const cur = await PH.fetchCurrent(ids.slice(0, n));
    console.log(`${n} launches in ONE request: ok, ${cur.length} returned, ${((Date.now() - t0) / 1000).toFixed(1)}s, allowance left ${PH.budget.remaining}`);
  } catch (e: any) {
    console.log(`${n} launches in one request: FAILED ${String(e.message).slice(0, 140)}`);
  }
}
