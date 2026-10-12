import { q } from "../src/lib/db";
const rows = await q(
  `SELECT l.name, l.votes_count v, l.site_status, length(coalesce(l.site_text,'')) sl, r.audience, r.serves, left(r.reason, 110) reason
   FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 14`,
);
for (const r of rows) console.log(`${r.name.padEnd(30)} ${String(r.v).padStart(4)} | audience ${r.audience} | site ${r.site_status}/${r.sl} chars | serves: ${r.serves}\n      ${r.reason}`);
const agg = await q(
  `SELECT r.audience, (length(coalesce(l.site_text,'')) >= 300) AS had_site, count(*)::int n
   FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days' GROUP BY 1,2 ORDER BY 1,2`,
);
console.log("relevant launches by audience and whether the website text was usable:", JSON.stringify(agg));
