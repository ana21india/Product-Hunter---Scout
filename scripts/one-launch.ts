import { q } from "../src/lib/db";
const name = process.argv[2];
const rows = await q(
  `SELECT l.name, l.votes_count v, l.topics, l.category, r.relevant, r.reason, l.tagline FROM launches l JOIN relevance r USING(post_id) WHERE l.name ILIKE $1`,
  [name + "%"],
);
for (const r of rows) console.log(JSON.stringify(r));
if (!rows.length) console.log("not found");
