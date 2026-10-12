import { q } from "../src/lib/db";
import { getDashboard } from "../src/lib/data";
import { scoreLaunches } from "../src/lib/scoring";

const d = await getDashboard(true);
const items = d.items;
console.log(`ranked now: ${items.length}`);
const bucket = (n: number) => (n === 0 ? "0" : n === 1 ? "1" : n <= 3 ? "2-3" : n <= 9 ? "4-9" : "10+");
const dist: Record<string, number> = {};
for (const i of items) dist[bucket(i.makerComments)] = (dist[bucket(i.makerComments)] ?? 0) + 1;
console.log("maker comments among ranked launches:", JSON.stringify(dist));
const votes = items.map((i) => i.votes).sort((a, b) => a - b);
const pct = (p: number) => votes[Math.min(votes.length - 1, Math.floor(votes.length * p))];
console.log(`upvotes: median ${pct(0.5)}, 75th ${pct(0.75)}, 90th ${pct(0.9)}, highest ${votes[votes.length - 1]}`);

console.log("\nCurrent top 15 and their maker activity:");
for (const i of items.slice(0, 15)) console.log(`  #${i.rank} ${i.name.padEnd(28)} ${String(i.votes).padStart(4)} upvotes, ${String(i.makerComments).padStart(2)} maker comments, ${i.daysSince}d | score ${i.finalScore.toFixed(1)}`);

for (const min of [1, 2, 3]) {
  const set = items.filter((i) => i.makerComments >= min);
  const rescored = scoreLaunches(set.map((i) => ({ postId: i.postId, votes: i.votes, makerComments: i.makerComments, createdAt: i.createdAt })));
  const byId = new Map(items.map((i) => [i.postId, i]));
  console.log(`\nIf makers must have written at least ${min} comment(s): ${set.length} launches stay eligible`);
  for (const r of rescored.slice(0, 15)) console.log(`  #${r.rank} ${byId.get(r.postId)!.name.padEnd(28)} ${String(r.votes).padStart(4)} upvotes, ${String(r.makerComments).padStart(2)} maker comments | score ${r.finalScore.toFixed(1)}`);
}

console.log("\nMost-upvoted launches that were filtered out (to check for wrongly excluded ones):");
const out = await q(
  `SELECT l.name, l.votes_count v, r.serves, left(r.reason, 120) reason FROM relevance r JOIN launches l USING(post_id)
   WHERE NOT r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 30`,
);
for (const o of out) console.log(`  ${String(o.v).padStart(4)} | ${o.name} | ${o.serves ?? "-"} | ${o.reason}`);
