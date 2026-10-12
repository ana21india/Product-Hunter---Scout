import { q } from "../src/lib/db";
const one = await q(
  `SELECT l.name, l.votes_count v, l.topics, r.relevant, r.reason, m.maker_comment_count mc, left(l.description, 220) d
   FROM launches l JOIN relevance r USING(post_id) LEFT JOIN maker_comments m USING(post_id) WHERE l.name ILIKE 'IrisGo%'`,
);
for (const o of one) console.log(JSON.stringify(o));
const ind = await q(
  `SELECT count(*)::int n FROM relevance r JOIN launches l USING(post_id)
   WHERE NOT r.relevant AND l.created_at > now() - interval '7 days' AND r.reason ~* 'individual|solo|personal|freelanc|rather than team'`,
);
console.log("filtered out with an 'individual / solo / personal' reason:", ind[0].n);
const tm = await q(
  `SELECT count(*)::int n FROM relevance r JOIN launches l USING(post_id)
   WHERE NOT r.relevant AND l.created_at > now() - interval '7 days' AND 'task-management' = ANY(l.topics)`,
);
console.log("filtered out that carry the task-management topic:", tm[0].n);
const top = await q(
  `SELECT l.name, l.votes_count v, r.reason FROM relevance r JOIN launches l USING(post_id)
   WHERE NOT r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 12`,
);
for (const t of top) console.log(`${String(t.v).padStart(4)} votes | ${t.name} | ${t.reason}`);
