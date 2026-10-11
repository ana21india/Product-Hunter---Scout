import { q } from "../src/lib/db";
// Prepares the Gemini failure test: removes the angles of the 3 lowest-ranked relevant launches (saved first so they can be restored by a normal run).
const rows = await q(
  `SELECT l.post_id AS id, l.name FROM launches l JOIN relevance r USING(post_id) JOIN angles a USING(post_id)
   WHERE r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 3`,
);
await q(`DELETE FROM angles WHERE post_id = ANY($1::text[])`, [rows.map((r: any) => r.id)]);
console.log("angles removed for:", rows.map((r: any) => r.name).join(", "));
