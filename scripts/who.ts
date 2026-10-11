import { q } from "../src/lib/db";
const rows = await q(
  `SELECT l.post_id, l.name product, l.tagline, l.website, l.votes_count, l.created_at, l.makers
   FROM launches l WHERE l.makers::text ILIKE '%ishu%' OR l.makers::text ILIKE '%darshan%'`,
);
for (const r of rows) {
  const ms = (r.makers as any[]).map((m) => `${m.name} (${m.username})`).join(", ");
  console.log(`${r.product} | ${r.votes_count} votes | ${r.created_at.toISOString?.() ?? r.created_at} | makers: ${ms}`);
  const f = await q(`SELECT maker_name, url, evidence, checked_at FROM founder_links WHERE post_id=$1`, [r.post_id]);
  console.log("   saved LinkedIn lookups:", JSON.stringify(f));
  const rel = await q(`SELECT relevant, reason FROM relevance WHERE post_id=$1`, [r.post_id]);
  console.log("   relevance:", JSON.stringify(rel));
}
if (!rows.length) console.log("no launch with a maker named like that");
