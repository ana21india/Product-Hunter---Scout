import { q } from "../src/lib/db";
const names = ["Rill Browser", "OpenSwarm", "Cue", "Onepin", "IrisGo for Solopreneurs", "Web Search API", "GitGlow", "CodeCrab", "Velozity", "Fyka Retro", "Hirevire", "PPM Compass 360", "Coddy", "ParakeetAI 2.0"];
const rows = await q(`SELECT name, topics, votes_count v FROM launches WHERE name = ANY($1::text[]) AND created_at > now() - interval '7 days'`, [names]);
for (const n of names) {
  const r = rows.find((x: any) => x.name === n);
  console.log(`${n} | ${r?.v} upvotes | tags: ${r?.topics?.join(", ")}`);
}
