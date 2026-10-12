import { q } from "../src/lib/db";
for (const n of process.argv.slice(2)) {
  const r = (await q(`SELECT name, tagline, description, url FROM launches WHERE name ILIKE $1 AND created_at > now() - interval '7 days' LIMIT 1`, [n + "%"]))[0];
  if (!r) { console.log(n, "not found"); continue; }
  console.log(`\n=== ${r.name} | ${String(r.url).split("?")[0]}\ntagline: ${r.tagline}\n${String(r.description).replace(/\s+/g, " ")}`);
}
