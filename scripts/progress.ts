import { q } from "../src/lib/db";
const done = (await q(`SELECT count(*)::int n FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days' AND l.makers::text LIKE '%"url"%'`))[0].n;
const total = (await q(`SELECT count(*)::int n FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days'`))[0].n;
console.log(`maker links backfilled: ${done} of ${total}`);
console.log("now:", new Date().toISOString());
