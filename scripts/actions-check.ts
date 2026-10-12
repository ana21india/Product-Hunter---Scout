import { q } from "../src/lib/db";
const rows = await q(`SELECT a.status, a.updated_at, l.name FROM actions a JOIN launches l USING(post_id) ORDER BY a.updated_at DESC`);
console.log("rows in the actions table:", rows.length);
for (const r of rows) console.log(`  ${r.name} | ${r.status} | ${r.updated_at.toISOString()}`);
