import { q } from "../src/lib/db";
const rows = await q(
  `SELECT l.name, l.tagline, length(coalesce(l.description,'')) dl, left(coalesce(l.description,''), 160) d, a.one_liner
   FROM angles a JOIN launches l USING(post_id) JOIN relevance r USING(post_id)
   WHERE a.status='thin' AND r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 14`,
);
for (const r of rows) console.log(`${r.name} | tagline: ${r.tagline} | desc length ${r.dl}\n    ${r.d}\n    one-liner: ${r.one_liner}`);
const stats = await q(
  `SELECT a.status, count(*)::int n, round(avg(length(coalesce(l.description,''))))::int avg_desc
   FROM angles a JOIN launches l USING(post_id) JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days' GROUP BY 1`,
);
console.log(JSON.stringify(stats));
