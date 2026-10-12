import fs from "node:fs";

const file = "src/lib/linkedin.ts";
let s = fs.readFileSync(file, "utf8");
function rep(from, to) {
  if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 90));
  s = s.replace(from, to);
}

rep('import { findLinkedIn } from "./gemini";', 'import { findLinkedIn } from "./gemini";\nimport { findLinkedInSerp, hasSerpKey } from "./serp";');

// With a search key, earlier "nothing found" answers from Gemini's own search are searched again once; results are marked "serp:".
rep(
  "const done = new Set((await q(`SELECT post_id || ':' || maker_id AS k FROM founder_links WHERE post_id = ANY($1::text[])`, [top])).map((r: any) => r.k));",
  "const useSerp = hasSerpKey();\n  const done = new Set((await q(\n    useSerp\n      ? `SELECT post_id || ':' || maker_id AS k FROM founder_links WHERE post_id = ANY($1::text[]) AND (url IS NOT NULL OR evidence LIKE 'serp:%')`\n      : `SELECT post_id || ':' || maker_id AS k FROM founder_links WHERE post_id = ANY($1::text[])`,\n    [top],\n  )).map((r: any) => r.k));",
);
// at most 30 searches per run so the monthly allowance of the search service is not used up by one click
rep("  log(`LinkedIn search: ${jobs.length} founders`);", "  if (useSerp && jobs.length > 30) jobs.length = 30;\n  log(`LinkedIn search (${useSerp ? \"search service\" : \"Gemini\"}): ${jobs.length} founders`);");
rep(
  "        const r = await findLinkedIn(j);\n        await q(\n          `INSERT INTO founder_links (post_id, maker_id, maker_name, url, evidence) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (post_id, maker_id) DO NOTHING`,",
  "        const r = useSerp ? await findLinkedInSerp(j) : await findLinkedIn(j);\n        await q(\n          `INSERT INTO founder_links (post_id, maker_id, maker_name, url, evidence) VALUES ($1,$2,$3,$4,$5)\n           ON CONFLICT (post_id, maker_id) DO ${useSerp ? \"UPDATE SET url = EXCLUDED.url, evidence = EXCLUDED.evidence, checked_at = now()\" : \"NOTHING\"}`,",
);
fs.writeFileSync(file, s, "utf8");
console.log("linkedin.ts patched");
