import { q } from "../src/lib/db";
import { generateAngles } from "../src/lib/angles";

// Rewrites only the angles that came back as "angle unavailable", using the current prompt (Gemini only).
const del = await q(`DELETE FROM angles WHERE status='thin' RETURNING post_id`);
console.log("cleared thin angles:", del.length);
const failed = await generateAngles({ log: (s) => console.log(s) });
const s = await q(`SELECT a.status, count(*)::int n FROM angles a JOIN launches l USING(post_id) JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days' GROUP BY 1`);
console.log("now:", JSON.stringify(s), "failed:", failed);
const sample = await q(`SELECT l.name, a.angle FROM angles a JOIN launches l USING(post_id) WHERE l.name IN ('AUDR by Chargebee','Web Search API','Pine Computer','CodeCrab')`);
for (const r of sample) console.log(`${r.name}: ${r.angle}`);
